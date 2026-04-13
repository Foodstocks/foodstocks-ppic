import { NextRequest, NextResponse } from 'next/server';

const TABLE = 'foodstocks_kv';
const KEY = 'leadtime_map';

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

export async function GET() {
  try {
    const res = await fetch(`${supabaseUrl()}?key=eq.${KEY}&select=data`, {
      headers: supabaseHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Supabase ${res.status}` });
    }

    const rows = await res.json();
    const data = rows?.[0]?.data ?? {};
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(supabaseUrl(), {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key: KEY, data: body, updated_at: new Date().toISOString() }),
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
