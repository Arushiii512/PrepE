from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class MCQOption(BaseModel):
    key: Literal["A", "B", "C", "D"]
    text: str

class MCQQuestion(BaseModel):
    id: int
    question: str
    options: List[MCQOption]
    correct_key: Literal["A", "B", "C", "D"]
    explanation: str
    difficulty: Literal["easy", "medium", "hard"] = "medium"

class QuizGenerateRequest(BaseModel):
    topic: Optional[str] = None
    use_indexed_notes: bool = True
    num_questions: int = Field(default=5, ge=1, le=15)
    difficulty: Literal["easy", "medium", "hard"] = "medium"

class QuizResponse(BaseModel):
    title: str
    total_questions: int
    questions: List[MCQQuestion]
