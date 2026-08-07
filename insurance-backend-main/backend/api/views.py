from io import BytesIO
import json
import re
import time
import uuid
import openai
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.core.cache import cache
from google import genai
from google.genai import types
from google.genai import errors as genai_errors
import os
from dotenv import load_dotenv
import httpx
import logging
import fitz  # PyMuPDF
from openai import APIError, BadRequestError, OpenAI
from django.http import JsonResponse
from django.conf import settings
from django.db.models import Q
from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .models import FamilySubProfile, PolicyDocument, PolicyShare, FamilySubProfileManager
from .serializers import (
    FamilySubProfileSerializer,
    PolicyDocumentSerializer,
    PolicyShareSerializer,
    FamilySubProfileManagerSerializer,
)
from .policy_extraction import (
    build_clause_index_text,
    extract_and_minimize_pdf,
    normalize_policy_type,
    run_structured_policy_extraction,
)

try:
    from jose import jwt, JWTError
except Exception:  # pragma: no cover - import guard for missing dependency
    jwt = None
    JWTError = Exception

# Configuration — always load backend/.env (folder that contains manage.py)
load_dotenv(settings.BASE_DIR / ".env")
gemini_api_key = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None


def _get_openai_api_key() -> str | None:
    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    return key or None
VECTOR_STORE_ID = "vs_680cb595b71c8191b25b7aa72d49ce5c"
THREAD_ID = "thread_feAuVoWDJCTzyfTrbXh6qUNJ"
# deepseek_client = DeepSeekAPI(api_key=os.getenv("DEEPSEEK_API_KEY"))

# Set up logging
logger = logging.getLogger(__name__)
_VECTOR_COLLECTION = "family_policy_docs"

PERSONAL_DETAILS_DEFAULT = {
    "income": 0,
    "familyMembers": [],
    "medicalRecord": [],
    "address": "",
    "phoneNumber": "",
    "email": "",
    "occupation": "",
    "emergencyContact": "",
}

def _require_gemini_client():
    if not gemini_client:
        return None, Response(
            {"error": "GEMINI_API_KEY is not set. Add it to backend/.env and restart runserver."},
            status=503,
        )
    return gemini_client, None


# ── JWKS cache (ES256/RS256 public keys fetched from Supabase) ────────────────
_jwks_cache: dict = {}   # kid → JWK dict
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600.0       # re-fetch at most once per hour


def _get_supabase_jwks_key(kid: str) -> dict | None:
    """
    Return the JWK dict for `kid`, fetching/refreshing the JWKS endpoint when needed.
    Cached in-process for _JWKS_TTL seconds.
    """
    global _jwks_fetched_at
    now = time.time()

    # Return cached key if still fresh
    if kid in _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache[kid]

    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    if not supabase_url:
        logger.error("SUPABASE_URL not set — cannot fetch JWKS")
        return None

    try:
        import httpx as _httpx
        resp = _httpx.get(
            f"{supabase_url}/auth/v1/.well-known/jwks.json",
            timeout=5,
        )
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _jwks_fetched_at = now
        _jwks_cache.clear()
        for k in keys:
            if k.get("kid"):
                _jwks_cache[k["kid"]] = k
        logger.info("JWKS refreshed — %d key(s) cached", len(_jwks_cache))
    except Exception as exc:
        logger.warning("Failed to fetch Supabase JWKS: %s", exc)

    return _jwks_cache.get(kid)


def _get_supabase_user_id(request):
    """
    Validate a Supabase bearer token and return the user UUID string.

    Supabase projects created after ~2024 use ES256 (asymmetric ECDSA).
    Older projects used HS256 with the shared JWT secret.
    This function handles both automatically by inspecting the token header.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, Response({"error": "Missing bearer token"}, status=401)

    token = auth_header.replace("Bearer ", "", 1).strip()

    if not jwt:
        return None, Response(
            {"error": "python-jose is not installed. Run: pip install python-jose"},
            status=500,
        )

    # Inspect the token header to determine algorithm
    try:
        header = jwt.get_unverified_header(token)
    except Exception:
        return None, Response({"error": "Malformed JWT token"}, status=401)

    alg = header.get("alg", "HS256")
    kid = header.get("kid")
    decode_opts = {"verify_aud": False}

    # ── ES256 / RS256 (asymmetric) — verify with JWKS public key ─────────────
    if alg in ("ES256", "ES384", "ES512", "RS256", "RS384", "RS512"):
        if not kid:
            return None, Response({"error": "Token missing 'kid' — cannot look up JWKS key"}, status=401)

        jwk_key = _get_supabase_jwks_key(kid)
        if not jwk_key:
            return None, Response(
                {"error": f"JWKS key '{kid}' not found. Check SUPABASE_URL in .env."},
                status=500,
            )
        try:
            payload = jwt.decode(token, jwk_key, algorithms=[alg], options=decode_opts)
            user_id = payload.get("sub")
            if not user_id:
                return None, Response({"error": "Token payload missing 'sub'"}, status=401)
            return user_id, None
        except JWTError as exc:
            logger.warning("JWT %s decode failed: %s", alg, exc)
            return None, Response({"error": "Invalid or expired token"}, status=401)

    # ── HS256 (symmetric) — verify with shared secret ─────────────────────────
    raw_secret = (os.getenv("SUPABASE_JWT_SECRET") or "").strip().strip('"').strip("'")
    if not raw_secret:
        return None, Response(
            {"error": "SUPABASE_JWT_SECRET not set in backend/.env"},
            status=500,
        )
    try:
        payload = jwt.decode(token, raw_secret, algorithms=["HS256"], options=decode_opts)
        user_id = payload.get("sub")
        if not user_id:
            return None, Response({"error": "Token payload missing 'sub'"}, status=401)
        return user_id, None
    except JWTError as exc:
        logger.warning("JWT HS256 decode failed: %s", exc)
        return None, Response({"error": "Invalid or expired token"}, status=401)


def _has_subprofile_manage_access(user_id, sub_profile):
    return FamilySubProfileManager.objects.filter(
        sub_profile=sub_profile,
        manager_supabase_uid=user_id,
        permission="manage",
    ).exists()


def _can_manage_subprofile(user_id, sub_profile):
    if str(sub_profile.owner_supabase_uid) == str(user_id):
        return True
    if _has_subprofile_manage_access(user_id, sub_profile):
        return True
    # Backward-compatible fallback: existing policy-level manage share.
    return PolicyShare.objects.filter(
        policy__sub_profile=sub_profile,
        shared_with_supabase_uid=user_id,
        permission="manage",
    ).exists()


def _uploaded_policies_path():
    return Path(settings.BASE_DIR) / "uploaded_policies.json"


# ─────────────────────────────────────────────────────────────────────────────
# Supabase pgvector RAG pipeline
#   Embeddings  : all-MiniLM-L6-v2  via HuggingFace Inference API  (384-dim)
#   Vector store: Supabase PostgreSQL pgvector
#   Generation  : Llama 3 via HuggingFace Inference API
# ─────────────────────────────────────────────────────────────────────────────
_pg_vector_table_ready = False

def _pg_conn():
    """Return a psycopg connection to Supabase PostgreSQL."""
    import psycopg
    db_url = (os.getenv("DATABASE_URL") or "").strip()
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in .env")
    return psycopg.connect(db_url, sslmode="require")

def _ensure_pg_vector_table():
    """Create policy_vectors table and an HNSW index (works with small datasets)."""
    global _pg_vector_table_ready
    if _pg_vector_table_ready:
        return
    try:
        with _pg_conn() as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS policy_vectors (
                    id BIGSERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding vector(384),
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            # IVFFlat returns empty results until enough rows exist; replace with HNSW.
            conn.execute("DROP INDEX IF EXISTS policy_vectors_emb_idx")
            conn.execute("""
                CREATE INDEX IF NOT EXISTS policy_vectors_emb_hnsw_idx
                ON policy_vectors USING hnsw (embedding vector_cosine_ops)
            """)
            conn.commit()
        _pg_vector_table_ready = True
    except Exception as exc:
        logger.warning("pgvector table setup skipped: %s", exc)

def _hf_embed(texts: list) -> list:
    """
    Embed a list of strings with all-MiniLM-L6-v2 via HF Inference API.
    Returns list of 384-dim float lists.
    """
    from huggingface_hub import InferenceClient
    token = (os.getenv("HF_API_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("HF_API_TOKEN is not set in .env")
    client = InferenceClient(token=token)
    result = client.feature_extraction(
        texts,
        model="sentence-transformers/all-MiniLM-L6-v2",
    )
    # result is a numpy array (n_texts × 384) or list of lists
    import numpy as np
    arr = np.array(result)
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    return arr.tolist()

def _vec_literal(vec: list) -> str:
    """Convert a float list to a Postgres vector literal string."""
    return "[" + ",".join(f"{v:.8f}" for v in vec) + "]"



def _index_policy_text(text: str, metadata: dict) -> dict:
    """
    Chunk policy text and upsert embeddings into Supabase pgvector.
    Replaces prior chunks for the same filename to avoid duplicates.
    """
    result = {"indexed": False, "chunks": 0, "error": None}
    if not text.strip():
        result["error"] = "No text to index"
        return result

    try:
        _ensure_pg_vector_table()
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        chunks = splitter.split_text(text)
        if not chunks:
            result["error"] = "Text splitter produced no chunks"
            return result

        embeddings = _hf_embed(chunks)
        filename = (metadata.get("filename") or "").strip()
        with _pg_conn() as conn:
            if filename:
                conn.execute(
                    "DELETE FROM policy_vectors WHERE metadata->>'filename' = %s",
                    (filename,),
                )
            for chunk, emb in zip(chunks, embeddings):
                conn.execute(
                    """INSERT INTO policy_vectors (content, embedding, metadata)
                       VALUES (%s, %s::vector, %s::jsonb)""",
                    (chunk, _vec_literal(emb), json.dumps(metadata)),
                )
            conn.commit()
        result["indexed"] = True
        result["chunks"] = len(chunks)
        return result
    except Exception as exc:
        logger.exception("pgvector indexing failed: %s", exc)
        result["error"] = str(exc)
        return result


def _index_policy_for_rag(
    *,
    raw_text: str,
    extracted: dict | None,
    metadata: dict,
) -> dict:
    """
    Index structured clause summary and raw policy text for emergency RAG.
    Clause chunks use chunk_type=clause_summary; raw PDF text uses policy_text.
    """
    result = {"indexed": False, "chunks": 0, "clause_chunks": 0, "raw_chunks": 0, "error": None}
    base_meta = {**metadata, "source": metadata.get("source", "policy_upload")}
    clause_text = build_clause_index_text(extracted)
    texts_to_index: list[tuple[str, dict]] = []

    if clause_text.strip():
        texts_to_index.append((clause_text, {**base_meta, "chunk_type": "clause_summary"}))
    if raw_text.strip():
        splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        for chunk in splitter.split_text(raw_text):
            texts_to_index.append((chunk, {**base_meta, "chunk_type": "policy_text"}))

    if not texts_to_index:
        result["error"] = "No policy text or clauses to index"
        return result

    try:
        _ensure_pg_vector_table()
        contents = [t[0] for t in texts_to_index]
        embeddings = _hf_embed(contents)
        filename = (base_meta.get("filename") or "").strip()

        with _pg_conn() as conn:
            if filename:
                conn.execute(
                    "DELETE FROM policy_vectors WHERE metadata->>'filename' = %s",
                    (filename,),
                )
            for (chunk, chunk_meta), emb in zip(texts_to_index, embeddings):
                conn.execute(
                    """INSERT INTO policy_vectors (content, embedding, metadata)
                       VALUES (%s, %s::vector, %s::jsonb)""",
                    (chunk, _vec_literal(emb), json.dumps(chunk_meta)),
                )
                if chunk_meta.get("chunk_type") == "clause_summary":
                    result["clause_chunks"] += 1
                else:
                    result["raw_chunks"] += 1
            conn.commit()

        result["chunks"] = len(texts_to_index)
        result["indexed"] = True
        return result
    except Exception as exc:
        logger.exception("policy RAG indexing failed: %s", exc)
        result["error"] = str(exc)
        return result

def _retrieve_policy_chunks(query: str, policy_owner: str = "", k: int = 4) -> list:
    """
    Retrieve top-k policy chunks from Supabase pgvector most similar to query.
    Optionally filter by policy_owner metadata field.
    Returns list of (content, metadata) tuples.
    """
    _ensure_pg_vector_table()
    emb = _hf_embed([query])[0]
    vec = _vec_literal(emb)
    try:
        with _pg_conn() as conn:
            if policy_owner:
                rows = conn.execute(
                    """SELECT content, metadata
                       FROM policy_vectors
                       WHERE metadata->>'policy_owner' ILIKE %s
                       ORDER BY embedding <=> %s::vector
                       LIMIT %s""",
                    (f"%{policy_owner}%", vec, k),
                ).fetchall()
            else:
                rows = conn.execute(
                    """SELECT content, metadata
                       FROM policy_vectors
                       ORDER BY embedding <=> %s::vector
                       LIMIT %s""",
                    (vec, k),
                ).fetchall()
        return rows
    except Exception as exc:
        logger.exception("pgvector retrieval failed: %s", exc)
        return []

def _llama_generate(system_prompt: str, user_prompt: str) -> str:
    """Generate a response using Llama via HuggingFace Inference API."""
    from huggingface_hub import InferenceClient
    token = (os.getenv("HF_API_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("HF_API_TOKEN is not set in .env")
    model = os.getenv("HF_LLAMA_MODEL", "meta-llama/Meta-Llama-3-8B-Instruct")
    client = InferenceClient(model=model, token=token)
    result = client.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=600,
        temperature=0.2,
    )
    return (result.choices[0].message.content or "").strip()
    
def _read_uploaded_policies():
    path = _uploaded_policies_path()
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
    except (json.JSONDecodeError, OSError):
        pass
    return []


def _append_uploaded_policy(entry: dict) -> None:
    path = _uploaded_policies_path()
    existing = _read_uploaded_policies()
    existing.append(entry)
    with path.open("w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=True, indent=2)


def extract_and_minimize_pdf(uploaded_file, max_pages=10, max_chars=25000):
    """
    Extract text from the first pages of PDF and trim to a safe character budget.
    This reduces token usage for large policy documents.
    """
    uploaded_file.seek(0)
    pdf_bytes = uploaded_file.read()
    if not pdf_bytes:
        return ""

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages_to_read = min(max_pages, doc.page_count)
    chunks = []
    for i in range(pages_to_read):
        page = doc.load_page(i)
        page_text = page.get_text("text") or ""
        if page_text:
            chunks.append(page_text)
    doc.close()
    minimized_text = "\n".join(chunks).strip()
    return minimized_text[:max_chars]


def _personal_details_path():
    return Path(settings.BASE_DIR) / "personal_details.json"


def _read_personal_details():
    path = _personal_details_path()
    if not path.exists():
        return PERSONAL_DETAILS_DEFAULT.copy()

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                merged = PERSONAL_DETAILS_DEFAULT.copy()
                merged.update(data)
                return merged
    except (json.JSONDecodeError, OSError):
        pass

    return PERSONAL_DETAILS_DEFAULT.copy()


def _write_personal_details(data):
    path = _personal_details_path()
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=True, indent=2)

# # ======== Gemini Endpoints ========
# @api_view(['POST'])
# @parser_classes([MultiPartParser])
# def analyze_doc(request):
#     """
#     Process PDFs with Gemini
#     """
#     pdf_file = request.FILES.get('file')
#     pdf_url = request.data.get('url')
#     prompt = request.data.get('prompt', 'Summarize this document')

#     if not (pdf_file or pdf_url):
#         return Response({'error': 'Either file or URL is required'}, status=400)

#     try:
#         # Handle file/URL logic
#         if pdf_file:
#             pdf_data = pdf_file.read()
#         elif pdf_url:
#             response = httpx.get(pdf_url)
#             pdf_data = response.content

#         if pdf_data[:4] != b'%PDF':
#             return Response({'error': 'Invalid PDF content'}, status=400)

#         # Process with Gemini
#         result = gemini_client.models.generate_content(
#             model="gemini-1.5-flash",
#             contents=[
#                 types.Part.from_bytes(data=pdf_data, mime_type='application/pdf'),
#                 prompt
#             ]
#         )

#         return Response({
#             'response': result.text,
#             'source': 'upload' if pdf_file else 'url'
#         })

#     except Exception as e:
#         logger.error(f"Gemini processing error: {str(e)}")
#         return Response({'error': str(e)}, status=500)

# @api_view(['POST'])
# def gemini_chat(request):
#     """
#     Handle Gemini conversations
#     """
#     user_message = request.data.get('message', '').strip()
#     session_id = request.data.get('session_id', 'default')
#     reset_conversation = request.data.get('reset', False)

#     if not user_message:
#         return Response({'error': 'Message cannot be empty'}, status=400)

#     try:
#         cache_key = f"gemini_chat_{session_id}"
#         history = [] if reset_conversation else cache.get(cache_key, [])

#         # Gemini chat session
#         chat_session = gemini_client.chats.create(model="gemini-2.0-flash")
        
#         # Replay history
#         for msg in history:
#             if msg['role'] == 'user':
#                 chat_session.send_message(msg['content'])

#         # Get response
#         response = chat_session.send_message(user_message)
#         assistant_reply = response.text
        
#         # Update history
#         updated_history = history + [
#             {'role': 'user', 'content': user_message},
#             {'role': 'model', 'content': assistant_reply}
#         ]
#         cache.set(cache_key, updated_history, 86400)

#         return Response({
#             'response': assistant_reply,
#             'session_id': session_id,
#             'history': updated_history[-10:]
#         })

#     except Exception as e:
#         logger.error(f"Gemini chat error: {str(e)}")
#         return Response({'error': 'Processing failed'}, status=500)

# # ======== DeepSeek Endpoint ========
# @api_view(['POST'])
# def deepseek_chat(request):
#     """
#     Handle DeepSeek conversations
#     """
#     user_message = request.data.get('message', '').strip()
#     session_id = request.data.get('session_id', 'default')
#     reset_conversation = request.data.get('reset', False)

#     if not user_message:
#         return Response({'error': 'Message cannot be empty'}, status=400)

#     try:
#         cache_key = f"deepseek_chat_{session_id}"
#         history = [] if reset_conversation else cache.get(cache_key, [])

#         # Format messages
#         messages = [{"role": "user" if i%2==0 else "assistant", "content": msg['content']} 
#                    for i, msg in enumerate(history)]
#         messages.append({"role": "user", "content": user_message})

#         # DeepSeek API call
#         response = deepseek_client.chat.create(
#             model="deepseek-chat",
#             messages=messages,
#             temperature=0.7
#         )

#         assistant_reply = response.choices[0].message.content
        
#         updated_history = history + [
#             {'role': 'user', 'content': user_message},
#             {'role': 'assistant', 'content': assistant_reply}
#         ]
#         cache.set(cache_key, updated_history, 86400)

#         return Response({
#             'response': assistant_reply,
#             'session_id': session_id,
#             'history': updated_history[-10:]
#         })

#     except Exception as e:
#         logger.error(f"DeepSeek error: {str(e)}")
#         return Response({'error': 'Processing failed'}, status=500)

# ======== OpenAI Endpoint ========
@api_view(['POST'])
def openai_assistant_chat(request):
    """
    Handle conversations using OpenAI Assistants API
    """
    # Kept endpoint name for frontend compatibility; uses Gemini if configured.
    user_message = request.data.get("message", "").strip()
    session_id = request.data.get("session_id", "default")
    reset_conversation = request.data.get("reset", False)

    if not user_message:
        return Response({'error': 'Message cannot be empty'}, status=400)

    try:
        client, err = _require_gemini_client()
        if err:
            return err

        prompt = (
            "You are an intelligent insurance assistant. Be concise and practical.\n\n"
            f"User: {user_message}\n"
        )
        result = client.models.generate_content(
            model=os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash"),
            contents=[prompt],
        )
        text = getattr(result, "text", None) or ""

        history = [{"role": "user", "content": user_message}, {"role": "assistant", "content": text}]
        return Response(
            {
                "response": text,
                "session_id": session_id,
                "thread_id": "gemini",
                "history": history[-10:],
                "reset_ack": bool(reset_conversation),
            }
        )
    except Exception as e:
        logger.error(f"Unexpected chat error: {str(e)}", exc_info=True)
        return Response({'error': 'Processing failed'}, status=500)


# @api_view(['POST'])
# @parser_classes([MultiPartParser])
# def analyze_with_assistant(request):
#     """
#     Process PDFs and query using OpenAI Assistant with file upload
#     """
#     # Get inputs from request
#     pdf_file = request.FILES.get('file')
#     pdf_url = request.data.get('url')
#     user_query = request.data.get('query', 'Analyze this document')
#     session_id = request.data.get('session_id', 'default')

#     if not (pdf_file or pdf_url):
#         return Response({'error': 'Either file or URL is required'}, status=400)

#     try:
#         # Initialize OpenAI client
#         client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
#         assistant_id = os.getenv("OPENAI_ASSISTANT_ID")

#         # Get PDF content
#         if pdf_file:
#             pdf_data = pdf_file.read()
#             filename = pdf_file.name
#         elif pdf_url:
#             response = httpx.get(pdf_url)
#             pdf_data = response.content
#             filename = pdf_url.split('/')[-1] or "uploaded_file.pdf"

#         # Validate PDF
#         if pdf_data[:4] != b'%PDF':
#             return Response({'error': 'Invalid PDF content'}, status=400)

#         # Upload PDF to OpenAI (using tuple format for filename)
#         file = client.files.create(
#             file=(filename, BytesIO(pdf_data)),
#             purpose='assistants'
#         )

#         # Create thread with the uploaded file (using attachments format)
#         thread = client.beta.threads.create(
#             messages=[
#                 {
#                     "role": "user",
#                     "content": user_query,
#                     "attachments": [
#                         {
#                             "file_id": file.id,
#                             "tools": [{"type": "file_search"}]
#                         }
#                     ]
#                 }
#             ]
#         )

#         # Create and poll run with timeout
#         run = client.beta.threads.runs.create(
#             thread_id=thread.id,
#             assistant_id=assistant_id
#         )

#         start_time = time.time()
#         while run.status in ['queued', 'in_progress']:
#             if time.time() - start_time > 60:  # 1 minute timeout
#                 return Response({'error': 'Processing timeout'}, status=504)
#             time.sleep(2)
#             run = client.beta.threads.runs.retrieve(
#                 thread_id=thread.id,
#                 run_id=run.id
#             )

#         # Handle failed runs
#         if run.status != 'completed':
#             error_msg = f"Processing failed: {run.status}"
#             if run.last_error:
#                 error_msg += f" - {run.last_error.message}"
#             return Response({'error': error_msg}, status=500)

#         # Get response messages
#         messages = client.beta.threads.messages.list(
#             thread_id=thread.id,
#             order="desc",
#             limit=1
#         )

#         # Format response
#         response_content = ""
#         for message in messages.data:
#             for content in message.content:
#                 if content.type == "text":
#                     response_content = content.text.value
#                     break

#         # Clean up (optional)
#         try:
#             client.files.delete(file.id)
#         except:
#             pass  # Silently fail if deletion fails

#         return Response({
#             'response': response_content,
#             'file_id': file.id,
#             'thread_id': thread.id,
#             'assistant_id': assistant_id
#         })

#     except APIError as e:
#         return Response({
#             'error': 'OpenAI API error',
#             'details': str(e),
#             'api_response': getattr(e, 'response', None)
#         }, status=503)
#     except Exception as e:
#         return Response({
#             'error': 'Processing failed',
#             'details': str(e)
#         }, status=500)

# @api_view(['POST'])
# @parser_classes([MultiPartParser])
# def analyze_with_assistant(request):
#     """
#     Process PDFs and query using OpenAI Assistant with file upload
#     Returns structured insurance information
#     """
#     # Get inputs from request
#     pdf_file = request.FILES.get('file')
#     pdf_url = request.data.get('url')
#     user_query = request.data.get('query', 
#         """Extract and return the following insurance information in JSON format:
#         - Insurance Type
#         - Insurance Provider
#         - Policy Number
#         - Coverage Benefits
#         - Expired Date
#         - Cost
#         - Important Details
#         Return ONLY this structured information, no additional commentary.""")
#     session_id = request.data.get('session_id', 'default')

#     if not (pdf_file or pdf_url):
#         return Response({'error': 'Either file or URL is required'}, status=400)

#     try:
#         # Initialize OpenAI client
#         client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
#         assistant_id = os.getenv("OPENAI_ASSISTANT_ID")
        
#         if not assistant_id:
#             return Response({'error': 'Assistant ID not configured'}, status=500)

#         # Get PDF content
#         if pdf_file:
#             pdf_data = pdf_file.read()
#             filename = pdf_file.name
#         elif pdf_url:
#             response = httpx.get(pdf_url)
#             pdf_data = response.content
#             filename = pdf_url.split('/')[-1] or "uploaded_file.pdf"

#         # Validate PDF
#         if pdf_data[:4] != b'%PDF':
#             return Response({'error': 'Invalid PDF content'}, status=400)

#         # Step 1: Upload PDF to OpenAI
#         file = client.files.create(
#             file=(filename, BytesIO(pdf_data)),
#             purpose='assistants'
#         )

#         # Step 2: Create thread with the uploaded file
#         thread = client.beta.threads.create(
#             messages=[
#                 {
#                     "role": "user",
#                     "content": user_query,
#                     "attachments": [
#                         {
#                             "file_id": file.id,
#                             "tools": [{"type": "file_search"}]
#                         }
#                     ]
#                 }
#             ]
#         )

#         # Step 3: Create and poll run
#         run = client.beta.threads.runs.create(
#             thread_id=thread.id,
#             assistant_id=assistant_id,
#             tools=[{"type": "file_search"}]
#         )

#         # Polling with timeout
#         start_time = time.time()
#         while run.status in ['queued', 'in_progress']:
#             if time.time() - start_time > 120:  # 2 minute timeout
#                 return Response({'error': 'Processing timeout'}, status=504)
#             time.sleep(2)
#             run = client.beta.threads.runs.retrieve(
#                 thread_id=thread.id,
#                 run_id=run.id
#             )

#         # Handle failed runs
#         if run.status != 'completed':
#             error_msg = f"Processing failed: {run.status}"
#             if run.last_error:
#                 error_msg += f" - {run.last_error.message}"
#             return Response({'error': error_msg}, status=500)

#         # Get response
#         messages = client.beta.threads.messages.list(
#             thread_id=thread.id,
#             order="desc",
#             limit=1
#         )

#         # Extract and parse the structured response
#         structured_response = {}
#         for message in messages.data:
#             for content in message.content:
#                 if content.type == "text":
#                     try:
#                         # Try to parse as JSON if the assistant returns JSON
#                         structured_response = json.loads(content.text.value)
#                     except json.JSONDecodeError:
#                         # If not JSON, try to extract fields from text
#                         text = content.text.value
#                         structured_response = {
#                             'Insurance Type': extract_field(text, 'Insurance Type'),
#                             'Insurance Provider': extract_field(text, 'Insurance Provider'),
#                             'Policy Number': extract_field(text, 'Policy Number'),
#                             'Coverage Benefits': extract_field(text, 'Coverage Benefits'),
#                             'Expired Date': extract_field(text, 'Expired Date'),
#                             'Cost': extract_field(text, 'Cost'),
#                             'Important Details': extract_field(text, 'Important Details')
#                         }
#                     break

#         return Response({
#             'response': structured_response,
#             'file_id': file.id,
#             'thread_id': thread.id,
#             'assistant_id': assistant_id
#         })

#     except APIError as e:
#         return Response({
#             'error': 'OpenAI API error',
#             'details': str(e),
#             'api_response': getattr(e, 'response', None)
#         }, status=503)
#     except Exception as e:
#         return Response({
#             'error': 'Processing failed',
#             'details': str(e)
#         }, status=500)

# def extract_field(text, field_name):
#     """Helper function to extract field from text if not in JSON format"""
#     # Look for patterns like "Field Name: value"
#     pattern = rf"{field_name}[:\\s]+([^\n]+)"
#     match = re.search(pattern, text, re.IGNORECASE)
#     return match.group(1).strip() if match else "Not found"

@api_view(['POST'])
@parser_classes([MultiPartParser])
def analyze_with_assistant(request):
    """
    Process policy PDFs with structured, policy-type-aware clause extraction.
    Returns metadata plus per-clause findings with page references and confidence.
    """
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response(
            {"error": 'Missing file upload. Use form field name "file".'},
            status=400,
        )

    client, err = _require_gemini_client()
    if err:
        return err

    policy_type_hint = request.data.get("policy_type") or request.data.get("insurance_type")
    extraction = run_structured_policy_extraction(
        client,
        uploaded_file,
        policy_type_hint=policy_type_hint,
    )

    if extraction.get("error") and not extraction.get("extracted"):
        status = 429 if extraction.get("code") == "gemini_quota_exceeded" else 400
        body: dict = {"error": extraction["error"]}
        if extraction.get("code"):
            body["code"] = extraction["code"]
        if extraction.get("retry_after_sec") is not None:
            body["retry_after_sec"] = extraction["retry_after_sec"]
        if extraction.get("models_tried"):
            body["models_tried"] = extraction["models_tried"]
        return Response(body, status=status)

    extracted = extraction.get("extracted") or {}
    rag_text = extract_and_minimize_pdf(uploaded_file)

    rag_meta = {
        "filename": uploaded_file.name,
        "policy_owner": request.data.get("policy_owner", "family-member"),
        "policy_type": extracted.get("detected_policy_type")
        or normalize_policy_type(policy_type_hint)
        or "unknown",
        "source": "policies_page",
    }
    rag_result = _index_policy_for_rag(
        raw_text=rag_text,
        extracted=extracted,
        metadata=rag_meta,
    )

    try:
        _append_uploaded_policy(
            {
                "filename": uploaded_file.name,
                "content_type": uploaded_file.content_type,
                "extracted": extracted,
                "extraction_meta": extraction.get("extraction_meta"),
                "rag_indexed": rag_result.get("indexed", False),
                "rag_chunks": rag_result.get("chunks", 0),
                "stored_at": time.time(),
            }
        )
    except Exception:
        logger.exception("Failed to persist extracted policy")

    return JsonResponse(
        {
            "response": extracted,
            "raw_response": extraction.get("raw_response", ""),
            "extraction_meta": extraction.get("extraction_meta"),
            "rag_indexed": rag_result.get("indexed", False),
            "rag_chunks": rag_result.get("chunks", 0),
            "rag_error": rag_result.get("error"),
        }
    )


@api_view(["POST"])
def emergency_rag_chat(request):
    """
    Emergency RAG chatbot (Supabase pgvector + Llama via HF Inference API):
    1) Embed the query with all-MiniLM-L6-v2 via HF API
    2) Retrieve top-k policy chunks from Supabase pgvector
    3) Generate a grounded emergency response via Llama 3
    """
    user_message = (request.data.get("message") or "").strip()
    policy_owner = (request.data.get("policy_owner") or "").strip().lower()

    if not user_message:
        return Response({"error": "message is required"}, status=400)

    try:
        rows = _retrieve_policy_chunks(user_message, policy_owner=policy_owner, k=4)

        if not rows:
            return Response(
                {
                    "response": (
                        "No indexed policy documents found. "
                        "Please upload policy PDFs in the Policies page first so they can be indexed."
                    ),
                    "sources": [],
                }
            )

        context_blocks = []
        sources = []
        for i, (content, meta) in enumerate(rows, start=1):
            if isinstance(meta, str):
                import json as _json
                try:
                    meta = _json.loads(meta)
                except Exception:
                    meta = {}
            filename = (meta or {}).get("filename", "policy")
            owner = (meta or {}).get("policy_owner", "")
            chunk_type = (meta or {}).get("chunk_type", "policy_text")
            type_label = "extracted clauses" if chunk_type == "clause_summary" else "policy text"
            context_blocks.append(f"[Source {i}: {filename} ({type_label})]\n{content}")
            sources.append({
                "filename": filename,
                "policy_owner": owner,
                "chunk_type": chunk_type,
            })

        context_text = "\n\n".join(context_blocks)

        system_prompt = (
            "You are an emergency insurance assistant. "
            "Use ONLY the policy context provided. "
            "If a required detail is missing, state what document is needed. "
            "Give concise, practical, step-by-step claim actions."
        )

        user_prompt = (
            f"Emergency message: {user_message}\n\n"
            f"Policy context:\n{context_text}"
        )
        answer = _llama_generate(system_prompt, user_prompt)
        return Response({"response": answer, "sources": sources})
    except RuntimeError as e:
        return Response({"error": str(e)}, status=503)    
    except Exception as e:
        logger.exception("emergency_rag_chat failed")
        return Response({"error": str(e)}, status=500)


    
def extract_all_information(messages):
    """Comprehensive extraction of all possible information from response"""
    default_response = {
        'Insurance Type': "Not found",
        'Insurance Provider': "Not found",
        'Policy Number': "Not found",
        'Coverage Benefits': [],
        'Expired Date': "Not found",
        'Cost': "Not found",
        'Important Details': []
    }

    for message in messages.data:
        for content in message.content:
            if content.type == "text":
                response_text = content.text.value
                
                # First try to parse as JSON
                try:
                    data = json.loads(response_text)
                    if isinstance(data, dict):
                        return validate_extracted_data(data)
                except json.JSONDecodeError:
                    pass
                
                # Fallback to advanced text parsing
                return parse_text_response_thoroughly(response_text)
    
    return default_response

def validate_extracted_data(data):
    """Ensure all fields are properly formatted"""
    return {
        'Insurance Type': data.get('Insurance Type', 'Not found'),
        'Insurance Provider': data.get('Insurance Provider', 'Not found'),
        'Policy Number': data.get('Policy Number', 'Not found'),
        'Coverage Benefits': ensure_list(data.get('Coverage Benefits', [])),
        'Expired Date': data.get('Expired Date', 'Not found'),
        'Cost': data.get('Cost', 'Not found'),
        'Important Details': ensure_list(data.get('Important Details', []))
    }

def parse_text_response_thoroughly(text):
    """Advanced parsing of text response to extract maximum information"""
    result = {
        'Insurance Type': "Not found",
        'Insurance Provider': "Not found",
        'Policy Number': "Not found",
        'Coverage Benefits': [],
        'Expired Date': "Not found",
        'Cost': "Not found",
        'Important Details': []
    }
    
    # Clean the text first
    clean_text = re.sub(r'【.*?】', '', text)  # Remove citations
    clean_text = re.sub(r'file-\w+', '', clean_text)  # Remove file references
    
    # Section-based parsing
    current_section = None
    for line in clean_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        
        # Detect sections
        if 'Insurance Type:' in line:
            result['Insurance Type'] = line.split(':', 1)[1].strip()
        elif 'Insurance Provider:' in line:
            result['Insurance Provider'] = line.split(':', 1)[1].strip()
        elif 'Policy Number:' in line:
            result['Policy Number'] = line.split(':', 1)[1].strip()
        elif 'Expired Date:' in line or 'Expiry Date:' in line:
            result['Expired Date'] = line.split(':', 1)[1].strip()
        elif 'Cost:' in line:
            result['Cost'] = line.split(':', 1)[1].strip()
        elif 'Coverage Benefits:' in line:
            current_section = 'Coverage Benefits'
        elif 'Important Details:' in line:
            current_section = 'Important Details'
        elif current_section:
            # Handle list items in sections
            if line.startswith(('- ', '• ', '* ')):
                item = line[2:].strip()
                if item:
                    result[current_section].append(item)
            else:
                # Add as new item if not empty
                if line:
                    result[current_section].append(line)
    
    return result

def ensure_list(value):
    """Convert value to list if it isn't already"""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]



@api_view(['GET'])
def check_duplicated_policies(request):
    """
    Check for duplicated/overlapping policies based on extracted uploaded policies.
    """
    try:
        client, err = _require_gemini_client()
        if err:
            return err

        policies = _read_uploaded_policies()
        if not policies:
            return JsonResponse(
                {"error": "No uploaded policies found. Upload policy documents first."},
                status=400,
            )

        analysis_prompt = (
            "Analyze the user's insurance policies below and detect DUPLICATES and OVERLAPS.\n\n"
            "Rules:\n"
            "- No tables.\n"
            "- Use bullet points.\n"
            "- For each issue: show affected policy_number (or filename), DUPLICATE/OVERLAP label, what overlaps, and a savings idea.\n"
            "- Only use the provided data; do not assume missing fields.\n\n"
            "Policies JSON:\n"
            f"{json.dumps(policies, ensure_ascii=False)}\n"
        )

        result = client.models.generate_content(
            model=os.getenv("GEMINI_ANALYSIS_MODEL", "gemini-1.5-flash"),
            contents=[analysis_prompt],
        )
        text = getattr(result, "text", None) or ""

        # Frontend `AnalysisPage` can read `output_text` directly.
        return JsonResponse({"output_text": text})

    except Exception as e:
        logger.exception("duplicate-policies failed")
        return JsonResponse({"error": str(e)}, status=500)


@api_view(["GET", "PUT"])
def personal_details(request):
    if request.method == "GET":
        return Response(_read_personal_details())

    incoming = request.data
    if not isinstance(incoming, dict):
        return Response({"error": "Invalid payload format"}, status=400)

    updated = PERSONAL_DETAILS_DEFAULT.copy()
    updated.update(incoming)

    try:
        _write_personal_details(updated)
    except OSError:
        return Response({"error": "Failed to save personal details"}, status=500)

    return Response(updated)


@api_view(["POST"])
def analyze_policies(request):
    insurances = request.data.get("insurances", [])
    if not isinstance(insurances, list):
        return Response({"error": "insurances must be an array"}, status=400)

    recommendations = []

    # Basic overlap detection by insurance type and close coverage range.
    for i in range(len(insurances)):
        for j in range(i + 1, len(insurances)):
            left = insurances[i]
            right = insurances[j]
            if left.get("type") != right.get("type"):
                continue

            left_coverage = float(left.get("coverage", 0) or 0)
            right_coverage = float(right.get("coverage", 0) or 0)
            baseline = max(left_coverage, right_coverage, 1)
            coverage_gap_ratio = abs(left_coverage - right_coverage) / baseline

            if coverage_gap_ratio <= 0.2:
                recommendations.append(
                    {
                        "type": "duplicate",
                        "policies": [left.get("name", "Policy A"), right.get("name", "Policy B")],
                        "reason": "These policies appear to provide similar protection and may overlap.",
                        "potentialSavings": int(float(left.get("premium", 0) or 0) * 0.5),
                        "suggestedAction": "Review both policies and keep the one with better benefits.",
                        "priority": "medium",
                    }
                )

    has_disability = any((item.get("type") or "").lower() == "disability" for item in insurances)
    if not has_disability:
        recommendations.append(
            {
                "type": "addon",
                "policies": ["Income Protection"],
                "reason": "No disability income protection was found in your policy list.",
                "suggestedAction": "Consider adding disability income coverage.",
                "priority": "high",
            }
        )

    return Response(recommendations)


@api_view(["GET", "POST"])
def family_subprofiles(request):
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err

    if request.method == "GET":
        rows = FamilySubProfile.objects.filter(
            Q(owner_supabase_uid=user_id) | Q(managers__manager_supabase_uid=user_id)
        ).distinct().order_by("-created_at")
        return Response(FamilySubProfileSerializer(rows, many=True).data)

    serializer = FamilySubProfileSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(owner_supabase_uid=user_id)
    return Response(serializer.data, status=201)


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser])
def family_policies(request):
    """
    GET  — list all policies accessible to the authenticated user.
    POST — upload a PDF for a sub-profile:
           extracts text via PyMuPDF, runs Gemini structured extraction,
           saves to DB, and indexes chunks in Supabase pgvector for RAG.
    """
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err

    if request.method == "GET":
        own = PolicyDocument.objects.filter(sub_profile__owner_supabase_uid=user_id)
        managed_subprofile = PolicyDocument.objects.filter(
            sub_profile__managers__manager_supabase_uid=user_id
        )
        shared = PolicyDocument.objects.filter(shares__shared_with_supabase_uid=user_id)
        rows = (own | managed_subprofile | shared).distinct().order_by("-created_at")
        return Response(PolicyDocumentSerializer(rows, many=True).data)

    # POST processing
    sub_profile_id = request.data.get("sub_profile")
    if not sub_profile_id:
        return Response({"error": "sub_profile is required"}, status=400)

    try:
        sub = FamilySubProfile.objects.get(id=sub_profile_id)
    except FamilySubProfile.DoesNotExist:
        return Response({"error": "Sub-profile not found"}, status=404)

    if not _can_manage_subprofile(user_id, sub):
        return Response(
            {"error": "Not allowed to upload for this sub-profile"},
            status=403,
        )

    uploaded_file = request.FILES.get("file")
    title = (request.data.get("title") or "").strip()
    insurance_type = (request.data.get("insurance_type") or "other").strip()
    provider = (request.data.get("provider") or "").strip()
    
    extracted_metadata: dict = {}
    policy_text = ""
    
    if uploaded_file:
        client, err_resp = _require_gemini_client()
        if err_resp:
            return err_resp

        extraction = run_structured_policy_extraction(
            client,
            uploaded_file,
            policy_type_hint=insurance_type if insurance_type != "other" else None,
        )
        extracted_metadata = extraction.get("extracted") or {}
        policy_text = extraction.get("policy_text") or extract_and_minimize_pdf(uploaded_file)

        if extracted_metadata:
            if not title:
                title = str(
                    extracted_metadata.get("insurance_type")
                    or extracted_metadata.get("detected_policy_type")
                    or uploaded_file.name
                )
            if not provider:
                provider = str(extracted_metadata.get("insurance_provider") or "")
            if not insurance_type or insurance_type == "other":
                detected = normalize_policy_type(
                    str(extracted_metadata.get("detected_policy_type") or "")
                ) or normalize_policy_type(
                    str(extracted_metadata.get("insurance_type") or "")
                )
                if detected:
                    insurance_type = detected
        elif extraction.get("error"):
            if extraction.get("code") == "gemini_quota_exceeded":
                body: dict = {"error": extraction["error"]}
                if extraction.get("retry_after_sec") is not None:
                    body["retry_after_sec"] = extraction["retry_after_sec"]
                if extraction.get("models_tried"):
                    body["models_tried"] = extraction["models_tried"]
                return Response({**body, "code": "gemini_quota_exceeded"}, status=429)
            logger.warning("Structured extraction failed: %s", extraction["error"])

    if not title:
        title = (uploaded_file.name if uploaded_file else "Untitled Policy")

    policy_data = {
        "sub_profile": str(sub_profile_id),
        "title": title,
        "insurance_type": insurance_type,
        "provider": provider,
        "storage_url": request.data.get("storage_url") or "uploaded-pdf",
        "metadata": extracted_metadata,
    }
    serializer = PolicyDocumentSerializer(data=policy_data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    doc = serializer.save(uploaded_by_supabase_uid=user_id)

     # Index into Supabase pgvector for Emergency RAG
    rag_result = {"indexed": False, "chunks": 0, "error": None}
    if policy_text.strip() or extracted_metadata:
        rag_result = _index_policy_for_rag(
            raw_text=policy_text,
            extracted=extracted_metadata,
            metadata={
                "filename": uploaded_file.name if uploaded_file else title,
                "policy_owner": sub.full_name,
                "policy_id": str(doc.id),
                "sub_profile_id": str(sub_profile_id),
                "policy_type": insurance_type,
                "source": "family_vault",
            },
        )
        if not rag_result.get("indexed"):
            logger.warning("Family vault RAG indexing failed: %s", rag_result.get("error"))
        try:
            _append_uploaded_policy({
                "filename": uploaded_file.name if uploaded_file else title,
                "content_type": uploaded_file.content_type if uploaded_file else "",
                "extracted": extracted_metadata,
                "rag_indexed": rag_result.get("indexed", False),
                "rag_chunks": rag_result.get("chunks", 0),
                "stored_at": time.time(),
            })
        except Exception:
            logger.exception("Failed to append uploaded policy record")

    response_data = PolicyDocumentSerializer(doc).data
    response_data["rag_indexed"] = rag_result.get("indexed", False)
    response_data["rag_chunks"] = rag_result.get("chunks", 0)
    if rag_result.get("error"):
        response_data["rag_error"] = rag_result["error"]
    return Response(response_data, status=201)


@api_view(["GET", "POST"])
def family_policy_shares(request):
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err

    if request.method == "GET":
        rows = PolicyShare.objects.filter(
            Q(shared_with_supabase_uid=user_id) | Q(shared_by_supabase_uid=user_id)
        ).order_by("-created_at")
        return Response(PolicyShareSerializer(rows, many=True).data)

    policy_id = request.data.get("policy")
    if not policy_id:
        return Response({"error": "policy is required"}, status=400)

    try:
        policy = PolicyDocument.objects.select_related("sub_profile").get(id=policy_id)
    except PolicyDocument.DoesNotExist:
        return Response({"error": "Policy not found"}, status=404)

    if str(policy.sub_profile.owner_supabase_uid) != str(user_id):
        return Response({"error": "Only owner can share this policy"}, status=403)
    has_policy_manage_access = PolicyShare.objects.filter(
        policy=policy, shared_with_supabase_uid=user_id, permission="manage"
    ).exists()
    if not (_can_manage_subprofile(user_id, policy.sub_profile) or has_policy_manage_access):
        return Response({"error": "Only owner or manager can share this policy"}, status=403)

    shared_with_uid = request.data.get("shared_with_supabase_uid")
    if str(shared_with_uid or "").strip() == str(user_id):
        return Response({"error": "Cannot share a policy with yourself"}, status=400)

    serializer = PolicyShareSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    serializer.save(shared_by_supabase_uid=user_id)
    return Response(serializer.data, status=201)


@api_view(["GET", "POST"])
def family_subprofile_managers(request):
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err

    if request.method == "GET":
        rows = FamilySubProfileManager.objects.filter(
            Q(sub_profile__owner_supabase_uid=user_id) | Q(manager_supabase_uid=user_id)
        ).distinct().order_by("-created_at")
        return Response(FamilySubProfileManagerSerializer(rows, many=True).data)

    sub_profile_id = request.data.get("sub_profile")
    manager_uid = request.data.get("manager_supabase_uid")
    permission = (request.data.get("permission") or "manage").strip()

    if not sub_profile_id:
        return Response({"error": "sub_profile is required"}, status=400)
    if not manager_uid:
        return Response({"error": "manager_supabase_uid is required"}, status=400)

    try:
        sub = FamilySubProfile.objects.get(id=sub_profile_id)
    except FamilySubProfile.DoesNotExist:
        return Response({"error": "Sub-profile not found"}, status=404)

    if not _can_manage_subprofile(user_id, sub):
        return Response(
            {"error": "Only owner or manager can grant sub-profile access"},
            status=403,
        )

    if str(manager_uid).strip() == str(sub.owner_supabase_uid):
        return Response(
            {"error": "Owner already has full access to this sub-profile"},
            status=400,
        )

    allowed_permissions = {"view", "claim_support", "manage"}
    if permission not in allowed_permissions:
        return Response({"error": "Invalid permission value"}, status=400)

    row, created = FamilySubProfileManager.objects.update_or_create(
        sub_profile=sub,
        manager_supabase_uid=manager_uid,
        defaults={
            "permission": permission,
            "granted_by_supabase_uid": user_id,
        },
    )

    serializer = FamilySubProfileManagerSerializer(row)
    return Response(serializer.data, status=201 if created else 200)


@api_view(["DELETE"])
def family_subprofile_manager_revoke(request, manager_id):
    """Revoke a FamilySubProfileManager grant. Only owner or manager may revoke."""
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err
    try:
        row = FamilySubProfileManager.objects.select_related("sub_profile").get(id=manager_id)
    except FamilySubProfileManager.DoesNotExist:
        return Response({"error": "Manager grant not found"}, status=404)
    if not _can_manage_subprofile(user_id, row.sub_profile):
        return Response({"error": "Only owner or manager can revoke access"}, status=403)
    row.delete()
    return Response({"ok": True})


@api_view(["GET"])
def family_lookup_user(request):
    """
    Look up a Supabase user UID by email using the Supabase Admin REST API.
    Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
    Query param: ?email=user@example.com
    """
    user_id, err = _get_supabase_user_id(request)
    if err:
        return err
    email = (request.GET.get("email") or "").strip().lower()
    if not email:
        return Response({"error": "email query param is required"}, status=400)
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not supabase_url or not service_key:
        return Response(
            {"error": "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"},
            status=503,
        )
    try:
        import httpx as _httpx
        resp = _httpx.get(
            f"{supabase_url}/auth/v1/admin/users",
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
            },
            params={"page": 1, "per_page": 1000},
            timeout=10,
        )
        if resp.status_code != 200:
            return Response({"error": "Supabase admin API error", "detail": resp.text}, status=502)
        data = resp.json()
        users = data.get("users") or []
        for u in users:
            if (u.get("email") or "").lower() == email:
                return Response({"uid": u["id"], "email": u["email"]})
        return Response({"error": f"No user found with email: {email}"}, status=404)
    except Exception as e:
        logger.exception("family_lookup_user failed")
        return Response({"error": str(e)}, status=500)
