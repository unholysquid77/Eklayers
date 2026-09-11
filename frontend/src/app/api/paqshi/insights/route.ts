import { NextResponse } from 'next/server';

/**
 * PAQSHI — AI insights overlay (R2-16 fusion).
 * Surfaces Paqshi's synthesized world brief + rising-risk cards on the globe as
 * a floating intel panel. Read-only proxy; Paqshi does the synthesis (LLM-cached
 * server-side, no per-request model call here).
 */
const PAQSHI_API = process.env.PAQSHI_API_URL || 'http://127.0.0.1:8000';

export async function GET() {
  try {
    const res = await fetch(`${PAQSHI_API}/ui/insights/current`, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 120 },
    });
    if (!res.ok) return NextResponse.json({ world_brief: '', rising_risks: [], error: `paqshi ${res.status}` });
    const d = await res.json();
    const rising = (d.rising_risks || []).map((r: any) => ({
      title: r.title || '',
      read: r.read || r.summary || '',
      severity: Number(r.severity ?? 0) || 0,
      // provenance the card was grounded on — {tag,kind,id,text,url}. Powers the
      // clickable pulse (fly to a cited chokepoint, show sources).
      evidence: Array.isArray(r.evidence) ? r.evidence : [],
    })).filter((r: any) => r.title);
    return NextResponse.json({
      world_brief: d.world_brief || '',
      rising_risks: rising,
      generated_at: d.generated_at || null,
    });
  } catch (e: any) {
    return NextResponse.json({ world_brief: '', rising_risks: [], error: String(e?.message || e) });
  }
}
