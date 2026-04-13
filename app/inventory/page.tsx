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
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 20, marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  td: { padding: '11px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-block' }),
  input: { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 240 } as React.CSSProperties,
  btn: { padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 } as React.CSSProperties,
};

const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
  KRITIS: { label: '🔴 Kritis', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  RENDAH: { label: '🟡 Rendah', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  AMAN: { label: '🟢 Aman', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  OVERSTOCK: { label: '📦 Overstock', bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
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
      <div style={{ marginBottom: 24 }}>
        <div style={s.title}>📦 Inventory Live</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Stok real-time dari Jubelio WMS · {rows.length} SKU aktif</div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Nilai Stok', value: formatRupiah(kpis.totalValue), color: '#3b82f6' },
          { label: 'SKU Kritis', value: `${kpis.kritis} SKU`, color: '#ef4444' },
          { label: 'SKU Rendah', value: `${kpis.rendah} SKU`, color: '#f59e0b' },
          { label: 'SKU Aman', value: `${kpis.aman} SKU`, color: '#10b981' },
          { label: 'SKU Overstock', value: `${kpis.overstock} SKU`, color: '#8b5cf6' },
          { label: 'Avg Margin', value: `${kpis.avgMargin.toFixed(1)}%`, color: '#06b6d4' },
          { label: 'Cost of Fund / Bln', value: formatRupiah(kpis.totalCostOfFund), color: '#f97316' },
          { label: 'Dead Stock', value: `${kpis.deadStock} SKU`, color: '#94a3b8' },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '6px 0' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Velocity Info Banner */}
      {!loading && rows.length > 0 && (() => {
        const noVelocity = rows.filter(r => r.daysRemaining === 999).length;
        const allOverstock = kpis.rendah === 0 && kpis.aman === 0 && kpis.overstock > 0;
        if (!allOverstock || noVelocity === 0) return null;
        return (
          <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: '#f59e0b' }}>
              ⚠️ <strong>{noVelocity} SKU</strong> belum memiliki data velocity (penjualan harian). Status RENDAH & AMAN akan muncul setelah velocity diisi. Saat ini semua tampil sebagai OVERSTOCK.
            </div>
            <a href="/settings#velocity" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
              → Import atau Tarik Velocity di Settings
            </a>
          </div>
        );
      })()}

      {/* Status Legend */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: '14px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          📋 Parameter Status Stok
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', label: '🔴 Kritis', rule: 'Sisa hari ≤ Lead Time supplier', desc: 'Stok akan habis SEBELUM barang tiba. Beli sekarang!' },
            { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: '🟡 Rendah', rule: 'Lead Time < Sisa hari ≤ Lead Time × 1.5', desc: 'Stok hampir habis. Perlu segera persiapan order.' },
            { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', label: '🟢 Aman', rule: 'Sisa hari > Lead Time × 1.5', desc: 'Stok dalam batas normal. Tidak perlu tindakan.' },
            { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)', label: '📦 Overstock', rule: 'Sisa hari > 30 hari (jauh di atas normal)', desc: 'Stok berlebih. Tahan order, evaluasi penjualan.' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.color, marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>📐 {item.rule}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-faint)' }}>
          💡 <strong style={{ color: 'var(--text-muted)' }}>Sisa Hari</strong> = Stok ÷ Rata-rata Penjualan Harian &nbsp;|&nbsp;
          <strong style={{ color: 'var(--text-muted)' }}>Lead Time</strong> = Hari pengiriman dari supplier ke gudang
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cari SKU atau nama produk..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.input}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'ALL', label: `Semua (${rows.length})` },
            { key: 'KRITIS', label: `🔴 Kritis (${kpis.kritis})` },
            { key: 'RENDAH', label: `🟡 Rendah (${kpis.rendah})` },
            { key: 'AMAN', label: `🟢 Aman (${kpis.aman})` },
            { key: 'OVERSTOCK', label: `📦 Overstock (${kpis.overstock})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
              ...s.btn,
              padding: '6px 12px',
              background: filterStatus === f.key ? '#3b82f6' : 'var(--bg-card)',
              color: filterStatus === f.key ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterStatus === f.key ? '#3b82f6' : 'var(--border)'}`,
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'A', 'B', 'C'].map(f => (
            <button key={f} onClick={() => setFilterABC(f)} style={{
              ...s.btn,
              padding: '6px 12px',
              background: filterABC === f ? '#8b5cf6' : 'var(--bg-card)',
              color: filterABC === f ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filterABC === f ? '#8b5cf6' : 'var(--border)'}`,
            }}>
              {f === 'ALL' ? 'ABC' : `Kat. ${f}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            ['ALL', 'Semua Gerak'],
            ['SUPER_FAST', 'A — Super Fast'],
            ['FAST', 'B — Fast'],
            ['MEDIUM', 'C — Medium'],
            ['SLOW', 'Slow'],
          ] as [string, string][]).map(([key, label]) => {
            const mc = key !== 'ALL' ? MOVEMENT_CONFIGS[key as MovementCategory] : null;
            const activeColor = mc?.color ?? '#3b82f6';
            return (
              <button key={key} onClick={() => setFilterMovement(key)} style={{
                ...s.btn,
                padding: '6px 12px',
                background: filterMovement === key ? activeColor : 'var(--bg-card)',
                color: filterMovement === key ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${filterMovement === key ? activeColor : 'var(--border)'}`,
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={s.card}>
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
                    <tr key={item.sku}>
                      <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{item.sku}</span></td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{item.name}</td>
                      <td style={s.td}>
                        {(() => {
                          const mc = MOVEMENT_CONFIGS[item.movement];
                          const shortLabel = item.movement === 'SUPER_FAST' ? 'Super Fast' : item.movement === 'FAST' ? 'Fast' : item.movement === 'MEDIUM' ? 'Medium' : 'Slow';
                          return <span style={s.badge(mc.bg, mc.color)}>{shortLabel}</span>;
                        })()}
                      </td>
                      <td style={s.td}>
                        <span style={s.badge(
                          item.abc === 'A' ? 'rgba(59,130,246,0.15)' : item.abc === 'B' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                          item.abc === 'A' ? '#3b82f6' : item.abc === 'B' ? '#f59e0b' : 'var(--text-secondary)'
                        )}>{item.abc}</span>
                      </td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{item.category}</td>
                      <td style={{ ...s.td, fontWeight: 700 }}>{item.stock}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: item.daysRemaining <= 3 ? '#ef4444' : item.daysRemaining <= 5 ? '#f59e0b' : '#10b981' }}>
                        {item.daysRemaining === 999 ? '?' : `${item.daysRemaining} hari`}
                      </td>
                      <td style={s.td}>
                        {(() => {
                          const ac = AGING_CONFIGS[item.agingCategory];
                          return <span style={s.badge(ac.bg, ac.color)}>{ac.label} ({item.daysInWarehouse}h)</span>;
                        })()}
                      </td>
                      <td style={{ ...s.td, color: item.agingCategory === 'OLD' || item.agingCategory === 'DEAD' ? '#ef4444' : '#f97316', fontWeight: 600 }}>
                        {formatRupiah(item.costOfFund)}/bln
                      </td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{item.reorderPoint > 0 ? item.reorderPoint : '—'}</td>
                      <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                      <td style={s.td}>{formatRupiah(item.hpp)}</td>
                      <td style={s.td}>{formatRupiah(item.sellPrice)}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: Number(margin) >= 30 ? '#10b981' : '#f59e0b' }}>{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Tidak ada SKU yang cocok dengan filter</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
