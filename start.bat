@echo off
echo Starting Sarvadarshi Backend (FastAPI)...
start "Sarvadarshi Backend" cmd /k "uvicorn backend.app:app --reload --port 8000"

echo Starting Sarvadarshi Frontend (Next.js)...
start "Sarvadarshi Frontend" cmd /k "cd frontend && npm run dev"

echo Starting 15-minute Ingestion Cron...
start "Sarvadarshi Cron" cmd /k "node cron.js"

echo Servers are spinning up in separate terminal windows!
