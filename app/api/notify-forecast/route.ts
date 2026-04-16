import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvItem {
  sku: string;
  name: string;
  stock: number;
  sellPrice: number;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

/** Read a key from Supabase KV */
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

/** Fetch all inventory from Jubelio */
async function fetchInventory(token: string): Promise<InvItem[]> {
  const results: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${JUBELIO_BASE}/inventory/items/?page=${page}&pageSize=100`, {
      headers: { Authorization: token },
    });
    if (!res.ok) break;
    const json = await res.json();
    const groups: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? []);
    if (!groups.length) break;
    for (const g of groups) {
      const variants: Record<string, unknown>[] = Array.isArray(g.variants) ? (g.variants as Record<string, unknown>[]) : [g];
      for (const v of variants) {
        results.push({
          sku: String(v.item_code ?? g.item_code ?? ''),
          name: String(v.item_name ?? g.item_name ?? ''),
          stock: Number(v.end_qty ?? v.available_qty ?? 0),
          sellPrice: Number(v.sell_price ?? g.sell_price ?? 0),
          category: String(g.item_category_name ?? ''),
        });
      }
    }
    const total = json.totalCount ?? groups.length;
    if (results.length >= total || groups.length < 100) break;
    page++;
  }
  return results.filter(i => String(i.sku) !== '') as InvItem[];
}

/** Send email via Resend REST API */
async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;
  if (!apiKey || !toEmail) {
    console.log('[notify-forecast] RESEND_API_KEY or NOTIFICATION_EMAIL not set — skipping email');
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

function buildEmailHtml(rows: ForecastRow[], syncedAt: string | null): string {
  const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const gray = '#6B7280';

  const urgencyLabel = (u: ForecastRow['urgency']) =>
    u === 'KRITIS' ? 'Kritis' : u === 'MINGGU_INI' ? 'Habis minggu ini' : 'Habis bulan ini';
  const urgencyColor = (u: ForecastRow['urgency']) =>
    u === 'KRITIS' ? '#D60001' : u === 'MINGGU_INI' ? '#D97706' : '#2563EB';
  const urgencyBg = (u: ForecastRow['urgency']) =>
    u === 'KRITIS' ? '#FEF2F2' : u === 'MINGGU_INI' ? '#FFFBEB' : '#EFF6FF';

  const kritis = rows.filter(r => r.urgency === 'KRITIS');
  const mingguIni = rows.filter(r => r.urgency === 'MINGGU_INI');
  const bulanIni = rows.filter(r => r.urgency === 'BULAN_INI');

  const summaryBadge = (label: string, count: number, color: string, bg: string) =>
    count > 0 ? `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${bg};color:${color};margin-right:8px;">${count} ${label}</span>` : '';

  const tableRows = (items: ForecastRow[]) => items.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827;font-weight:600;">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#9CA3AF;font-family:monospace;">${r.sku}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;text-align:right;">${r.stock} pcs</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:700;color:${urgencyColor(r.urgency)};text-align:right;">${r.daysRemaining === 0 ? 'Habis' : `${r.daysRemaining} hari`}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;">
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${urgencyBg(r.urgency)};color:${urgencyColor(r.urgency)};">${urgencyLabel(r.urgency)}</span>
      </td>
    </tr>`).join('');

  const tableHeader = `
    <tr style="background:#F9FAFB;">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Produk</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">SKU</th>
      <th style="padding:8px 12px;text-align:right;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Stok</th>
      <th style="padding:8px 12px;text-align:right;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Sisa Hari</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Status</th>
    </tr>`;

  return `<!DOCTYPE html>
  <html><body style="font-family:Inter,system-ui,sans-serif;background:#F7F8FA;margin:0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #E4E7ED;overflow:hidden;">
      <div style="background:#D60001;padding:20px 24px;">
        <h1 style="color:#fff;font-size:18px;margin:0;font-weight:700;">Foodstocks PPIC</h1>
        <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0;">Forecast Stok Harian · ${date}</p>
      </div>
      <div style="padding:24px;">
        <div style="margin-bottom:20px;">
          <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px;">Ringkasan</div>
          ${summaryBadge('SKU Kritis', kritis.length, '#D60001', '#FEF2F2')}
          ${summaryBadge('Habis Minggu Ini', mingguIni.length, '#D97706', '#FFFBEB')}
          ${summaryBadge('Habis Bulan Ini', bulanIni.length, '#2563EB', '#EFF6FF')}
        </div>

        ${kritis.length > 0 ? `
        <div style="background:#FEF2F2;border-left:4px solid #D60001;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
          <strong style="color:#B91C1C;font-size:13px;">${kritis.length} SKU Kritis — stok habis dalam ≤ lead time</strong>
          <p style="color:#DC2626;font-size:12px;margin:4px 0 0;">Harus beli sekarang sebelum stok kosong.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${tableHeader}${tableRows(kritis)}
        </table>` : ''}

        ${mingguIni.length > 0 ? `
        <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
          <strong style="color:#92400E;font-size:13px;">${mingguIni.length} SKU Habis Minggu Ini</strong>
          <p style="color:#B45309;font-size:12px;margin:4px 0 0;">Siapkan PO segera untuk menghindari stockout.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${tableHeader}${tableRows(mingguIni)}
        </table>` : ''}

        ${bulanIni.length > 0 ? `
        <div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
          <strong style="color:#1E40AF;font-size:13px;">${bulanIni.length} SKU Habis Bulan Ini</strong>
          <p style="color:#2563EB;font-size:12px;margin:4px 0 0;">Rencanakan pembelian dalam 1–2 minggu ke depan.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          ${tableHeader}${tableRows(bulanIni)}
        </table>` : ''}

        <p style="font-size:11px;color:${gray};text-align:center;margin-top:8px;padding-top:16px;border-top:1px solid #F3F4F6;">
          Data velocity terakhir sync: ${syncedAt ? new Date(syncedAt as string).toLocaleString('id-ID') : '—'} ·
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '#'}/planner" style="color:#D60001;">Buka Purchase Planner</a>
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

    // Fetch inventory + velocity map in parallel
    const [inventory, velocityRaw, syncAtRaw, leadTimeRaw] = await Promise.all([
      fetchInventory(token),
      supabaseKvGet('velocity_map'),
      supabaseKvGet('sync_at'),
      supabaseKvGet('leadtime_map'),
    ]);

    const velocityMap = (velocityRaw ?? {}) as Record<string, number>;
    const leadTimeMap = (leadTimeRaw ?? {}) as Record<string, number>;
    const syncedAt = syncAtRaw as string | null;
    const defaultLT = leadTimeMap['__default__'] ?? 3;

    // Build forecast rows — only SKUs with velocity data
    const forecastRows: ForecastRow[] = [];

    for (const item of inventory) {
      const velocity = velocityMap[item.sku];
      if (!velocity || velocity <= 0) continue; // skip no-velocity SKUs

      const leadTime = leadTimeMap[item.sku] ?? leadTimeMap[item.category] ?? defaultLT;
      const daysRemaining = parseFloat((item.stock / velocity).toFixed(1));

      let urgency: ForecastRow['urgency'] | null = null;
      if (daysRemaining <= leadTime) urgency = 'KRITIS';
      else if (daysRemaining <= 7) urgency = 'MINGGU_INI';
      else if (daysRemaining <= 30) urgency = 'BULAN_INI';

      if (urgency) {
        forecastRows.push({ sku: item.sku, name: item.name, stock: item.stock, velocity, leadTime, daysRemaining, urgency });
      }
    }

    // Sort: KRITIS first, then MINGGU_INI, then BULAN_INI, then by daysRemaining asc
    const order: Record<ForecastRow['urgency'], number> = { KRITIS: 0, MINGGU_INI: 1, BULAN_INI: 2 };
    forecastRows.sort((a, b) => order[a.urgency] - order[b.urgency] || a.daysRemaining - b.daysRemaining);

    const kritis = forecastRows.filter(r => r.urgency === 'KRITIS').length;
    const mingguIni = forecastRows.filter(r => r.urgency === 'MINGGU_INI').length;
    const bulanIni = forecastRows.filter(r => r.urgency === 'BULAN_INI').length;

    // Only send email if there's something urgent (kritis or minggu ini)
    const shouldNotify = kritis > 0 || mingguIni > 0;

    if (shouldNotify && forecastRows.length > 0) {
      const parts: string[] = [];
      if (kritis > 0) parts.push(`${kritis} SKU kritis`);
      if (mingguIni > 0) parts.push(`${mingguIni} habis minggu ini`);
      if (bulanIni > 0) parts.push(`${bulanIni} habis bulan ini`);
      const subject = `[Foodstocks] Forecast: ${parts.join(', ')}`;
      await sendEmail(subject, buildEmailHtml(forecastRows, syncedAt));
    }

    return NextResponse.json({
      success: true,
      checkedAt,
      skusWithVelocity: inventory.filter(i => (velocityMap[i.sku] ?? 0) > 0).length,
      forecast: { kritis, mingguIni, bulanIni, total: forecastRows.length },
      notificationSent: shouldNotify,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err), checkedAt }, { status: 500 });
  }
}
