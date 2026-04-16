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
    const orderKeys = firstOrder ? Object.keys(firstOrder) : [];
    const orderId = firstOrder
      ? (firstOrder.salesorder_id ?? firstOrder.id ?? firstOrder.order_id ?? firstOrder.no ?? 'unknown')
      : 'none';

    // Try detail endpoints with actual order ID
    const [det1, det2, det3, det4] = await Promise.all([
      orderId !== 'none' ? probe(token, `/sales/orders/completed/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      orderId !== 'none' ? probe(token, `/sales/orders/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      orderId !== 'none' ? probe(token, `/salesorder/${orderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      orderId !== 'none' ? probe(token, `/sales/orders/completed/?id=${orderId}&page=1&pageSize=1`) : Promise.resolve({ status: 0, body: 'no id' }),
    ]);

    function summarize(r: { status: number; body: unknown }) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 200) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (arr) return { status: 200, count: arr.length, keys: arr.length > 0 ? Object.keys(arr[0] as Record<string,unknown>) : [] };
      return { status: 200, keys: Object.keys(b), sample: JSON.stringify(b).slice(0, 400) };
    }

    // More endpoint patterns to try
    const salesorderNo = firstOrder ? String(firstOrder.salesorder_no ?? '') : '';
    const [det5, det6, det7, det8, det9] = await Promise.all([
      probe(token, `/sales/orders/completed/${orderId}`),           // no trailing slash
      probe(token, `/sales/orders/completed/?salesorder_id=${orderId}&page=1&pageSize=1`),
      probe(token, `/sales/invoices/?page=1&pageSize=3`),
      probe(token, `/sales/transactions/?page=1&pageSize=3`),
      salesorderNo ? probe(token, `/sales/orders/completed/?salesorder_no=${encodeURIComponent(salesorderNo)}&page=1&pageSize=1`) : Promise.resolve({ status: 0, body: 'no no' }),
    ]);

    return NextResponse.json({
      listStatus: listRes.status,
      listTopKeys: Object.keys(listBody),
      orderCount: orders.length,
      firstOrderKeys: orderKeys,
      firstOrderSample: firstOrder ? JSON.stringify(firstOrder).slice(0, 500) : null,
      probedId: orderId,
      probedNo: salesorderNo,
      'detail /completed/{id}': summarize(det1),
      'detail /orders/{id}': summarize(det2),
      'detail /salesorder/{id}': summarize(det3),
      'list filter ?id=': summarize(det4),
      'detail /completed/{id} no slash': summarize(det5),
      'list ?salesorder_id=': summarize(det6),
      '/sales/invoices/': summarize(det7),
      '/sales/transactions/': summarize(det8),
      'list ?salesorder_no=': summarize(det9),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
