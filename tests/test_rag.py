import pytest
import pymupdf
from app.services.document_processor import DocumentProcessor
from app.services.rag_engine import RAGEngine
from app.schemas.rag import QueryResponse

def create_sample_pdf() -> bytes:
    """Create a 2-page sample PDF in memory."""
    doc = pymupdf.open()
    
    # Page 1
    page1 = doc.new_page()
    page1.insert_text((50, 72), "Operating Systems Notes - Page 1\nA process is a program in execution. Deadlock requires mutual exclusion, hold and wait, no preemption, and circular wait.")
    
    # Page 2
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Operating Systems Notes - Page 2\nVirtual memory uses paging and segmentation. LRU is Least Recently Used page replacement algorithm.")
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_document_processor_pages_and_chunks():
    pdf_bytes = create_sample_pdf()
    chunks = DocumentProcessor.process_pdf(pdf_bytes, "os_notes.pdf")
    
    assert len(chunks) >= 2
    pages = [c["page_number"] for c in chunks]
    assert 1 in pages
    assert 2 in pages
    assert any("Deadlock" in c["text"] for c in chunks)
    assert any("Virtual memory" in c["text"] for c in chunks)

def test_rag_engine_retrieval_and_citations():
    pdf_bytes = create_sample_pdf()
    chunks = DocumentProcessor.process_pdf(pdf_bytes, "os_notes.pdf")
    
    engine = RAGEngine()
    indexed = engine.add_documents(chunks)
    assert indexed == len(chunks)
    assert engine.get_total_chunks() == len(chunks)
    
    # Test retrieval
    results = engine.retrieve("What are the conditions for deadlock?", top_k=2)
    assert len(results) > 0
    assert "Deadlock" in results[0]["text"]
    assert results[0]["page_number"] == 1

def test_rag_fallback_offline_mode():
    pdf_bytes = create_sample_pdf()
    chunks = DocumentProcessor.process_pdf(pdf_bytes, "os_notes.pdf")
    
    engine = RAGEngine()
    engine.add_documents(chunks)
    
    # Query completely outside the document
    response: QueryResponse = engine.answer_query("Explain photosynthesis and chloroplasts in plant biology.")
    assert response.found_in_notes is False
    assert "information not available in provided notes" in response.answer.lower()


def test_rag_index_persists_across_engine_restart(tmp_path, monkeypatch):
    """A new RAGEngine instance restores both vectors and matching metadata."""
    import numpy as np
    import app.services.rag_engine as rag_module

    class FakeEmbeddingModel:
        def encode(self, texts, convert_to_numpy=True, show_progress_bar=False):
            vectors = np.zeros((len(texts), 384), dtype=np.float32)
            for row, text in enumerate(texts):
                vectors[row, 0] = 1.0 if "deadlock" in text.lower() else 0.5
            return vectors

    monkeypatch.setattr(rag_module, "get_embedding_model", lambda: FakeEmbeddingModel())
    storage_dir = tmp_path / "faiss_store"
    chunks = [{
        "text": "Deadlock occurs when processes wait indefinitely.",
        "source_file": "os_notes.pdf",
        "page_number": 3,
    }]

    first_engine = RAGEngine(storage_dir=storage_dir)
    assert first_engine.add_documents(chunks) == 1
    assert first_engine.get_total_chunks() == 1

    restarted_engine = RAGEngine(storage_dir=storage_dir)
    assert restarted_engine.get_total_chunks() == 1
    assert restarted_engine.doc_store[0]["source_file"] == "os_notes.pdf"
    assert restarted_engine.retrieve("deadlock", top_k=1)[0]["page_number"] == 3

    restarted_engine.reset()
    empty_engine = RAGEngine(storage_dir=storage_dir)
    assert empty_engine.get_total_chunks() == 0
