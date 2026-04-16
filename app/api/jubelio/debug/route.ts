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

    // Fetch invoice list to get doc_id
    const invListRes = await probe(token, `/sales/invoices/?page=1&pageSize=3`);
    const invBody = invListRes.body as Record<string, unknown>;
    const invoices = Array.isArray(invBody) ? invBody : (Array.isArray(invBody.data) ? invBody.data : []) as Record<string, unknown>[];
    const firstInv = invoices[0] as Record<string, unknown> | undefined;
    const docId = firstInv ? (firstInv.doc_id ?? firstInv.id ?? 'none') : 'none';
    const invSalesorderId = firstInv ? (firstInv.salesorder_id ?? 'none') : 'none';

    const [det5, det6, det7, det8] = await Promise.all([
      docId !== 'none' ? probe(token, `/sales/invoices/${docId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      invSalesorderId !== 'none' ? probe(token, `/sales/orders/completed/${invSalesorderId}/`) : Promise.resolve({ status: 0, body: 'no id' }),
      probe(token, `/sales/pos/?page=1&pageSize=3`),
      probe(token, `/inventory/items/movements/?page=1&pageSize=3`),
    ]);

    return NextResponse.json({
      probedId: orderId,
      firstOrderKeys: orderKeys,
      docId,
      invSalesorderId,
      'detail /completed/{id}': summarize(det1),
      'detail /orders/{id}': summarize(det2),
      'detail /salesorder/{id}': summarize(det3),
      'invoice detail /invoices/{docId}': summarize(det5),
      'order via invoice salesorder_id': summarize(det6),
      '/sales/pos/': summarize(det7),
      '/inventory/items/movements/': summarize(det8),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
