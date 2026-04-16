import { NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bill {
  id: string;
  poNumber: string;
  supplier: string;
  total: number;
  due: number;
  dueDate: string;
  ageDays: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchPendingBills(token: string): Promise<Bill[]> {
  const results: Record<string, unknown>[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(
      `${JUBELIO_BASE}/purchase/bills/?page=${page}&pageSize=${pageSize}`,
      { headers: { Authorization: token } }
    );
    if (!res.ok) break;
    const json = await res.json();
    const items: Record<string, unknown>[] = Array.isArray(json) ? json : (json.data ?? []);
    if (!items.length) break;
    results.push(...items);
    const total = json.totalCount ?? json.total ?? 0;
    if (results.length >= total || items.length < pageSize) break;
    page++;
  }

  return results
    .map(item => ({
      id: String(item.doc_id ?? ''),
      poNumber: String(item.doc_number ?? ''),
      supplier: String(item.supplier_name ?? item.contact_name ?? ''),
      total: Number(item.grand_total ?? 0),
      due: Number(item.due ?? 0),
      dueDate: String(item.due_date ?? ''),
      ageDays: Number(item.age ?? 0),
    }))
    .filter(b => b.id !== '' && b.due > 0); // only unpaid bills
}

/** Send email via Resend REST API — no SDK needed */
async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;

  if (!apiKey || !toEmail) {
    console.log('[notify-po] RESEND_API_KEY or NOTIFICATION_EMAIL not set — skipping email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Foodstocks PPIC <noreply@resend.dev>',
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

function buildEmailHtml(overdue: Bill[], dueSoon: Bill[]): string {
  const red = '#D60001';
  const yellow = '#D97706';
  const gray = '#6B7280';

  const billRow = (b: Bill, color: string) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">${b.poNumber || b.id.slice(0, 8)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">${b.supplier}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827;font-weight:600;">${formatRupiah(b.due)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:13px;color:${color};font-weight:600;">${b.dueDate ? formatDate(b.dueDate) : '—'}</td>
    </tr>`;

  const tableHeader = `
    <tr style="background:#F9FAFB;">
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">No. PO</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Supplier</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Sisa Tagihan</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;color:${gray};font-weight:600;text-transform:uppercase;">Jatuh Tempo</th>
    </tr>`;

  const overdueSection = overdue.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="background:#FEF2F2;border-left:4px solid ${red};border-radius:6px;padding:12px 16px;margin-bottom:12px;">
        <strong style="color:#B91C1C;font-size:14px;">${overdue.length} PO Sudah Jatuh Tempo</strong>
        <p style="color:#DC2626;font-size:13px;margin:4px 0 0;">Total ${formatRupiah(overdue.reduce((s, b) => s + b.due, 0))} — hubungi supplier segera.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;">
        ${tableHeader}
        ${overdue.map(b => billRow(b, red)).join('')}
      </table>
    </div>` : '';

  const dueSoonSection = dueSoon.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin-bottom:12px;">
        <strong style="color:#92400E;font-size:14px;">${dueSoon.length} PO Jatuh Tempo dalam 3 Hari</strong>
        <p style="color:#B45309;font-size:13px;margin:4px 0 0;">Total ${formatRupiah(dueSoon.reduce((s, b) => s + b.due, 0))} — siapkan dana pembayaran.</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E4E7ED;border-radius:8px;overflow:hidden;">
        ${tableHeader}
        ${dueSoon.map(b => billRow(b, yellow)).join('')}
      </table>
    </div>` : '';

  const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Inter,system-ui,sans-serif;background:#F7F8FA;margin:0;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #E4E7ED;overflow:hidden;">
        <div style="background:#D60001;padding:20px 24px;">
          <h1 style="color:#fff;font-size:18px;margin:0;font-weight:700;">Foodstocks PPIC</h1>
          <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0;">Reminder Pembayaran PO · ${date}</p>
        </div>
        <div style="padding:24px;">
          ${overdueSection}
          ${dueSoonSection}
          <p style="font-size:12px;color:${gray};text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #F3F4F6;">
            Email ini dikirim otomatis oleh Foodstocks PPIC · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? '#'}" style="color:#D60001;">Buka Dashboard</a>
          </p>
        </div>
      </div>
    </body>
    </html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const token = await getJubelioToken();
    const bills = await fetchPendingBills(token);

    const todayMs = new Date().setHours(0, 0, 0, 0);
    const in3DaysMs = todayMs + 3 * 24 * 60 * 60 * 1000;

    const overdue = bills.filter(b => b.dueDate && new Date(b.dueDate).getTime() < todayMs);
    const dueSoon = bills.filter(b => {
      if (!b.dueDate) return false;
      const t = new Date(b.dueDate).getTime();
      return t >= todayMs && t <= in3DaysMs;
    });

    const shouldNotify = overdue.length > 0 || dueSoon.length > 0;

    if (shouldNotify) {
      const subjectParts: string[] = [];
      if (overdue.length > 0) subjectParts.push(`${overdue.length} PO terlambat`);
      if (dueSoon.length > 0) subjectParts.push(`${dueSoon.length} PO H-3`);
      const subject = `[Foodstocks] Perhatian: ${subjectParts.join(', ')}`;

      await sendEmail(subject, buildEmailHtml(overdue, dueSoon));
    }

    return NextResponse.json({
      success: true,
      checkedAt,
      totalPending: bills.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      notificationSent: shouldNotify,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), checkedAt },
      { status: 500 }
    );
  }
}
