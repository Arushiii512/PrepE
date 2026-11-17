import json
import logging
import re
from typing import Optional, List

import pymupdf
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from google import genai
from google.genai import types

from app.config import settings
from app.schemas.insights import ClusterAnalysisRequest, ClusterAnalysisResponse
from app.services.insights_engine import insights_service, extract_questions_from_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/insights", tags=["PrepE Insights"])

# Keep requests reasonably small and predictable for Gemini Vision.
OCR_BATCH_SIZE = 3
OCR_MAX_PAGES = 90
OCR_RENDER_SCALE = 1.5


def _parse_ocr_questions(response_text: str) -> List[str]:
    """Parse Gemini's JSON response, tolerating optional Markdown fences."""
    text = (response_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Gemini OCR response was not valid JSON")
        return []

    raw_questions = payload.get("questions", []) if isinstance(payload, dict) else payload
    if not isinstance(raw_questions, list):
        return []

    questions: List[str] = []
    for item in raw_questions:
        if isinstance(item, str):
            question = item.strip()
        elif isinstance(item, dict):
            question = str(item.get("question", "")).strip()
        else:
            continue
        # Reject short OCR noise and answer-only fragments.
        if len(question) >= 12 and question not in questions:
            questions.append(question)
    return questions


def _extract_questions_with_gemini_vision(pdf_bytes: bytes) -> List[str]:
    """OCR scanned/image PDFs page-by-page in small Gemini Vision batches."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=("This PDF appears to be scanned or image-based. Add GEMINI_API_KEY "
                    "to the backend .env file to enable automatic OCR."),
        )

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        logger.exception("Could not open uploaded PDF")
        raise HTTPException(status_code=400, detail="The uploaded PDF could not be opened.") from exc

    try:
        if doc.page_count > OCR_MAX_PAGES:
            raise HTTPException(
                status_code=413,
                detail=f"This PDF has {doc.page_count} pages. Automatic OCR currently supports up to {OCR_MAX_PAGES} pages per upload.",
            )

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        questions: List[str] = []

        for start in range(0, doc.page_count, OCR_BATCH_SIZE):
            batch_pages = doc.pages(start, min(start + OCR_BATCH_SIZE, doc.page_count))
            image_parts = []
            for page in batch_pages:
                pix = page.get_pixmap(matrix=pymupdf.Matrix(OCR_RENDER_SCALE, OCR_RENDER_SCALE), alpha=False)
                image_parts.append(types.Part.from_bytes(data=pix.tobytes("png"), mime_type="image/png"))

            prompt = (
                "You are extracting exam questions from scanned or handwritten question papers. "
                "Read the page images carefully. Extract each complete QUESTION only; do not include "
                "answers, worked solutions, page headers, marks, or instructions unless they are part "
                "of a question. Preserve mathematical notation and the original wording as accurately "
                "as possible. A question may continue across lines. Do not invent unreadable text. "
                "Return strictly valid JSON in this format: "
                '{"questions":[{"question":"..."}]}. '
                "If no question is visible, return {\"questions\":[]}."
            )
            try:
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=[prompt, *image_parts],
                    config=types.GenerateContentConfig(
                        temperature=0,
                        response_mime_type="application/json",
                    ),
                )
                questions.extend(_parse_ocr_questions(response.text or ""))
            except Exception as exc:
                logger.exception("Gemini Vision OCR failed for PDF pages %s-%s", start + 1, start + len(batch_pages))
                raise HTTPException(
                    status_code=502,
                    detail=(f"OCR failed while reading pages {start + 1}-{start + len(batch_pages)}. "
                            "Check your Gemini API key, model access, quota and network connection."),
                ) from exc

        # Deduplicate while preserving page/document order.
        return list(dict.fromkeys(questions))
    finally:
        doc.close()


@router.post("/cluster", response_model=ClusterAnalysisResponse)
async def cluster_pyqs(request: ClusterAnalysisRequest):
    """Analyse previous-year exam questions using KMeans clustering and embeddings."""
    if len(request.questions) < 2:
        raise HTTPException(status_code=400, detail="At least 2 questions are required for clustering analysis.")
    try:
        return insights_service.analyze_pyqs(request)
    except Exception as exc:
        logger.exception("PYQ clustering failed")
        raise HTTPException(status_code=500, detail=f"Clustering analysis failed: {str(exc)}") from exc


@router.post("/upload-pyqs", response_model=ClusterAnalysisResponse)
async def upload_pyqs_file(
    file: UploadFile = File(...),
    num_clusters: Optional[int] = Form(None),
):
    """Extract questions from PDF/TXT, using Gemini Vision automatically when PDF text is unavailable."""
    filename = (file.filename or "").lower()
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if filename.endswith(".pdf"):
        try:
            doc = pymupdf.open(stream=content, filetype="pdf")
            extracted_text = "\n".join(page.get_text("text") for page in doc)
            doc.close()
        except Exception as exc:
            logger.exception("PDF text extraction failed")
            raise HTTPException(status_code=400, detail="Could not read this PDF. Please check that it is a valid, unencrypted PDF.") from exc

        questions = extract_questions_from_text(extracted_text) if extracted_text.strip() else []
        # OCR is the automatic fallback for image PDFs and text PDFs whose layout
        # could not be parsed into enough questions.
        if len(questions) < 2:
            questions = _extract_questions_with_gemini_vision(content)
    elif filename.endswith(".txt"):
        extracted_text = content.decode("utf-8", errors="ignore")
        questions = extract_questions_from_text(extracted_text)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    if len(questions) < 2:
        raise HTTPException(
            status_code=422,
            detail=(f"Could not identify at least 2 questions (found {len(questions)}). "
                    "Try a clearer scan with readable question text and numbering."),
        )

    try:
        req = ClusterAnalysisRequest(questions=questions, num_clusters=num_clusters)
        return insights_service.analyze_pyqs(req)
    except Exception as exc:
        logger.exception("PYQ analysis failed after question extraction")
        raise HTTPException(status_code=500, detail=f"Question extraction succeeded, but topic analysis failed: {str(exc)}") from exc

