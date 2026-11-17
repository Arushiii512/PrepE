import pytest
from app.services.insights_engine import extract_questions_from_text, InsightsEngine
from app.schemas.insights import ClusterAnalysisRequest

def test_extract_questions_from_text():
    sample_text = """
    Operating Systems Exam 2024
    
    1. Explain Round Robin CPU scheduling algorithm with an example.
    2. What are the necessary conditions for deadlock occurrence?
    Q3. Discuss paging and segmentation in virtual memory management.
    Question 4: Compare preemptive and non-preemptive scheduling algorithms.
    5) Describe LRU page replacement technique with page reference string.
    """
    questions = extract_questions_from_text(sample_text)
    assert len(questions) >= 5
    assert any("Round Robin" in q for q in questions)
    assert any("deadlock" in q.lower() for q in questions)
    assert any("paging" in q.lower() for q in questions)

def test_insights_engine_clustering_and_plotly():
    questions = [
        "What is CPU scheduling and how does Round Robin work?",
        "Compare SJF and FCFS process scheduling algorithms.",
        "What is multi-level queue CPU scheduling in OS?",
        "Explain virtual memory management using paging.",
        "What is page fault and how does LRU page replacement work?",
        "Describe segmentation and demand paging in modern OS.",
        "Explain SQL queries and relational database normalization forms 1NF to 3NF.",
        "What is ACID properties in database transactions and how is concurrency managed?",
        "Compare SQL vs NoSQL databases with primary key foreign key constraints."
    ]
    
    engine = InsightsEngine()
    req = ClusterAnalysisRequest(questions=questions, num_clusters=3)
    response = engine.analyze_pyqs(req)
    
    assert response.total_questions_analyzed == len(questions)
    assert len(response.clusters) == 3
    
    # Check that each cluster has metadata
    for cluster in response.clusters:
        assert cluster.question_count > 0
        assert cluster.percentage > 0
        assert len(cluster.keywords) > 0
        assert len(cluster.sample_questions) > 0
        
    # Check that Plotly chart specs were generated
    assert response.plotly_chart_json is not None
    assert "data" in response.plotly_chart_json
    assert response.scatter_chart_json is not None
    assert "data" in response.scatter_chart_json
