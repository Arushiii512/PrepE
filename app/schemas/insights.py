from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class TopicCluster(BaseModel):
    cluster_id: int
    topic_label: str
    keywords: List[str]
    question_count: int
    percentage: float
    sample_questions: List[str]

class ClusterAnalysisRequest(BaseModel):
    questions: List[str] = Field(..., min_length=2, description="List of previous year questions")
    num_clusters: Optional[int] = Field(default=None, ge=2, le=10, description="Auto-computed if None")

class ClusterAnalysisResponse(BaseModel):
    total_questions_analyzed: int
    clusters: List[TopicCluster]
    plotly_chart_json: Dict[str, Any]
    scatter_chart_json: Optional[Dict[str, Any]] = None
