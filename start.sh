#!/bin/bash
echo "Starting Sarvadarshi servers..."

echo "Starting Backend (FastAPI)..."
uvicorn backend.app:app --reload --port 8000 &

echo "Starting Frontend (Next.js)..."
(cd frontend && npm run dev) &

echo "Starting Ingestion Cron..."
node cron.js &

wait
