import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

async function fetchAllItems(): Promise<unknown[]> {
  const token = await getJubelioToken();
  const results: unknown[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(`${JUBELIO_BASE}/inventory/items/?page=${page}&pageSize=${pageSize}`, {
      headers: { Authorization: token },
      next: { revalidate: 300 },
    });

    if (!res.ok) break;

    const json = await res.json();
    // Jubelio returns { data: [...itemGroups], totalCount: N }
    // Each itemGroup has a `variants` array with the actual SKU data
    const groups = (json.data ?? []) as Record<string, unknown>[];
    if (!groups.length) break;

    for (const group of groups) {
      const variants = Array.isArray(group.variants)
        ? (group.variants as Record<string, unknown>[])
        : [];
      for (const v of variants) {
        results.push({
          item_code: v.item_code,
          item_name: v.item_name ?? group.item_name,
          sell_price: v.sell_price ?? group.sell_price,
          end_qty: v.end_qty,        // physical stock on hand
          available_qty: v.available_qty,
          category: group.item_category_id,
        });
      }
    }

    const total = json.totalCount ?? 0;
    if (results.length >= total || groups.length < pageSize) break;
    page++;
  }

  return results;
}

function mapItem(item: Record<string, unknown>) {
  const sku = String(item.item_code ?? '');
  const name = String(item.item_name ?? '');
  const sellPrice = Number(item.sell_price ?? 0);
  const buyPrice = 0; // buy price not exposed in this endpoint
  const category = String(item.category ?? '');
  const stock = Number(item.end_qty ?? item.available_qty ?? 0);
  return { sku, name, sellPrice, buyPrice, category, stock };
}

export async function GET() {
  try {
    const items = await fetchAllItems();
    const data = (items as Record<string, unknown>[])
      .map(mapItem)
      .filter(i => i.sku !== '');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
