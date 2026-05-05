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
import os
from dotenv import load_dotenv
import httpx
import logging
import PyPDF2
from openai import APIError, BadRequestError, OpenAI
from django.http import JsonResponse
from django.conf import settings
from pathlib import Path

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


def _uploaded_policies_path():
    return Path(settings.BASE_DIR) / "uploaded_policies.json"


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
    reader = PyPDF2.PdfReader(uploaded_file)
    pages_to_read = min(max_pages, len(reader.pages))
    chunks = []
    for i in range(pages_to_read):
        page_text = reader.pages[i].extract_text() or ""
        if page_text:
            chunks.append(page_text)
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
    Process PDFs and extract ALL available insurance information
    Returns complete structured data found in the document
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

    try:
        minimized_policy_text = extract_and_minimize_pdf(uploaded_file)
    except Exception:
        # Fallback for non-standard PDFs where text extraction may fail.
        uploaded_file.seek(0)
        file_bytes = uploaded_file.read()
        if not file_bytes:
            return Response({"error": "Empty upload"}, status=400)
        minimized_policy_text = file_bytes.decode("utf-8", errors="ignore")[:25000]

    if not minimized_policy_text.strip():
        return Response(
            {"error": "Could not extract readable text from PDF. Try another file."},
            status=400,
        )

    prompt = (
        "Please analyze this insurance policy text and extract key coverage details.\n"
        "Return ONLY a JSON string with these fields:\n"
        "insurance_type, insurance_provider, policy_number, coverage_benefits (array), "
        "expiry_date, cost, important_details (array).\n"
        "If a field is missing, use null or empty arrays.\n\n"
        f"Policy text:\n{minimized_policy_text}"
    )

    result = client.models.generate_content(
        model=os.getenv("GEMINI_DOC_MODEL", "gemini-1.5-flash"),
        contents=[prompt],
    )
    text = getattr(result, "text", None) or ""

    stored_payload = None
    try:
        stored_payload = json.loads(text)
    except Exception:
        stored_payload = None

    try:
        _append_uploaded_policy(
            {
                "filename": uploaded_file.name,
                "content_type": uploaded_file.content_type,
                "extracted": stored_payload if isinstance(stored_payload, dict) else {"raw": text},
                "stored_at": time.time(),
            }
        )
    except Exception:
        logger.exception("Failed to persist extracted policy")

    return JsonResponse({"response": text})


    
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