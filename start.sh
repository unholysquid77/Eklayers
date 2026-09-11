#!/bin/bash
echo "Starting Sarvadarshi servers..."

echo "Starting Backend (FastAPI)..."
(cd backend && uvicorn app:app --reload) &

echo "Starting Frontend (Next.js)..."
(cd frontend && npm run dev) &

wait
