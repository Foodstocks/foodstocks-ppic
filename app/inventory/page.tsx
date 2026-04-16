'use client';

import {
  formatRupiah,
  calcMovementCategory, MOVEMENT_CONFIGS,
  calcAgingCategory, AGING_CONFIGS, calcCostOfFund,
  type MovementCategory, type AgingCategory,
} from '@/lib/calculations';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const HPP_KEY = 'foodstocks_hpp_v1';
const VELOCITY_KEY = 'foodstocks_velocity_v1';
const LEAD_TIME_KEY = 'foodstocks_leadtime_v1';

interface JubelioItem {
  sku: string;
  name: string;
  sellPrice: number;
  buyPrice: number;
  category: string;
  stock: number;
}

interface InventoryRow {
  sku: string;
  name: string;
  category: string;
  stock: number;
  sellPrice: number;
  hpp: number;
  daysRemaining: number;
  reorderPoint: number;
  status: 'KRITIS' | 'RENDAH' | 'AMAN' | 'OVERSTOCK';
  abc: 'A' | 'B' | 'C';
  movement: MovementCategory;
  daysInWarehouse: number;
  agingCategory: AgingCategory;
  costOfFund: number;
}

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '11px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' }),
  input: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 14px', color: '#111827', fontSize: 13, outline: 'none', width: 240 } as React.CSSProperties,
  btn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 600 } as React.CSSProperties,
};

const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
  KRITIS:   { label: 'Kritis',    bg: '#FEF2F2', color: '#D60001' },
  RENDAH:   { label: 'Rendah',    bg: '#FFFBEB', color: '#F59E0B' },
  AMAN:     { label: 'Aman',      bg: '#F0FDF4', color: '#10B981' },
  OVERSTOCK:{ label: 'Overstock', bg: '#EFF6FF', color: '#3B82F6' },
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterABC, setFilterABC] = useState('ALL');
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

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
        const velocityMap: Record<string, number> = loadStorage(VELOCITY_KEY, {});
        const leadTimeMap: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});

        const scored = items.map(item => ({
          sku: item.sku,
          score: (velocityMap[item.sku] ?? 0) > 0
            ? item.sellPrice * (velocityMap[item.sku] ?? 0)
            : item.sellPrice,
        })).sort((a, b) => b.score - a.score);

        const n = scored.length;
        const abcMap: Record<string, 'A' | 'B' | 'C'> = {};
        scored.forEach((x, i) => {
          const pct = (i + 1) / n;
          abcMap[x.sku] = pct <= 0.2 ? 'A' : pct <= 0.5 ? 'B' : 'C';
        });

        const computed: InventoryRow[] = items.map(item => {
          const avgDailySales = velocityMap[item.sku] ?? 0;
          const defaultLT = leadTimeMap['__default__'] ?? 3;
          const leadTime = leadTimeMap[item.sku] ?? leadTimeMap[item.category] ?? defaultLT;
          const hpp = hppMap[item.sku] ?? (item.buyPrice > 0 ? item.buyPrice : Math.round(item.sellPrice * 0.65));

          const daysRemaining = avgDailySales > 0
            ? parseFloat((item.stock / avgDailySales).toFixed(1))
            : item.stock === 0 ? 0 : 999;

          let status: InventoryRow['status'];
          if (daysRemaining <= leadTime) status = 'KRITIS';
          else if (daysRemaining <= leadTime * 1.5) status = 'RENDAH';
          else if (daysRemaining > 30) status = 'OVERSTOCK';
          else status = 'AMAN';

          const reorderPoint = avgDailySales > 0 ? Math.round(avgDailySales * leadTime * 1.2) : 0;
          const movement = calcMovementCategory(daysRemaining, avgDailySales > 0);
          const daysInWarehouse: number = (item as { daysInWarehouse?: number }).daysInWarehouse ?? 14;
          const agingCategory = calcAgingCategory(daysInWarehouse);
          const costOfFund = calcCostOfFund(item.stock * hpp, daysInWarehouse);

          return { sku: item.sku, name: item.name, category: item.category, stock: item.stock, sellPrice: item.sellPrice, hpp, daysRemaining, reorderPoint, status, abc: abcMap[item.sku] ?? 'C', movement, daysInWarehouse, agingCategory, costOfFund };
        });

        setRows(computed);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpis = {
    totalValue: rows.reduce((s, r) => s + r.stock * r.hpp, 0),
    kritis: rows.filter(r => r.status === 'KRITIS').length,
    rendah: rows.filter(r => r.status === 'RENDAH').length,
    aman: rows.filter(r => r.status === 'AMAN').length,
    overstock: rows.filter(r => r.status === 'OVERSTOCK').length,
    avgMargin: rows.length > 0 ? rows.reduce((s, r) => s + (r.sellPrice > 0 ? (r.sellPrice - r.hpp) / r.sellPrice * 100 : 0), 0) / rows.length : 0,
    totalCostOfFund: rows.reduce((s, r) => s + r.costOfFund, 0),
    deadStock: rows.filter(r => r.agingCategory === 'DEAD').length,
  };

  const filtered = rows.filter(item => {
    const matchSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchABC = filterABC === 'ALL' || item.abc === filterABC;
    const matchMovement = filterMovement === 'ALL' || item.movement === filterMovement;
    return matchSearch && matchStatus && matchABC && matchMovement;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // Reset to page 1 when filter/search changes
  const resetPage = () => setPage(1);

  const deadStockItems = rows.filter(r => r.agingCategory === 'DEAD');
  const kritisItems = rows.filter(r => r.status === 'KRITIS');

  const kpiCards = [
    {
      label: 'Total Nilai Stok', value: formatRupiah(kpis.totalValue), bg: '#EFF6FF', color: '#3B82F6',
      sub: `${rows.length} SKU aktif`,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    },
    {
      label: 'SKU Kritis', value: `${kpis.kritis}`, bg: '#FEF2F2', color: '#D60001',
      sub: 'Stok ≤ lead time supplier',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    },
    {
      label: 'SKU Rendah', value: `${kpis.rendah}`, bg: '#FFFBEB', color: '#F59E0B',
      sub: 'Perlu dipersiapkan minggu ini',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    },
    {
      label: 'SKU Aman', value: `${kpis.aman}`, bg: '#F0FDF4', color: '#10B981',
      sub: 'Tidak perlu tindakan',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
      label: 'SKU Overstock', value: `${kpis.overstock}`, bg: '#F5F3FF', color: '#8B5CF6',
      sub: 'Tahan order sementara',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      label: 'Avg Margin', value: `${kpis.avgMargin.toFixed(1)}%`, bg: '#F0FDFA', color: '#0D9488',
      sub: 'Rata-rata semua SKU',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
    },
    {
      label: 'Biaya Simpan/Bln', value: formatRupiah(kpis.totalCostOfFund), bg: '#FFF7ED', color: '#F97316',
      sub: 'Modal yang tertahan di gudang',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    },
    {
      label: 'Dead Stock', value: `${kpis.deadStock}`, bg: '#F9FAFB', color: '#6B7280',
      sub: 'Tidak terjual >60 hari',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
    },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={s.title}>Inventory Live</div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>Stok real-time dari Jubelio WMS · {rows.length} SKU aktif</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowLegend(p => !p)}
            style={{ ...s.btn, background: '#fff', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Panduan Status {showLegend ? '▲' : '▼'}
          </button>
          <button
            type="button"
            onClick={() => setShowDetail(p => !p)}
            style={{ ...s.btn, background: showDetail ? '#111827' : '#fff', color: showDetail ? '#fff' : '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            {showDetail ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpiCards.map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                {k.icon}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Dead Stock Banner */}
      {!loading && deadStockItems.length > 0 && (
        <div style={{ padding: '14px 18px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              {deadStockItems.length} SKU Dead Stock — tidak terjual lebih dari 60 hari
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
              {deadStockItems.slice(0, 4).map(r => r.name || r.sku).join(', ')}{deadStockItems.length > 4 ? ` +${deadStockItems.length - 4} lainnya` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: '📢 Jalankan promo', desc: 'Turunkan harga atau bundling' },
                { label: '🔄 Evaluasi reorder', desc: 'Stop beli sampai stok habis' },
                { label: '↩️ Retur supplier', desc: 'Jika masih dalam masa retur' },
              ].map(a => (
                <div key={a.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 7, padding: '6px 12px', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{a.label}</span>
                  <span style={{ color: '#9CA3AF' }}> — {a.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Kritis Banner */}
      {!loading && kritisItems.length > 0 && (
        <div style={{ padding: '12px 18px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D60001" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style={{ flex: 1, fontSize: 13, color: '#B91C1C' }}>
            <strong>{kritisItems.length} SKU kritis</strong> — {kritisItems.slice(0, 3).map(r => r.name || r.sku).join(', ')}{kritisItems.length > 3 ? ` +${kritisItems.length - 3} lainnya` : ''}
          </div>
          <Link href="/planner?status=REORDER_NOW" style={{ fontSize: 12, fontWeight: 700, color: '#D60001', textDecoration: 'none', whiteSpace: 'nowrap', padding: '6px 14px', background: '#fff', border: '1px solid #FCA5A5', borderRadius: 7 }}>
            Buat PO Sekarang →
          </Link>
        </div>
      )}

      {/* Velocity Info Banner */}
      {!loading && rows.length > 0 && (() => {
        const noVelocity = rows.filter(r => r.daysRemaining === 999).length;
        if (noVelocity === 0) return null;
        return (
          <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#92400E' }}>
              <strong>{noVelocity} SKU</strong> belum punya data kecepatan jual. Status KRITIS/RENDAH tidak bisa dihitung.
            </div>
            <a href="/settings#velocity" style={{ fontSize: 12, color: '#D60001', textDecoration: 'none', fontWeight: 600 }}>
              Import Velocity di Settings →
            </a>
          </div>
        );
      })()}

      {/* Status Legend — collapsible */}
      {showLegend && (
        <div style={{ ...s.card, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Panduan Status Stok</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {[
              { color: '#D60001', bg: '#FEF2F2', border: '#FECACA', label: 'Kritis', rule: 'Sisa hari ≤ Lead Time', desc: 'Stok habis sebelum barang tiba. Beli sekarang!' },
              { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Rendah', rule: 'Sisa hari ≤ Lead Time × 1.5', desc: 'Hampir habis. Siapkan order dalam 3–5 hari.' },
              { color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', label: 'Aman', rule: 'Sisa hari > Lead Time × 1.5', desc: 'Stok normal. Tidak perlu tindakan.' },
              { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: 'Overstock', rule: 'Sisa hari > 30 hari', desc: 'Stok berlebih. Tahan order, evaluasi penjualan.' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{item.rule}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#9CA3AF' }}>
            Sisa Hari = Stok ÷ Rata-rata Penjualan Harian &nbsp;|&nbsp; Lead Time = Hari pengiriman dari supplier
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Cari SKU atau nama produk..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            style={{ ...s.input, paddingLeft: 32 }}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'ALL',       label: `Semua (${rows.length})` },
            { key: 'KRITIS',    label: `Kritis (${kpis.kritis})` },
            { key: 'RENDAH',    label: `Rendah (${kpis.rendah})` },
            { key: 'AMAN',      label: `Aman (${kpis.aman})` },
            { key: 'OVERSTOCK', label: `Overstock (${kpis.overstock})` },
          ].map(f => (
            <button key={f.key} type="button" onClick={() => { setFilterStatus(f.key); resetPage(); }} style={{
              ...s.btn, padding: '6px 12px', fontSize: 12,
              background: filterStatus === f.key ? '#D60001' : '#fff',
              color: filterStatus === f.key ? '#fff' : '#374151',
              border: `1px solid ${filterStatus === f.key ? '#D60001' : '#E5E7EB'}`,
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'A', 'B', 'C'].map(f => (
            <button key={f} type="button" onClick={() => { setFilterABC(f); resetPage(); }} style={{
              ...s.btn, padding: '6px 12px', fontSize: 12,
              background: filterABC === f ? '#8B5CF6' : '#fff',
              color: filterABC === f ? '#fff' : '#374151',
              border: `1px solid ${filterABC === f ? '#8B5CF6' : '#E5E7EB'}`,
            }}>{f === 'ALL' ? 'ABC' : `Kat. ${f}`}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            ['ALL', 'Semua Gerak'],
            ['SUPER_FAST', 'Super Fast'],
            ['FAST', 'Fast'],
            ['MEDIUM', 'Medium'],
            ['SLOW', 'Slow'],
          ] as [string, string][]).map(([key, label]) => {
            const mc = key !== 'ALL' ? MOVEMENT_CONFIGS[key as MovementCategory] : null;
            const activeColor = mc?.color ?? '#3B82F6';
            return (
              <button key={key} type="button" onClick={() => { setFilterMovement(key); resetPage(); }} style={{
                ...s.btn, padding: '6px 12px', fontSize: 12,
                background: filterMovement === key ? activeColor : '#fff',
                color: filterMovement === key ? '#fff' : '#374151',
                border: `1px solid ${filterMovement === key ? activeColor : '#E5E7EB'}`,
              }}>{label}</button>
            );
          })}
        </div>
        {filtered.length !== rows.length && (
          <span style={{ fontSize: 12, color: '#6B7280' }}>Menampilkan {filtered.length} dari {rows.length} SKU</span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#6B7280', fontSize: 14 }}>Memuat data Jubelio...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#D60001', fontSize: 14 }}>Gagal memuat data: {error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {/* Core columns — always visible */}
                  <th style={s.th}>Produk</th>
                  <th style={s.th}>Stok</th>
                  <th style={s.th}>Sisa Hari</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>HPP</th>
                  <th style={s.th}>Margin</th>
                  {/* Detail columns — toggle */}
                  {showDetail && <>
                    <th style={s.th}>SKU</th>
                    <th style={s.th}>Pergerakan</th>
                    <th style={s.th}>ABC</th>
                    <th style={s.th}>Kategori</th>
                    <th style={s.th}>Aging</th>
                    <th style={{ ...s.th }} title="Modal yang tertahan di gudang per bulan">Biaya Simpan/Bln ⓘ</th>
                    <th style={s.th}>Reorder Point</th>
                    <th style={s.th}>Harga Jual</th>
                  </>}
                  <th style={{ ...s.th, textAlign: 'center' as const }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(item => {
                  const margin = item.sellPrice > 0 ? ((item.sellPrice - item.hpp) / item.sellPrice * 100).toFixed(1) : '0.0';
                  const cfg = statusCfg[item.status];
                  const isKritis = item.status === 'KRITIS';
                  return (
                    <tr
                      key={item.sku}
                      style={{ transition: 'background 0.1s', background: isKritis ? '#FFFAFA' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isKritis ? '#FEF2F2' : '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = isKritis ? '#FFFAFA' : 'transparent')}
                    >
                      {/* Core */}
                      <td style={{ ...s.td, fontWeight: 600, color: '#111827', maxWidth: 220 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        {!showDetail && <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>{item.sku}</div>}
                      </td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{item.stock} pcs</td>
                      <td style={{ ...s.td, fontWeight: 600, color: item.daysRemaining <= 3 ? '#D60001' : item.daysRemaining <= 7 ? '#F59E0B' : '#10B981' }}>
                        {item.daysRemaining === 999 ? '—' : `${item.daysRemaining}h`}
                      </td>
                      <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                      <td style={s.td}>{formatRupiah(item.hpp)}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: Number(margin) >= 30 ? '#10B981' : '#F59E0B' }}>{margin}%</td>
                      {/* Detail */}
                      {showDetail && <>
                        <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{item.sku}</span></td>
                        <td style={s.td}>
                          {(() => {
                            const mc = MOVEMENT_CONFIGS[item.movement];
                            const label = item.movement === 'SUPER_FAST' ? 'Super Fast' : item.movement === 'FAST' ? 'Fast' : item.movement === 'MEDIUM' ? 'Medium' : 'Slow';
                            return <span style={s.badge(mc.bg, mc.color)}>{label}</span>;
                          })()}
                        </td>
                        <td style={s.td}>
                          <span style={s.badge(
                            item.abc === 'A' ? '#EFF6FF' : item.abc === 'B' ? '#FFFBEB' : '#F9FAFB',
                            item.abc === 'A' ? '#3B82F6' : item.abc === 'B' ? '#F59E0B' : '#6B7280'
                          )}>{item.abc}</span>
                        </td>
                        <td style={{ ...s.td, color: '#6B7280' }}>{item.category}</td>
                        <td style={s.td}>
                          {(() => {
                            const ac = AGING_CONFIGS[item.agingCategory];
                            return <span style={s.badge(ac.bg, ac.color)}>{ac.label} ({item.daysInWarehouse}h)</span>;
                          })()}
                        </td>
                        <td style={{ ...s.td, color: item.agingCategory === 'OLD' || item.agingCategory === 'DEAD' ? '#D60001' : '#F97316', fontWeight: 600 }}>
                          {formatRupiah(item.costOfFund)}/bln
                        </td>
                        <td style={{ ...s.td, color: '#6B7280' }}>{item.reorderPoint > 0 ? item.reorderPoint : '—'}</td>
                        <td style={s.td}>{formatRupiah(item.sellPrice)}</td>
                      </>}
                      {/* Actions */}
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <Link
                            href="/planner"
                            title="Buat PO di Purchase Planner"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: isKritis ? '#D60001' : '#F3F4F6', color: isKritis ? '#fff' : '#374151', fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                            PO
                          </Link>
                          <Link
                            href="/forecast"
                            title="Lihat forecast stok"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: '#F3F4F6', color: '#374151', fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                            Forecast
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Tidak ada SKU yang cocok dengan filter</div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
          {/* Info */}
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Menampilkan <strong>{(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)}</strong> dari <strong>{filtered.length}</strong> SKU
          </div>

          {/* Per page + nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Per page selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
              Tampilkan
              <select
                title="Jumlah SKU per halaman"
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
              >
                {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              per halaman
            </div>

            {/* Page buttons */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === 1 ? '#D1D5DB' : '#374151' }}
              >«</button>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === 1 ? '#D1D5DB' : '#374151' }}
              >‹</button>

              {/* Page number buttons — show max 5 around current */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === '...' ? (
                  <span key={`ellipsis-${i}`} style={{ padding: '5px 8px', fontSize: 12, color: '#9CA3AF' }}>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${safePage === p ? '#D60001' : '#E5E7EB'}`, background: safePage === p ? '#D60001' : '#fff', color: safePage === p ? '#fff' : '#374151', cursor: 'pointer', fontSize: 12, fontWeight: safePage === p ? 700 : 400, minWidth: 34 }}
                  >{p}</button>
                ))
              }

              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === totalPages ? '#D1D5DB' : '#374151' }}
              >›</button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: 12, color: safePage === totalPages ? '#D1D5DB' : '#374151' }}
              >»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
