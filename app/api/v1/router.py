from fastapi import APIRouter
from app.api.v1.rag import router as rag_router
from app.api.v1.quiz import router as quiz_router
from app.api.v1.insights import router as insights_router

api_v1_router = APIRouter()
api_v1_router.include_router(rag_router)
api_v1_router.include_router(quiz_router)
api_v1_router.include_router(insights_router)
