import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

/** Ambil semua bills untuk ekstrak supplier unik */
async function fetchSuppliersFromBills(): Promise<unknown[]> {
  const token = await getJubelioToken();
  const supplierMap: Record<number, Record<string, unknown>> = {};
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(
      `${JUBELIO_BASE}/purchase/bills/?page=${page}&pageSize=${pageSize}`,
      { headers: { Authorization: token }, next: { revalidate: 300 } }
    );
    if (!res.ok) break;

    const json = await res.json();
    const items = (Array.isArray(json) ? json : (json.data ?? [])) as Record<string, unknown>[];
    if (!items.length) break;

    for (const bill of items) {
      const cid = Number(bill.contact_id ?? 0);
      // Hanya simpan supplier dengan contact_id positif (bukan marketplace system)
      if (cid > 0 && !supplierMap[cid]) {
        supplierMap[cid] = bill;
      }
    }

    const total = json.totalCount ?? json.total ?? 0;
    if (page * pageSize >= total || items.length < pageSize) break;
    page++;
  }

  return Object.values(supplierMap);
}

/** Coba fetch detail kontak (email/phone) dari endpoint contacts */
async function fetchContactDetail(token: string, contactId: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${JUBELIO_BASE}/contacts/${contactId}`, {
      headers: { Authorization: token },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function mapSupplier(bill: Record<string, unknown>, detail: Record<string, unknown> | null) {
  const contact = detail ?? {};
  return {
    id: String(bill.contact_id ?? ''),
    name: String(contact.contact_name ?? bill.supplier_name ?? ''),
    email: String(contact.email ?? ''),
    phone: String(contact.phone ?? contact.mobile ?? ''),
    address: String(contact.billing_address ?? contact.shipping_address ?? ''),
  };
}

export async function GET() {
  try {
    const token = await getJubelioToken();
    const supplierBills = await fetchSuppliersFromBills();

    // Fetch contact detail untuk tiap supplier (max 20 untuk hindari timeout)
    const limited = supplierBills.slice(0, 20);
    const details = await Promise.all(
      limited.map(b => fetchContactDetail(token, Number((b as Record<string, unknown>).contact_id)))
    );

    const data = limited.map((bill, i) =>
      mapSupplier(bill as Record<string, unknown>, details[i])
    ).filter(s => s.id !== '');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
