import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPEE_BASE = 'https://partner.test-stable.shopeemobile.com';
const DAYS = 90;

function shopeeSign(partnerKey: string, partnerId: string, path: string, ts: number, accessToken: string, shopId: string) {
  return crypto.createHmac('sha256', partnerKey.trim()).update(`${partnerId}${path}${ts}${accessToken}${shopId}`).digest('hex').toUpperCase();
}

async function fetchOrderList(partnerId: string, partnerKey: string, accessToken: string, shopId: string): Promise<string[]> {
  const path = '/api/v2/order/get_order_list';
  const timeFrom = Math.floor(Date.now() / 1000) - DAYS * 24 * 3600;
  const timeTo = Math.floor(Date.now() / 1000);
  const orderSns: string[] = [];
  let cursor = '';

  while (true) {
    const ts = Math.floor(Date.now() / 1000);
    const sign = shopeeSign(partnerKey, partnerId, path, ts, accessToken, shopId);
    const params = new URLSearchParams({
      partner_id: partnerId, timestamp: String(ts), sign, access_token: accessToken, shop_id: shopId,
      time_range_field: 'create_time', time_from: String(timeFrom), time_to: String(timeTo),
      page_size: '100', order_status: 'COMPLETED',
      ...(cursor ? { cursor } : {}),
    });

    const res = await fetch(`${SHOPEE_BASE}${path}?${params}`);
    const json = await res.json();

    if (json.error || !json.response) break;

    const orders: { order_sn: string }[] = json.response.order_list ?? [];
    for (const o of orders) orderSns.push(o.order_sn);

    if (!json.response.more || !json.response.next_cursor) break;
    cursor = json.response.next_cursor;
  }

  return orderSns;
}

async function fetchOrderDetails(partnerId: string, partnerKey: string, accessToken: string, shopId: string, orderSns: string[]) {
  const path = '/api/v2/order/get_order_detail';
  const BATCH = 50;
  const velMap: Record<string, number> = {};

  for (let i = 0; i < orderSns.length; i += BATCH) {
    const batch = orderSns.slice(i, i + BATCH);
    const ts = Math.floor(Date.now() / 1000);
    const sign = shopeeSign(partnerKey, partnerId, path, ts, accessToken, shopId);
    const params = new URLSearchParams({
      partner_id: partnerId, timestamp: String(ts), sign, access_token: accessToken, shop_id: shopId,
      order_sn_list: batch.join(','), response_optional_fields: 'item_list',
    });

    const res = await fetch(`${SHOPEE_BASE}${path}?${params}`);
    const json = await res.json();

    if (json.error || !json.response?.order_list) continue;

    for (const order of json.response.order_list) {
      for (const item of order.item_list ?? []) {
        const sku = item.item_sku ?? item.model_sku ?? '';
        if (!sku) continue;
        velMap[sku] = (velMap[sku] ?? 0) + (item.model_quantity_purchased ?? 1);
      }
    }
  }

  return velMap;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accessToken = searchParams.get('access_token');
  const shopId = searchParams.get('shop_id');

  if (!accessToken || !shopId) {
    return NextResponse.json({ error: 'access_token dan shop_id wajib diisi' }, { status: 400 });
  }

  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    return NextResponse.json({ error: 'SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum diset' }, { status: 500 });
  }

  try {
    const orderSns = await fetchOrderList(partnerId, partnerKey, accessToken, shopId);

    if (orderSns.length === 0) {
      return NextResponse.json({ ok: true, velocity: {}, orderCount: 0, skuCount: 0, days: DAYS });
    }

    const totalQtyMap = await fetchOrderDetails(partnerId, partnerKey, accessToken, shopId, orderSns);

    const velocity: Record<string, number> = {};
    for (const [sku, total] of Object.entries(totalQtyMap)) {
      velocity[sku] = Math.round((total / DAYS) * 100) / 100;
    }

    return NextResponse.json({
      ok: true,
      velocity,
      orderCount: orderSns.length,
      skuCount: Object.keys(velocity).length,
      days: DAYS,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error' }, { status: 500 });
  }
}
