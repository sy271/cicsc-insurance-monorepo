"""
Structured, policy-type-aware clause extraction via Gemini.

Replaces shallow summarization with explicit clause-type detection and
page references from page-marked PDF text.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any

import fitz  # PyMuPDF

try:
    from google.genai import errors as genai_errors
except ImportError:  # pragma: no cover
    genai_errors = None

logger = logging.getLogger(__name__)

POLICY_CLAUSE_TYPES: dict[str, list[str]] = {
    "medical": [
        "Waiting Period",
        "Annual Limit",
        "Lifetime Limit",
        "Deductible",
        "Co-payment",
        "Panel Hospitals",
        "Pre-existing Conditions",
        "General Exclusions",
    ],
    "life": [
        "Death Benefit",
        "Total Permanent Disability",
        "Critical Illness Benefit",
        "Exclusions",
        "Contestability Period",
        "Free-Look Period",
        "Premium Waiver conditions",
    ],
    "motor": [
        "Third Party Liability",
        "Own Damage",
        "Windscreen",
        "NCD",
        "Exclusions",
        "Named Driver conditions",
    ],
    "travel": [
        "Trip Cancellation",
        "Medical Emergency Abroad",
        "Baggage Loss",
        "Personal Liability",
        "Exclusions",
        "Coverage Territory",
    ],
    "other": [
        "Coverage Summary",
        "Exclusions",
        "Waiting Period",
        "Policy Limits",
        "Claims Procedure",
    ],
}

_POLICY_TYPE_ALIASES: dict[str, str] = {
    "medical": "medical",
    "health": "medical",
    "hospital": "medical",
    "life": "life",
    "motor": "motor",
    "auto": "motor",
    "car": "motor",
    "vehicle": "motor",
    "travel": "travel",
    "other": "other",
    "home": "other",
}


def normalize_policy_type(hint: str | None) -> str | None:
    if not hint:
        return None
    key = hint.strip().lower()
    for alias, canonical in _POLICY_TYPE_ALIASES.items():
        if alias in key:
            return canonical
    return None


def extract_pdf_with_page_markers(
    uploaded_file,
    max_pages: int = 10,
    max_chars: int = 25000,
) -> dict[str, Any]:
    """
    Extract PDF text with explicit page markers for Gemini page references.

    Returns:
        text: page-marked string sent to the model
        pages: per-page metadata with character offsets in `text`
        page_count: total pages in the PDF
        truncated: whether output was cut at max_chars
    """
    uploaded_file.seek(0)
    pdf_bytes = uploaded_file.read()
    if not pdf_bytes:
        return {"text": "", "pages": [], "page_count": 0, "truncated": False}

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = doc.page_count
    pages_to_read = min(max_pages, page_count)

    parts: list[str] = []
    pages: list[dict[str, Any]] = []
    offset = 0

    for i in range(pages_to_read):
        page_num = i + 1
        page = doc.load_page(i)
        page_text = (page.get_text("text") or "").strip()
        marker = f"--- PAGE {page_num} ---"
        block = f"{marker}\n{page_text}" if page_text else marker
        char_start = offset
        parts.append(block)
        offset += len(block)
        if i < pages_to_read - 1:
            parts.append("\n\n")
            offset += 2
        char_end = offset
        pages.append(
            {
                "page_number": page_num,
                "char_start": char_start,
                "char_end": char_end,
                "text_length": len(page_text),
            }
        )

    doc.close()
    full_text = "".join(parts).strip()
    truncated = len(full_text) > max_chars
    text = full_text[:max_chars]

    if truncated and pages:
        last = pages[-1]
        last["char_end"] = min(last["char_end"], len(text))

    return {
        "text": text,
        "pages": pages,
        "page_count": page_count,
        "truncated": truncated,
    }


def extract_and_minimize_pdf(uploaded_file, max_pages: int = 10, max_chars: int = 25000) -> str:
    """Backward-compatible helper returning plain text (no page markers)."""
    result = extract_pdf_with_page_markers(uploaded_file, max_pages, max_chars)
    # Strip markers for legacy RAG indexing callers that expect continuous text
    plain = re.sub(r"--- PAGE \d+ ---\n?", "", result["text"])
    return plain.strip()


def build_structured_extraction_prompt(
    policy_text: str,
    policy_type_hint: str | None = None,
) -> str:
    hint = normalize_policy_type(policy_type_hint)
    all_types = sorted(set(POLICY_CLAUSE_TYPES.keys()))

    if hint:
        primary_clauses = POLICY_CLAUSE_TYPES[hint]
        secondary_note = (
            f"The user indicated this is likely a {hint} policy. "
            f"Prioritize these clause types: {', '.join(primary_clauses)}. "
            "Still verify detected_policy_type from document content."
        )
    else:
        primary_clauses = []
        secondary_note = (
            "No policy type hint was given. First detect the policy type "
            f"(one of: {', '.join(all_types)}), then extract the clause types "
            "defined for that type."
        )

    clause_catalog = "\n".join(
        f"  {ptype}: {', '.join(clauses)}"
        for ptype, clauses in POLICY_CLAUSE_TYPES.items()
    )

    return f"""You are an insurance policy clause extractor. Analyze the policy text below.

{secondary_note}

Clause types by policy category:
{clause_catalog}

TASK:
1. Detect the policy type from the document (detected_policy_type).
2. Extract basic metadata and every applicable clause for that policy type.
3. For EACH expected clause type listed for the detected policy type, return one entry in the clauses array — even if not found (set found=false).
4. Use page markers (--- PAGE N ---) to set page_number (integer, 1-based).
5. Set char_start and char_end as approximate character offsets within the provided policy text (0-based).
6. Set confidence between 0.0 and 1.0 for each clause and for policy_type_confidence.

Return ONLY valid JSON (no markdown fences, no commentary) with this exact schema:
{{
  "insurance_type": string|null,
  "insurance_provider": string|null,
  "policy_number": string|null,
  "expiry_date": string|null,
  "cost": string|null,
  "coverage_benefits": string[],
  "important_details": string[],
  "detected_policy_type": "medical"|"life"|"motor"|"travel"|"other",
  "policy_type_confidence": number,
  "clauses": [
    {{
      "clause_type": string,
      "found": boolean,
      "value": string|null,
      "excerpt": string|null,
      "page_number": integer|null,
      "char_start": integer|null,
      "char_end": integer|null,
      "confidence": number
    }}
  ]
}}

If a metadata field is missing, use null or empty arrays. If a clause is not found, set found=false, value=null, excerpt=null, page_number=null, char_start=null, char_end=null, confidence=0.0.

Policy text:
{policy_text}"""


def parse_gemini_json(raw: str) -> dict[str, Any] | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None


def get_gemini_doc_models() -> list[str]:
    """Ordered model list: primary env var, then comma-separated fallbacks."""
    primary = (os.getenv("GEMINI_DOC_MODEL") or "gemini-2.0-flash").strip()
    fallback_raw = os.getenv(
        "GEMINI_DOC_MODEL_FALLBACKS", "gemini-2.0-flash,gemini-1.5-flash"
    )
    models: list[str] = []
    for candidate in [primary, *fallback_raw.split(",")]:
        name = candidate.strip()
        if name and name not in models:
            models.append(name)
    return models


def build_clause_index_text(extracted: dict[str, Any] | None) -> str:
    """Flatten structured clause extraction into searchable text for RAG indexing."""
    if not extracted:
        return ""

    lines: list[str] = []
    for key, label in (
        ("insurance_type", "Insurance type"),
        ("insurance_provider", "Provider"),
        ("policy_number", "Policy number"),
        ("expiry_date", "Expiry date"),
        ("cost", "Premium/Cost"),
        ("detected_policy_type", "Detected policy type"),
    ):
        value = extracted.get(key)
        if value:
            lines.append(f"{label}: {value}")

    for benefit in extracted.get("coverage_benefits") or []:
        if benefit:
            lines.append(f"Coverage benefit: {benefit}")

    for clause in extracted.get("clauses") or []:
        if not clause.get("found"):
            continue
        clause_type = clause.get("clause_type") or "Clause"
        page = clause.get("page_number")
        page_ref = f" (page {page})" if page is not None else ""
        body = clause.get("value") or clause.get("excerpt") or ""
        if body:
            lines.append(f"{clause_type}{page_ref}: {body}")

    for detail in extracted.get("important_details") or []:
        if detail:
            lines.append(f"Important detail: {detail}")

    return "\n".join(lines)


def _parse_retry_seconds(exc: Exception) -> float | None:
    match = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", str(exc), re.IGNORECASE)
    if match:
        return float(match.group(1))
    response_json = getattr(exc, "response_json", None) or {}
    if isinstance(response_json, dict):
        for detail in response_json.get("error", {}).get("details", []):
            if detail.get("@type", "").endswith("RetryInfo"):
                delay = detail.get("retryDelay", "")
                if isinstance(delay, str) and delay.endswith("s"):
                    try:
                        return float(delay[:-1])
                    except ValueError:
                        pass
    return None


def gemini_generate_text(
    client,
    *,
    models: list[str],
    contents: list[str],
    max_retries_on_429: int = 1,
) -> tuple[str, str]:
    """
    Call Gemini with model fallback. On 429, optionally waits then retries or
    tries the next model in the list.

    Returns (text, model_used). Raises the last ClientError if all attempts fail.
    """
    last_exc: Exception | None = None

    for model in models:
        for attempt in range(max_retries_on_429 + 1):
            try:
                result = client.models.generate_content(model=model, contents=contents)
                text = getattr(result, "text", None) or ""
                if attempt > 0 or model != models[0]:
                    logger.info("Gemini generate_content succeeded with model=%s", model)
                return text, model
            except Exception as exc:
                last_exc = exc
                is_rate_limited = (
                    genai_errors is not None
                    and isinstance(exc, genai_errors.ClientError)
                    and getattr(exc, "status_code", None) == 429
                )
                if not is_rate_limited:
                    raise

                retry_after = _parse_retry_seconds(exc)
                logger.warning(
                    "Gemini 429 for model=%s (attempt %s/%s, retry_after=%s)",
                    model,
                    attempt + 1,
                    max_retries_on_429 + 1,
                    retry_after,
                )
                if attempt < max_retries_on_429 and retry_after and retry_after <= 60:
                    time.sleep(min(retry_after + 0.5, 60))
                    continue
                break

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("No Gemini models configured")


def _quota_error_payload(exc: Exception, models_tried: list[str]) -> dict[str, Any]:
    retry_after = _parse_retry_seconds(exc)
    model_list = ", ".join(models_tried)
    return {
        "error": (
            "Gemini API quota exceeded. The free-tier daily limit was hit for the "
            f"configured model(s): {model_list}. "
            "Wait and retry, enable billing in Google AI Studio, or set "
            "GEMINI_DOC_MODEL to a different model (e.g. gemini-2.0-flash)."
        ),
        "code": "gemini_quota_exceeded",
        "retry_after_sec": retry_after,
        "models_tried": models_tried,
    }


def run_structured_policy_extraction(
    client,
    uploaded_file,
    *,
    models: list[str] | None = None,
    policy_type_hint: str | None = None,
    max_pages: int = 10,
    max_chars: int = 25000,
) -> dict[str, Any]:
    """
    Extract page-marked text from PDF and run structured Gemini extraction.

    Returns dict with keys: extracted, policy_text, extraction_meta, raw_response, error
    """
    try:
        pdf_data = extract_pdf_with_page_markers(uploaded_file, max_pages, max_chars)
    except Exception:
        uploaded_file.seek(0)
        file_bytes = uploaded_file.read()
        fallback = file_bytes.decode("utf-8", errors="ignore")[:max_chars]
        pdf_data = {
            "text": fallback,
            "pages": [],
            "page_count": 0,
            "truncated": len(fallback) >= max_chars,
        }

    policy_text = pdf_data["text"]
    if not policy_text.strip():
        return {
            "extracted": None,
            "policy_text": "",
            "extraction_meta": pdf_data,
            "raw_response": "",
            "error": "Could not extract readable text from PDF.",
        }

    prompt = build_structured_extraction_prompt(policy_text, policy_type_hint)
    model_list = models or get_gemini_doc_models()

    try:
        raw, model_used = gemini_generate_text(
            client,
            models=model_list,
            contents=[prompt],
        )
    except Exception as exc:
        is_rate_limited = (
            genai_errors is not None
            and isinstance(exc, genai_errors.ClientError)
            and getattr(exc, "status_code", None) == 429
        )
        if is_rate_limited:
            payload = _quota_error_payload(exc, model_list)
            return {
                "extracted": None,
                "policy_text": policy_text,
                "extraction_meta": {
                    "pages_read": len(pdf_data.get("pages", [])),
                    "page_count": pdf_data.get("page_count", 0),
                    "truncated": pdf_data.get("truncated", False),
                    "policy_type_hint": normalize_policy_type(policy_type_hint),
                },
                "raw_response": "",
                **payload,
            }
        logger.exception("Gemini extraction failed")
        return {
            "extracted": None,
            "policy_text": policy_text,
            "extraction_meta": {
                "pages_read": len(pdf_data.get("pages", [])),
                "page_count": pdf_data.get("page_count", 0),
                "truncated": pdf_data.get("truncated", False),
                "policy_type_hint": normalize_policy_type(policy_type_hint),
            },
            "raw_response": "",
            "error": f"Gemini API error: {exc}",
            "code": "gemini_api_error",
        }

    extracted = parse_gemini_json(raw)

    if extracted and not extracted.get("detected_policy_type"):
        hinted = normalize_policy_type(policy_type_hint)
        if hinted:
            extracted["detected_policy_type"] = hinted

    return {
        "extracted": extracted,
        "policy_text": policy_text,
        "extraction_meta": {
            "pages_read": len(pdf_data.get("pages", [])),
            "page_count": pdf_data.get("page_count", 0),
            "truncated": pdf_data.get("truncated", False),
            "policy_type_hint": normalize_policy_type(policy_type_hint),
            "model_used": model_used,
        },
        "raw_response": raw,
        "error": None if extracted else "Failed to parse structured extraction response.",
    }
