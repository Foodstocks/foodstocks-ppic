/**
 * /api/notify-daily
 *
 * Runs daily at 09:00 WIB (02:00 UTC) via Vercel Cron.
 * Combines two checks into one email to stay within Vercel Hobby plan (max 2 crons):
 *   1. Forecast alert — SKU yang stoknya akan habis (kritis / minggu ini / bulan ini)
 *   2. PO reminder   — Purchase Order yang overdue atau jatuh tempo H-3
 *
 * Required env vars (set in Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY       - Resend API key for email delivery
 *   NOTIFICATION_EMAIL   - Recipient email address
 *   NEXT_PUBLIC_APP_URL  - Your app URL (e.g. https://foodstocks-ppic.vercel.app)
 */

import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvItem {
  sku: string;
  name: string;
  stock: number;
  category: string;
}

interface ForecastRow {
  sku: string;
  name: string;
  stock: number;
  velocity: number;
  leadTime: number;
  daysRemaining: number;
  urgency: 'KRITIS' | 'MINGGU_INI' | 'BULAN_INI';
}

interface BillRow {
  id: string;
  poNumber: string;
  supplier: string;
  due: number;
  dueDate: string;
  urgency: 'OVERDUE' | 'DUE_SOON';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function supabaseKvGet(key: string): Promise<unknown> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!base || !apiKey) return null;
  try {
    const res = await fetch(
      `${base}/rest/v1/foodstocks_kv?key=eq.${encodeURIComponent(key)}&select=data`,
      { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    );
    const rows = await res.json();
    return rows?.[0]?.data ?? null;
  } catch { return null; }
}

async function fetchAllPages(path: string, token: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${JUBELIO_BASE}${path}?page=${page}&pageSize=100`, {
      headers: { Authorization: token },
    });
    if (!res.ok) break;
    const json = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? []);
    if (!items.length) break;
    results.push(...items);
    const total = json.totalCount ?? json.total ?? 0;
    if (results.length >= total || items.length < 100) break;
    page++;
  }
  return results;
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;
  if (!apiKey || !toEmail) {
    console.log('[notify-daily] RESEND_API_KEY or NOTIFICATION_EMAIL not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Foodstocks PPIC <noreply@resend.dev>',
      to: [toEmail],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmail(
  forecastRows: ForecastRow[],
  bills: BillRow[],
  syncedAt: string | null,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '#';
  const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const gray = '#6B7280';

  const kritis    = forecastRows.filter(r => r.urgency === 'KRITIS');
  const mingguIni = forecastRows.filter(r => r.urgency === 'MINGGU_INI');
  const bulanIni  = forecastRows.filter(r => r.urgency === 'BULAN_INI');
  const overdue   = bills.filter(b => b.urgency === 'OVERDUE');
  const dueSoon   = bills.filter(b => b.urgency === 'DUE_SOON');

  const badge = (label: string, count: number, color: string, bg: string) =>
    count > 0 ? `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${bg};color:${color};margin-right:6px;margin-bottom:4px;">${count} ${label}</span>` : '';

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;background:#F9FAFB;`;
  const tdStyle = `padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;`;

  const forecastTableHeader = `<tr><th style="${thStyle}">Produk</th><th style="${thStyle}">SKU</th><th style="${thStyle};text-align:right">Stok</th><th style="${thStyle};text-align:right">Sisa Hari</th></tr>`;

  const forecastRow = (r: ForecastRow, color: string) =>
    `<tr>
      <td style="${tdStyle}color:#111827;font-weight:600;">${r.name}</td>
      <td style="${tdStyle}color:#9CA3AF;font-family:monospace;font-size:11px;">${r.sku}</td>
      <td style="${tdStyle}text-align:right;">${r.stock} pcs</td>
      <td style="${tdStyle}text-align:right;font-weight:700;color:${color};">${r.daysRemaining === 0 ? 'Habis' : `${r.daysRemaining} hari`}</td>
    </tr>`;

  const billTableHeader = `<tr><th style="${thStyle}">No. PO</th><th style="${thStyle}">Supplier</th><th style="${thStyle};text-align:right">Sisa Tagihan</th><th style="${thStyle}">Jatuh Tempo</th></tr>`;

  const billRow = (b: BillRow, color: string) =>
    `<tr>
      <td style="${tdStyle}color:#374151;">${b.poNumber || b.id.slice(0, 8)}</td>
      <td style="${tdStyle}color:#374151;">${b.supplier}</td>
      <td style="${tdStyle}text-align:right;font-weight:600;color:#111827;">${formatRupiah(b.due)}</td>
      <td style="${tdStyle}font-weight:600;color:${color};">${b.dueDate ? formatDate(b.dueDate) : '—'}</td>
    </tr>`;

  const section = (
    borderColor: string, bgColor: string, titleColor: string,
    title: string, subtitle: string,
    theader: string, trows: string,
  ) => `
    <div style="background:${bgColor};border-left:4px solid ${borderColor};border-radius:6px;padding:12px 16px;margin-bottom:12px;">
      <strong style="color:${titleColor};font-size:13px;">${title}</strong>
      <p style="color:${titleColor};font-size:12px;margin:4px 0 0;opacity:0.8;">${subtitle}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      ${theader}${trows}
    </table>`;

  const hasForecast = kritis.length > 0 || mingguIni.length > 0 || bulanIni.length > 0;
  const hasBills    = overdue.length > 0 || dueSoon.length > 0;

  return `<!DOCTYPE html>
  <html><body style="font-family:Inter,system-ui,sans-serif;background:#F7F8FA;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #E4E7ED;overflow:hidden;">
    <div style="background:#D60001;padding:20px 24px;">
      <h1 style="color:#fff;font-size:18px;margin:0;font-weight:700;">Foodstocks PPIC</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0;">Notifikasi Harian · ${date}</p>
    </div>
    <div style="padding:24px;">

      <!-- Summary badges -->
      <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #F3F4F6;">
        <div style="font-size:12px;font-weight:700;color:${gray};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Ringkasan Hari Ini</div>
        ${badge('SKU Kritis', kritis.length, '#D60001', '#FEF2F2')}
        ${badge('Habis Minggu Ini', mingguIni.length, '#D97706', '#FFFBEB')}
        ${badge('Habis Bulan Ini', bulanIni.length, '#1D4ED8', '#EFF6FF')}
        ${badge('PO Overdue', overdue.length, '#D60001', '#FEF2F2')}
        ${badge('PO H-3', dueSoon.length, '#D97706', '#FFFBEB')}
        ${!hasForecast && !hasBills ? '<span style="font-size:13px;color:#10B981;font-weight:600;">Semua aman — tidak ada yang perlu ditindaklanjuti hari ini.</span>' : ''}
      </div>

      <!-- Forecast sections -->
      ${hasForecast ? `<div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:14px;">Forecast Stok</div>` : ''}

      ${kritis.length > 0 ? section('#D60001','#FEF2F2','#B91C1C',
        `${kritis.length} SKU Kritis`,
        'Stok akan habis sebelum barang baru tiba — beli sekarang.',
        forecastTableHeader, kritis.map(r => forecastRow(r,'#D60001')).join('')) : ''}

      ${mingguIni.length > 0 ? section('#F59E0B','#FFFBEB','#92400E',
        `${mingguIni.length} SKU Habis Minggu Ini`,
        'Siapkan PO segera untuk menghindari stockout.',
        forecastTableHeader, mingguIni.map(r => forecastRow(r,'#D97706')).join('')) : ''}

      ${bulanIni.length > 0 ? section('#3B82F6','#EFF6FF','#1E40AF',
        `${bulanIni.length} SKU Habis Bulan Ini`,
        'Rencanakan pembelian dalam 1–2 minggu ke depan.',
        forecastTableHeader, bulanIni.map(r => forecastRow(r,'#2563EB')).join('')) : ''}

      <!-- PO sections -->
      ${hasBills ? `<div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:14px;${hasForecast ? 'margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;' : ''}">Pembayaran PO</div>` : ''}

      ${overdue.length > 0 ? section('#D60001','#FEF2F2','#B91C1C',
        `${overdue.length} PO Terlambat Bayar`,
        `Total ${formatRupiah(overdue.reduce((s,b) => s+b.due, 0))} — hubungi supplier segera.`,
        billTableHeader, overdue.map(b => billRow(b,'#D60001')).join('')) : ''}

      ${dueSoon.length > 0 ? section('#F59E0B','#FFFBEB','#92400E',
        `${dueSoon.length} PO Jatuh Tempo dalam 3 Hari`,
        `Total ${formatRupiah(dueSoon.reduce((s,b) => s+b.due, 0))} — siapkan pembayaran.`,
        billTableHeader, dueSoon.map(b => billRow(b,'#D97706')).join('')) : ''}

      <!-- Footer -->
      <p style="font-size:11px;color:${gray};text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid #F3F4F6;">
        Velocity terakhir sync: ${syncedAt ? new Date(syncedAt).toLocaleString('id-ID') : '—'} ·
        <a href="${appUrl}/planner" style="color:#D60001;">Purchase Planner</a> ·
        <a href="${appUrl}/po-budget" style="color:#D60001;">PO &amp; Budget</a>
      </p>
    </div>
  </div>
  </body></html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const token = await getJubelioToken();

    // Fetch all data in parallel
    const [invGroups, billsRaw, velocityRaw, syncAtRaw, leadTimeRaw] = await Promise.all([
      fetchAllPages('/inventory/items/', token),
      fetchAllPages('/purchase/bills/', token),
      supabaseKvGet('velocity_map'),
      supabaseKvGet('sync_at'),
      supabaseKvGet('leadtime_map'),
    ]);

    const velocityMap = (velocityRaw ?? {}) as Record<string, number>;
    const leadTimeMap = (leadTimeRaw ?? {}) as Record<string, number>;
    const syncedAt    = typeof syncAtRaw === 'string' ? syncAtRaw : null;
    const defaultLT   = leadTimeMap['__default__'] ?? 3;
    const todayMs     = new Date().setHours(0, 0, 0, 0);
    const in3DaysMs   = todayMs + 3 * 24 * 60 * 60 * 1000;

    // ── Forecast ──────────────────────────────────────────────────────────────

    // Flatten inventory groups → items
    const inventory: InvItem[] = [];
    for (const g of invGroups) {
      const variants: Record<string, unknown>[] = Array.isArray(g.variants)
        ? (g.variants as Record<string, unknown>[])
        : [g];
      for (const v of variants) {
        const sku = String(v.item_code ?? g.item_code ?? '');
        if (!sku) continue;
        inventory.push({
          sku,
          name: String(v.item_name ?? g.item_name ?? ''),
          stock: Number(v.end_qty ?? v.available_qty ?? 0),
          category: String(g.item_category_name ?? ''),
        });
      }
    }

    const forecastRows: ForecastRow[] = [];
    for (const item of inventory) {
      const velocity = velocityMap[item.sku];
      if (!velocity || velocity <= 0) continue;
      const leadTime = leadTimeMap[item.sku] ?? leadTimeMap[item.category] ?? defaultLT;
      const daysRemaining = parseFloat((item.stock / velocity).toFixed(1));
      let urgency: ForecastRow['urgency'] | null = null;
      if (daysRemaining <= leadTime)  urgency = 'KRITIS';
      else if (daysRemaining <= 7)    urgency = 'MINGGU_INI';
      else if (daysRemaining <= 30)   urgency = 'BULAN_INI';
      if (urgency) forecastRows.push({ sku: item.sku, name: item.name, stock: item.stock, velocity, leadTime, daysRemaining, urgency });
    }
    const order: Record<ForecastRow['urgency'], number> = { KRITIS: 0, MINGGU_INI: 1, BULAN_INI: 2 };
    forecastRows.sort((a, b) => order[a.urgency] - order[b.urgency] || a.daysRemaining - b.daysRemaining);

    // ── PO Bills ──────────────────────────────────────────────────────────────

    const bills: BillRow[] = [];
    for (const item of billsRaw) {
      const due = Number(item.due ?? 0);
      if (due <= 0) continue; // skip paid bills
      const dueDate = String(item.due_date ?? '');
      const dueDateMs = dueDate ? new Date(dueDate).getTime() : null;
      let urgency: BillRow['urgency'] | null = null;
      if (dueDateMs !== null && dueDateMs < todayMs)               urgency = 'OVERDUE';
      else if (dueDateMs !== null && dueDateMs <= in3DaysMs)        urgency = 'DUE_SOON';
      if (urgency) {
        bills.push({
          id: String(item.doc_id ?? ''),
          poNumber: String(item.doc_number ?? ''),
          supplier: String(item.supplier_name ?? item.contact_name ?? ''),
          due,
          dueDate,
          urgency,
        });
      }
    }

    // ── Send email ────────────────────────────────────────────────────────────

    const kritis     = forecastRows.filter(r => r.urgency === 'KRITIS').length;
    const mingguIni  = forecastRows.filter(r => r.urgency === 'MINGGU_INI').length;
    const bulanIni   = forecastRows.filter(r => r.urgency === 'BULAN_INI').length;
    const overdueCt  = bills.filter(b => b.urgency === 'OVERDUE').length;
    const dueSoonCt  = bills.filter(b => b.urgency === 'DUE_SOON').length;

    const shouldNotify = kritis > 0 || mingguIni > 0 || overdueCt > 0 || dueSoonCt > 0;

    if (shouldNotify) {
      const parts: string[] = [];
      if (kritis > 0)    parts.push(`${kritis} SKU kritis`);
      if (mingguIni > 0) parts.push(`${mingguIni} habis minggu ini`);
      if (overdueCt > 0) parts.push(`${overdueCt} PO overdue`);
      if (dueSoonCt > 0) parts.push(`${dueSoonCt} PO H-3`);
      await sendEmail(
        `[Foodstocks] ${parts.join(', ')}`,
        buildEmail(forecastRows, bills, syncedAt),
      );
    }

    return NextResponse.json({
      success: true,
      checkedAt,
      forecast: { kritis, mingguIni, bulanIni },
      po: { overdue: overdueCt, dueSoon: dueSoonCt },
      notificationSent: shouldNotify,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err), checkedAt }, { status: 500 });
  }
}
