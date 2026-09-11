import { NextResponse } from 'next/server';

/**
 * PAQSHI — draw-a-shape → area intelligence brief (R2-16).
 * The brain's draw tool produces a polygon ring; this forwards it to Paqshi,
 * which finds the chokepoints + geolocated events inside the area and runs a
 * grounded synthesis into a short "why this area matters" brief.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch { /* empty */ }
  const polygon = body?.polygon;
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return NextResponse.json({ error: 'polygon of >=3 points required' }, { status: 400 });
  }
  try {
    const res = await fetch(`${PAQSHI_API}/ui/area/brief`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ polygon, name: body?.name || '' }),
      // the synthesis runs an LLM pass — allow generous time
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return NextResponse.json({ error: `paqshi ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 504 });
  }
}
