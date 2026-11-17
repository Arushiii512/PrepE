# PrepE — AI-powered exam preparation assistant

PrepE is a React + FastAPI application for studying from course notes, generating practice quizzes, and analysing previous-year questions.

## Features

### Ask PrepE
- Upload PDF lecture notes.
- Extract page-aware text and index chunks using Sentence Transformers and FAISS.
- Ask questions against the indexed notes.
- Receive answers with source-file and page citations, with a fallback when the notes do not contain the answer.

### Quiz PrepE
- Generate multiple-choice questions with Google Gemini.
- Choose a topic, number of questions, and difficulty.
- Optionally ground quiz generation in indexed notes.
- Answer questions, see the score, and review explanations.

### PrepE Insights
- Upload PDF/TXT past papers or paste questions.
- Group similar questions using sentence embeddings and KMeans.
- Review topic frequency, keywords, sample questions, and semantic visualisations.

## Architecture

- **Frontend:** React 18, Vite, React Router, Tailwind CSS, Recharts, Axios.
- **Backend:** FastAPI, Pydantic.
- **AI:** Google Gemini and Sentence Transformers (`all-MiniLM-L6-v2`).
- **Vector search:** FAISS CPU.
- **Analytics:** Scikit-learn (KMeans, PCA, TF-IDF).
- **PDF processing:** PyMuPDF.

The browser communicates with FastAPI through `/api/v1` endpoints. Gemini credentials remain on the backend and must never be placed in a `VITE_` variable.

## Prerequisites

- Python 3.10+ (use a version supported by the installed FAISS/PyTorch wheels).
- Node.js 18+ and npm.
- A Gemini API key for live Gemini-generated answers and quizzes.

## Setup

### 1. Backend

From the project root, create and activate a virtual environment, then install dependencies:

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

Create `.env` in the project root using `.env.example` as a template, then add your own Gemini API key. Do not commit `.env`.

Start FastAPI:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: `http://localhost:8000/health`
- Interactive API docs: `http://localhost:8000/docs`

### 2. React frontend

Open a second terminal:

```bash
cd frontend
npm ci
```

Create `frontend/.env` from `frontend/.env.example` if it does not exist. For local development it should contain:

```ini
VITE_API_BASE_URL=http://localhost:8000
VITE_API_V1_STR=/api/v1
```

Start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Tests and production build

From the project root:

```bash
pytest -v
```

For the frontend production build:

```bash
cd frontend
npm run build
npm run preview
```

## Important behaviour and limitations

- The current FAISS index is held in backend process memory. Restarting FastAPI clears indexed notes; upload them again after a restart. Persistent vector storage is a future improvement.
- Quiz generation can return clearly labelled sample questions if Gemini is unavailable or validation fails. Do not treat sample questions as AI-generated study material.
- For deployment, set `CORS_ORIGINS` to the exact deployed React origin(s), separated by commas. Set `VITE_API_BASE_URL` to the deployed backend URL and rebuild the frontend.
- Never commit `.env`, API keys, `node_modules`, or build output.

### Scanned and handwritten PYQ PDFs

PrepE Insights first tries normal PDF text extraction. If fewer than two questions can be
parsed, it automatically falls back to Gemini Vision OCR for scanned/image-based PDFs.
Set `GEMINI_API_KEY` in the project-root `.env` file and restart FastAPI to enable this.
OCR processes up to 90 pages per upload in batches of three pages. Clear, upright scans
produce the best results; handwritten recognition can still be imperfect and should be
reviewed before relying on the topic analysis.
