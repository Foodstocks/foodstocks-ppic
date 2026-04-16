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

    // Fetch first page of completed orders to inspect structure
    const listRes = await probe(token, `/sales/orders/completed/?createdSince=${thirtyDaysAgo}&page=1&pageSize=3`);
    const listBody = listRes.body as Record<string, unknown>;
    const orders = Array.isArray(listBody) ? listBody : (Array.isArray(listBody.data) ? listBody.data : []) as Record<string, unknown>[];

    const firstOrder = orders[0] as Record<string, unknown> | undefined;
    const orderId = firstOrder
      ? (firstOrder.salesorder_id ?? firstOrder.id ?? firstOrder.order_id ?? firstOrder.no ?? 'unknown')
      : 'none';

    // Try detail endpoints with actual order ID
    const [det1, det2, det3] = await Promise.all([
      orderId !== 'none' ? probe(token, `/sales/orders/completed/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      orderId !== 'none' ? probe(token, `/sales/orders/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      orderId !== 'none' ? probe(token, `/salesorder/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
    ]);

    function summarize(r: { status: number; body: unknown }) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 200) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (arr) return { status: 200, count: arr.length, keys: arr.length > 0 ? Object.keys(arr[0] as Record<string,unknown>) : [] };
      return { status: 200, keys: Object.keys(b), sample: JSON.stringify(b).slice(0, 400) };
    }

    const salesorderNo = firstOrder ? String(firstOrder.salesorder_no ?? '') : '';
    const internalSoNo = firstOrder ? String(firstOrder.internal_so_number ?? '') : '';

    const [det5, det6, det7, det8, det9] = await Promise.all([
      salesorderNo ? probe(token, `/sales/orders/completed/${encodeURIComponent(salesorderNo)}/`) : Promise.resolve({ status: 0, body: 'no no' }),
      internalSoNo ? probe(token, `/sales/orders/completed/${encodeURIComponent(internalSoNo)}/`) : Promise.resolve({ status: 0, body: 'no so' }),
      probe(token, `/reporting/item-sales/?page=1&pageSize=3`),
      probe(token, `/inventory/stock-mutations/?page=1&pageSize=3`),
      probe(token, `/sales/reports/items/?page=1&pageSize=3`),
    ]);

    return NextResponse.json({
      probedId: orderId,
      salesorderNo,
      internalSoNo,
      firstOrderSample: firstOrder ? JSON.stringify(firstOrder).slice(0, 600) : null,
      'detail /completed/{id}': summarize(det1),
      'detail /orders/{id}': summarize(det2),
      'detail /salesorder/{id}': summarize(det3),
      'detail via salesorder_no string': summarize(det5),
      'detail via internal_so_number': summarize(det6),
      '/reporting/item-sales/': summarize(det7),
      '/inventory/stock-mutations/': summarize(det8),
      '/sales/reports/items/': summarize(det9),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
