import os
from pathlib import Path
from dotenv import load_dotenv

# Allow multiple OpenMP runtimes on Windows to avoid DLL conflicts between Faiss, PyTorch, and Scikit-learn
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["LOKY_MAX_CPU_COUNT"] = "4"

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    PROJECT_NAME: str = "PrepE – AI-Powered Exam Preparation Assistant"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Gemini Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # Hugging Face Embeddings
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    
    # Server configuration
    FASTAPI_HOST: str = os.getenv("FASTAPI_HOST", "0.0.0.0")
    FASTAPI_PORT: int = int(os.getenv("FASTAPI_PORT", 8000))
    API_BASE_URL: str = os.getenv("API_BASE_URL", f"http://localhost:{FASTAPI_PORT}")

    # Comma-separated browser origins allowed to call the API.
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    
    # Storage / Uploads
    UPLOAD_DIR: Path = BASE_DIR / "uploads"

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
