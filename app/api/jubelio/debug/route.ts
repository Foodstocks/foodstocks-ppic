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

    // Probe inventory items structure for built-in sales fields
    const [invRes, invDetail, movRes, ledgerRes, doRes] = await Promise.all([
      probe(token, `/inventory/items/?page=1&pageSize=1`),
      probe(token, `/inventory/items/?page=1&pageSize=1&include=sales`),
      probe(token, `/inventory/item-movements/?page=1&pageSize=3`),
      probe(token, `/inventory/ledger/?page=1&pageSize=3`),
      probe(token, `/delivery-order/outbound/?page=1&pageSize=3`),
    ]);

    function firstItem(r: { status: number; body: unknown }) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 150) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (!arr || arr.length === 0) return { status: 200, keys: Object.keys(b), note: 'no array' };
      const item = arr[0] as Record<string, unknown>;
      return { status: 200, keys: Object.keys(item), sample: JSON.stringify(item).slice(0, 500) };
    }

    return NextResponse.json({
      probedOrderId: orderId,
      'orders detail /completed/{id}': summarize(det1),
      'orders detail /orders/{id}': summarize(det2),
      'orders detail /salesorder/{id}': summarize(det3),
      '/inventory/items/ first item': firstItem(invRes),
      '/inventory/items/?include=sales': firstItem(invDetail),
      '/inventory/item-movements/': firstItem(movRes),
      '/inventory/ledger/': firstItem(ledgerRes),
      '/delivery-order/outbound/': firstItem(doRes),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
