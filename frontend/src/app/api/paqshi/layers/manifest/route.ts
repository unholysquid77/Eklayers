import { NextResponse } from 'next/server';

/**
 * PAQSHI — layer manifest (R2-16 feed-merge).
 * Paqshi serves 27 curated/derived intel layers (nuclear sites, refineries, LNG
 * terminals, ports, undersea cables, ACLED conflict, FIRMS fires, drought,
 * conflict zones, …) each as GeoJSON. This lists them so the brain can render
 * PAQSHI's own feeds on the globe instead of OSIRIS's independent fetches.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const res = await fetch(`${PAQSHI_API}/ui/layers/manifest`, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 300 },
    });
    if (!res.ok) return NextResponse.json({ layers: [], error: `paqshi ${res.status}` });
    const d = await res.json();
    const layers = (d.layers || []).map((l: any) => ({
      id: l.id,
      label: l.label || l.id,
      color: l.color || l._color || '#58a6ff',
      render: l.render || 'point',       // point | line | polygon
      source: l.source || '',
      needsBbox: l.source === 'overpass', // OSM-per-region layers
      icon: l.icon || '',
    })).filter((l: any) => l.id && l.source !== 'computed'); // day_night handled natively
    return NextResponse.json({ layers, total: layers.length });
  } catch (e: any) {
    return NextResponse.json({ layers: [], error: String(e?.message || e) });
  }
}
