from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
from app.schemas.rag import QueryRequest, QueryResponse, DocumentUploadResponse
from app.services.document_processor import DocumentProcessor
from app.services.rag_engine import rag_service

router = APIRouter(prefix="/rag", tags=["Ask PrepE (RAG)"])

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload academic PDF notes, extract text page-by-page, and index into FAISS."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        content = file.file.read()
        chunks = DocumentProcessor.process_pdf(content, file.filename)
        if not chunks:
            raise HTTPException(status_code=400, detail="No readable text found in PDF.")
        
        # Determine total unique pages processed
        pages = set(c["page_number"] for c in chunks)
        indexed_count = rag_service.add_documents(chunks)
        
        return DocumentUploadResponse(
            filename=file.filename,
            total_pages=len(pages),
            chunks_indexed=indexed_count,
            message=f"Successfully indexed {indexed_count} chunks across {len(pages)} pages."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

@router.post("/query", response_model=QueryResponse)
async def query_notes(request: QueryRequest):
    """Ask a question about uploaded notes using RAG with page citations."""
    try:
        response = rag_service.answer_query(request.query, top_k=request.top_k)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.get("/status")
async def get_rag_status() -> Dict[str, Any]:
    """Check number of indexed chunks in vector store."""
    return {
        "chunks_indexed": rag_service.get_total_chunks(),
        "ready": rag_service.get_total_chunks() > 0
    }

@router.post("/reset")
async def reset_rag():
    """Clear all indexed documents from memory."""
    rag_service.reset()
    return {"message": "RAG index cleared successfully."}
