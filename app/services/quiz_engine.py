import json
import logging
from typing import Optional, List
from google import genai
from google.genai import types
from pydantic import ValidationError

from app.config import settings
from app.schemas.quiz import QuizGenerateRequest, QuizResponse, MCQQuestion, MCQOption
from app.services.rag_engine import rag_service

logger = logging.getLogger(__name__)

QUIZ_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "total_questions": {"type": "integer"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "question": {"type": "string"},
                    "options": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": {"type": "string", "enum": ["A", "B", "C", "D"]},
                                "text": {"type": "string"}
                            },
                            "required": ["key", "text"]
                        }
                    },
                    "correct_key": {"type": "string", "enum": ["A", "B", "C", "D"]},
                    "explanation": {"type": "string"},
                    "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
                },
                "required": ["id", "question", "options", "correct_key", "explanation", "difficulty"]
            }
        }
    },
    "required": ["title", "total_questions", "questions"]
}

def generate_mock_quiz(topic: str, num_questions: int, difficulty: str) -> QuizResponse:
    """Fallback generator for offline testing or missing API keys."""
    questions = []
    for i in range(1, num_questions + 1):
        questions.append(MCQQuestion(
            id=i,
            question=f"Sample Question {i} on {topic or 'General Concepts'}: Which concept is fundamental?",
            options=[
                MCQOption(key="A", text="Option A: Fundamental Principle"),
                MCQOption(key="B", text="Option B: Secondary Factor"),
                MCQOption(key="C", text="Option C: Irrelevant Detail"),
                MCQOption(key="D", text="Option D: None of the above"),
            ],
            correct_key="A",
            explanation="Option A represents the primary established definition covered in the syllabus.",
            difficulty=difficulty  # type: ignore
        ))
    return QuizResponse(
        title=f"Practice Quiz: {topic or 'Uploaded Study Notes'}",
        total_questions=len(questions),
        questions=questions
    )

class QuizEngine:
    def __init__(self):
        self._client: Optional[genai.Client] = None
        self.max_retries = 3

    @property
    def client(self) -> Optional[genai.Client]:
        if self._client is None and settings.GEMINI_API_KEY:
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def generate_quiz(self, request: QuizGenerateRequest) -> QuizResponse:
        """
        Generate structured MCQs with Pydantic validation and automatic retry logic.
        """
        # 1. Gather context
        context_text = ""
        topic_title = request.topic or "Uploaded Notes"
        
        if request.use_indexed_notes and rag_service.get_total_chunks() > 0:
            if request.topic:
                relevant_chunks = rag_service.retrieve(request.topic, top_k=5)
                context_text = "\n\n".join([f"[{c['source_file']} p.{c['page_number']}]: {c['text']}" for c in relevant_chunks])
            else:
                # Use up to 5 diverse chunks from the store
                chunks = rag_service.doc_store[:5]
                context_text = "\n\n".join([f"[{c['source_file']} p.{c['page_number']}]: {c['text']}" for c in chunks])
                topic_title = "Uploaded Course Material"
        
        client = self.client
        if client is None:
            # Fallback to mock quiz if no Gemini client available
            return generate_mock_quiz(topic_title, request.num_questions, request.difficulty)

        # Build prompt instructions
        base_prompt = (
            f"Generate a rigorous academic multiple-choice quiz with exactly {request.num_questions} questions.\n"
            f"Topic/Subject: {topic_title}\n"
            f"Difficulty Level: {request.difficulty}\n\n"
        )
        if context_text:
            base_prompt += f"Source Context from Student's Notes:\n{context_text}\n\n"
        
        base_prompt += (
            "REQUIREMENTS:\n"
            "1. Each question must have exactly 4 distinct options with keys 'A', 'B', 'C', 'D'.\n"
            "2. 'correct_key' must match exactly one of 'A', 'B', 'C', or 'D'.\n"
            "3. Provide a clear, educational explanation for why the correct answer is right.\n"
            "4. Output strictly valid JSON matching the required schema. Do NOT include markdown code fences or conversational text."
        )

        feedback = ""
        for attempt in range(1, self.max_retries + 1):
            attempt_prompt = base_prompt
            if feedback:
                attempt_prompt += f"\n\nCRITICAL FIX FROM PREVIOUS ATTEMPT:\n{feedback}\nPlease rectify and return strictly valid JSON."

            try:
                response = client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=attempt_prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        response_mime_type="application/json",
                        response_schema=QUIZ_JSON_SCHEMA,
                    )
                )
                
                raw_text = response.text.strip()
                # Clean any stray markdown formatting if present
                if raw_text.startswith("```"):
                    raw_text = raw_text.strip("`")
                    if raw_text.startswith("json"):
                        raw_text = raw_text[4:].strip()
                
                parsed_json = json.loads(raw_text)
                validated_quiz = QuizResponse.model_validate(parsed_json)
                
                # Verify questions list count matches
                if validated_quiz.questions:
                    validated_quiz.total_questions = len(validated_quiz.questions)
                    return validated_quiz
                else:
                    feedback = "The questions array was empty. Generate at least 1 question."

            except (json.JSONDecodeError, ValidationError) as err:
                logger.warning(f"Quiz generation attempt {attempt} failed validation: {err}")
                feedback = f"Validation/JSON error: {str(err)}. Ensure valid JSON conforming to the schema."
            except Exception as e:
                logger.error(f"Gemini API error on attempt {attempt}: {e}")
                feedback = f"API error: {str(e)}"

        # If all retries failed, fallback to mock generator
        logger.error(f"All {self.max_retries} attempts failed. Returning fallback quiz.")
        return generate_mock_quiz(topic_title, request.num_questions, request.difficulty)

quiz_service = QuizEngine()
