import { NextRequest, NextResponse } from 'next/server';
import { getJubelioToken } from '@/lib/jubelio';

const JUBELIO_BASE = 'https://api2.jubelio.com';
const SUPABASE_TABLE = 'foodstocks_kv';
const HISTORY_KEY = 'smart_events_history';
const MAX_HISTORY = 20;

// ── Types ────────────────────────────────────────────────────

export interface EventRecommendation {
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  avgDailySales: number;
  recommendedAdditionalQty: number;
  hpp: number;
  estimatedCost: number;
  reason: string;
}

export interface DetectedEvent {
  name: string;
  date: string;
  daysUntil: number;
  type: 'holiday' | 'promo' | 'seasonal' | 'cultural';
  demandMultiplier: number;
  recommendations: EventRecommendation[];
  totalEstimatedCost: number;
  summary: string;
}

export interface SmartEventResult {
  id: string;
  generatedAt: string;
  todayDate: string;
  events: DetectedEvent[];
  generalSummary: string;
  totalBudgetNeeded: number;
  dataSnapshot: {
    totalSKUs: number;
    criticalSKUs: number;
  };
}

// ── Supabase helpers ─────────────────────────────────────────

function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
}

function sbUrl() {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/rest/v1/${SUPABASE_TABLE}`;
}

async function loadHistory(): Promise<SmartEventResult[]> {
  try {
    const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!base) return [];
    const url = `${base}/rest/v1/${SUPABASE_TABLE}?key=eq.${encodeURIComponent(HISTORY_KEY)}&select=data`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows?.[0]?.data as SmartEventResult[]) ?? [];
  } catch {
    return [];
  }
}

async function saveHistory(history: SmartEventResult[]) {
  try {
    const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!base) return;
    await fetch(sbUrl(), {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        key: HISTORY_KEY,
        data: history,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // noop — history failure shouldn't block response
  }
}

// ── Jubelio inventory fetch ───────────────────────────────────

async function fetchInventory() {
  const token = await getJubelioToken();
  const results: { sku: string; name: string; stock: number; sellPrice: number; category: string }[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${JUBELIO_BASE}/inventory/items/?page=${page}&pageSize=100`, {
      headers: { Authorization: token },
    } as RequestInit);
    if (!res.ok) break;
    const json = await res.json();
    const groups = (json.data ?? []) as Record<string, unknown>[];
    if (!groups.length) break;

    for (const group of groups) {
      const variants = Array.isArray(group.variants)
        ? (group.variants as Record<string, unknown>[])
        : [group];
      for (const v of variants) {
        const sku = String(v.item_code ?? '');
        if (!sku) continue;
        results.push({
          sku,
          name: String(v.item_name ?? group.item_name ?? ''),
          stock: Number(v.end_qty ?? v.available_qty ?? 0),
          sellPrice: Number(v.sell_price ?? group.sell_price ?? 0),
          category: String(group.item_category_id ?? ''),
        });
      }
    }

    const total = json.totalCount ?? 0;
    if (results.length >= total || groups.length < 100) break;
    page++;
  }

  return results;
}

// ── GET — return history ──────────────────────────────────────

export async function GET() {
  const history = await loadHistory();
  return NextResponse.json({ success: true, history });
}

// ── POST — generate new AI recommendation ────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY belum dikonfigurasi di Vercel environment variables.' },
      { status: 500 }
    );
  }

  let velocityMap: Record<string, number> = {};
  let hppMap: Record<string, number> = {};
  try {
    const body = await req.json();
    velocityMap = body.velocityMap ?? {};
    hppMap = body.hppMap ?? {};
  } catch { /* proceed with empty maps */ }

  let inventoryItems: { sku: string; name: string; stock: number; sellPrice: number; category: string }[] = [];
  try {
    inventoryItems = await fetchInventory();
  } catch (err) {
    return NextResponse.json({ success: false, error: `Gagal ambil data Jubelio: ${String(err)}` }, { status: 500 });
  }

  if (inventoryItems.length === 0) {
    return NextResponse.json({ success: false, error: 'Tidak ada data inventory dari Jubelio.' }, { status: 400 });
  }

  const today = new Date();
  const todayStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = today.toISOString().split('T')[0];

  const inventoryContext = inventoryItems
    .slice(0, 80)
    .map(item => {
      const velocity = velocityMap[item.sku] ?? 0;
      const hpp = hppMap[item.sku] ?? Math.round(item.sellPrice * 0.65);
      const daysRemaining = velocity > 0 ? Math.round(item.stock / velocity) : null;
      return `${item.sku}|${item.name}|Stok:${item.stock}|Jual/hr:${velocity}|HPP:${hpp}|Sisa:${daysRemaining !== null ? daysRemaining + 'h' : '?'}`;
    })
    .join('\n');

  const criticalCount = inventoryItems.filter(item => {
    const v = velocityMap[item.sku] ?? 0;
    return v > 0 && item.stock / v <= 3;
  }).length;

  const prompt = `Kamu adalah AI analis purchasing untuk Foodstocks, bisnis snack & makanan ringan di Indonesia.

Hari ini: ${todayStr} (${todayISO})

Inventory (SKU|Nama|Stok|Jual/hr|HPP|Sisa):
${inventoryContext}

Total SKU: ${inventoryItems.length} | Kritis: ${criticalCount}

TUGAS:
1. Deteksi event/momen Indonesia dalam 60 hari ke depan dari ${todayISO} yang relevan untuk bisnis snack (hari raya, harbolnas, tanggal kembar, long weekend, libur nasional, libur sekolah, dll).
2. Rekomendasikan produk dari inventory yang perlu distok lebih banyak per event.
3. recommendedAdditionalQty = round(avgDailySales * durationDays * (demandMultiplier - 1))

Jawab HANYA dengan JSON valid tanpa markdown:
{
  "events": [
    {
      "name": "string",
      "date": "YYYY-MM-DD",
      "daysUntil": 0,
      "type": "holiday|promo|seasonal|cultural",
      "demandMultiplier": 1.5,
      "summary": "string",
      "recommendations": [
        {
          "sku": "string",
          "name": "string",
          "category": "string",
          "currentStock": 0,
          "avgDailySales": 0,
          "recommendedAdditionalQty": 0,
          "hpp": 0,
          "estimatedCost": 0,
          "reason": "string"
        }
      ],
      "totalEstimatedCost": 0
    }
  ],
  "generalSummary": "string"
}

Aturan: hanya SKU yang ada di inventory, maks 5 event, maks 5 rekomendasi per event, prioritaskan SKU dengan velocity > 0.`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return NextResponse.json({ success: false, error: `OpenAI error: ${errText}` }, { status: 500 });
    }

    const openaiData = await openaiRes.json();
    const rawText = openaiData.choices?.[0]?.message?.content ?? '{}';

    let parsed: { events?: DetectedEvent[]; generalSummary?: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ success: false, error: 'AI mengembalikan format tidak valid.' }, { status: 500 });
    }

    const events: DetectedEvent[] = (parsed.events ?? []).map(ev => ({
      ...ev,
      recommendations: (ev.recommendations ?? []).map(r => ({
        ...r,
        hpp: r.hpp || hppMap[r.sku] || 0,
        estimatedCost: r.estimatedCost || (r.recommendedAdditionalQty * (r.hpp || hppMap[r.sku] || 0)),
      })),
      totalEstimatedCost: ev.totalEstimatedCost || (ev.recommendations ?? []).reduce((s, r) => s + (r.estimatedCost || 0), 0),
    }));

    const totalBudgetNeeded = events.reduce((s, ev) => s + ev.totalEstimatedCost, 0);

    const result: SmartEventResult = {
      id: `se_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      todayDate: todayISO,
      events,
      generalSummary: parsed.generalSummary ?? '',
      totalBudgetNeeded,
      dataSnapshot: { totalSKUs: inventoryItems.length, criticalSKUs: criticalCount },
    };

    // Save to Supabase history
    const history = await loadHistory();
    await saveHistory([result, ...history].slice(0, MAX_HISTORY));

    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
