'use client';

import { formatRupiah, calcTrueCOGS } from '@/lib/calculations';
import { useState, useEffect } from 'react';

const HPP_KEY = 'foodstocks_hpp_v1';
const COGS_BUDGET_KEY = 'foodstocks_cogs_budget_v1';
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

interface MonthlyBudget { targetRevenue: number; cogsBudgetPct: number; cogsRealisasi: number; }

interface JubelioItem {
  sku: string;
  name: string;
  sellPrice: number;
  buyPrice: number;
  category: string;
  stock: number;
}

interface COGSRow {
  sku: string;
  name: string;
  abc: 'A' | 'B' | 'C';
  hpp: number;
  sellingPrice: number;
  trueCogs: number;
  channelFee: number;
  grossMargin: number;
  simpleMargin: number;
}

// Fee = total biaya wajib per platform (% dari harga jual)
// Shopee: Admin Kat.B 9% + Gratis Ongkir XTRA 4.5% = 13.5%
// Tokopedia & TikTok Shop: Komisi Kat.A 9.5% + Dinamis 5% + XBP 4.5% = 19%
const CHANNELS = [
  { name: 'Tokopedia', fee: 0.19 },
  { name: 'Shopee', fee: 0.135 },
  { name: 'TikTok Shop', fee: 0.19 },
  { name: 'Reseller/WA', fee: 0 },
  { name: 'Offline', fee: 0 },
];

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 20, marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  td: { padding: '11px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

export default function COGSPage() {
  const [selectedChannel, setSelectedChannel] = useState('Tokopedia');
  const [cogsData, setCogsData] = useState<COGSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [budgetMonth, setBudgetMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [allBudgets, setAllBudgets] = useState<Record<string, MonthlyBudget>>(() =>
    loadStorage(COGS_BUDGET_KEY, { '2026-03': { targetRevenue: 220_000_000, cogsBudgetPct: 0.55, cogsRealisasi: 114_170_000 } })
  );

  const monthKey = `${budgetMonth.year}-${String(budgetMonth.month).padStart(2, '0')}`;
  const budget = allBudgets[monthKey] ?? { targetRevenue: 0, cogsBudgetPct: 0.55, cogsRealisasi: 0 };

  function updateBudget(field: keyof MonthlyBudget, value: number) {
    const updated = { ...allBudgets, [monthKey]: { ...budget, [field]: value } };
    setAllBudgets(updated);
    try { localStorage.setItem(COGS_BUDGET_KEY, JSON.stringify(updated)); } catch { /* noop */ }
  }
  function prevMonth() { setBudgetMonth(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 }); }
  function nextMonth() { setBudgetMonth(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }); }

  const channel = CHANNELS.find(c => c.name === selectedChannel) || CHANNELS[0];

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/jubelio/inventory');
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Gagal memuat data');

        const items: JubelioItem[] = json.data;
        const hppMap: Record<string, number> = loadStorage(HPP_KEY, {});

        // ABC by sellPrice rank (top 20% = A, next 30% = B, rest = C)
        const sorted = [...items].sort((a, b) => b.sellPrice - a.sellPrice);
        const n = sorted.length;
        const abcMap: Record<string, 'A' | 'B' | 'C'> = {};
        sorted.forEach((x, i) => {
          const pct = (i + 1) / n;
          abcMap[x.sku] = pct <= 0.2 ? 'A' : pct <= 0.5 ? 'B' : 'C';
        });

        const rows: COGSRow[] = items.map(item => {
          const hpp = hppMap[item.sku] ?? (item.buyPrice > 0 ? item.buyPrice : Math.round(item.sellPrice * 0.65));
          const trueCogs = calcTrueCOGS({
            purchasePrice: hpp,
            inboundShipping: 50000,
            unitsReceived: 200,
            handlingCostPerUnit: 200,
            avgDaysInWarehouse: 14,
            holdingRateMonthly: 0.02,
            badDebtRate: 0,
            paymentTermDays: 0,
            costOfCapitalMonthly: 0.02,
          });
          const channelFee = item.sellPrice * channel.fee;
          const grossMargin = item.sellPrice > 0 ? ((item.sellPrice - trueCogs - channelFee) / item.sellPrice) * 100 : 0;
          const simpleMargin = item.sellPrice > 0 ? ((item.sellPrice - hpp) / item.sellPrice) * 100 : 0;
          return { sku: item.sku, name: item.name, abc: abcMap[item.sku] ?? 'C', hpp, sellingPrice: item.sellPrice, trueCogs, channelFee, grossMargin, simpleMargin };
        }).sort((a, b) => b.grossMargin - a.grossMargin);

        setCogsData(rows);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel]);

  const avgMargin = cogsData.length > 0 ? cogsData.reduce((s, i) => s + i.grossMargin, 0) / cogsData.length : 0;
  const topItems = cogsData.filter(i => i.grossMargin >= 35);
  const lowItems = cogsData.filter(i => i.grossMargin < 25);

  const targetRevenue = budget.targetRevenue;
  const cogsBudgetPct = budget.cogsBudgetPct;
  const cogsBudget = targetRevenue * cogsBudgetPct;
  const cogsRealisasi = budget.cogsRealisasi;

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <div style={s.title}>💹 COGS & Margin Tracker</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>True HPP per SKU, margin per channel, dan target COGS tracker</div>
      </div>

      {/* COGS Budget Tracker */}
      <div style={{ ...s.card, background: 'var(--bg-card)' }}>
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>←</button>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>📊 COGS Budget {MONTHS_ID[budgetMonth.month - 1]} {budgetMonth.year}</div>
          <button onClick={nextMonth} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>→</button>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          {[
            { label: 'Target Revenue', value: formatRupiah(targetRevenue), color: '#3b82f6' },
            { label: `Budget COGS (${Math.round(cogsBudgetPct * 100)}%)`, value: formatRupiah(cogsBudget), color: '#f59e0b' },
            { label: 'Realisasi COGS', value: formatRupiah(cogsRealisasi), color: '#10b981' },
            { label: 'Sisa Ruang COGS', value: formatRupiah(Math.max(0, cogsBudget - cogsRealisasi)), color: cogsBudget - cogsRealisasi < 0 ? '#ef4444' : '#06b6d4' },
          ].map(k => (
            <div key={k.label} style={{ padding: 16, background: 'var(--bg-hover)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '6px 0' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        {cogsBudget > 0 && (
          <>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>COGS Usage</span>
              <span style={{ color: cogsRealisasi > cogsBudget ? '#ef4444' : '#10b981', fontWeight: 600 }}>{((cogsRealisasi / cogsBudget) * 100).toFixed(1)}% dari budget</span>
            </div>
            <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${Math.min(100, (cogsRealisasi / cogsBudget) * 100)}%`, height: '100%', background: cogsRealisasi > cogsBudget ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: 5 }} />
            </div>
          </>
        )}

        {/* Editable Inputs */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Target Revenue (Rp)</label>
            <input type="number" value={targetRevenue || ''} placeholder="0" onChange={e => updateBudget('targetRevenue', Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Budget COGS (%)</label>
            <input type="number" step="1" min="1" max="100" value={Math.round(cogsBudgetPct * 100) || ''} placeholder="55"
              onChange={e => updateBudget('cogsBudgetPct', Number(e.target.value) / 100)}
              style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Realisasi COGS (Rp)</label>
            <input type="number" value={cogsRealisasi || ''} placeholder="0" onChange={e => updateBudget('cogsRealisasi', Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' as const }} />
          </div>
        </div>
      </div>

      {/* Channel Selector */}
      <div style={{ ...s.card }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>📐 Margin per SKU per Channel</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Channel:</span>
          {CHANNELS.map(ch => (
            <button key={ch.name} onClick={() => setSelectedChannel(ch.name)} style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedChannel === ch.name ? '#3b82f6' : 'var(--border)'}`,
              background: selectedChannel === ch.name ? '#3b82f6' : 'var(--bg-hover)',
              color: selectedChannel === ch.name ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
              {ch.name} {ch.fee > 0 ? `(fee ${(ch.fee * 100).toFixed(0)}%)` : ''}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Avg Margin', value: `${avgMargin.toFixed(1)}%`, color: '#10b981' },
            { label: `SKU Margin ≥ 35%`, value: `${topItems.length} SKU`, color: '#3b82f6' },
            { label: 'SKU Margin < 25%', value: `${lowItems.length} SKU`, color: '#ef4444' },
          ].map(k => (
            <div key={k.label} style={{ padding: 14, background: 'var(--bg-hover)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 16 }}>
            ⏳ Memuat data Jubelio...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ef4444', fontSize: 14 }}>
            ⚠️ Gagal memuat data: {error}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['SKU', 'Produk', 'ABC', 'HPP Beli', 'True COGS', 'Fee Channel', 'Harga Jual', 'Gross Margin', 'Margin Sederhana', 'Δ vs Sederhana'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cogsData.map(item => (
                  <tr key={item.sku}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{item.sku}</span></td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{item.name}</td>
                    <td style={s.td}>
                      <span style={{
                        background: item.abc === 'A' ? 'rgba(59,130,246,0.15)' : item.abc === 'B' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                        color: item.abc === 'A' ? '#3b82f6' : item.abc === 'B' ? '#f59e0b' : 'var(--text-secondary)',
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>{item.abc}</span>
                    </td>
                    <td style={s.td}>{formatRupiah(item.hpp)}</td>
                    <td style={{ ...s.td, color: '#f59e0b' }}>{formatRupiah(Math.round(item.trueCogs))}</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)' }}>{formatRupiah(Math.round(item.channelFee))}</td>
                    <td style={s.td}>{formatRupiah(item.sellingPrice)}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: item.grossMargin >= 35 ? '#10b981' : item.grossMargin >= 25 ? '#f59e0b' : '#ef4444' }}>
                      {item.grossMargin.toFixed(1)}%
                    </td>
                    <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{item.simpleMargin.toFixed(1)}%</td>
                    <td style={{ ...s.td, color: item.grossMargin < item.simpleMargin ? '#ef4444' : '#10b981' }}>
                      {(item.grossMargin - item.simpleMargin).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* True COGS explanation */}
      <div style={{ padding: 16, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', marginBottom: 8 }}>📐 Komponen True COGS per Unit:</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Harga Beli + (Ongkir Masuk / Total Unit) + Biaya Handling + (Holding Cost × Avg Hari di Gudang × HPP × 2%/30)
          + Bad Debt Rate × HPP (untuk konsinyasi) + Payment Cost (0 jika Cash, benefit jika dapat TOP)
        </div>
      </div>
    </div>
  );
}
