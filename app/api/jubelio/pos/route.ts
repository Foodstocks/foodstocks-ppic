import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

async function fetchAllBills(): Promise<unknown[]> {
  const token = await getJubelioToken();
  const results: unknown[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(
      `${JUBELIO_BASE}/purchase/bills/?page=${page}&pageSize=${pageSize}`,
      {
        headers: { Authorization: token },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) break;

    const json = await res.json();
    const items: unknown[] = Array.isArray(json) ? json : (json.data ?? []);
    if (!items.length) break;

    results.push(...items);

    const total = json.totalCount ?? json.total ?? 0;
    if (results.length >= total || items.length < pageSize) break;
    page++;
  }

  return results;
}

function mapBill(item: Record<string, unknown>) {
  // due = outstanding amount. 0 = lunas, > 0 = pending
  const due = Number(item.due ?? 0);
  const status = due === 0 ? 'Lunas' : 'Pending';

  return {
    id: String(item.doc_id ?? ''),
    poNumber: String(item.doc_number ?? ''),
    supplier: String(item.supplier_name ?? item.contact_name ?? ''),
    supplierId: Number(item.contact_id ?? 0),
    total: Number(item.grand_total ?? 0),
    due,
    status,
    orderDate: String(item.transaction_date ?? ''),
    dueDate: String(item.due_date ?? ''),
    paymentTerms: String(item.payment_term ?? ''),
    ageDays: Number(item.age ?? 0),
    items: [],
  };
}

export async function GET() {
  try {
    const bills = await fetchAllBills();
    const data = (bills as Record<string, unknown>[])
      .map(mapBill)
      .filter(p => p.id !== '');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
