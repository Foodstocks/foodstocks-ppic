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

const CHANNELS = [
  { name: 'Tokopedia', fee: 0.19 },
  { name: 'Shopee', fee: 0.135 },
  { name: 'TikTok Shop', fee: 0.19 },
  { name: 'Reseller/WA', fee: 0 },
  { name: 'Offline', fee: 0 },
];

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' }),
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

// Icons
const IconCOGS = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconBudget = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconInfo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconChevronDown = ({ down }: { down: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: down ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function COGSPage() {
  const [selectedChannel, setSelectedChannel] = useState('Tokopedia');
  const [cogsData, setCogsData] = useState<COGSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

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

  const avgMargin = cogsData.length > 0 ? cogsData.reduce((sum, i) => sum + i.grossMargin, 0) / cogsData.length : 0;
  const topItems = cogsData.filter(i => i.grossMargin >= 35);
  const lowItems = cogsData.filter(i => i.grossMargin < 25);
  const negItems = cogsData.filter(i => i.grossMargin < 0);

  const targetRevenue = budget.targetRevenue;
  const cogsBudgetPct = budget.cogsBudgetPct;
  const cogsBudget = targetRevenue * cogsBudgetPct;
  const cogsRealisasi = budget.cogsRealisasi;
  const cogsUsedPct = cogsBudget > 0 ? (cogsRealisasi / cogsBudget) * 100 : 0;

  // Pagination
  const totalPages = Math.ceil(cogsData.length / perPage);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = cogsData.slice((safePage - 1) * perPage, safePage * perPage);

  const pageNumbers: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push('…');
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push('…');
    pageNumbers.push(totalPages);
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <IconCOGS />
          </div>
          <div style={s.title}>COGS & Margin Tracker</div>
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>
          True HPP per SKU, margin per channel, dan target COGS tracker
        </div>
      </div>

      {/* Low margin alert */}
      {!loading && negItems.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ color: '#ef4444', marginTop: 1, flexShrink: 0 }}><IconAlert /></div>
          <div>
            <div style={{ fontWeight: 600, color: '#991B1B', fontSize: 13, marginBottom: 2 }}>
              {negItems.length} SKU Margin Negatif di {selectedChannel}
            </div>
            <div style={{ fontSize: 12, color: '#B91C1C' }}>
              {negItems.slice(0, 3).map(i => i.name).join(', ')}{negItems.length > 3 ? ` + ${negItems.length - 3} lainnya` : ''} — pertimbangkan penyesuaian harga atau efisiensi COGS
            </div>
          </div>
        </div>
      )}

      {/* COGS Budget Tracker */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: '#f59e0b' }}><IconBudget /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
              COGS Budget — {MONTHS_ID[budgetMonth.month - 1]} {budgetMonth.year}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E4E7ED', background: '#F9FAFB', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconChevronLeft />
            </button>
            <button type="button" onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E4E7ED', background: '#F9FAFB', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconChevronRight />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Target Revenue', value: formatRupiah(targetRevenue), color: '#3b82f6', sub: 'Ditetapkan tim' },
            { label: `Budget COGS (${Math.round(cogsBudgetPct * 100)}%)`, value: formatRupiah(cogsBudget), color: '#f59e0b', sub: 'Dari target revenue' },
            { label: 'Realisasi COGS', value: formatRupiah(cogsRealisasi), color: '#10b981', sub: 'Input manual' },
            { label: 'Sisa Ruang COGS', value: formatRupiah(Math.max(0, cogsBudget - cogsRealisasi)), color: cogsBudget - cogsRealisasi < 0 ? '#ef4444' : '#06b6d4', sub: cogsBudget - cogsRealisasi < 0 ? 'Over budget!' : 'Belum digunakan' },
          ].map(k => (
            <div key={k.label} style={{ padding: 14, background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {cogsBudget > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: '#374151', fontWeight: 500 }}>COGS Usage: <strong>{cogsUsedPct.toFixed(1)}%</strong></span>
              <span style={{ color: cogsRealisasi > cogsBudget ? '#ef4444' : cogsUsedPct > 90 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                {cogsRealisasi > cogsBudget ? 'Over Budget' : cogsUsedPct > 90 ? 'Hampir Habis' : 'Aman'}
              </span>
            </div>
            <div style={{ height: 10, background: '#E4E7ED', borderRadius: 5, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ width: `${Math.min(100, cogsUsedPct)}%`, height: '100%', background: cogsRealisasi > cogsBudget ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { field: 'targetRevenue' as const, label: 'Target Revenue (Rp)', val: targetRevenue, ph: '0' },
            { field: 'cogsBudgetPct' as const, label: 'Budget COGS (%)', val: Math.round(cogsBudgetPct * 100), ph: '55', step: '1', min: '1', max: '100' },
            { field: 'cogsRealisasi' as const, label: 'Realisasi COGS (Rp)', val: cogsRealisasi, ph: '0' },
          ].map(inp => (
            <div key={inp.field}>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600 }}>{inp.label}</label>
              <input
                type="number"
                step={inp.step}
                min={inp.min}
                max={inp.max}
                value={inp.val || ''}
                placeholder={inp.ph}
                onChange={e => updateBudget(inp.field, inp.field === 'cogsBudgetPct' ? Number(e.target.value) / 100 : Number(e.target.value))}
                style={{ width: '100%', background: '#F9FAFB', border: '1px solid #E4E7ED', borderRadius: 6, padding: '7px 10px', color: '#111827', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Channel + Margin Table */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ color: '#3b82f6' }}><IconChart /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Margin per SKU per Channel</div>
        </div>

        {/* Channel Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Channel:</span>
          {CHANNELS.map(ch => (
            <button type="button" key={ch.name} onClick={() => { setSelectedChannel(ch.name); setPage(1); }} style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${selectedChannel === ch.name ? '#3b82f6' : '#E4E7ED'}`,
              background: selectedChannel === ch.name ? '#3b82f6' : '#F9FAFB',
              color: selectedChannel === ch.name ? 'white' : '#374151',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
              {ch.name}{ch.fee > 0 ? ` (${(ch.fee * 100).toFixed(0)}%)` : ''}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={() => setShowDetail(v => !v)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${showDetail ? '#8b5cf6' : '#E4E7ED'}`, background: showDetail ? 'rgba(139,92,246,0.1)' : '#fff', color: showDetail ? '#8b5cf6' : '#374151', cursor: 'pointer' }}>
              {showDetail ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Avg Gross Margin', value: `${avgMargin.toFixed(1)}%`, color: '#10b981', sub: `Di ${selectedChannel}` },
            { label: 'Margin ≥ 35%', value: `${topItems.length} SKU`, color: '#3b82f6', sub: 'Produk unggulan' },
            { label: 'Margin < 25%', value: `${lowItems.length} SKU`, color: '#f59e0b', sub: 'Perlu perhatian' },
            { label: 'Margin Negatif', value: `${negItems.length} SKU`, color: negItems.length > 0 ? '#ef4444' : '#10b981', sub: negItems.length > 0 ? 'Perlu aksi segera' : 'Semua positif' },
          ].map(k => (
            <div key={k.label} style={{ padding: 12, background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E4E7ED', borderTopColor: '#10b981', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14 }}>Memuat data Jubelio...</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ef4444', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><IconAlert /></div>
            Gagal memuat data: {error}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: showDetail ? 900 : 620, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Produk</th>
                    <th style={s.th}>ABC</th>
                    <th style={s.th}>HPP Beli</th>
                    <th style={s.th}>True COGS</th>
                    <th style={s.th}>Fee Channel</th>
                    <th style={s.th}>Gross Margin</th>
                    {showDetail && <>
                      <th style={s.th}>Harga Jual</th>
                      <th style={s.th}>Margin Sederhana</th>
                      <th style={{ ...s.th, textAlign: 'right' as const }}>Δ vs Sederhana</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(item => (
                    <tr key={item.sku}>
                      <td style={{ ...s.td, maxWidth: 200 }}>
                        <div style={{ fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{item.name}</div>
                        {showDetail && <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>{item.sku}</div>}
                      </td>
                      <td style={s.td}>
                        <span style={{
                          background: item.abc === 'A' ? 'rgba(59,130,246,0.12)' : item.abc === 'B' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                          color: item.abc === 'A' ? '#3b82f6' : item.abc === 'B' ? '#f59e0b' : '#374151',
                          borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        }}>{item.abc}</span>
                      </td>
                      <td style={s.td}>{formatRupiah(item.hpp)}</td>
                      <td style={{ ...s.td, color: '#f59e0b', fontWeight: 500 }}>{formatRupiah(Math.round(item.trueCogs))}</td>
                      <td style={{ ...s.td, color: '#6B7280' }}>{channel.fee > 0 ? formatRupiah(Math.round(item.channelFee)) : <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: item.grossMargin >= 35 ? '#10b981' : item.grossMargin >= 25 ? '#f59e0b' : '#ef4444' }}>
                            {item.grossMargin.toFixed(1)}%
                          </span>
                          <div style={{ flex: 1, minWidth: 50, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, item.grossMargin))}%`, height: '100%', background: item.grossMargin >= 35 ? '#10b981' : item.grossMargin >= 25 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      {showDetail && <>
                        <td style={s.td}>{formatRupiah(item.sellingPrice)}</td>
                        <td style={{ ...s.td, color: '#374151' }}>{item.simpleMargin.toFixed(1)}%</td>
                        <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 600, color: item.grossMargin < item.simpleMargin ? '#ef4444' : '#10b981' }}>
                          {(item.grossMargin - item.simpleMargin).toFixed(1)}%
                        </td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {cogsData.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  Menampilkan <strong style={{ color: '#111827' }}>{(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, cogsData.length)}</strong> dari <strong style={{ color: '#111827' }}>{cogsData.length}</strong> SKU
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select title="Jumlah SKU per halaman" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                    style={{ border: '1px solid #E4E7ED', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}>
                    {[25, 50, 100].map(n => <option key={n} value={n}>{n} / hal</option>)}
                  </select>
                  <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>«</button>
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>‹</button>
                  {pageNumbers.map((n, i) =>
                    n === '…'
                      ? <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: 13, color: '#9CA3AF' }}>…</span>
                      : <button type="button" key={n} onClick={() => setPage(n as number)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${safePage === n ? '#3b82f6' : '#E4E7ED'}`, background: safePage === n ? '#3b82f6' : '#fff', color: safePage === n ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: safePage === n ? 600 : 400 }}>{n}</button>
                  )}
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages || totalPages === 0} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: (safePage === totalPages || totalPages === 0) ? '#D1D5DB' : '#374151', cursor: (safePage === totalPages || totalPages === 0) ? 'default' : 'pointer', fontSize: 13 }}>›</button>
                  <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages || totalPages === 0} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: (safePage === totalPages || totalPages === 0) ? '#D1D5DB' : '#374151', cursor: (safePage === totalPages || totalPages === 0) ? 'default' : 'pointer', fontSize: 13 }}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* True COGS explanation (collapsible) */}
      <div style={{ border: '1px solid #E4E7ED', borderRadius: 10, overflow: 'hidden' }}>
        <button type="button" onClick={() => setShowFormula(v => !v)}
          style={{ width: '100%', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#374151', fontSize: 13, fontWeight: 600, textAlign: 'left' as const }}>
          <IconInfo />
          Komponen True COGS &amp; Penjelasan
          <span style={{ marginLeft: 'auto' }}><IconChevronDown down={showFormula} /></span>
        </button>
        {showFormula && (
          <div style={{ padding: '14px 16px', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Rumus True COGS per Unit</div>
                <div>HPP Beli + (Ongkir Masuk ÷ Total Unit) + Biaya Handling</div>
                <div>+ (Holding Cost × Avg Hari di Gudang × HPP × 2%/30)</div>
                <div>+ Bad Debt Rate × HPP (untuk konsinyasi)</div>
                <div>+ Payment Cost (0 jika Cash, benefit jika dapat TOP)</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Gross Margin vs Margin Sederhana</div>
                <div><strong>Gross Margin</strong> = (Harga Jual − True COGS − Fee Channel) ÷ Harga Jual × 100%</div>
                <div style={{ marginTop: 4 }}><strong>Margin Sederhana</strong> = (Harga Jual − HPP Beli) ÷ Harga Jual × 100%</div>
                <div style={{ marginTop: 4 }}><strong>Δ (Delta)</strong> = selisih keduanya — semakin negatif, semakin besar biaya tersembunyi</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
