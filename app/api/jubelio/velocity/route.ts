import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

/** Fetch all completed order headers from the last 30 days (paginated) */
async function fetchOrderHeaders(token: string, thirtyDaysAgo: string): Promise<{ id: number | string; items?: unknown[] }[]> {
  const results: { id: number | string; items?: unknown[] }[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(
      `${JUBELIO_BASE}/sales/orders/completed/?createdSince=${thirtyDaysAgo}&page=${page}&pageSize=${pageSize}`,
      { headers: { Authorization: token }, next: { revalidate: 3600 } },
    );
    if (!res.ok) break;

    const json = await res.json();
    const orders = Array.isArray(json) ? json : (json.data ?? []) as Record<string, unknown>[];
    if (!orders.length) break;

    for (const o of orders) {
      const order = o as Record<string, unknown>;
      const id = order.salesorder_id ?? order.id ?? order.order_id ?? order.no;
      if (id != null) {
        results.push({
          id: id as number | string,
          items: Array.isArray(order.items) && order.items.length > 0 ? order.items as unknown[] : undefined,
        });
      }
    }

    const total = json.totalCount ?? json.total_count ?? orders.length;
    if (page * pageSize >= total || orders.length < pageSize) break;
    page++;

    if (results.length >= 500) break;
  }

  return results;
}

/** Extract items from any possible field in a response object */
function extractItems(json: Record<string, unknown>): Record<string, unknown>[] {
  // Try common field names for line items
  const candidates = [
    json.items, json.line_items, json.order_items, json.details,
    json.item_lines, json.sales_items, json.products,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Record<string, unknown>[];
  }
  // If root is array
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  return [];
}

/** Try multiple endpoint patterns to fetch a single order detail */
async function tryFetchDetail(token: string, orderId: number | string): Promise<{ url: string; json: Record<string, unknown> } | null> {
  const candidates = [
    `${JUBELIO_BASE}/sales/orders/completed/${orderId}/`,
    `${JUBELIO_BASE}/sales/orders/${orderId}/`,
    `${JUBELIO_BASE}/salesorder/${orderId}/`,
  ];
  for (const url of candidates) {
    const res = await fetch(url, { headers: { Authorization: token }, next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json() as Record<string, unknown>;
      return { url, json };
    }
  }
  return null;
}

/** Probe a single order — returns its top-level keys and items if found */
async function probeOrder(token: string, orderId: number | string): Promise<{ keys: string[]; items: Record<string, unknown>[]; url: string }> {
  const result = await tryFetchDetail(token, orderId);
  if (!result) return { keys: ['HTTP_404_all_endpoints'], items: [], url: '' };

  const keys = Object.keys(result.json);
  const items = extractItems(result.json);
  return { keys, items, url: result.url };
}

/** Fetch line items for a single order */
async function fetchOrderItems(token: string, orderId: number | string, detailUrlPattern: string): Promise<{ sku: string; qty: number }[]> {
  const url = detailUrlPattern.replace('{id}', String(orderId));
  const res = await fetch(url, { headers: { Authorization: token }, next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const json = await res.json() as Record<string, unknown>;
  const items = extractItems(json);
  return items.map((item: Record<string, unknown>) => ({
    sku: String(item.item_code ?? item.sku ?? item.item_id ?? item.code ?? ''),
    qty: Number(item.quantity ?? item.qty ?? item.order_qty ?? item.amount ?? 0),
  })).filter(i => i.sku && i.qty > 0);
}

/** Batch-run promises with max concurrency */
async function batchRun<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency).map(t => t());
    results.push(...await Promise.all(batch));
  }
  return results;
}

function buildVelocityMap(skuTotals: Record<string, number>): Record<string, number> {
  const velocityMap: Record<string, number> = {};
  for (const [sku, total] of Object.entries(skuTotals)) {
    velocityMap[sku] = Math.round((total / 30) * 100) / 100;
  }
  return velocityMap;
}

export async function GET() {
  try {
    const token = await getJubelioToken();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const orders = await fetchOrderHeaders(token, thirtyDaysAgo);
    const orderCount = orders.length;
    const skuTotals: Record<string, number> = {};
    let itemsSource = 'none';
    let sampleOrderKeys: string[] = [];

    // Check if items already embedded in list response
    const embeddedCount = orders.filter(o => o.items && (o.items as unknown[]).length > 0).length;

    if (embeddedCount > 0) {
      for (const order of orders) {
        const items = (order.items ?? []) as Record<string, unknown>[];
        for (const item of items) {
          const sku = String(item.item_code ?? item.sku ?? item.item_id ?? '');
          const qty = Number(item.quantity ?? item.qty ?? 0);
          if (sku && qty > 0) skuTotals[sku] = (skuTotals[sku] ?? 0) + qty;
        }
      }
      itemsSource = 'embedded';
    } else if (orderCount > 0) {
      // Probe first order to understand response structure
      const probe = await probeOrder(token, orders[0].id);
      sampleOrderKeys = [...probe.keys, `url:${probe.url}`];

      if (probe.items.length > 0) {
        // Items found in detail endpoint — batch fetch all orders using same URL pattern
        const detailUrlPattern = probe.url.replace(String(orders[0].id), '{id}');
        const toFetch = orders.slice(0, 200);
        const fetchTasks = toFetch.map(order => () => fetchOrderItems(token, order.id, detailUrlPattern));
        const allItems = await batchRun(fetchTasks, 10);

        for (const itemList of allItems) {
          for (const item of itemList) {
            skuTotals[item.sku] = (skuTotals[item.sku] ?? 0) + item.qty;
          }
        }
        itemsSource = `detail-fetch (${detailUrlPattern})`;
      } else {
        itemsSource = `probe-empty (keys: ${sampleOrderKeys.join(',')})`;
      }
    }

    const velocityMap = buildVelocityMap(skuTotals);
    const skuCount = Object.keys(velocityMap).length;

    return NextResponse.json({
      success: true,
      data: velocityMap,
      skuCount,
      orderCount,
      itemsSource,
      sampleOrderKeys,
      window: '30 hari terakhir',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
