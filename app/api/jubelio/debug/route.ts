import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const BASE = 'https://api2.jubelio.com';

async function probe(token: string, path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: token }, cache: 'no-store' });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

export async function GET() {
  try {
    const token = await getJubelioToken();
    const itemId = 508;

    const [d1, d2, d3, d4, d5, d6, d7] = await Promise.all([
      probe(token, `/inventory/items/${itemId}/`),
      probe(token, `/inventory/items-to-buy/`),
      probe(token, `/inventory/items/to-buy/`),
      probe(token, `/sales/orders/completed/?page=1&salesorderNo=SP-260310QRSMHTUX`),
      // Try reporting endpoints
      probe(token, `/reporting/sales/?page=1`),
      probe(token, `/reports/sales/?page=1`),
      probe(token, `/sales/summary/?page=1`),
    ]);

    function summarize(r: { status: number; body: unknown }) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 150) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (arr) return { status: 200, count: arr.length, keys: arr.length > 0 ? Object.keys((arr[0]) as Record<string,unknown>) : [] };
      return { status: 200, keys: Object.keys(b), sample: JSON.stringify(b).slice(0, 300) };
    }

    return NextResponse.json({
      'items/508 detail': summarize(d1),
      'items-to-buy (hyphen)': summarize(d2),
      'items/to-buy (slash)': summarize(d3),
      'orders with salesorderNo filter': summarize(d4),
      'reporting/sales': summarize(d5),
      'reports/sales': summarize(d6),
      'sales/summary': summarize(d7),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
