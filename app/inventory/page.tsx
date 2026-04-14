'use client';

import {
  formatRupiah,
  calcMovementCategory, MOVEMENT_CONFIGS,
  calcAgingCategory, AGING_CONFIGS, calcCostOfFund,
  type MovementCategory, type AgingCategory,
} from '@/lib/calculations';
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
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' }),
  input: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 14px', color: '#111827', fontSize: 13, outline: 'none', width: 240 } as React.CSSProperties,
  btn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 600 } as React.CSSProperties,
};

const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
  KRITIS: { label: 'Kritis', bg: '#FEF2F2', color: '#D60001' },
  RENDAH: { label: 'Rendah', bg: '#FFFBEB', color: '#F59E0B' },
  AMAN: { label: 'Aman', bg: '#F0FDF4', color: '#10B981' },
  OVERSTOCK: { label: 'Overstock', bg: '#EFF6FF', color: '#3B82F6' },
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

        // ABC: sort by (sellPrice * avgDailySales) desc; fallback by sellPrice
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
          // Estimasi hari di gudang dari last PO date; fallback ke 14 hari
          const daysInWarehouse: number = (item as { daysInWarehouse?: number }).daysInWarehouse ?? 14;
          const agingCategory = calcAgingCategory(daysInWarehouse);
          const costOfFund = calcCostOfFund(item.stock * hpp, daysInWarehouse);

          return {
            sku: item.sku,
            name: item.name,
            category: item.category,
            stock: item.stock,
            sellPrice: item.sellPrice,
            hpp,
            daysRemaining,
            reorderPoint,
            status,
            abc: abcMap[item.sku] ?? 'C',
            movement,
            daysInWarehouse,
            agingCategory,
            costOfFund,
          };
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
    avgMargin: rows.length > 0
      ? rows.reduce((s, r) => s + (r.sellPrice > 0 ? (r.sellPrice - r.hpp) / r.sellPrice * 100 : 0), 0) / rows.length
      : 0,
    totalCostOfFund: rows.reduce((s, r) => s + r.costOfFund, 0),
    deadStock: rows.filter(r => r.agingCategory === 'DEAD').length,
    slowMoving: rows.filter(r => r.movement === 'SLOW').length,
  };

  const filtered = rows.filter(item => {
    const matchSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
    const matchABC = filterABC === 'ALL' || item.abc === filterABC;
    const matchMovement = filterMovement === 'ALL' || item.movement === filterMovement;
    return matchSearch && matchStatus && matchABC && matchMovement;
  });

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={s.title}>Inventory Live</div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>Stok real-time dari Jubelio WMS · {rows.length} SKU aktif</div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Nilai Stok', value: formatRupiah(kpis.totalValue), bg: '#EFF6FF', color: '#3B82F6' },
          { label: 'SKU Kritis', value: `${kpis.kritis} SKU`, bg: '#FEF2F2', color: '#D60001' },
          { label: 'SKU Rendah', value: `${kpis.rendah} SKU`, bg: '#FFFBEB', color: '#F59E0B' },
          { label: 'SKU Aman', value: `${kpis.aman} SKU`, bg: '#F0FDF4', color: '#10B981' },
          { label: 'SKU Overstock', value: `${kpis.overstock} SKU`, bg: '#F5F3FF', color: '#8B5CF6' },
          { label: 'Avg Margin', value: `${kpis.avgMargin.toFixed(1)}%`, bg: '#F0FDFA', color: '#0D9488' },
          { label: 'Cost of Fund/Bln', value: formatRupiah(kpis.totalCostOfFund), bg: '#FFF7ED', color: '#F97316' },
          { label: 'Dead Stock', value: `${kpis.deadStock} SKU`, bg: '#F9FAFB', color: '#6B7280' },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, padding: '16px 18px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: k.color }} />
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Velocity Info Banner */}
      {!loading && rows.length > 0 && (() => {
        const noVelocity = rows.filter(r => r.daysRemaining === 999).length;
        const allOverstock = kpis.rendah === 0 && kpis.aman === 0 && kpis.overstock > 0;
        if (!allOverstock || noVelocity === 0) return null;
        return (
          <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#92400E' }}>
              <strong>{noVelocity} SKU</strong> belum memiliki data velocity. Status RENDAH & AMAN akan muncul setelah velocity diisi.
            </div>
            <a href="/settings#velocity" style={{ fontSize: 12, color: '#D60001', textDecoration: 'none', fontWeight: 600 }}>
              Import Velocity di Settings →
            </a>
          </div>
        );
      })()}

      {/* Status Legend */}
      <div style={{ ...s.card, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Parameter Status Stok</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { color: '#D60001', bg: '#FEF2F2', border: '#FECACA', label: 'Kritis', rule: 'Sisa hari ≤ Lead Time supplier', desc: 'Stok habis sebelum barang tiba. Beli sekarang!' },
            { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Rendah', rule: 'Lead Time < Sisa hari ≤ Lead Time × 1.5', desc: 'Stok hampir habis. Perlu segera persiapan order.' },
            { color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', label: 'Aman', rule: 'Sisa hari > Lead Time × 1.5', desc: 'Stok dalam batas normal. Tidak perlu tindakan.' },
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Cari SKU atau nama produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.input, paddingLeft: 32 }}
          />
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: `Semua (${rows.length})` },
            { key: 'KRITIS', label: `Kritis (${kpis.kritis})` },
            { key: 'RENDAH', label: `Rendah (${kpis.rendah})` },
            { key: 'AMAN', label: `Aman (${kpis.aman})` },
            { key: 'OVERSTOCK', label: `Overstock (${kpis.overstock})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
              ...s.btn, padding: '6px 12px', fontSize: 12,
              background: filterStatus === f.key ? '#D60001' : '#fff',
              color: filterStatus === f.key ? '#fff' : '#374151',
              border: `1px solid ${filterStatus === f.key ? '#D60001' : '#E5E7EB'}`,
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'A', 'B', 'C'].map(f => (
            <button key={f} onClick={() => setFilterABC(f)} style={{
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
              <button key={key} onClick={() => setFilterMovement(key)} style={{
                ...s.btn, padding: '6px 12px', fontSize: 12,
                background: filterMovement === key ? activeColor : '#fff',
                color: filterMovement === key ? '#fff' : '#374151',
                border: `1px solid ${filterMovement === key ? activeColor : '#E5E7EB'}`,
              }}>{label}</button>
            );
          })}
        </div>
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
                  {['SKU', 'Produk', 'Pergerakan', 'ABC', 'Kategori', 'Stok', 'Sisa Hari', 'Aging', 'Cost of Fund', 'Reorder Point', 'Status', 'HPP', 'Harga Jual', 'Margin'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const margin = item.sellPrice > 0 ? ((item.sellPrice - item.hpp) / item.sellPrice * 100).toFixed(1) : '0.0';
                  const cfg = statusCfg[item.status];
                  return (
                    <tr key={item.sku} style={{ transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{item.sku}</span></td>
                      <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{item.name}</td>
                      <td style={s.td}>
                        {(() => {
                          const mc = MOVEMENT_CONFIGS[item.movement];
                          const shortLabel = item.movement === 'SUPER_FAST' ? 'Super Fast' : item.movement === 'FAST' ? 'Fast' : item.movement === 'MEDIUM' ? 'Medium' : 'Slow';
                          return <span style={s.badge(mc.bg, mc.color)}>{shortLabel}</span>;
                        })()}
                      </td>
                      <td style={s.td}>
                        <span style={s.badge(
                          item.abc === 'A' ? '#EFF6FF' : item.abc === 'B' ? '#FFFBEB' : '#F9FAFB',
                          item.abc === 'A' ? '#3B82F6' : item.abc === 'B' ? '#F59E0B' : '#6B7280'
                        )}>{item.abc}</span>
                      </td>
                      <td style={{ ...s.td, color: '#6B7280' }}>{item.category}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{item.stock}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: item.daysRemaining <= 3 ? '#D60001' : item.daysRemaining <= 5 ? '#F59E0B' : '#10B981' }}>
                        {item.daysRemaining === 999 ? '—' : `${item.daysRemaining}h`}
                      </td>
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
                      <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                      <td style={s.td}>{formatRupiah(item.hpp)}</td>
                      <td style={s.td}>{formatRupiah(item.sellPrice)}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: Number(margin) >= 30 ? '#10B981' : '#F59E0B' }}>{margin}%</td>
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
    </div>
  );
}
