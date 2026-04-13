import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for insights (6 hour TTL)
const insightCache: { value: string; expiresAt: number } = { value: '', expiresAt: 0 };

interface InsightPayload {
  reorderNow: number;
  prepare: number;
  totalSKUs: number;
  stockoutItems: Array<{ sku: string; name: string; daysRemaining: number; stock: number; hpp: number }>;
  deadStockItems: Array<{ sku: string; name: string; stock: number; hpp: number; daysInWarehouse: number }>;
  totalCostOfFund: number;
  totalStockValue: number;
  budgetUsed: number;
  budgetTotal: number;
  avgMargin: number;
  slowMovingCount: number;
  upcomingEvents: Array<{ name: string; startDay: number; multiplier: number }>;
}

export async function POST(req: NextRequest) {
  // Check cache (6 hours)
  if (insightCache.expiresAt > Date.now() && insightCache.value) {
    return NextResponse.json({ success: true, insight: insightCache.value, cached: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY belum dikonfigurasi di environment variables.' }, { status: 500 });
  }

  let payload: InsightPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const prompt = `Kamu adalah analis purchasing untuk bisnis food & beverage Indonesia bernama Foodstocks.
Berikan insight analisis singkat dan actionable dalam Bahasa Indonesia berdasarkan data berikut:

Data Inventory Saat Ini:
- Total SKU aktif: ${payload.totalSKUs}
- SKU perlu beli sekarang (REORDER_NOW): ${payload.reorderNow}
- SKU persiapan order (PREPARE): ${payload.prepare}
- SKU slow moving (>30 hari habis): ${payload.slowMovingCount}

5 SKU Paling Urgent (kehabisan stok):
${payload.stockoutItems.map(i => `  - ${i.name} (${i.sku}): sisa ${i.daysRemaining} hari, stok ${i.stock} unit, HPP Rp${i.hpp.toLocaleString('id-ID')}`).join('\n')}

Dead Stock (stok menumpuk >90 hari):
${payload.deadStockItems.length > 0
  ? payload.deadStockItems.map(i => `  - ${i.name}: ${i.stock} unit, ${i.daysInWarehouse} hari, nilai Rp${(i.stock * i.hpp).toLocaleString('id-ID')}`).join('\n')
  : '  - Tidak ada dead stock'}

Keuangan:
- Total nilai stok: Rp${payload.totalStockValue.toLocaleString('id-ID')}
- Cost of Fund bulan ini: Rp${payload.totalCostOfFund.toLocaleString('id-ID')}
- Budget PO terpakai: Rp${payload.budgetUsed.toLocaleString('id-ID')} dari Rp${payload.budgetTotal.toLocaleString('id-ID')} (${payload.budgetTotal > 0 ? Math.round(payload.budgetUsed / payload.budgetTotal * 100) : 0}%)
- Avg gross margin: ${payload.avgMargin.toFixed(1)}%

Event Mendatang:
${payload.upcomingEvents.length > 0
  ? payload.upcomingEvents.map(e => `  - ${e.name}: +${e.startDay} hari, demand ${e.multiplier}× normal`).join('\n')
  : '  - Tidak ada event terjadwal'}

Berikan 3-5 bullet point insight yang actionable. Format:
• [URGENT/INFO/PELUANG] Insight singkat (1-2 kalimat, langsung to the point)

Fokus pada: apa yang harus dilakukan hari ini, risiko stockout, peluang efisiensi biaya, dan persiapan event.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ success: false, error: `Claude API error: ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const insight = (data.content?.[0]?.text ?? '').trim();

    // Cache for 6 hours
    insightCache.value = insight;
    insightCache.expiresAt = Date.now() + 6 * 60 * 60 * 1000;

    return NextResponse.json({ success: true, insight, cached: false });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Invalidate cache (called after sync)
export async function DELETE() {
  insightCache.value = '';
  insightCache.expiresAt = 0;
  return NextResponse.json({ success: true, message: 'Cache cleared' });
}
