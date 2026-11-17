import os
import threading
from typing import Optional
from sentence_transformers import SentenceTransformer
from app.config import settings

_model_lock = threading.Lock()
_embedding_model: Optional[SentenceTransformer] = None

def get_embedding_model() -> SentenceTransformer:
    """Lazy-load and return the singleton SentenceTransformer embedding model."""
    global _embedding_model
    if _embedding_model is None:
        with _model_lock:
            if _embedding_model is None:
                try:
                    # Prefer local cache to prevent network delays
                    _embedding_model = SentenceTransformer(
                        settings.EMBEDDING_MODEL_NAME,
                        local_files_only=True
                    )
                except Exception:
                    # If not cached locally, allow online download
                    _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    return _embedding_model
