import { NextResponse } from 'next/server';

/**
 * PAQSHI — chokepoint cascade relations (R2-16 arc layer).
 * Proxies the Paqshi cp_relations influence graph (7k+ edges) and returns the
 * STRONGEST edges only (capped) so the globe shows meaningful cascade arcs, not
 * a spaghetti mesh. Arcs are drawn client-side between the chokepoint coords.
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cap = Math.min(400, Math.max(20, Number(searchParams.get('cap')) || 220));
  const minWeight = Number(searchParams.get('min_weight')) || 0.35;
  try {
    const res = await fetch(`${PAQSHI_API}/ui/cp_relations?limit=8000`, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ relations: [], error: `paqshi ${res.status}` });
    const data = await res.json();
    const edges = data.edges || data.relations || [];
    const rels = edges
      .map((e: any) => ({
        from: e.from_cp || e.from,
        to: e.to_cp || e.to,
        weight: Number(e.weight) || 0,
        type: e.relation_type || e.type || '',
      }))
      .filter((e: any) => e.from && e.to && e.from !== e.to && e.weight >= minWeight)
      .sort((a: any, b: any) => b.weight - a.weight)
      .slice(0, cap);
    return NextResponse.json({ relations: rels, total: rels.length });
  } catch (e: any) {
    return NextResponse.json({ relations: [], error: String(e?.message || e) });
  }
}
