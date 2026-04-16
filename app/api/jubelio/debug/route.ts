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

    // Get full variant structure from first inventory item
    const invRes = await probe(token, `/inventory/items/?page=1&pageSize=1`);
    const invBody2 = invRes.body as Record<string, unknown>;
    const groups = Array.isArray(invBody2) ? invBody2 : (Array.isArray(invBody2.data) ? invBody2.data : []) as Record<string, unknown>[];
    const firstGroup = groups[0] as Record<string, unknown> | undefined;
    const firstVariant = firstGroup && Array.isArray(firstGroup.variants) ? (firstGroup.variants[0] as Record<string, unknown>) : undefined;
    const variantKeys = firstVariant ? Object.keys(firstVariant) : [];
    const variantSample = firstVariant ? JSON.stringify(firstVariant) : null;

    // Probe more endpoints using known IDs
    const itemGroupId = firstGroup ? String(firstGroup.item_group_id ?? '') : '';
    const itemId = firstVariant ? String(firstVariant.item_id ?? '') : '';
    const [grpDetail, itemHistory, itemSales, doRes, repSales] = await Promise.all([
      itemGroupId ? probe(token, `/inventory/items/${itemGroupId}/`) : Promise.resolve({ status: 0, body: 'no gid' }),
      itemId ? probe(token, `/inventory/items/${itemId}/history/?page=1&pageSize=3`) : Promise.resolve({ status: 0, body: 'no id' }),
      itemId ? probe(token, `/inventory/items/${itemId}/sales/?page=1&pageSize=3`) : Promise.resolve({ status: 0, body: 'no id' }),
      probe(token, `/delivery-order/?page=1&pageSize=3`),
      probe(token, `/reports/item-sales/?page=1&pageSize=3`),
    ]);

    function firstItem(r: { status: number; body: unknown }) {
      if (r.status !== 200) return { status: r.status, err: JSON.stringify(r.body).slice(0, 200) };
      const b = r.body as Record<string, unknown>;
      const arr = Array.isArray(b) ? b : (Array.isArray(b.data) ? b.data : null);
      if (!arr || arr.length === 0) return { status: 200, keys: Object.keys(b), note: 'no array' };
      const item = arr[0] as Record<string, unknown>;
      return { status: 200, keys: Object.keys(item), sample: JSON.stringify(item).slice(0, 400) };
    }

    return NextResponse.json({
      variantKeys,
      variantSample,
      probedGroupId: itemGroupId,
      probedItemId: itemId,
      '/inventory/items/{groupId}/': firstItem(grpDetail),
      '/inventory/items/{itemId}/history/': firstItem(itemHistory),
      '/inventory/items/{itemId}/sales/': firstItem(itemSales),
      '/delivery-order/': firstItem(doRes),
      '/reports/item-sales/': firstItem(repSales),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
