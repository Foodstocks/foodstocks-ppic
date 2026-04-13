import { NextRequest, NextResponse } from 'next/server';

const TABLE = 'foodstocks_kv';

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

function supabaseUrl() {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/rest/v1/${TABLE}`;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ ok: false, error: 'Missing key param' }, { status: 400 });

  try {
    const res = await fetch(`${supabaseUrl()}?key=eq.${encodeURIComponent(key)}&select=data`, {
      headers: supabaseHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) return NextResponse.json({ ok: false, error: `Supabase ${res.status}` });

    const rows = await res.json();
    const data = rows?.[0]?.data ?? null;
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { key: string; data: unknown };
    if (!body.key) return NextResponse.json({ ok: false, error: 'Missing key' }, { status: 400 });

    const res = await fetch(supabaseUrl(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key: body.key, data: body.data, updated_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
