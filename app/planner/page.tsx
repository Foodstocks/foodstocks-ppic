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
  effectiveDailySales: number; // after event multiplier
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
}

const statusConfig: Record<PlannerStatus, { label: string; bg: string; color: string }> = {
  REORDER_NOW: { label: '🔴 Beli Sekarang', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  PREPARE:     { label: '🟡 Persiapan',     bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  SAFE:        { label: '🟢 Aman',          bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  NO_DATA:     { label: '⚪ Kurang Data',    bg: 'rgba(100,116,139,0.15)', color: 'var(--text-secondary)' },
};

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: 'var(--bg-card)', border: '1px solid #2a2d3e', borderRadius: 12, padding: 20, marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: 'left' as const, borderBottom: '1px solid #2a2d3e', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid #1a1d27' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-block' }),
  btn: { padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 } as React.CSSProperties,
};

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

export default function PurchasePlanner() {
  const [filter, setFilter] = useState<'ALL' | PlannerStatus>('ALL');
  const [search, setSearch] = useState('');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [dataSource, setDataSource] = useState<'demo' | 'import' | 'jubelio'>('demo');

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

        // Apply demand event multiplier for any upcoming or currently active event within 60 days
        const activeEvent = demandEvents.find(ev =>
          ev.startDay >= -(ev.durationDays ?? 14) &&
          ev.startDay <= 60 &&
          (ev.category === '' || ev.category === item.category)
        ) ?? null;
        const eventMultiplier = activeEvent ? activeEvent.multiplier : 1;
        const effectiveDailySales = avgDailySales * eventMultiplier;

        const daysRemaining = avgDailySales > 0
          ? parseFloat((item.stock / avgDailySales).toFixed(1))
          : (item.stock === 0 ? 0 : -1); // -1 = unknown

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
          supplier: item.supplier || '-', stock: item.stock,
          sellingPrice: item.sellingPrice, hpp, avgDailySales, effectiveDailySales, leadTime,
          daysRemaining, reorderPoint, eoq,
          recommendedQty: Math.max(1, recommendedQty),
          estimatedCost: Math.max(1, recommendedQty) * hpp,
          status, hasVelocity, movement,
          activeEvent: activeEvent?.name ?? null,
        };
      });

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
  const totalCost = actionItems.reduce((s, r) => s + r.estimatedCost, 0);
  const bySupplier = actionItems.reduce((acc, r) => {
    if (!acc[r.supplier]) acc[r.supplier] = [];
    acc[r.supplier].push(r);
    return acc;
  }, {} as Record<string, PlannerItem[]>);

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={s.title}>🧠 Purchase Planner</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Rekomendasi berbasis ABC Analysis + Reorder Point + EOQ · {items.length} SKU aktif
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: dataSource === 'import' ? 'rgba(16,185,129,0.15)' : dataSource === 'jubelio' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: dataSource === 'import' ? '#10b981' : dataSource === 'jubelio' ? '#3b82f6' : '#f59e0b', fontWeight: 600 }}>
              {dataSource === 'import' ? '✅ Data Import' : dataSource === 'jubelio' ? '🔗 Data Jubelio' : '⚠️ Data Demo'}
            </span>
            <button onClick={() => setShowDraftModal(true)} style={{ ...s.btn, background: '#3b82f6', color: 'white' }}>
              📄 Draft PO ({actionItems.length} SKU)
            </button>
          </div>
        </div>
      </div>

      {/* Velocity coverage info */}
      <div style={{ padding: '12px 16px', background: counts.NO_DATA === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${counts.NO_DATA === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: counts.NO_DATA === 0 ? '#10b981' : '#f59e0b' }}>
          {counts.NO_DATA === 0
            ? `✅ Semua ${items.length} SKU memiliki data velocity — rekomendasi penuh aktif`
            : <>⚠️ <strong>{items.length - counts.NO_DATA} dari {items.length} SKU</strong> punya velocity · <strong>{counts.NO_DATA} SKU</strong> masih NO_DATA (belum ada data penjualan harian)</>
          }
        </div>
        {counts.NO_DATA > 0 && (
          <a href="/settings#velocity" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            → Import atau Tarik Velocity di Settings
          </a>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Est. Budget', value: formatRupiah(totalCost), sub: 'Untuk semua yang perlu dibeli', color: '#3b82f6' },
          { label: 'Beli Sekarang', value: `${counts.REORDER_NOW} SKU`, sub: 'Sisa hari ≤ Lead Time', color: '#ef4444' },
          { label: 'Persiapan Order', value: `${counts.PREPARE} SKU`, sub: 'Stok 1.0–1.5× Lead Time', color: '#f59e0b' },
          { label: 'Aman', value: `${counts.SAFE} SKU`, sub: 'Stok cukup', color: '#10b981' },
          { label: 'Kurang Data', value: `${counts.NO_DATA} SKU`, sub: 'Belum ada velocity', color: 'var(--text-muted)' },
          { label: 'Supplier Terlibat', value: `${Object.keys(bySupplier).length}`, sub: 'Perlu dihubungi', color: '#8b5cf6' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...s.card, marginBottom: 0, borderLeft: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, margin: '6px 0 4px' }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Cari SKU atau produk..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--bg-hover)', border: '1px solid #2a2d3e', borderRadius: 8, padding: '7px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 220 }} />
        {([
          ['ALL', `Semua (${items.length})`],
          ['REORDER_NOW', `🔴 Beli Sekarang (${counts.REORDER_NOW})`],
          ['PREPARE', `🟡 Persiapan (${counts.PREPARE})`],
          ['SAFE', `🟢 Aman (${counts.SAFE})`],
          ['NO_DATA', `⚪ Kurang Data (${counts.NO_DATA})`],
        ] as [string, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as typeof filter)} style={{
            ...s.btn, padding: '6px 12px', fontSize: 12,
            background: filter === key ? '#3b82f6' : 'var(--bg-card)',
            color: filter === key ? 'white' : 'var(--text-secondary)',
            border: `1px solid ${filter === key ? '#3b82f6' : 'var(--border)'}`,
          }}>{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={s.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['SKU', 'Produk', 'Gerak', 'Kategori', 'Stok', 'Avg/Hari', 'Efektif/Hari', 'Sisa Hari', 'Reorder Pt.', 'Rec. Beli', 'EOQ', 'HPP', 'Est. Biaya', 'Margin', 'Status'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const cfg = statusConfig[r.status];
                const margin = ((r.sellingPrice - r.hpp) / r.sellingPrice * 100);
                return (
                  <tr key={r.sku} style={{ background: r.status === 'REORDER_NOW' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{r.sku}</span></td>
                    <td style={{ ...s.td, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                      {r.activeEvent && (
                        <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 2 }}>📅 {r.activeEvent}</div>
                      )}
                    </td>
                    <td style={s.td}>
                      {(() => {
                        const mc = MOVEMENT_CONFIGS[r.movement];
                        const shortLabel = r.movement === 'SUPER_FAST' ? 'A' : r.movement === 'FAST' ? 'B' : r.movement === 'MEDIUM' ? 'C' : 'Slow';
                        return <span style={s.badge(mc.bg, mc.color)}>{shortLabel}</span>;
                      })()}
                    </td>
                    <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{r.category}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{r.stock} pcs</td>
                    <td style={{ ...s.td, color: r.hasVelocity ? 'var(--text-primary)' : 'var(--text-faint)' }}>
                      {r.hasVelocity ? `${r.avgDailySales}/hr` : '—'}
                    </td>
                    <td style={{ ...s.td, color: r.activeEvent ? '#8b5cf6' : 'var(--text-faint)', fontWeight: r.activeEvent ? 600 : 400 }}>
                      {r.hasVelocity ? `${r.effectiveDailySales.toFixed(1)}/hr` : '—'}
                      {r.activeEvent && r.effectiveDailySales !== r.avgDailySales && (
                        <span style={{ fontSize: 10, marginLeft: 4 }}>↑</span>
                      )}
                    </td>
                    <td style={{ ...s.td, fontWeight: 600, color: r.daysRemaining === 0 ? '#ef4444' : r.daysRemaining === -1 ? 'var(--text-faint)' : r.daysRemaining <= 3 ? '#ef4444' : r.daysRemaining <= 7 ? '#f59e0b' : '#10b981' }}>
                      {r.daysRemaining === -1 ? '?' : `${r.daysRemaining}h`}
                    </td>
                    <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{r.reorderPoint > 0 ? `${r.reorderPoint} pcs` : '—'}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: '#3b82f6' }}>{r.recommendedQty} pcs</td>
                    <td style={s.td}>{r.eoq ? `${r.eoq} pcs` : '—'}</td>
                    <td style={s.td}>{formatRupiah(r.hpp)}</td>
                    <td style={{ ...s.td, color: 'var(--text-primary)', fontWeight: 600 }}>{formatRupiah(r.estimatedCost)}</td>
                    <td style={{ ...s.td, fontWeight: 600, color: margin >= 30 ? '#10b981' : '#f59e0b' }}>{margin.toFixed(0)}%</td>
                    <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Tidak ada data yang cocok</div>
          )}
        </div>
      </div>

      {/* Draft PO Modal */}
      {showDraftModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid #2a2d3e', borderRadius: 16, padding: 28, maxWidth: 700, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>📄 Draft Purchase Orders</div>
              <button onClick={() => setShowDraftModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Digroup per supplier. Total estimasi: <strong style={{ color: '#3b82f6' }}>{formatRupiah(totalCost)}</strong>
            </div>
            {Object.entries(bySupplier).map(([supplier, recs]) => (
              <div key={supplier} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🏭 {supplier}</div>
                  <div style={{ color: '#3b82f6', fontWeight: 600 }}>{formatRupiah(recs.reduce((s, r) => s + r.estimatedCost, 0))}</div>
                </div>
                {recs.map(item => (
                  <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #2a2d3e', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)', flex: 1, paddingRight: 8 }}>{item.name}</span>
                    <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{item.recommendedQty} pcs · {formatRupiah(item.estimatedCost)}</span>
                  </div>
                ))}
              </div>
            ))}
            {actionItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Tidak ada item yang perlu dibeli saat ini.</div>
            )}
          </div>
        </div>
      )}

      {/* Info box */}
      <div style={{ padding: 16, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#8b5cf6' }}>📐 Formula:</strong>
          {' '}Reorder Point = Avg Daily Sales × Lead Time × 1.2
          {' '}· EOQ = √(2 × D × S / H)
          {' '}· Sisa Hari = Stok ÷ Avg Harian
          {' '}· <strong style={{ color: '#8b5cf6' }}>⚠️ Kurang Data</strong> = SKU tanpa data velocity (import di Settings → Stok & Velocity)
        </div>
      </div>
    </div>
  );
}
