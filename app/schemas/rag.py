from pydantic import BaseModel, Field
from typing import List, Optional

class Citation(BaseModel):
    source_file: str
    page_number: int
    snippet: str

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Student's question")
    top_k: int = Field(default=3, ge=1, le=10)

class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    found_in_notes: bool = True
    fallback_message: Optional[str] = None

class DocumentUploadResponse(BaseModel):
    filename: str
    total_pages: int
    chunks_indexed: int
    message: str
