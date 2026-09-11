@echo off
echo Starting Sarvadarshi Backend (FastAPI)...
:: Try python -m uvicorn first, if it fails, try py / uvicorn directly on all interfaces (0.0.0.0)
start "Sarvadarshi Backend" cmd /k "python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000 || py -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000 || uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000"

echo Starting Sarvadarshi Frontend (Next.js)...
start "Sarvadarshi Frontend" cmd /k "cd frontend && npm run dev"

echo Starting 15-minute Ingestion Cron...
start "Sarvadarshi Cron" cmd /k "node cron.js"

echo Both servers and the cron job are spinning up in separate terminal windows!
