/**
 * Sarvadarshi - 15 minute ingestion cron
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runIngest() {
  console.log(`[${new Date().toISOString()}] Triggering live ingestion...`);
  try {
    const res = await fetch(`${BACKEND_URL}/v1/ingest/live`, {
      method: 'POST',
    });
    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] Ingestion failed with status: ${res.status}`);
    } else {
      console.log(`[${new Date().toISOString()}] Ingestion successful.`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Ingestion error:`, err.message);
  }
}

// Run immediately once, then set interval
setTimeout(() => {
  runIngest();
  setInterval(runIngest, INTERVAL_MS);
}, 5000); // give backend 5s to start

console.log(`Ingestion cron started. Will hit ${BACKEND_URL}/v1/ingest/live every 15 minutes.`);
