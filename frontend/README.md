# PrepE React frontend

This is the primary user interface for PrepE. It is built with React, Vite, React Router, Tailwind CSS, Axios, and Recharts, and communicates with the FastAPI backend.

## Local development

```bash
npm ci
npm run dev
```

The Vite development server normally runs at `http://localhost:5173`.

Configure the backend URL in `frontend/.env`:

```ini
VITE_API_BASE_URL=http://localhost:8000
VITE_API_V1_STR=/api/v1
```

See the project-root `README.md` for complete backend setup, environment configuration, tests, and deployment notes.
