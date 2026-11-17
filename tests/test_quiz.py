import pytest
import json
from unittest.mock import MagicMock
from pydantic import ValidationError
from app.schemas.quiz import MCQOption, MCQQuestion, QuizResponse, QuizGenerateRequest
from app.services.quiz_engine import QuizEngine, generate_mock_quiz

def test_mcq_schema_valid():
    q = MCQQuestion(
        id=1,
        question="What is the time complexity of binary search?",
        options=[
            MCQOption(key="A", text="O(n)"),
            MCQOption(key="B", text="O(log n)"),
            MCQOption(key="C", text="O(n^2)"),
            MCQOption(key="D", text="O(1)"),
        ],
        correct_key="B",
        explanation="Binary search halves the search space each step.",
        difficulty="easy"
    )
    assert q.id == 1
    assert q.correct_key == "B"
    assert len(q.options) == 4

def test_mcq_schema_invalid_key():
    with pytest.raises(ValidationError):
        MCQOption(key="E", text="Invalid option")  # type: ignore

def test_mock_quiz_generation():
    req = QuizGenerateRequest(topic="Data Structures", num_questions=3, difficulty="medium")
    quiz = generate_mock_quiz(req.topic, req.num_questions, req.difficulty)
    
    assert quiz.total_questions == 3
    assert len(quiz.questions) == 3
    for q in quiz.questions:
        assert q.correct_key in ["A", "B", "C", "D"]
        assert len(q.options) == 4

def test_quiz_engine_retry_recovery():
    engine = QuizEngine()
    
    # Mock Gemini client
    mock_client = MagicMock()
    
    # Attempt 1 returns malformed JSON
    # Attempt 2 returns valid JSON
    valid_payload = {
        "title": "Algorithms Quiz",
        "total_questions": 1,
        "questions": [
            {
                "id": 1,
                "question": "What is Dijkstra's algorithm used for?",
                "options": [
                    {"key": "A", "text": "Shortest path in non-negative weighted graphs"},
                    {"key": "B", "text": "Minimum spanning tree"},
                    {"key": "C", "text": "String matching"},
                    {"key": "D", "text": "Sorting elements"}
                ],
                "correct_key": "A",
                "explanation": "Dijkstra computes single-source shortest paths.",
                "difficulty": "medium"
            }
        ]
    }
    
    resp_fail = MagicMock()
    resp_fail.text = "This is not valid JSON at all!"
    
    resp_success = MagicMock()
    resp_success.text = json.dumps(valid_payload)
    
    mock_client.models.generate_content.side_effect = [resp_fail, resp_success]
    engine._client = mock_client
    
    req = QuizGenerateRequest(topic="Algorithms", num_questions=1, difficulty="medium", use_indexed_notes=False)
    result = engine.generate_quiz(req)
    
    assert result.title == "Algorithms Quiz"
    assert len(result.questions) == 1
    assert result.questions[0].correct_key == "A"
    assert mock_client.models.generate_content.call_count == 2
