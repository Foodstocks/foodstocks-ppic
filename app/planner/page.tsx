'use client';

import { formatRupiah, calcMovementCategory, MOVEMENT_CONFIGS, type MovementCategory } from '@/lib/calculations';
import { useState, useEffect } from 'react';
import type { InventorySnapshot } from '@/app/settings/page';

const HPP_KEY = 'foodstocks_hpp_v1';
const VELOCITY_KEY = 'foodstocks_velocity_v1';
const INVENTORY_KEY = 'foodstocks_inventory_snapshot';
const LEAD_TIME_KEY = 'foodstocks_leadtime_v1';
const EVENTS_KEY = 'foodstocks_events_v1';
const SKUPPLIER_KEY = 'foodstocks_skupplier_v1';

type PlannerStatus = 'REORDER_NOW' | 'PREPARE' | 'SAFE' | 'NO_DATA';

interface DemandEvent { id: string; name: string; startDay: number; durationDays?: number; multiplier: number; category: string; }

interface PlannerItem {
  sku: string;
  name: string;
  category: string;
  supplier: string;
  stock: number;
  sellingPrice: number;
  hpp: number;
  avgDailySales: number;
  effectiveDailySales: number;
  leadTime: number;
  daysRemaining: number;
  reorderPoint: number;
  eoq: number | null;
  recommendedQty: number;
  estimatedCost: number;
  status: PlannerStatus;
  hasVelocity: boolean;
  movement: MovementCategory;
  activeEvent: string | null;
  abcClass: 'A' | 'B' | 'C';
}

const statusConfig: Record<PlannerStatus, { label: string; bg: string; color: string; dot: string }> = {
  REORDER_NOW: { label: 'Beli Sekarang', bg: '#FEF2F2', color: '#D60001', dot: '#ef4444' },
  PREPARE:     { label: 'Persiapan',     bg: '#FFFBEB', color: '#F59E0B', dot: '#f59e0b' },
  SAFE:        { label: 'Aman',          bg: '#F0FDF4', color: '#10B981', dot: '#10b981' },
  NO_DATA:     { label: 'Kurang Data',   bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
};

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' }),
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 } as React.CSSProperties,
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

// SVG Icons
const IconBrain = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);
const IconBudget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
  </svg>
);
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconPrepare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IconMissing = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IconDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconFormula = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const IconChevron = ({ down }: { down: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: down ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function PurchasePlanner() {
  const [filter, setFilter] = useState<'ALL' | PlannerStatus>('ALL');
  const [search, setSearch] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [dataSource, setDataSource] = useState<'demo' | 'import' | 'jubelio'>('demo');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  useEffect(() => {
    async function load() {
      const hppMap: Record<string, number> = loadStorage(HPP_KEY, {});
      const velocityMap: Record<string, number> = loadStorage(VELOCITY_KEY, {});
      const leadTimeMap: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
      const skupplierMap: Record<string, string> = loadStorage(SKUPPLIER_KEY, {});
      const snapshot: InventorySnapshot[] = loadStorage(INVENTORY_KEY, []);
      const demandEvents: DemandEvent[] = loadStorage(EVENTS_KEY, []);

      let source: InventorySnapshot[] = snapshot;
      let src: 'demo' | 'import' | 'jubelio' = snapshot.length > 0 ? 'import' : 'demo';

      if (snapshot.length === 0) {
        try {
          const res = await fetch('/api/jubelio/inventory');
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            source = json.data.map((item: { sku: string; name: string; stock: number; sellPrice: number; category: string }) => ({
              sku: item.sku,
              name: item.name,
              stock: item.stock,
              sellingPrice: item.sellPrice,
              supplier: '',
              category: item.category,
            }));
            src = 'jubelio';
          }
        } catch {
          // fall through to demo
        }
      }

      setDataSource(src);

      const computed: PlannerItem[] = source.map(item => {
        const hpp = hppMap[item.sku] ?? Math.round(item.sellingPrice * 0.65);
        const supplierName = skupplierMap[item.sku];
        const leadTime = (supplierName ? leadTimeMap[supplierName] : undefined) ?? leadTimeMap['__default__'] ?? item.leadTime ?? 3;
        const avgDailySales = velocityMap[item.sku] ?? 0;
        const hasVelocity = velocityMap[item.sku] != null;

        const activeEvent = demandEvents.find(ev =>
          ev.startDay >= -(ev.durationDays ?? 14) &&
          ev.startDay <= 60 &&
          (ev.category === '' || ev.category === item.category)
        ) ?? null;
        const eventMultiplier = activeEvent ? activeEvent.multiplier : 1;
        const effectiveDailySales = avgDailySales * eventMultiplier;

        const daysRemaining = avgDailySales > 0
          ? parseFloat((item.stock / avgDailySales).toFixed(1))
          : (item.stock === 0 ? 0 : -1);

        const movement = calcMovementCategory(daysRemaining, hasVelocity);
        const moveCfg = MOVEMENT_CONFIGS[movement];

        const reorderPoint = effectiveDailySales > 0
          ? Math.round(effectiveDailySales * leadTime * (1 + moveCfg.safetyMultiplier * 0.1))
          : 0;

        const annualDemand = effectiveDailySales * 365;
        const eoq = effectiveDailySales > 0
          ? Math.round(Math.sqrt((2 * annualDemand * 50000) / (hpp * 0.02)))
          : null;

        let status: PlannerStatus;
        if (!hasVelocity) {
          status = item.stock === 0 ? 'REORDER_NOW' : 'NO_DATA';
        } else if (daysRemaining <= leadTime) {
          status = 'REORDER_NOW';
        } else if (daysRemaining <= leadTime * 1.5) {
          status = 'PREPARE';
        } else {
          status = 'SAFE';
        }

        const recommendedQty = eoq
          ? Math.max(eoq, reorderPoint - item.stock)
          : Math.max(1, reorderPoint - item.stock);

        return {
          sku: item.sku, name: item.name, category: item.category || '-',
          supplier: supplierName || item.supplier || '-', stock: item.stock,
          sellingPrice: item.sellingPrice, hpp, avgDailySales, effectiveDailySales, leadTime,
          daysRemaining, reorderPoint, eoq,
          recommendedQty: Math.max(1, recommendedQty),
          estimatedCost: Math.max(1, recommendedQty) * hpp,
          status, hasVelocity, movement,
          activeEvent: activeEvent?.name ?? null,
          abcClass: 'C' as 'A' | 'B' | 'C', // placeholder, calculated below
        };
      });

      // ABC Classification — rank SKUs by monthly revenue contribution
      // A = top items covering ~80% of total revenue, B = next ~15%, C = rest
      const totalRevenue = computed.reduce((s, i) => s + i.avgDailySales * i.sellingPrice * 30, 0);
      if (totalRevenue > 0) {
        const sorted = [...computed].sort((a, b) =>
          (b.avgDailySales * b.sellingPrice) - (a.avgDailySales * a.sellingPrice)
        );
        let cumulative = 0;
        const abcMap: Record<string, 'A' | 'B' | 'C'> = {};
        for (const item of sorted) {
          const rev = item.avgDailySales * item.sellingPrice * 30;
          cumulative += rev;
          const pct = cumulative / totalRevenue;
          abcMap[item.sku] = pct <= 0.80 ? 'A' : pct <= 0.95 ? 'B' : 'C';
        }
        for (const item of computed) {
          item.abcClass = abcMap[item.sku] ?? 'C';
        }
      }

      setItems(computed.sort((a, b) => {
        const order: Record<PlannerStatus, number> = { REORDER_NOW: 0, PREPARE: 1, NO_DATA: 2, SAFE: 3 };
        return order[a.status] - order[b.status] || a.daysRemaining - b.daysRemaining;
      }));
    }
    load();
  }, []);

  const filtered = items.filter(r => {
    const matchFilter = filter === 'ALL' || r.status === filter;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.sku.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    REORDER_NOW: items.filter(r => r.status === 'REORDER_NOW').length,
    PREPARE: items.filter(r => r.status === 'PREPARE').length,
    SAFE: items.filter(r => r.status === 'SAFE').length,
    NO_DATA: items.filter(r => r.status === 'NO_DATA').length,
  };

  const actionItems = items.filter(r => r.status === 'REORDER_NOW' || r.status === 'PREPARE');
  const totalCost = actionItems.reduce((sum, r) => sum + r.estimatedCost, 0);
  const bySupplier = actionItems.reduce((acc, r) => {
    if (!acc[r.supplier]) acc[r.supplier] = [];
    acc[r.supplier].push(r);
    return acc;
  }, {} as Record<string, PlannerItem[]>);

  // Pagination
  const totalPages = Math.ceil(filtered.length / perPage);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const resetPage = () => setPage(1);

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

  const kpiCards = [
    { label: 'Total Est. Budget', value: formatRupiah(totalCost), sub: 'Untuk semua yang perlu dibeli', color: '#3b82f6', icon: <IconBudget /> },
    { label: 'Beli Sekarang', value: `${counts.REORDER_NOW} SKU`, sub: 'Stok ≤ Lead Time', color: '#ef4444', icon: <IconAlert /> },
    { label: 'Persiapan Order', value: `${counts.PREPARE} SKU`, sub: 'Stok 1.0–1.5× Lead Time', color: '#f59e0b', icon: <IconPrepare /> },
    { label: 'Aman', value: `${counts.SAFE} SKU`, sub: 'Stok cukup tersedia', color: '#10b981', icon: <IconCheck /> },
    { label: 'Kurang Data', value: `${counts.NO_DATA} SKU`, sub: 'Belum ada data velocity', color: '#9CA3AF', icon: <IconMissing /> },
    { label: 'Supplier Terlibat', value: `${Object.keys(bySupplier).length}`, sub: 'Perlu dihubungi segera', color: '#8b5cf6', icon: <IconTruck /> },
  ];

  const filterButtons: [string, string, string][] = [
    ['ALL', `Semua (${items.length})`, '#6B7280'],
    ['REORDER_NOW', `Beli Sekarang (${counts.REORDER_NOW})`, '#ef4444'],
    ['PREPARE', `Persiapan (${counts.PREPARE})`, '#f59e0b'],
    ['SAFE', `Aman (${counts.SAFE})`, '#10b981'],
    ['NO_DATA', `Kurang Data (${counts.NO_DATA})`, '#9CA3AF'],
  ];

  return (
    <div className="page-root" style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <IconBrain />
              </div>
              <div style={s.title}>Purchase Planner</div>
            </div>
            <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>
              Rekomendasi berbasis ABC Analysis · Reorder Point · EOQ &nbsp;·&nbsp; {items.length} SKU aktif
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: dataSource === 'import' ? 'rgba(16,185,129,0.12)' : dataSource === 'jubelio' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: dataSource === 'import' ? '#10b981' : dataSource === 'jubelio' ? '#3b82f6' : '#f59e0b', fontWeight: 600 }}>
              {dataSource === 'import' ? 'Data Import' : dataSource === 'jubelio' ? 'Data Jubelio' : 'Data Demo'}
            </span>
            <button type="button" onClick={() => setShowDraftModal(true)} style={{ ...s.btn, background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconDoc />
              Draft PO ({actionItems.length} SKU)
            </button>
          </div>
        </div>
      </div>

      {/* Velocity Coverage Banner */}
      <div style={{ padding: '12px 16px', background: counts.NO_DATA === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${counts.NO_DATA === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: counts.NO_DATA === 0 ? '#10b981' : '#92400e' }}>
          {counts.NO_DATA === 0
            ? `Semua ${items.length} SKU memiliki data velocity — rekomendasi penuh aktif`
            : <><strong>{items.length - counts.NO_DATA} dari {items.length} SKU</strong> punya velocity · <strong>{counts.NO_DATA} SKU</strong> belum ada data penjualan harian (status: Kurang Data)</>
          }
        </div>
        {counts.NO_DATA > 0 && (
          <a href="/settings#velocity" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            Import Velocity di Settings →
          </a>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 24 }}>
        {kpiCards.map(kpi => (
          <div key={kpi.label} style={{ ...s.card, marginBottom: 0, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>{kpi.label}</div>
              <div style={{ color: kpi.color, opacity: 0.8 }}>{kpi.icon}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search + Toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Cari SKU atau produk..."
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage(); }}
          className="search-input"
          style={{ background: '#F9FAFB', border: '1px solid #E4E7ED', borderRadius: 8, padding: '7px 14px', color: '#111827', fontSize: 13, outline: 'none', width: 220 }}
        />
        <div style={{ width: 1, height: 28, background: '#E4E7ED', margin: '0 2px' }} />
        {filterButtons.map(([key, label, dotColor]) => (
          <button
            type="button"
            key={key}
            onClick={() => { setFilter(key as typeof filter); resetPage(); }}
            style={{
              ...s.btn, padding: '6px 12px', fontSize: 12,
              background: filter === key ? '#3b82f6' : '#fff',
              color: filter === key ? 'white' : '#374151',
              border: `1px solid ${filter === key ? '#3b82f6' : '#E4E7ED'}`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {key !== 'ALL' && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: filter === key ? 'rgba(255,255,255,0.8)' : dotColor, display: 'inline-block', flexShrink: 0 }} />
            )}
            {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowDetail(v => !v)}
            style={{ ...s.btn, padding: '6px 14px', fontSize: 12, background: showDetail ? 'rgba(139,92,246,0.1)' : '#fff', color: showDetail ? '#8b5cf6' : '#374151', border: `1px solid ${showDetail ? '#8b5cf6' : '#E4E7ED'}` }}
          >
            {showDetail ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={s.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: showDetail ? 1400 : 780, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={s.th}>Produk</th>
                <th style={s.th}>Stok</th>
                <th style={s.th}>Sisa Hari</th>
                <th style={s.th}>Lead Time</th>
                <th style={s.th}>Rec. Beli</th>
                <th style={s.th}>Est. Biaya</th>
                {showDetail && <>
                  <th style={s.th}>Gerak</th>
                  <th style={s.th}>Kategori</th>
                  <th style={s.th}>Avg/Hari</th>
                  <th style={s.th}>Efektif/Hari</th>
                  <th style={s.th}>Reorder Pt.</th>
                  <th style={s.th}>EOQ</th>
                  <th style={s.th}>HPP</th>
                  <th style={s.th}>Margin</th>
                </>}
                <th style={s.th}>Status</th>
                <th style={{ ...s.th, textAlign: 'center' as const }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => {
                const cfg = statusConfig[r.status];
                const margin = ((r.sellingPrice - r.hpp) / r.sellingPrice * 100);
                const isUrgent = r.status === 'REORDER_NOW';
                return (
                  <tr key={r.sku} style={{ background: isUrgent ? 'rgba(239,68,68,0.035)' : 'transparent' }}>
                    {/* Produk */}
                    <td style={{ ...s.td, maxWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{r.name}</div>
                        {r.hasVelocity && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                            background: r.abcClass === 'A' ? '#FEF2F2' : r.abcClass === 'B' ? '#FFFBEB' : '#F9FAFB',
                            color: r.abcClass === 'A' ? '#D60001' : r.abcClass === 'B' ? '#D97706' : '#9CA3AF',
                            border: `1px solid ${r.abcClass === 'A' ? '#FECACA' : r.abcClass === 'B' ? '#FDE68A' : '#E5E7EB'}`,
                          }}>
                            {r.abcClass}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>{r.sku}</div>
                      {r.activeEvent && (
                        <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {r.activeEvent}
                        </div>
                      )}
                    </td>
                    {/* Stok */}
                    <td style={{ ...s.td, fontWeight: 700 }}>{r.stock} pcs</td>
                    {/* Sisa Hari */}
                    <td style={{ ...s.td, fontWeight: 600, color: r.daysRemaining === 0 ? '#ef4444' : r.daysRemaining === -1 ? '#D1D5DB' : r.daysRemaining <= 3 ? '#ef4444' : r.daysRemaining <= 7 ? '#f59e0b' : '#10b981' }}>
                      {r.daysRemaining === -1 ? (
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>Belum diketahui</span>
                      ) : `${r.daysRemaining} hari`}
                    </td>
                    {/* Lead Time */}
                    <td style={{ ...s.td, color: '#374151' }}>{r.leadTime} hari</td>
                    {/* Rec. Beli */}
                    <td style={{ ...s.td, fontWeight: 700, color: '#3b82f6' }}>{r.recommendedQty} pcs</td>
                    {/* Est. Biaya */}
                    <td style={{ ...s.td, color: '#111827', fontWeight: 600 }}>{formatRupiah(r.estimatedCost)}</td>
                    {/* Detail columns */}
                    {showDetail && <>
                      <td style={s.td}>
                        {(() => {
                          const mc = MOVEMENT_CONFIGS[r.movement];
                          const shortLabel = r.movement === 'SUPER_FAST' ? 'A+' : r.movement === 'FAST' ? 'A' : r.movement === 'MEDIUM' ? 'B' : 'C';
                          return <span style={s.badge(mc.bg, mc.color)}>{shortLabel}</span>;
                        })()}
                      </td>
                      <td style={{ ...s.td, color: '#374151' }}>{r.category}</td>
                      <td style={{ ...s.td, color: r.hasVelocity ? '#111827' : '#D1D5DB' }}>
                        {r.hasVelocity ? `${r.avgDailySales}/hr` : '—'}
                      </td>
                      <td style={{ ...s.td, color: r.activeEvent ? '#8b5cf6' : (r.hasVelocity ? '#111827' : '#D1D5DB'), fontWeight: r.activeEvent ? 600 : 400 }}>
                        {r.hasVelocity ? `${r.effectiveDailySales.toFixed(1)}/hr` : '—'}
                        {r.activeEvent && r.effectiveDailySales !== r.avgDailySales && (
                          <span style={{ fontSize: 10, marginLeft: 3, color: '#8b5cf6' }}>↑event</span>
                        )}
                      </td>
                      <td style={{ ...s.td, color: '#374151' }}>{r.reorderPoint > 0 ? `${r.reorderPoint} pcs` : '—'}</td>
                      <td style={s.td}>{r.eoq ? `${r.eoq} pcs` : '—'}</td>
                      <td style={s.td}>{formatRupiah(r.hpp)}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: margin >= 30 ? '#10b981' : '#f59e0b' }}>{margin.toFixed(0)}%</td>
                    </>}
                    {/* Status */}
                    <td style={s.td}>
                      <span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span>
                      {r.status === 'NO_DATA' && (
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>Tidak ada data velocity</div>
                      )}
                    </td>
                    {/* Aksi */}
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <a
                          href="/po-budget"
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', background: isUrgent ? '#ef4444' : '#F3F4F6', color: isUrgent ? '#fff' : '#374151', whiteSpace: 'nowrap' as const }}
                        >
                          PO
                        </a>
                        <a
                          href="/forecast"
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', background: '#F3F4F6', color: '#374151', whiteSpace: 'nowrap' as const }}
                        >
                          Forecast
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Tidak ada data yang cocok</div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              Menampilkan <strong style={{ color: '#111827' }}>{(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)}</strong> dari <strong style={{ color: '#111827' }}>{filtered.length}</strong> SKU
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                title="Jumlah SKU per halaman"
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); resetPage(); }}
                style={{ border: '1px solid #E4E7ED', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
              >
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} / halaman</option>)}
              </select>
              <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>«</button>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>‹</button>
              {pageNumbers.map((n, i) =>
                n === '…'
                  ? <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', fontSize: 13, color: '#9CA3AF' }}>…</span>
                  : <button type="button" key={n} onClick={() => setPage(n as number)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${safePage === n ? '#3b82f6' : '#E4E7ED'}`, background: safePage === n ? '#3b82f6' : '#fff', color: safePage === n ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: safePage === n ? 600 : 400 }}>{n}</button>
              )}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages || totalPages === 0} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: (safePage === totalPages || totalPages === 0) ? '#D1D5DB' : '#374151', cursor: (safePage === totalPages || totalPages === 0) ? 'default' : 'pointer', fontSize: 13 }}>›</button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages || totalPages === 0} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: (safePage === totalPages || totalPages === 0) ? '#D1D5DB' : '#374151', cursor: (safePage === totalPages || totalPages === 0) ? 'default' : 'pointer', fontSize: 13 }}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Formula (collapsible) */}
      <div style={{ border: '1px solid #E4E7ED', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowFormula(v => !v)}
          style={{ width: '100%', padding: '12px 16px', background: '#F9FAFB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#374151', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
        >
          <IconFormula />
          Formula & Penjelasan Status
          <span style={{ marginLeft: 'auto' }}><IconChevron down={showFormula} /></span>
        </button>
        {showFormula && (
          <div style={{ padding: '14px 16px', background: '#fff', fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Rumus Kalkulasi</div>
                <div><strong>Reorder Point</strong> = Avg Daily Sales × Lead Time × 1.2</div>
                <div><strong>EOQ</strong> = √(2 × D × S / H) · D=demand tahunan, S=50.000, H=HPP×2%</div>
                <div><strong>Sisa Hari</strong> = Stok ÷ Avg Daily Sales</div>
                <div><strong>Rec. Beli</strong> = max(EOQ, Reorder Point − Stok)</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Penjelasan Status</div>
                <div><span style={s.badge('#FEF2F2', '#D60001')}>Beli Sekarang</span> Sisa hari ≤ Lead Time</div>
                <div style={{ marginTop: 4 }}><span style={s.badge('#FFFBEB', '#F59E0B')}>Persiapan</span> Sisa hari 1.0–1.5× Lead Time</div>
                <div style={{ marginTop: 4 }}><span style={s.badge('#F0FDF4', '#10B981')}>Aman</span> Stok cukup</div>
                <div style={{ marginTop: 4 }}><span style={s.badge('#F9FAFB', '#6B7280')}>Kurang Data</span> Belum ada velocity — import di <a href="/settings#velocity" style={{ color: '#3b82f6' }}>Settings</a></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Draft PO Modal */}
      {showDraftModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 28, maxWidth: 700, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <IconDoc />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Draft Purchase Orders</div>
              </div>
              <button type="button" onClick={() => setShowDraftModal(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              Dikelompokkan per supplier · Total estimasi: <strong style={{ color: '#3b82f6' }}>{formatRupiah(totalCost)}</strong>
            </div>
            {Object.entries(bySupplier).map(([supplier, recs]) => (
              <div key={supplier} style={{ background: '#F9FAFB', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconTruck />
                    {supplier}
                  </div>
                  <div style={{ color: '#3b82f6', fontWeight: 600 }}>{formatRupiah(recs.reduce((sum, r) => sum + r.estimatedCost, 0))}</div>
                </div>
                {recs.map(item => (
                  <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E4E7ED', fontSize: 13 }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <div style={{ color: '#111827', fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{item.sku}</div>
                    </div>
                    <div style={{ color: '#374151', whiteSpace: 'nowrap' as const, textAlign: 'right' as const }}>
                      <div style={{ fontWeight: 600 }}>{item.recommendedQty} pcs</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{formatRupiah(item.estimatedCost)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {actionItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#6B7280' }}>Tidak ada item yang perlu dibeli saat ini.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
