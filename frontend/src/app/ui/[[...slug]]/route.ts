import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for /ui/* routes used by the Globe application.
 * All requests are proxied to the FastAPI backend at /v1/globe/*
 */

const SARVADARSHI_BACKEND = process.env.SARVADARSHI_BACKEND_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const path = '/' + (slug?.join('/') || '');
  const url = new URL(request.url);

  try {
    const targetUrl = `${SARVADARSHI_BACKEND}/v1/globe${path}${url.search}`;
    const res = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: `Backend responded with ${res.status}` }, { status: res.status });
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: 'Backend unreachable or timed out' }, { status: 502 });
  }
}
