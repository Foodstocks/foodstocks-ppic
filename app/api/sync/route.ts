import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

// In-memory cache (shared across requests in the same serverless instance)
const memCache: Record<string, { value: unknown; expiresAt: number }> = {};

async function kvSet(key: string, value: unknown, exSeconds = 7200) {
  memCache[key] = { value, expiresAt: Date.now() + exSeconds * 1000 };
}

/** Persist a key/value to Supabase KV so data survives across serverless instances */
async function supabaseKvSet(key: string, data: unknown): Promise<void> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!base || !apiKey) return; // skip if Supabase not configured
  try {
    await fetch(`${base}/rest/v1/foodstocks_kv`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }),
    });
  } catch { /* non-fatal — memory cache still works */ }
}

async function jubelioFetchAll(path: string, token: string): Promise<unknown[]> {
  const results: unknown[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const res = await fetch(`${JUBELIO_BASE}${path}?page=${page}&pageSize=${pageSize}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) break;
    const json = await res.json();
    const items = Array.isArray(json) ? json : (json.data ?? []);
    if (!items.length) break;
    results.push(...items);
    const total = json.totalCount ?? items.length;
    if (results.length >= total || items.length < pageSize) break;
    page++;
  }
  return results;
}

/** Calculate rolling 30-day velocity per SKU from completed sales */
function calcVelocityMap(salesOrders: unknown[]): Record<string, number> {
  const skuTotals: Record<string, number> = {};
  for (const order of salesOrders) {
    const o = order as Record<string, unknown>;
    const items = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
    for (const item of items) {
      const sku = String(item.item_code ?? item.sku ?? '');
      const qty = Number(item.quantity ?? item.qty ?? 0);
      if (sku) skuTotals[sku] = (skuTotals[sku] ?? 0) + qty;
    }
  }
  // Divide by 30 to get avg daily sales
  const velocityMap: Record<string, number> = {};
  for (const [sku, total] of Object.entries(skuTotals)) {
    velocityMap[sku] = Math.round((total / 30) * 100) / 100;
  }
  return velocityMap;
}

/** Normalize inventory items from Jubelio response */
function normalizeInventory(groups: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const group of groups) {
    const g = group as Record<string, unknown>;
    const variants = Array.isArray(g.variants) ? (g.variants as Record<string, unknown>[]) : [g];
    for (const v of variants) {
      result.push({
        sku: String(v.item_code ?? g.item_code ?? ''),
        name: String(v.item_name ?? g.item_name ?? ''),
        sellPrice: Number(v.sell_price ?? g.sell_price ?? 0),
        buyPrice: Number(v.buy_price ?? g.buy_price ?? 0),
        category: String(g.item_category_name ?? g.item_category_id ?? ''),
        stock: Number(v.end_qty ?? v.available_qty ?? 0),
      });
    }
  }
  return result.filter((i: unknown) => (i as { sku: string }).sku !== '');
}

export async function GET() {
  const startedAt = new Date().toISOString();

  try {
    const token = await getJubelioToken();

    // 30 days ago ISO string for sales filter
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all data in parallel
    const [inventoryGroups, salesOrders, purchaseOrders, suppliers] = await Promise.allSettled([
      jubelioFetchAll('/inventory/items/', token),
      jubelioFetchAll(`/sales/orders/completed/?createdSince=${thirtyDaysAgo}`, token),
      jubelioFetchAll('/purchase/orders/', token),
      jubelioFetchAll('/contacts/suppliers/', token),
    ]);

    const inventory = inventoryGroups.status === 'fulfilled'
      ? normalizeInventory(inventoryGroups.value)
      : [];

    const sales = salesOrders.status === 'fulfilled' ? salesOrders.value : [];
    const velocityMap = calcVelocityMap(sales);

    const pos = purchaseOrders.status === 'fulfilled' ? purchaseOrders.value : [];
    const supList = suppliers.status === 'fulfilled' ? suppliers.value : [];

    // Persist to in-memory KV cache (2 hour TTL)
    await Promise.all([
      kvSet('foodstocks:inventory', inventory, 7200),
      kvSet('foodstocks:velocity', velocityMap, 7200),
      kvSet('foodstocks:pos', pos, 7200),
      kvSet('foodstocks:suppliers', supList, 7200),
      kvSet('foodstocks:sync_at', startedAt, 7200),
    ]);

    // Persist velocity + sync timestamp to Supabase so all serverless instances can read it
    await Promise.all([
      supabaseKvSet('velocity_map', velocityMap),
      supabaseKvSet('sync_at', startedAt),
    ]);

    return NextResponse.json({
      success: true,
      syncedAt: startedAt,
      counts: {
        inventory: inventory.length,
        velocitySKUs: Object.keys(velocityMap).length,
        pos: pos.length,
        suppliers: supList.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err), syncedAt: startedAt }, { status: 500 });
  }
}
