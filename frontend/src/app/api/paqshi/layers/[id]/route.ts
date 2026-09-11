import { NextResponse } from 'next/server';

/**
 * PAQSHI — per-layer GeoJSON (R2-16 feed-merge).
 * Proxies /ui/layers/{id}. Overpass-sourced layers (ports, refineries, …) need
 * a bbox = the current viewport; pass ?bbox=W,S,E,N through. Curated/derived
 * layers ignore it.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get('bbox');
  const qs = bbox ? `?bbox=${encodeURIComponent(bbox)}` : '';
  try {
    const res = await fetch(`${PAQSHI_API}/ui/layers/${encodeURIComponent(id)}${qs}`, {
      // overpass/FIRMS/GDELT fetches can be slow the first time
      signal: AbortSignal.timeout(30000),
      next: { revalidate: 120 },
    });
    if (!res.ok) return NextResponse.json({ type: 'FeatureCollection', features: [], error: `paqshi ${res.status}` });
    const fc = await res.json();
    // normalise to a FeatureCollection the map can consume directly
    if (fc && fc.type === 'FeatureCollection') return NextResponse.json(fc);
    return NextResponse.json({ type: 'FeatureCollection', features: fc?.features || [] });
  } catch (e: any) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: String(e?.message || e) });
  }
}
