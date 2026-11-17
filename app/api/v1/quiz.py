from fastapi import APIRouter, HTTPException
from app.schemas.quiz import QuizGenerateRequest, QuizResponse
from app.services.quiz_engine import quiz_service

router = APIRouter(prefix="/quiz", tags=["Quiz PrepE"])

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz_endpoint(request: QuizGenerateRequest):
    """Generate structured MCQs with Pydantic validation and automatic retries."""
    try:
        quiz = quiz_service.generate_quiz(request)
        return quiz
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")
