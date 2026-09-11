@echo off
echo Starting Sarvadarshi Backend (FastAPI)...
start "Sarvadarshi Backend" cmd /k "cd backend && uvicorn app:app --reload"

echo Starting Sarvadarshi Frontend (Next.js)...
start "Sarvadarshi Frontend" cmd /k "cd frontend && npm run dev"

echo Both servers are spinning up in separate terminal windows!
