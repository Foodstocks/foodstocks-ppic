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
  startDay: number; // relative days from today (legacy)
  startDate?: string; // ISO date for calendar-anchored events
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
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const label = d === 0 ? 'Hari Ini' : `+${d}h`;

    // Apply event multiplier if applicable
    let dailySales = item.avgDailySales;
    for (const ev of events) {
      // Resolve startDay: use startDate if available for accuracy
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

    points.push({
      day: d,
      label,
      stock: Math.round(stock * 10) / 10,
      reorderPoint: item.reorderPoint,
    });
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

export default function ForecastPage() {
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [horizon, setHorizon] = useState(30);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMovement, setFilterMovement] = useState('ALL');
  const [velInfo, setVelInfo] = useState<{ velTotal: number; invTotal: number; matched: number; source: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const hppMap: Record<string, number> = loadStorage(HPP_KEY, {});
        let velocityMap: Record<string, number> = loadStorage(VELOCITY_KEY, {});
        const leadTimeMap: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
        let velSource = 'localStorage';

        // Auto-fetch from Jubelio API if localStorage is empty
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
              sku: item.sku,
              name: item.name,
              category: item.category,
              stock: item.stock,
              hpp: hppMap[item.sku] ?? Math.round(item.sellPrice * 0.65),
              avgDailySales,
              leadTime,
              daysRemaining,
              reorderPoint,
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

  // Pre-event reorder alerts
  const hppMapForAlerts: Record<string, number> = loadStorage(HPP_KEY, {});
  const leadTimeMapForAlerts: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
  const velocityMapForAlerts: Record<string, number> = Object.fromEntries(
    items.map(i => [i.sku, i.avgDailySales])
  );
  const invForEvents = items.map(item => ({
    sku: item.sku,
    name: item.name,
    stock: item.stock,
    sellPrice: 0,
    category: item.category,
  }));
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

  // Summary stats for all items
  const stockoutIn30 = items.filter(i => i.daysRemaining <= 30 && i.daysRemaining > 0).length;
  const stockoutIn7 = items.filter(i => i.daysRemaining <= 7 && i.daysRemaining > 0).length;
  const alreadyOut = items.filter(i => i.daysRemaining <= 0).length;

  const movementColors: Record<string, string> = {
    SUPER_FAST: '#ef4444', FAST: '#f59e0b', MEDIUM: '#3b82f6', SLOW: '#64748b',
  };

  if (!loading && items.length === 0) {
    const hasVelData = velInfo && velInfo.velTotal > 0;
    return (
      <div style={s.page}>
        <div style={{ marginBottom: 24 }}>
          <div style={s.title}>📈 Forecast Stok</div>
          <div style={{ fontSize: 14, color: '#6B7280' }}>Proyeksi stok 30/60/90 hari</div>
        </div>
        <div style={{ ...s.card, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            {hasVelData ? 'SKU Velocity Tidak Cocok dengan Inventory' : 'Data Velocity Belum Tersedia'}
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', maxWidth: 500, margin: '0 auto 16px' }}>
            {hasVelData
              ? `Velocity tersimpan untuk ${velInfo!.velTotal} SKU, tapi tidak ada yang cocok dengan ${velInfo!.invTotal} SKU di Jubelio inventory. Kemungkinan format SKU berbeda (contoh: "SKU-001" vs "SKU001").`
              : 'Halaman Forecast membutuhkan data penjualan harian (velocity). Coba tarik otomatis dari Jubelio di bawah.'
            }
          </div>
          {velInfo && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 16px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>Velocity tersimpan: </span>
                <strong style={{ color: velInfo.velTotal > 0 ? '#10b981' : '#ef4444' }}>{velInfo.velTotal} SKU</strong>
              </div>
              <div style={{ padding: '8px 16px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>SKU di Inventory: </span>
                <strong style={{ color: '#111827' }}>{velInfo.invTotal} SKU</strong>
              </div>
              <div style={{ padding: '8px 16px', background: '#F9FAFB', borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>Cocok: </span>
                <strong style={{ color: velInfo.matched > 0 ? '#10b981' : '#ef4444' }}>{velInfo.matched} SKU</strong>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/settings" style={{ display: 'inline-block', padding: '10px 20px', background: '#3b82f6', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
              ⬇️ Tarik Velocity dari Jubelio di Settings
            </a>
            <a href="/settings" style={{ display: 'inline-block', padding: '10px 20px', background: '#F9FAFB', color: '#374151', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14, border: '1px solid #E4E7ED' }}>
              📤 Upload CSV Velocity
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <div style={s.title}>📈 Forecast Stok</div>
        <div style={{ fontSize: 14, color: '#6B7280' }}>
          Proyeksi stok 30/60/90 hari · {items.length} SKU dengan data velocity
          {velInfo && velInfo.source !== 'localStorage' && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#10b981', fontWeight: 600 }}>· {velInfo.source}</span>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Habis ≤ 7 Hari', value: `${stockoutIn7} SKU`, color: '#ef4444' },
          { label: 'Habis ≤ 30 Hari', value: `${stockoutIn30} SKU`, color: '#f59e0b' },
          { label: 'Sudah Habis', value: `${alreadyOut} SKU`, color: '#94a3b8' },
          { label: 'Total Dipantau', value: `${items.length} SKU`, color: '#3b82f6' },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '6px 0' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Pre-Event Reorder Calendar */}
      {(preEventAlerts.length > 0 || events.some(e => e.startDate)) && (
        <div style={{ ...s.card, borderLeft: '3px solid #8b5cf6', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 14 }}>
            📅 Agenda Reorder Pre-Event
          </div>
          {preEventAlerts.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6B7280', padding: '12px 16px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, textAlign: 'center' }}>
              ✅ Tidak ada event yang memerlukan reorder dalam 60 hari ke depan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {preEventAlerts.map(alert => {
                const u = alert.daysUntilEvent;
                const isOverdue = u < 0;
                const isUrgent = !isOverdue && u <= 7;
                const isWarn = !isOverdue && !isUrgent && u <= 14;
                const borderClr = isOverdue ? '#ef4444' : isUrgent ? '#f97316' : isWarn ? '#f59e0b' : '#3b82f6';
                const urgencyLabel = isOverdue ? '🔴 DEADLINE TERLEWAT!' : isUrgent ? '🟠 Segera Order!' : isWarn ? '🟡 Persiapkan PO' : '🔵 Pantau';

                return (
                  <div key={alert.event.id ?? alert.event.name} style={{ background: isOverdue ? 'rgba(239,68,68,0.06)' : isUrgent ? 'rgba(249,115,22,0.06)' : isWarn ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.04)', border: `1px solid ${borderClr}25`, borderLeft: `3px solid ${borderClr}`, borderRadius: 10, padding: '14px 16px' }}>
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
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${borderClr}20`, color: borderClr }}>{urgencyLabel}</span>
                    </div>

                    {/* Top 3 affected SKUs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {alert.affectedSkus.slice(0, 3).map(sku => (
                        <div key={sku.sku} style={{ padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2 }}>{sku.sku}</div>
                          <div style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>{sku.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{sku.extraUnitsNeeded} unit</span>
                            <span style={{ color: sku.urgencyDays <= 0 ? '#ef4444' : sku.urgencyDays <= 7 ? '#f97316' : '#6B7280' }}>
                              {sku.urgencyDays <= 0 ? 'TERLEWAT' : `${sku.urgencyDays}h lagi`}
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

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
        {/* SKU List */}
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Pilih SKU</div>
          <input
            type="text"
            placeholder="Cari SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...s.select, width: '100%', marginBottom: 8, boxSizing: 'border-box' as const }}
          />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['ALL', 'SUPER_FAST', 'FAST', 'MEDIUM', 'SLOW'] as const).map(m => (
              <button key={m} onClick={() => setFilterMovement(m)} style={{
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
              <div style={{ textAlign: 'center', padding: 24, color: '#6B7280' }}>Memuat...</div>
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
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3b82f6' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>
                        {item.name}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: urgentColor, whiteSpace: 'nowrap' }}>
                        {item.daysRemaining <= 0 ? 'HABIS' : `${item.daysRemaining}h`}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
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
                    <button key={opt.value} onClick={() => setHorizon(opt.value)} style={{
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
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#ef4444' }}>
                  ⚠️ Stok diperkirakan habis dalam <strong>{stockoutDay} hari</strong>
                </div>
              )}
              {reorderDay !== undefined && reorderDay < (stockoutDay ?? Infinity) && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#f59e0b' }}>
                  📌 Reorder point tercapai dalam <strong>{reorderDay} hari</strong> — segera persiapkan PO
                </div>
              )}
              {events.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#8b5cf6' }}>
                  📅 Demand dipengaruhi {events.length} event terjadwal
                </div>
              )}

              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={forecastData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E7ED" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#6B7280', fontSize: 10 }}
                    interval={Math.floor(forecastData.length / 6)}
                  />
                  <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#F3F4F6', border: '1px solid #E4E7ED', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#374151' }} />
                  <ReferenceLine y={selectedItem.reorderPoint} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'ROP', fill: '#f59e0b', fontSize: 10 }} />
                  <Line type="monotone" dataKey="stock" name="Proyeksi Stok" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>

              {/* Detail table — first 10 days */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
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
                              {empty ? <span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>Habis</span>
                                : atRisk ? <span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>Di bawah ROP</span>
                                  : <span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>Aman</span>}
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

      {/* All items table */}
      <div style={s.card}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12 }}>Ringkasan Semua SKU</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['SKU', 'Produk', 'Stok', 'Avg/Hari', 'Sisa Hari', 'Habis 30h?', 'Habis 60h?', 'Habis 90h?'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(item => {
                const d30 = item.daysRemaining <= 30;
                const d60 = item.daysRemaining <= 60;
                const d90 = item.daysRemaining <= 90;
                const urgentColor = item.daysRemaining <= 7 ? '#ef4444' : item.daysRemaining <= 14 ? '#f59e0b' : '#10b981';
                return (
                  <tr key={item.sku} style={{ cursor: 'pointer' }} onClick={() => setSelectedSku(item.sku)}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{item.sku}</span></td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{item.name}</td>
                    <td style={s.td}>{item.stock}</td>
                    <td style={s.td}>{item.avgDailySales}</td>
                    <td style={{ ...s.td, fontWeight: 700, color: urgentColor }}>{item.daysRemaining <= 0 ? 'HABIS' : `${item.daysRemaining}h`}</td>
                    <td style={s.td}>{d30 ? <span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>Ya</span> : <span style={{ color: '#6B7280' }}>—</span>}</td>
                    <td style={s.td}>{d60 ? <span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>Ya</span> : <span style={{ color: '#6B7280' }}>—</span>}</td>
                    <td style={s.td}>{d90 ? <span style={s.badge('rgba(100,116,139,0.15)', '#64748b')}>Ya</span> : <span style={{ color: '#6B7280' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
