/**
 * Sarvadarshi - 15 minute ingestion cron
 */
const DEFAULT_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const ALT_URL = 'http://localhost:8000';
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runIngest() {
  console.log(`[${new Date().toISOString()}] Triggering live ingestion...`);
  
  // Try 127.0.0.1 first (avoids Node 18+ IPv6 ::1 localhost resolution mismatches)
  for (const baseUrl of [DEFAULT_URL, ALT_URL]) {
    try {
      const res = await fetch(`${baseUrl}/v1/ingest/live`, {
        method: 'POST',
      });
      if (res.ok) {
        const text = await res.text();
        console.log(`[${new Date().toISOString()}] Ingestion successful via ${baseUrl}. Response:`, text.slice(0, 120));
        return;
      } else {
        console.warn(`[${new Date().toISOString()}] Ingestion returned status: ${res.status} via ${baseUrl}`);
      }
    } catch (err) {
      // Continue to try next URL
    }
  }

  console.error(
    `[${new Date().toISOString()}] Ingestion error: Could not connect to backend on port 8000.\n` +
    `  Tip: Ensure the FastAPI backend server is running in its terminal window (python -m uvicorn backend.app:app --port 8000).`
  );
}

// Run immediately once, then set interval
setTimeout(() => {
  runIngest();
  setInterval(runIngest, INTERVAL_MS);
}, 5000); // give backend 5s to start

console.log(`Ingestion cron started. Will hit ${DEFAULT_URL}/v1/ingest/live every 15 minutes.`);
