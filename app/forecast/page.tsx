'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { formatRupiah, calcMovementCategory, calcPreEventOrders, type PreEventAlert } from '@/lib/calculations';

const HPP_KEY = 'foodstocks_hpp_v1';
const VELOCITY_KEY = 'foodstocks_velocity_v1';
const LEAD_TIME_KEY = 'foodstocks_leadtime_v1';
const EVENTS_KEY = 'foodstocks_events_v1';
const SKUPPLIER_KEY = 'foodstocks_skupplier_v1';

interface ForecastItem {
  sku: string;
  name: string;
  category: string;
  stock: number;
  avgDailySales: number;
  leadTime: number;
  reorderPoint: number;
  daysRemaining: number;
  movement: ReturnType<typeof calcMovementCategory>;
}

interface ForecastPoint {
  day: number;
  label: string;
  stock: number;
  reorderPoint: number;
}

interface DemandEvent {
  id: string;
  name: string;
  startDay: number;
  startDate?: string;
  durationDays?: number;
  multiplier: number;
  category?: string;
}

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

function buildForecast(item: ForecastItem, days: number, events: DemandEvent[]): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  let stock = item.stock;
  const today = new Date();

  for (let d = 0; d <= days; d++) {
    const label = d === 0 ? 'Hari Ini' : `+${d}h`;
    let dailySales = item.avgDailySales;
    for (const ev of events) {
      const effectiveStartDay = ev.startDate
        ? Math.round((new Date(ev.startDate).getTime() - today.getTime()) / 86400000)
        : ev.startDay;
      const duration = ev.durationDays ?? 14;
      if (d >= effectiveStartDay && d < effectiveStartDay + duration) {
        dailySales = dailySales * ev.multiplier;
        break;
      }
    }
    if (d > 0) stock = Math.max(0, stock - dailySales);
    points.push({ day: d, label, stock: Math.round(stock * 10) / 10, reorderPoint: item.reorderPoint });
  }
  return points;
}

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' } as React.CSSProperties),
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#fff', color: '#374151' } as React.CSSProperties,
  select: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 14px', color: '#111827', fontSize: 13, outline: 'none' } as React.CSSProperties,
};

const HORIZON_OPTIONS = [
  { value: 30, label: '30 Hari' },
  { value: 60, label: '60 Hari' },
  { value: 90, label: '90 Hari' },
];

// Icons
const IconForecast = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconEmpty = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IconUpload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

export default function ForecastPage() {
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [horizon, setHorizon] = useState(30);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [velInfo, setVelInfo] = useState<{ velTotal: number; invTotal: number; matched: number; source: string } | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const tablePerPage = 25;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const hppMap: Record<string, number> = loadStorage(HPP_KEY, {});
        let velocityMap: Record<string, number> = loadStorage(VELOCITY_KEY, {});
        const leadTimeMap: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
        let velSource = 'localStorage';

        if (Object.keys(velocityMap).length === 0) {
          try {
            const velRes = await fetch('/api/jubelio/velocity');
            const velJson = await velRes.json();
            if (velJson.success && velJson.data && Object.keys(velJson.data).length > 0) {
              velocityMap = velJson.data;
              velSource = 'Jubelio API (auto)';
              try { localStorage.setItem(VELOCITY_KEY, JSON.stringify(velocityMap)); } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
        }

        const res = await fetch('/api/jubelio/inventory');
        const json = await res.json();
        if (!json.success) return;

        const invItems = json.data as { sku: string; name: string; stock: number; sellPrice: number; category: string }[];
        const matched = invItems.filter(i => velocityMap[i.sku] != null && velocityMap[i.sku] > 0).length;
        setVelInfo({ velTotal: Object.keys(velocityMap).length, invTotal: invItems.length, matched, source: velSource });

        const computed: ForecastItem[] = invItems
          .filter(i => velocityMap[i.sku] != null && velocityMap[i.sku] > 0)
          .map(item => {
            const avgDailySales = velocityMap[item.sku];
            const defaultLT = leadTimeMap['__default__'] ?? 3;
            const leadTime = leadTimeMap[item.sku] ?? leadTimeMap[item.category] ?? defaultLT;
            const daysRemaining = parseFloat((item.stock / avgDailySales).toFixed(1));
            const reorderPoint = Math.round(avgDailySales * leadTime * 1.2);
            return {
              sku: item.sku, name: item.name, category: item.category,
              stock: item.stock, hpp: hppMap[item.sku] ?? Math.round(item.sellPrice * 0.65),
              avgDailySales, leadTime, daysRemaining, reorderPoint,
              movement: calcMovementCategory(daysRemaining, true),
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        setItems(computed);
        if (computed.length > 0) setSelectedSku(computed[0].sku);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const events: DemandEvent[] = loadStorage(EVENTS_KEY, []);
  const hppMapForAlerts: Record<string, number> = loadStorage(HPP_KEY, {});
  const leadTimeMapForAlerts: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
  const velocityMapForAlerts: Record<string, number> = Object.fromEntries(items.map(i => [i.sku, i.avgDailySales]));
  const invForEvents = items.map(item => ({ sku: item.sku, name: item.name, stock: item.stock, sellPrice: 0, category: item.category }));
  const skupplierMapForAlerts: Record<string, string> = loadStorage(SKUPPLIER_KEY, {});
  const preEventAlerts: PreEventAlert[] = !loading && items.length > 0
    ? calcPreEventOrders(events, velocityMapForAlerts, hppMapForAlerts, invForEvents, leadTimeMapForAlerts, new Date(), 60, skupplierMapForAlerts)
    : [];

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchMovement = filterMovement === 'ALL' || item.movement === filterMovement;
    return matchSearch && matchMovement;
  });

  const selectedItem = items.find(i => i.sku === selectedSku);
  const forecastData = selectedItem ? buildForecast(selectedItem, horizon, events) : [];
  const stockoutDay = forecastData.find(p => p.stock <= 0)?.day;
  const reorderDay = forecastData.find(p => p.stock <= p.reorderPoint)?.day;

  const stockoutIn30 = items.filter(i => i.daysRemaining <= 30 && i.daysRemaining > 0).length;
  const stockoutIn7 = items.filter(i => i.daysRemaining <= 7 && i.daysRemaining > 0).length;
  const alreadyOut = items.filter(i => i.daysRemaining <= 0).length;

  const movementColors: Record<string, string> = {
    SUPER_FAST: '#ef4444', FAST: '#f59e0b', MEDIUM: '#3b82f6', SLOW: '#64748b',
  };

  // Table pagination
  const totalTablePages = Math.ceil(filtered.length / tablePerPage);
  const safeTablePage = Math.min(tablePage, Math.max(1, totalTablePages));
  const paginatedTable = filtered.slice((safeTablePage - 1) * tablePerPage, safeTablePage * tablePerPage);

  const tablePageNumbers: (number | '…')[] = [];
  if (totalTablePages <= 7) {
    for (let i = 1; i <= totalTablePages; i++) tablePageNumbers.push(i);
  } else {
    tablePageNumbers.push(1);
    if (safeTablePage > 3) tablePageNumbers.push('…');
    for (let i = Math.max(2, safeTablePage - 1); i <= Math.min(totalTablePages - 1, safeTablePage + 1); i++) tablePageNumbers.push(i);
    if (safeTablePage < totalTablePages - 2) tablePageNumbers.push('…');
    tablePageNumbers.push(totalTablePages);
  }

  if (!loading && items.length === 0) {
    const hasVelData = velInfo && velInfo.velTotal > 0;
    return (
      <div style={s.page}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}><IconForecast /></div>
            <div style={s.title}>Forecast Stok</div>
          </div>
        </div>
        <div style={{ ...s.card, textAlign: 'center', padding: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><IconEmpty /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            {hasVelData ? 'SKU Velocity Tidak Cocok dengan Inventory' : 'Data Velocity Belum Tersedia'}
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', maxWidth: 500, margin: '0 auto 20px' }}>
            {hasVelData
              ? `Velocity tersimpan untuk ${velInfo!.velTotal} SKU, tapi tidak ada yang cocok dengan ${velInfo!.invTotal} SKU di Jubelio. Kemungkinan format SKU berbeda (contoh: "SKU-001" vs "SKU001").`
              : 'Halaman Forecast membutuhkan data penjualan harian (velocity). Tarik otomatis dari Jubelio atau upload CSV.'
            }
          </div>
          {velInfo && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Velocity tersimpan', val: velInfo.velTotal, ok: velInfo.velTotal > 0 },
                { label: 'SKU di Inventory', val: velInfo.invTotal, ok: true },
                { label: 'Cocok', val: velInfo.matched, ok: velInfo.matched > 0 },
              ].map(stat => (
                <div key={stat.label} style={{ padding: '8px 16px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>{stat.label}: </span>
                  <strong style={{ color: stat.ok ? '#10b981' : '#ef4444' }}>{stat.val} SKU</strong>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
              <IconDownload /> Tarik Velocity dari Jubelio
            </a>
            <a href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#F9FAFB', color: '#374151', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, border: '1px solid #E4E7ED' }}>
              <IconUpload /> Upload CSV Velocity
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}><IconForecast /></div>
          <div style={s.title}>Forecast Stok</div>
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>
          Proyeksi stok 30/60/90 hari · {items.length} SKU dengan data velocity
          {velInfo && velInfo.source !== 'localStorage' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#10b981', fontWeight: 600 }}>· {velInfo.source}</span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Habis ≤ 7 Hari', value: `${stockoutIn7} SKU`, color: '#ef4444', sub: 'Perlu PO segera', icon: <IconAlert /> },
          { label: 'Habis ≤ 30 Hari', value: `${stockoutIn30} SKU`, color: '#f59e0b', sub: 'Pantau ketat', icon: <IconAlert /> },
          { label: 'Sudah Habis', value: `${alreadyOut} SKU`, color: '#94a3b8', sub: 'Stok = 0', icon: <IconAlert /> },
          { label: 'Total Dipantau', value: `${items.length} SKU`, color: '#3b82f6', sub: 'Punya velocity', icon: <IconForecast /> },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600 }}>{k.label}</div>
              <div style={{ color: k.color, opacity: 0.7 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Pre-Event Reorder Calendar */}
      {(preEventAlerts.length > 0 || events.some(e => e.startDate)) && (
        <div style={{ ...s.card, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ color: '#8b5cf6' }}><IconCalendar /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Agenda Reorder Pre-Event</div>
          </div>
          {preEventAlerts.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6B7280', padding: '12px 16px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, textAlign: 'center' }}>
              Tidak ada event yang memerlukan reorder dalam 60 hari ke depan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {preEventAlerts.map(alert => {
                const u = alert.daysUntilEvent;
                const isOverdue = u < 0;
                const isUrgent = !isOverdue && u <= 7;
                const isWarn = !isOverdue && !isUrgent && u <= 14;
                const borderClr = isOverdue ? '#ef4444' : isUrgent ? '#f97316' : isWarn ? '#f59e0b' : '#3b82f6';
                const urgencyLabel = isOverdue ? 'Deadline Terlewat' : isUrgent ? 'Segera Order' : isWarn ? 'Persiapkan PO' : 'Pantau';
                const urgencyDot = isOverdue ? '#ef4444' : isUrgent ? '#f97316' : isWarn ? '#f59e0b' : '#3b82f6';

                return (
                  <div key={alert.event.id ?? alert.event.name} style={{ background: isOverdue ? 'rgba(239,68,68,0.05)' : isUrgent ? 'rgba(249,115,22,0.05)' : isWarn ? 'rgba(245,158,11,0.05)' : 'rgba(59,130,246,0.03)', border: `1px solid ${borderClr}22`, borderLeft: `3px solid ${borderClr}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{alert.event.name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span>Mulai: {new Date(alert.event.startDate!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span>·</span>
                          <span>Deadline Order: {alert.orderDeadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span>·</span>
                          <span>{alert.affectedSkus.length} SKU terpengaruh</span>
                        </div>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${borderClr}18`, color: borderClr }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgencyDot, display: 'inline-block' }} />
                        {urgencyLabel}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {alert.affectedSkus.slice(0, 3).map(sku => (
                        <div key={sku.sku} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: 1 }}>{sku.name}</div>
                          <div style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 }}>{sku.sku}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{sku.extraUnitsNeeded} unit</span>
                            <span style={{ color: sku.urgencyDays <= 0 ? '#ef4444' : sku.urgencyDays <= 7 ? '#f97316' : '#6B7280', fontWeight: 600 }}>
                              {sku.urgencyDays <= 0 ? 'Terlewat' : `${sku.urgencyDays}h lagi`}
                            </span>
                          </div>
                        </div>
                      ))}
                      {alert.affectedSkus.length > 3 && (
                        <div style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                          +{alert.affectedSkus.length - 3} SKU lainnya
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chart + SKU List */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* SKU List Panel */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Pilih SKU untuk Proyeksi</div>
          <input
            type="text"
            placeholder="Cari nama atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.select, width: '100%', marginBottom: 8, boxSizing: 'border-box' as const }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['ALL', 'SUPER_FAST', 'FAST', 'MEDIUM', 'SLOW'] as const).map(m => (
              <button type="button" key={m} onClick={() => setFilterMovement(m)} style={{
                ...s.btn, padding: '4px 10px', fontSize: 11,
                background: filterMovement === m ? (movementColors[m] ?? '#3b82f6') : '#F9FAFB',
                color: filterMovement === m ? 'white' : '#374151',
                border: `1px solid ${filterMovement === m ? (movementColors[m] ?? '#3b82f6') : '#E4E7ED'}`,
              }}>
                {m === 'ALL' ? 'Semua' : m === 'SUPER_FAST' ? 'SFM' : m}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>
                <div style={{ width: 24, height: 24, border: '3px solid #E4E7ED', borderTopColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
                Memuat...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#6B7280', fontSize: 13 }}>
                Tidak ada SKU dengan data velocity.{' '}
                <a href="/settings" style={{ color: '#3b82f6' }}>Import di Settings</a>
              </div>
            ) : (
              filtered.map(item => {
                const isSelected = item.sku === selectedSku;
                const urgentColor = item.daysRemaining <= 7 ? '#ef4444' : item.daysRemaining <= 14 ? '#f59e0b' : '#10b981';
                return (
                  <div key={item.sku} onClick={() => setSelectedSku(item.sku)} style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                    background: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(59,130,246,0.35)' : 'transparent'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3b82f6' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>
                        {item.name}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: urgentColor, whiteSpace: 'nowrap' as const }}>
                        {item.daysRemaining <= 0 ? 'HABIS' : `${item.daysRemaining}h`}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      {item.sku} · {item.avgDailySales}/hari
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart Panel */}
        <div>
          {selectedItem ? (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{selectedItem.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                    {selectedItem.sku} · Stok: {selectedItem.stock} · {selectedItem.avgDailySales}/hari · Lead Time: {selectedItem.leadTime} hari
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {HORIZON_OPTIONS.map(opt => (
                    <button type="button" key={opt.value} onClick={() => setHorizon(opt.value)} style={{
                      ...s.btn, padding: '6px 12px', fontSize: 12,
                      background: horizon === opt.value ? '#3b82f6' : '#F9FAFB',
                      color: horizon === opt.value ? 'white' : '#374151',
                      border: `1px solid ${horizon === opt.value ? '#3b82f6' : '#E4E7ED'}`,
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Alert banners */}
              {stockoutDay !== undefined && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IconAlert />
                  Stok diperkirakan habis dalam <strong style={{ marginLeft: 4 }}>{stockoutDay} hari</strong>
                </div>
              )}
              {reorderDay !== undefined && reorderDay < (stockoutDay ?? Infinity) && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IconPin />
                  Reorder point tercapai dalam <strong style={{ marginLeft: 4 }}>{reorderDay} hari</strong> — persiapkan PO
                </div>
              )}
              {events.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <IconCalendar />
                  Demand dipengaruhi {events.length} event terjadwal
                </div>
              )}

              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={forecastData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E7ED" />
                  <XAxis dataKey="label" tick={{ fill: '#6B7280', fontSize: 10 }} interval={Math.floor(forecastData.length / 6)} />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#F3F4F6', border: '1px solid #E4E7ED', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#111827', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#374151' }} />
                  <ReferenceLine y={selectedItem.reorderPoint} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'ROP', fill: '#f59e0b', fontSize: 10 }} />
                  <Line type="monotone" dataKey="stock" name="Proyeksi Stok" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>

              {/* Detail 10 hari */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 }}>
                  Detail 10 Hari Pertama
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>{['Hari', 'Proyeksi Stok', 'Reorder Point', 'Status'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {forecastData.slice(0, 11).map(p => {
                        const atRisk = p.stock <= p.reorderPoint;
                        const empty = p.stock <= 0;
                        return (
                          <tr key={p.day}>
                            <td style={s.td}>{p.label}</td>
                            <td style={{ ...s.td, fontWeight: 600, color: empty ? '#ef4444' : atRisk ? '#f59e0b' : '#10b981' }}>{p.stock}</td>
                            <td style={{ ...s.td, color: '#374151' }}>{p.reorderPoint}</td>
                            <td style={s.td}>
                              {empty ? <span style={s.badge('rgba(239,68,68,0.12)', '#ef4444')}>Habis</span>
                                : atRisk ? <span style={s.badge('rgba(245,158,11,0.12)', '#f59e0b')}>Di bawah ROP</span>
                                  : <span style={s.badge('rgba(16,185,129,0.12)', '#10b981')}>Aman</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.card, textAlign: 'center', padding: 60, color: '#6B7280' }}>
              Pilih SKU di kiri untuk melihat proyeksi stok
            </div>
          )}
        </div>
      </div>

      {/* Summary Table with Pagination */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Ringkasan Semua SKU</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{filtered.length} SKU</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['SKU', 'Produk', 'Stok', 'Avg/Hari', 'Sisa Hari', 'Habis 30h?', 'Habis 60h?', 'Habis 90h?'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {paginatedTable.map(item => {
                const d30 = item.daysRemaining <= 30;
                const d60 = item.daysRemaining <= 60;
                const d90 = item.daysRemaining <= 90;
                const urgentColor = item.daysRemaining <= 7 ? '#ef4444' : item.daysRemaining <= 14 ? '#f59e0b' : '#10b981';
                return (
                  <tr key={item.sku} style={{ cursor: 'pointer' }} onClick={() => setSelectedSku(item.sku)}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{item.sku}</span></td>
                    <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{item.name}</td>
                    <td style={s.td}>{item.stock}</td>
                    <td style={s.td}>{item.avgDailySales}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: urgentColor }}>{item.daysRemaining <= 0 ? 'HABIS' : `${item.daysRemaining}h`}</td>
                    <td style={s.td}>{d30 ? <span style={s.badge('rgba(239,68,68,0.12)', '#ef4444')}>Ya</span> : <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={s.td}>{d60 ? <span style={s.badge('rgba(245,158,11,0.12)', '#f59e0b')}>Ya</span> : <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={s.td}>{d90 ? <span style={s.badge('rgba(100,116,139,0.12)', '#64748b')}>Ya</span> : <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > tablePerPage && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              Menampilkan <strong style={{ color: '#111827' }}>{(safeTablePage - 1) * tablePerPage + 1}–{Math.min(safeTablePage * tablePerPage, filtered.length)}</strong> dari <strong style={{ color: '#111827' }}>{filtered.length}</strong> SKU
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => setTablePage(1)} disabled={safeTablePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safeTablePage === 1 ? '#D1D5DB' : '#374151', cursor: safeTablePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>«</button>
              <button type="button" onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safeTablePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safeTablePage === 1 ? '#D1D5DB' : '#374151', cursor: safeTablePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>‹</button>
              {tablePageNumbers.map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: 13, color: '#9CA3AF' }}>…</span>
                  : <button type="button" key={n} onClick={() => setTablePage(n as number)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${safeTablePage === n ? '#3b82f6' : '#E4E7ED'}`, background: safeTablePage === n ? '#3b82f6' : '#fff', color: safeTablePage === n ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: safeTablePage === n ? 600 : 400 }}>{n}</button>
              )}
              <button type="button" onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} disabled={safeTablePage === totalTablePages} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safeTablePage === totalTablePages ? '#D1D5DB' : '#374151', cursor: safeTablePage === totalTablePages ? 'default' : 'pointer', fontSize: 13 }}>›</button>
              <button type="button" onClick={() => setTablePage(totalTablePages)} disabled={safeTablePage === totalTablePages} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safeTablePage === totalTablePages ? '#D1D5DB' : '#374151', cursor: safeTablePage === totalTablePages ? 'default' : 'pointer', fontSize: 13 }}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
