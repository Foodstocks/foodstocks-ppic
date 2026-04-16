import { NextRequest, NextResponse } from 'next/server';

// Parse Jubelio "Penjualan Produk" Excel/CSV export into velocity map
// Expected columns (from Jubelio report): SKU, Nama Barang, ..., Tanggal, ..., QTY, ..., Status, ...
// We auto-detect column positions by header name.

interface ParseResult {
  success: boolean;
  data?: Record<string, number>;
  skuCount?: number;
  days?: number;
  orderCount?: number;
  error?: string;
}

function detectCols(headers: string[]): { skuIdx: number; qtyIdx: number; statusIdx: number; tanggalIdx: number } {
  const h = headers.map(s => String(s ?? '').toLowerCase().trim());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = h.findIndex(x => x.includes(c));
      if (i !== -1) return i;
    }
    return -1;
  };
  return {
    skuIdx:     find('sku', 'kode barang', 'kode item', 'item_code', 'item code'),
    qtyIdx:     find('qty', 'jumlah', 'quantity', 'kuantitas'),
    statusIdx:  find('status'),
    tanggalIdx: find('tanggal', 'date', 'tgl'),
  };
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  // Excel serial number
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function isCompleted(status: string): boolean {
  const s = status.toUpperCase().trim();
  return !['CANCELLED', 'CANCEL', 'RETURNED', 'RETUR', 'FAILED', 'BATAL'].some(x => s.includes(x));
}

export async function POST(req: NextRequest): Promise<NextResponse<ParseResult>> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' });

    const bytes = await file.arrayBuffer();
    const name = file.name.toLowerCase();

    let rows: unknown[][];

    if (name.endsWith('.csv')) {
      // Parse CSV
      const text = new TextDecoder('utf-8').decode(bytes);
      rows = text.split('\n')
        .filter(l => l.trim())
        .map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    } else {
      // Parse XLSX using dynamic import
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX = await import('xlsx') as any;
      const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    }

    if (rows.length < 2) return NextResponse.json({ success: false, error: 'File kosong atau tidak valid' });

    const headers = rows[0] as string[];
    const { skuIdx, qtyIdx, statusIdx, tanggalIdx } = detectCols(headers);

    if (skuIdx === -1) return NextResponse.json({ success: false, error: `Kolom SKU tidak ditemukan. Header: ${headers.slice(0, 6).join(', ')}` });
    if (qtyIdx === -1) return NextResponse.json({ success: false, error: `Kolom QTY tidak ditemukan. Header: ${headers.slice(0, 16).join(', ')}` });

    const skuTotals: Record<string, number> = {};
    const dates: Date[] = [];
    let orderCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const sku    = String(row[skuIdx] ?? '').trim();
      const qtyRaw = row[qtyIdx];
      const status = statusIdx !== -1 ? String(row[statusIdx] ?? '').trim() : 'COMPLETED';
      const tgl    = tanggalIdx !== -1 ? parseDate(row[tanggalIdx]) : null;

      if (!sku) continue;
      if (statusIdx !== -1 && !isCompleted(status)) continue;

      const qty = parseFloat(String(qtyRaw).replace(/[^\d.-]/g, ''));
      if (isNaN(qty) || qty <= 0) continue;

      skuTotals[sku] = (skuTotals[sku] ?? 0) + qty;
      orderCount++;
      if (tgl) dates.push(tgl);
    }

    // Calculate days from date range (min 1, default 30)
    let days = 30;
    if (dates.length >= 2) {
      const minTs = Math.min(...dates.map(d => d.getTime()));
      const maxTs = Math.max(...dates.map(d => d.getTime()));
      const detected = Math.round((maxTs - minTs) / 86400000) + 1;
      if (detected >= 1) days = detected;
    }

    // Build velocity map: avg daily sales per SKU
    const velocityMap: Record<string, number> = {};
    for (const [sku, total] of Object.entries(skuTotals)) {
      velocityMap[sku] = Math.round((total / days) * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      data: velocityMap,
      skuCount: Object.keys(velocityMap).length,
      days,
      orderCount,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  }
}
