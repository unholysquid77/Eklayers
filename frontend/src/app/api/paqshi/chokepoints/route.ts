import { NextResponse } from 'next/server';

/**
 * PAQSHI — Chokepoint intelligence (R2-16 fusion layer).
 * Proxies the Paqshi FastAPI backend so its live chokepoint stress lands on the
 * globe as a first-class layer. Server-side (no browser CSP), same machine.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const res = await fetch(`${PAQSHI_API}/ui/chokepoints?limit=800`, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 20 },
    });
    if (!res.ok) {
      return NextResponse.json({ chokepoints: [], error: `paqshi ${res.status}` });
    }
    const data = await res.json();
    const items = data.items || data.chokepoints || [];
    const chokepoints = items
      .filter((c: any) => c.latitude != null && c.longitude != null)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        lat: Number(c.latitude),
        lng: Number(c.longitude),
        stress: Math.max(0, Math.min(1, Number(c.stress_level) || 0)),
        baseline: Math.max(0, Math.min(1, Number(c.baseline_stress) || 0)),
        criticality: Math.max(0, Math.min(1, Number(c.criticality) || 0)),
        category: c.category || '',
        country: c.country || '',
      }));
    return NextResponse.json({ chokepoints, total: chokepoints.length });
  } catch (e: any) {
    return NextResponse.json({ chokepoints: [], error: String(e?.message || e) });
  }
}
