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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Try order list with different params to get embedded items
    const [r1, r2, r3, r4, r5] = await Promise.all([
      probe(token, `/sales/orders/completed/?page=1&pageSize=1&include_items=true`),
      probe(token, `/sales/orders/completed/?page=1&pageSize=1&detail=true`),
      probe(token, `/sales/orders/completed/?page=1&pageSize=1&expand=items`),
      probe(token, `/sales/orders/completed/items/?page=1&pageSize=3`),
      probe(token, `/sales/items/?createdSince=${thirtyDaysAgo}&page=1&pageSize=3`),
    ]);

    function inspect(r: { status: number; body: unknown }, label: string) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 150) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (!arr || arr.length === 0) return { status: 200, topKeys: Object.keys(b) };
      const first = arr[0] as Record<string, unknown>;
      const hasItems = 'items' in first || 'line_items' in first || 'order_items' in first;
      return { status: 200, label, count: arr.length, firstKeys: Object.keys(first), hasItems, sample: JSON.stringify(first).slice(0, 300) };
    }

    return NextResponse.json({
      'completed/?include_items=true': inspect(r1, 'include_items'),
      'completed/?detail=true': inspect(r2, 'detail'),
      'completed/?expand=items': inspect(r3, 'expand'),
      'completed/items/': inspect(r4, 'items subpath'),
      '/sales/items/': inspect(r5, 'sales items'),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
