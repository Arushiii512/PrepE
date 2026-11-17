import pytest
import pymupdf
from fastapi import UploadFile
from io import BytesIO

from app.api.v1.rag import upload_pdf, query_notes, get_rag_status, reset_rag
from app.api.v1.quiz import generate_quiz_endpoint
from app.api.v1.insights import cluster_pyqs, upload_pyqs_file
from app.schemas.rag import QueryRequest
from app.schemas.quiz import QuizGenerateRequest
from app.schemas.insights import ClusterAnalysisRequest
from app.main import root, health_check

def run_coro(coro):
    """Synchronously advance coroutine without any event loop or loopback socket overhead."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

def create_dummy_pdf() -> bytes:
    doc = pymupdf.open()
    page1 = doc.new_page()
    page1.insert_text((50, 72), "Computer Networks Lecture Notes\nThe OSI model has seven layers: Physical, Data Link, Network, Transport, Session, Presentation, Application.")
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Computer Networks Page 2\nTCP provides reliable connection-oriented transport, whereas UDP provides low-latency connectionless datagram delivery.")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes

def test_api_root_and_health():
    res_root = run_coro(root())
    assert "PrepE" in res_root["project"]

    res_health = run_coro(health_check())
    assert res_health["status"] == "healthy"

def test_rag_endpoints_integration():
    pdf_bytes = create_dummy_pdf()
    
    # 1. Test PDF upload endpoint
    file_obj = UploadFile(filename="networks.pdf", file=BytesIO(pdf_bytes))
    upload_res = run_coro(upload_pdf(file=file_obj))
    assert upload_res.filename == "networks.pdf"
    assert upload_res.total_pages == 2
    assert upload_res.chunks_indexed >= 2

    # 2. Test status endpoint
    stat_res = run_coro(get_rag_status())
    assert stat_res["chunks_indexed"] >= 2
    assert stat_res["ready"] is True

    # 3. Test query endpoint with citations
    query_req = QueryRequest(query="What is the difference between TCP and UDP?", top_k=2)
    query_res = run_coro(query_notes(query_req))
    assert len(query_res.answer) > 0
    assert len(query_res.citations) > 0
    assert query_res.citations[0].source_file == "networks.pdf"

    # 4. Test reset endpoint
    reset_res = run_coro(reset_rag())
    assert "cleared" in reset_res["message"].lower()
    stat_res_after = run_coro(get_rag_status())
    assert stat_res_after["chunks_indexed"] == 0

def test_quiz_endpoint_integration():
    req = QuizGenerateRequest(
        topic="Computer Architecture",
        use_indexed_notes=False,
        num_questions=3,
        difficulty="medium"
    )
    quiz_res = run_coro(generate_quiz_endpoint(req))
    assert quiz_res.total_questions == 3
    assert len(quiz_res.questions) == 3
    for q in quiz_res.questions:
        assert len(q.options) == 4
        assert q.correct_key in ["A", "B", "C", "D"]
        assert len(q.explanation) > 0

def test_insights_cluster_endpoint_integration():
    questions = [
        "What is the function of the Transport Layer in OSI model?",
        "Compare TCP and UDP protocols with header structures.",
        "How does TCP three-way handshake establish a connection?",
        "Explain Distance Vector routing and Link State routing algorithms.",
        "What is Dijkstra's shortest path routing algorithm in networks?",
        "Describe subnetting, CIDR notation, and IP addressing classes."
    ]
    req = ClusterAnalysisRequest(questions=questions, num_clusters=2)
    res = run_coro(cluster_pyqs(req))
    assert res.total_questions_analyzed == 6
    assert len(res.clusters) == 2
    assert "data" in res.plotly_chart_json
    assert res.scatter_chart_json is not None

def test_insights_upload_endpoint_integration():
    pyq_content = """
    1. Explain Round Robin CPU scheduling.
    2. What are the deadlock conditions?
    3. Discuss virtual memory paging.
    4. What is demand paging and page replacement?
    """
    file_obj = UploadFile(filename="pyqs.txt", file=BytesIO(pyq_content.encode("utf-8")))
    res = run_coro(upload_pyqs_file(file=file_obj, num_clusters=2))
    assert res.total_questions_analyzed >= 4
    assert len(res.clusters) == 2
