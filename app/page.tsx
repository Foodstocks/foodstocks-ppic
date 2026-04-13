'use client';

import {
  formatRupiah,
  calcStockFlowBalance, calcCapitalHealth, calcPreEventOrders,
  type MonthStartSnapshot, type StockFlowResult, type CapitalHealthResult,
  type PreEventAlert, type DemandEventExtended,
} from '@/lib/calculations';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const HPP_KEY = 'foodstocks_hpp_v1';
const VELOCITY_KEY = 'foodstocks_velocity_v1';
const EVENTS_KEY = 'foodstocks_events_v1';
const LEAD_TIME_KEY = 'foodstocks_leadtime_v1';
const MONTHSTART_KEY = 'foodstocks_monthstart_v1';
const SKUPPLIER_KEY = 'foodstocks_skupplier_v1';

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

interface InvItem {
  sku: string;
  name: string;
  sellPrice: number;
  buyPrice: number;
  category: string;
  stock: number;
}

interface SupplierItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface POItem {
  id: string;
  poNumber: string;
  supplier: string;
  total: number;
  status: string;
  orderDate: string;
  dueDate: string;
  paymentTerms: string;
}

type StockStatus = 'KRITIS' | 'RENDAH' | 'AMAN' | 'OVERSTOCK';

function mapStatus(raw: string): 'Lunas' | 'Batal' | 'Pending' {
  const lower = raw.toLowerCase();
  if (lower.includes('closed') || lower.includes('completed') || lower.includes('lunas')) return 'Lunas';
  if (lower.includes('cancelled') || lower.includes('cancel') || lower.includes('batal')) return 'Batal';
  return 'Pending';
}

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  header: { marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  subtitle: { fontSize: 14, color: 'var(--text-muted)' } as React.CSSProperties,
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16, marginBottom: 24 } as React.CSSProperties,
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 20 } as React.CSSProperties,
  kpiCard: (color: string) => ({ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 20, borderLeft: `3px solid ${color}` }) as React.CSSProperties,
  kpiLabel: { fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  kpiValue: (color: string) => ({ fontSize: 28, fontWeight: 700, color, marginTop: 4, marginBottom: 4 }),
  kpiSub: { fontSize: 12, color: 'var(--text-secondary)' },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 } as React.CSSProperties,
  alertRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const }),
};

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={s.kpiCard(color)}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={s.kpiValue(color)}>{value}</div>
      <div style={s.kpiSub}>{sub}</div>
    </div>
  );
}

interface SmartAlert {
  level: 'URGENT' | 'WARNING' | 'INFO' | 'PELUANG';
  icon: string;
  title: string;
  detail?: string;
}

function buildSmartAlerts(params: {
  invItems: InvItem[];
  velocityMap: Record<string, number>;
  leadTimeMap: Record<string, number>;
  hppMap: Record<string, number>;
  capitalHealth: CapitalHealthResult | null;
  stockFlow: StockFlowResult | null;
  preEventAlerts: PreEventAlert[];
  poKpis: { pendingItems: POItem[]; pendingCount: number; pending: number };
}): SmartAlert[] {
  const { invItems, velocityMap, leadTimeMap, hppMap, capitalHealth, stockFlow, preEventAlerts, poKpis } = params;
  const alerts: SmartAlert[] = [];

  // Compute days remaining per SKU
  const withVelocity = invItems.map(item => {
    const vel = velocityMap[item.sku] ?? 0;
    const lt = leadTimeMap[item.sku] ?? leadTimeMap['__default__'] ?? 3;
    const days = vel > 0 ? item.stock / vel : 999;
    return { ...item, vel, leadTime: lt, daysRemaining: days };
  });

  const kritisItems = withVelocity.filter(i => i.vel > 0 && i.daysRemaining <= i.leadTime);
  const warnItems = withVelocity.filter(i => i.vel > 0 && i.daysRemaining > i.leadTime && i.daysRemaining <= 7);
  const hasVelocityData = Object.keys(velocityMap).length > 0;

  // ── URGENT ────────────────────────────────────────────────
  if (kritisItems.length > 0) {
    alerts.push({
      level: 'URGENT',
      icon: '⚡',
      title: `${kritisItems.length} SKU kritis — stok habis dalam ≤${Math.max(...kritisItems.map(i => i.leadTime))} hari`,
      detail: kritisItems.slice(0, 5).map(i => i.name || i.sku).join(', ') + (kritisItems.length > 5 ? ` +${kritisItems.length - 5} lainnya` : ''),
    });
  }

  if (capitalHealth && capitalHealth.status === 'BAHAYA') {
    const pct = ((1 - capitalHealth.capitalRatio) * 100).toFixed(0);
    alerts.push({
      level: 'URGENT',
      icon: '🚨',
      title: `Modal stok turun ${pct}% dari awal bulan!`,
      detail: `Ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}% — perlu evaluasi pembelian atau ada kebocoran stok.`,
    });
  }

  if (capitalHealth && capitalHealth.profitIllusion) {
    const truePos = capitalHealth.truePosition;
    alerts.push({
      level: 'URGENT',
      icon: '⚠️',
      title: 'PROFIT SEMU — gross profit positif tapi modal stok berkurang',
      detail: `True Position ${formatRupiah(truePos)} — jangan konsumsi profit sebelum stok terisi ulang.`,
    });
  }

  // PO jatuh tempo hari ini
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueTodayItems = poKpis.pendingItems.filter(p => {
    if (!p.dueDate) return false;
    const d = new Date(p.dueDate);
    d.setHours(0, 0, 0, 0);
    return d <= today;
  });
  if (dueTodayItems.length > 0) {
    const total = dueTodayItems.reduce((s, p) => s + p.total, 0);
    alerts.push({
      level: 'URGENT',
      icon: '💸',
      title: `${dueTodayItems.length} PO jatuh tempo hari ini — total ${formatRupiah(total)}`,
      detail: dueTodayItems.map(p => p.poNumber || p.supplier).join(', '),
    });
  }

  // Pre-event deadline lewat
  const overdueEvents = preEventAlerts.filter(e => e.isOverdue);
  overdueEvents.forEach(e => {
    alerts.push({ level: 'URGENT', icon: '🗓️', title: `Deadline order untuk ${e.event.name} sudah lewat!`, detail: `${e.affectedSkus.length} SKU perlu dipesan segera.` });
  });

  // ── WARNING ───────────────────────────────────────────────
  if (warnItems.length > 0) {
    alerts.push({
      level: 'WARNING',
      icon: '📦',
      title: `${warnItems.length} SKU perlu restock minggu ini`,
      detail: warnItems.slice(0, 4).map(i => i.name || i.sku).join(', ') + (warnItems.length > 4 ? ` +${warnItems.length - 4} lainnya` : ''),
    });
  }

  if (capitalHealth && capitalHealth.status === 'WASPADA') {
    alerts.push({
      level: 'WARNING',
      icon: '📊',
      title: `Modal stok turun sedikit — ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}%`,
      detail: 'Perhatikan pengeluaran stok agar modal tetap terjaga.',
    });
  }

  // PO jatuh tempo ≤3 hari (bukan hari ini)
  const dueSoonItems = poKpis.pendingItems.filter(p => {
    if (!p.dueDate) return false;
    const d = new Date(p.dueDate);
    d.setHours(0, 0, 0, 0);
    const diff = (d.getTime() - today.getTime()) / 86400000;
    return diff > 0 && diff <= 3;
  });
  if (dueSoonItems.length > 0) {
    const total = dueSoonItems.reduce((s, p) => s + p.total, 0);
    alerts.push({
      level: 'WARNING',
      icon: '📋',
      title: `${dueSoonItems.length} PO jatuh tempo dalam 3 hari — ${formatRupiah(total)}`,
      detail: dueSoonItems.map(p => p.poNumber || p.supplier).join(', '),
    });
  }

  // Pre-event deadline ≤7 hari (tidak overdue)
  const upcomingEvents = preEventAlerts.filter(e => {
    if (e.isOverdue) return false;
    const diff = (e.orderDeadline.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  upcomingEvents.forEach(e => {
    const diff = Math.round((e.orderDeadline.getTime() - today.getTime()) / 86400000);
    const totalCost = e.affectedSkus.reduce((s, sk) => s + sk.estimatedCost, 0);
    alerts.push({ level: 'WARNING', icon: '🗓️', title: `${e.event.name} — order dalam ${diff} hari!`, detail: `${e.affectedSkus.length} SKU · estimasi ${formatRupiah(totalCost)}` });
  });

  // ── INFO ──────────────────────────────────────────────────
  if (stockFlow && hasVelocityData) {
    const variance = stockFlow.openingCapital > 0
      ? Math.abs(stockFlow.actualClosing - stockFlow.expectedClosing) / stockFlow.openingCapital
      : 0;
    if (variance > 0.1) {
      const pct = (variance * 100).toFixed(0);
      alerts.push({
        level: 'INFO',
        icon: '📉',
        title: `Stok aktual vs estimasi selisih ${pct}% — cek penjualan/kehilangan`,
        detail: `Expected: ${formatRupiah(stockFlow.expectedClosing)} · Aktual: ${formatRupiah(stockFlow.actualClosing)}`,
      });
    }
  }

  const slowItems = withVelocity.filter(i => i.vel > 0 && i.daysRemaining > 30);
  if (slowItems.length > 0 && hasVelocityData) {
    const slowValue = slowItems.reduce((s, i) => {
      const hpp = hppMap[i.sku] ?? i.buyPrice ?? 0;
      return s + i.stock * hpp;
    }, 0);
    alerts.push({
      level: 'INFO',
      icon: '🐌',
      title: `${slowItems.length} SKU slow moving senilai ${formatRupiah(slowValue)}`,
      detail: 'Stok bertahan >30 hari — pertimbangkan promo atau kurangi reorder.',
    });
  }

  // ── PELUANG ───────────────────────────────────────────────
  if (capitalHealth && capitalHealth.status === 'SEHAT') {
    alerts.push({
      level: 'PELUANG',
      icon: '💰',
      title: `Modal stok sehat — ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}% dari awal bulan`,
      detail: 'Kondisi bisnis terjaga dengan baik.',
    });
  }

  if (kritisItems.length === 0 && hasVelocityData) {
    alerts.push({ level: 'PELUANG', icon: '✅', title: 'Semua SKU aman — tidak ada yang perlu direstock urgent', detail: undefined });
  }

  if (capitalHealth && !capitalHealth.profitIllusion && capitalHealth.grossProfit > 0 && capitalHealth.status === 'SEHAT') {
    alerts.push({
      level: 'PELUANG',
      icon: '📈',
      title: `True Position positif ${formatRupiah(capitalHealth.truePosition)} — bisnis dalam kondisi baik`,
      detail: 'Gross profit nyata dan modal stok terjaga.',
    });
  }

  // Sort: URGENT → WARNING → INFO → PELUANG, max 5
  const order: Record<SmartAlert['level'], number> = { URGENT: 0, WARNING: 1, INFO: 2, PELUANG: 3 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  if (alerts.length === 0) {
    alerts.push({ level: 'PELUANG', icon: '✅', title: 'Semua indikator aman — tidak ada aksi mendesak hari ini', detail: undefined });
  }

  return alerts.slice(0, 5);
}

export default function Overview() {
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock flow & capital health
  const [monthStartSnapshot, setMonthStartSnapshot] = useState<MonthStartSnapshot | null>(null);
  const [hppMap, setHppMap] = useState<Record<string, number>>({});
  const [velocityMap, setVelocityMap] = useState<Record<string, number>>({});
  const [leadTimeMap, setLeadTimeMap] = useState<Record<string, number>>({});
  const [skupplierMap, setSkupplierMap] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<DemandEventExtended[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [invRes, supRes, poRes] = await Promise.allSettled([
          fetch('/api/jubelio/inventory').then(r => r.json()),
          fetch('/api/jubelio/suppliers').then(r => r.json()),
          fetch('/api/jubelio/pos').then(r => r.json()),
        ]);

        if (invRes.status === 'fulfilled' && invRes.value.success) {
          setInvItems(invRes.value.data);
        }
        if (supRes.status === 'fulfilled' && supRes.value.success) {
          setSuppliers(supRes.value.data);
        }
        if (poRes.status === 'fulfilled' && poRes.value.success) {
          setPoItems(poRes.value.data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load localStorage data + auto-capture month-start snapshot once invItems arrives
  useEffect(() => {
    if (invItems.length === 0) return;
    const hpp: Record<string, number> = loadStorage(HPP_KEY, {});
    const vel: Record<string, number> = loadStorage(VELOCITY_KEY, {});
    const lt: Record<string, number> = loadStorage(LEAD_TIME_KEY, {});
    const evts: DemandEventExtended[] = loadStorage(EVENTS_KEY, []);
    const supp: Record<string, string> = loadStorage(SKUPPLIER_KEY, {});
    setHppMap(hpp);
    setVelocityMap(vel);
    setLeadTimeMap(lt);
    setEvents(evts);
    setSkupplierMap(supp);

    // Pull velocity + events from cloud (overwrites local if cloud has newer data)
    fetch('/api/kv-sync?key=velocity_map', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data) { const m = { ...vel, ...j.data }; setVelocityMap(m); try { localStorage.setItem(VELOCITY_KEY, JSON.stringify(m)); } catch { /* noop */ } } })
      .catch(() => {});
    fetch('/api/kv-sync?key=events', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data && Array.isArray(j.data)) { setEvents(j.data); try { localStorage.setItem(EVENTS_KEY, JSON.stringify(j.data)); } catch { /* noop */ } } })
      .catch(() => {});
    fetch('/api/kv-sync?key=skupplier_map', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data) { const m = { ...supp, ...j.data }; setSkupplierMap(m); try { localStorage.setItem(SKUPPLIER_KEY, JSON.stringify(m)); } catch { /* noop */ } } })
      .catch(() => {});

    const currentMonth = new Date().toISOString().slice(0, 7);
    const existing = loadStorage<MonthStartSnapshot | null>(MONTHSTART_KEY, null);
    if (!existing || existing.month !== currentMonth) {
      const items = invItems.map(item => {
        const h = hpp[item.sku] ?? (item.buyPrice > 0 ? item.buyPrice : Math.round(item.sellPrice * 0.65));
        return { sku: item.sku, qty: item.stock, hpp: h, value: item.stock * h };
      });
      const totalValue = items.reduce((s, i) => s + i.value, 0);
      const snap: MonthStartSnapshot = {
        month: currentMonth,
        capturedAt: new Date().toISOString(),
        totalValue,
        items,
      };
      try { localStorage.setItem(MONTHSTART_KEY, JSON.stringify(snap)); } catch { /* noop */ }
      setMonthStartSnapshot(snap);
    } else {
      setMonthStartSnapshot(existing);
    }
  }, [invItems]);


  // Compute inventory KPIs
  const invKpis = (() => {
    const counts: Record<StockStatus, number> = { KRITIS: 0, RENDAH: 0, AMAN: 0, OVERSTOCK: 0 };
    let totalValue = 0;
    let marginSum = 0;
    invItems.forEach(item => {
      const hpp = item.buyPrice > 0 ? item.buyPrice : Math.round(item.sellPrice * 0.65);
      totalValue += item.stock * hpp;
      if (item.sellPrice > 0) marginSum += (item.sellPrice - hpp) / item.sellPrice * 100;
      // Without velocity data we can't compute days, mark as AMAN by default
      counts.AMAN++;
    });
    return {
      kritis: counts.KRITIS,
      rendah: counts.RENDAH,
      aman: counts.AMAN,
      overstock: counts.OVERSTOCK,
      totalValue,
      avgMargin: invItems.length > 0 ? marginSum / invItems.length : 0,
    };
  })();

  // PO KPIs
  const poKpis = (() => {
    const mapped = poItems.map(p => ({ ...p, displayStatus: mapStatus(p.status) }));
    return {
      totalBudget: mapped.reduce((s, p) => s + p.total, 0),
      lunas: mapped.filter(p => p.displayStatus === 'Lunas').reduce((s, p) => s + p.total, 0),
      pending: mapped.filter(p => p.displayStatus === 'Pending').reduce((s, p) => s + p.total, 0),
      pendingCount: mapped.filter(p => p.displayStatus === 'Pending').length,
      pendingItems: mapped.filter(p => p.displayStatus === 'Pending'),
    };
  })();

  // Stock flow & capital health computed values
  const currentMonth = today.toISOString().slice(0, 7);
  const daysElapsed = today.getDate();

  const restockInTotal = poItems
    .filter(p => p.orderDate?.slice(0, 7) === currentMonth && mapStatus(p.status) !== 'Batal')
    .reduce((s, p) => s + (p.total ?? 0), 0);

  const invForCalc = invItems.map(item => ({
    sku: item.sku,
    name: item.name,
    stock: item.stock,
    sellPrice: item.sellPrice,
    category: item.category,
  }));

  const stockFlow: StockFlowResult | null = monthStartSnapshot
    ? calcStockFlowBalance(monthStartSnapshot, restockInTotal, velocityMap, hppMap, invForCalc, daysElapsed)
    : null;

  const capitalHealth: CapitalHealthResult | null = stockFlow && monthStartSnapshot
    ? calcCapitalHealth(stockFlow.openingCapital, stockFlow.actualClosing, stockFlow.salesOutCapital, velocityMap, hppMap, invForCalc, daysElapsed)
    : null;

  const preEventAlerts: PreEventAlert[] = events.length > 0
    ? calcPreEventOrders(events, velocityMap, hppMap, invForCalc, leadTimeMap, today, 60, skupplierMap)
    : [];

  const hasVelocity = Object.keys(velocityMap).length > 0;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={s.title}>📊 Overview Dashboard</div>
            <div style={s.subtitle}>{dateStr} · Foodstocks WMS</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={s.badge('rgba(59,130,246,0.15)', '#3b82f6')}>{invItems.length} SKU</span>
            <span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>{suppliers.length} Supplier</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 16 }}>
          ⏳ Memuat data Jubelio...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={s.grid4}>
            <KpiCard label="Total Budget PO" value={formatRupiah(poKpis.totalBudget)} sub={`${formatRupiah(poKpis.lunas)} sudah lunas`} color="#3b82f6" />
            <KpiCard label="PO Pending (Belum Bayar)" value={formatRupiah(poKpis.pending)} sub={`${poKpis.pendingCount} Purchase Orders`} color="#f59e0b" />
            <KpiCard label="Total SKU Aktif" value={`${invItems.length} SKU`} sub={`Data live dari Jubelio`} color="#ef4444" />
            <KpiCard label="Nilai Stok Gudang" value={formatRupiah(invKpis.totalValue)} sub={`${invItems.length} SKU aktif`} color="#10b981" />
          </div>

          {/* Second row KPIs */}
          <div style={s.grid4}>
            <KpiCard label="Avg Margin Kotor" value={`${invKpis.avgMargin.toFixed(1)}%`} sub="Rata-rata semua SKU" color="#8b5cf6" />
            <KpiCard label="Total Supplier" value={`${suppliers.length}`} sub="Dari Jubelio WMS" color="#06b6d4" />
            <KpiCard label="Total PO" value={`${poItems.length}`} sub="Purchase Orders" color="#f97316" />
            <KpiCard label="Supplier dengan Email" value={`${suppliers.filter(s => s.email).length}`} sub="Siap dihubungi" color="#10b981" />
          </div>

          {/* 🔔 Analisa Hari Ini — Smart Daily Alerts */}
          {(() => {
            const alerts = buildSmartAlerts({ invItems, velocityMap, leadTimeMap, hppMap, capitalHealth, stockFlow, preEventAlerts, poKpis });
            const levelBg: Record<SmartAlert['level'], string> = {
              URGENT: 'rgba(239,68,68,0.08)', WARNING: 'rgba(245,158,11,0.08)',
              INFO: 'rgba(59,130,246,0.08)', PELUANG: 'rgba(16,185,129,0.08)',
            };
            const levelBorder: Record<SmartAlert['level'], string> = {
              URGENT: 'rgba(239,68,68,0.25)', WARNING: 'rgba(245,158,11,0.25)',
              INFO: 'rgba(59,130,246,0.25)', PELUANG: 'rgba(16,185,129,0.25)',
            };
            const levelColor: Record<SmartAlert['level'], string> = {
              URGENT: '#ef4444', WARNING: '#f59e0b', INFO: '#3b82f6', PELUANG: '#10b981',
            };
            return (
              <div style={{ ...s.card, marginBottom: 24, borderLeft: '3px solid #8b5cf6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>🔔 Analisa Hari Ini</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Diperbarui otomatis · {dateStr}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.map((alert, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '10px 14px', borderRadius: 9,
                      background: levelBg[alert.level],
                      border: `1px solid ${levelBorder[alert.level]}`,
                    }}>
                      <span style={{ fontSize: 16, lineHeight: 1.4 }}>{alert.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: levelColor[alert.level] }}>{alert.title}</div>
                        {alert.detail && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{alert.detail}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: levelBg[alert.level], color: levelColor[alert.level], whiteSpace: 'nowrap',
                      }}>{alert.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Widget A: Pergerakan Stok Bulan Ini ─────────────── */}
          <div style={{ ...s.card, marginBottom: 24, borderLeft: '3px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                📊 Pergerakan Stok Bulan Ini
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  Hari ke-{daysElapsed} · {today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => {
                  if (!confirm('Catat ulang stok awal bulan ini? Data snapshot lama akan diganti.')) return;
                  const hpp: Record<string, number> = loadStorage(HPP_KEY, {});
                  const items = invItems.map(item => {
                    const h = hpp[item.sku] ?? (item.buyPrice > 0 ? item.buyPrice : Math.round(item.sellPrice * 0.65));
                    return { sku: item.sku, qty: item.stock, hpp: h, value: item.stock * h };
                  });
                  const totalValue = items.reduce((s, i) => s + i.value, 0);
                  const snap: MonthStartSnapshot = { month: currentMonth, capturedAt: new Date().toISOString(), totalValue, items };
                  try { localStorage.setItem(MONTHSTART_KEY, JSON.stringify(snap)); } catch { /* noop */ }
                  setMonthStartSnapshot(snap);
                }}
                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              >
                📸 Catat Stok Awal
              </button>
            </div>

            {!stockFlow ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
                ⏳ Memuat snapshot stok awal...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'center' }}>
                {/* Waterfall chart */}
                <div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[
                      { name: 'Modal Awal', value: stockFlow.openingCapital },
                      { name: '+ Restock', value: stockFlow.restockInCapital },
                      { name: '- Terjual', value: stockFlow.salesOutCapital },
                      { name: 'Aktual Closing', value: stockFlow.actualClosing },
                    ]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) => formatRupiah(Number(v))}
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill="#3b82f6" />
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                        <Cell fill={stockFlow.actualClosing >= stockFlow.openingCapital ? '#10b981' : '#f59e0b'} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {!hasVelocity && (
                    <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                      ⚠️ Data velocity belum ada — estimasi terjual tidak akurat.{' '}
                      <Link href="/settings" style={{ color: '#3b82f6' }}>Sync di Settings</Link>
                    </div>
                  )}
                </div>

                {/* Summary table */}
                <div style={{ fontSize: 13 }}>
                  {[
                    { label: 'Modal Awal Bulan', value: formatRupiah(stockFlow.openingCapital), color: '#3b82f6' },
                    { label: '+ Restock Diterima', value: formatRupiah(stockFlow.restockInCapital), color: '#10b981' },
                    { label: '− Estimasi Terjual', value: formatRupiah(stockFlow.salesOutCapital), color: '#ef4444' },
                    { label: '= Expected Closing', value: formatRupiah(stockFlow.expectedClosing), color: 'var(--text-secondary)' },
                    { label: 'Aktual Closing', value: formatRupiah(stockFlow.actualClosing), color: stockFlow.actualClosing >= stockFlow.openingCapital ? '#10b981' : '#f59e0b', bold: true },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ color: row.color, fontWeight: row.bold ? 700 : 500 }}>{row.value}</span>
                    </div>
                  ))}
                  {/* Health ratio */}
                  {stockFlow.openingCapital > 0 && (() => {
                    const ratio = stockFlow.actualClosing / stockFlow.openingCapital;
                    const isSehat = ratio >= 1.0;
                    const isWaspada = ratio >= 0.9;
                    const bg = isSehat ? 'rgba(16,185,129,0.15)' : isWaspada ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                    const clr = isSehat ? '#10b981' : isWaspada ? '#f59e0b' : '#ef4444';
                    const label = isSehat ? 'SEHAT' : isWaspada ? 'WASPADA' : 'BAHAYA';
                    return (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: bg, borderRadius: 8 }}>
                        <span style={{ fontSize: 11, color: clr, fontWeight: 700 }}>● {label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: clr }}>{(ratio * 100).toFixed(1)}%</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* ── Widget B + existing Alerts row ──────────────────── */}
          <div style={s.grid2}>
            {/* Kesehatan Modal */}
            <div style={{ ...s.card, borderLeft: capitalHealth ? `3px solid ${capitalHealth.status === 'SEHAT' ? '#10b981' : capitalHealth.status === 'WASPADA' ? '#f59e0b' : '#ef4444'}` : '3px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
                💰 Kesehatan Modal
              </div>
              {!capitalHealth ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {!hasVelocity ? '⚠️ Lengkapi data velocity untuk melihat kesehatan modal.' : '⏳ Memuat...'}
                </div>
              ) : (
                <>
                  {/* Traffic light indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                      background: capitalHealth.status === 'SEHAT' ? '#10b981' : capitalHealth.status === 'WASPADA' ? '#f59e0b' : '#ef4444',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{(capitalHealth.capitalRatio * 100).toFixed(0)}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: capitalHealth.status === 'SEHAT' ? '#10b981' : capitalHealth.status === 'WASPADA' ? '#f59e0b' : '#ef4444' }}>
                        {capitalHealth.status}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {capitalHealth.status === 'SEHAT' ? 'Modal stok terjaga dengan baik' : capitalHealth.status === 'WASPADA' ? 'Modal stok sedikit tergerus' : 'Modal stok berkurang signifikan'}
                      </div>
                    </div>
                  </div>

                  {[
                    { label: 'Est. Omset Bulan Ini', value: formatRupiah(capitalHealth.estRevenue), color: '#3b82f6' },
                    { label: 'Est. COGS', value: formatRupiah(capitalHealth.estRevenue - capitalHealth.grossProfit), color: '#64748b' },
                    { label: 'Gross Profit', value: formatRupiah(capitalHealth.grossProfit), color: capitalHealth.grossProfit >= 0 ? '#10b981' : '#ef4444' },
                    { label: 'Perubahan Modal Stok', value: `${capitalHealth.capitalDelta >= 0 ? '+' : ''}${formatRupiah(capitalHealth.capitalDelta)}`, color: capitalHealth.capitalDelta >= 0 ? '#10b981' : '#ef4444' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
                    </div>
                  ))}

                  <div style={{ marginTop: 10, padding: '8px 12px', background: capitalHealth.truePosition >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>True Position</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: capitalHealth.truePosition >= 0 ? '#10b981' : '#ef4444' }}>{capitalHealth.truePosition >= 0 ? '+' : ''}{formatRupiah(capitalHealth.truePosition)}</span>
                  </div>

                  {capitalHealth.profitIllusion && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                      ⚠️ PROFIT SEMU — Gross profit positif tapi modal stok berkurang! Cek apakah harga beli naik atau ada stok yang hilang.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* PO Jatuh Tempo (existing) */}
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={s.sectionTitle}>📋 PO Jatuh Tempo (Pending)</div>
                <Link href="/po-budget" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>Lihat Semua →</Link>
              </div>
              {poKpis.pendingItems.length === 0 ? (
                <div style={{ color: '#10b981', fontSize: 14 }}>✅ Tidak ada PO pending saat ini</div>
              ) : (
                poKpis.pendingItems.slice(0, 5).map(p => {
                  const due = p.dueDate ? new Date(p.dueDate) : null;
                  const diffDays = due && !isNaN(due.getTime()) ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const urgent = diffDays !== null && diffDays <= 3;
                  return (
                    <div key={p.id} style={s.alertRow}>
                      <span style={s.badge(urgent ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', urgent ? '#ef4444' : '#f59e0b')}>
                        {urgent ? '🔴' : '🟡'} {diffDays !== null ? `H-${Math.max(0, diffDays)}` : '⏳'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.poNumber || p.id}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.supplier || '—'} · {p.paymentTerms || '—'}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatRupiah(p.total)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Widget C: Agenda Reorder Pre-Event ──────────────── */}
          <div style={{ ...s.card, marginBottom: 24, borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
              📅 Agenda Reorder Pre-Event
            </div>
            {preEventAlerts.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(139,92,246,0.06)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                {events.filter(e => e.startDate).length === 0
                  ? '💡 Tambahkan tanggal event di Settings → Event Calendar untuk mendapatkan reorder deadline otomatis.'
                  : '✅ Tidak ada event yang memerlukan reorder dalam 60 hari ke depan.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {preEventAlerts.map(alert => {
                  const u = alert.daysUntilEvent;
                  const isOverdue = u < 0;
                  const isUrgent = !isOverdue && u <= 7;
                  const isWarn = !isOverdue && !isUrgent && u <= 14;
                  const bg = isOverdue ? 'rgba(239,68,68,0.08)' : isUrgent ? 'rgba(249,115,22,0.08)' : isWarn ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)';
                  const borderClr = isOverdue ? '#ef4444' : isUrgent ? '#f97316' : isWarn ? '#f59e0b' : '#3b82f6';
                  const urgencyLabel = isOverdue ? '🔴 DEADLINE TERLEWAT!' : isUrgent ? '🟠 Segera Order!' : isWarn ? '🟡 Persiapkan PO' : '🔵 Pantau';
                  const expanded = expandedEvent === alert.event.id;

                  return (
                    <div key={alert.event.id} style={{ background: bg, border: `1px solid ${borderClr}30`, borderLeft: `3px solid ${borderClr}`, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {alert.event.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span>Mulai: {new Date(alert.event.startDate!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span>|</span>
                            <span>Deadline Order: {alert.orderDeadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span>|</span>
                            <span>{alert.affectedSkus.length} SKU · {formatRupiah(alert.totalExtraUnitsValue)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${borderClr}20`, color: borderClr }}>{urgencyLabel}</span>
                          <button
                            onClick={() => setExpandedEvent(expanded ? null : alert.event.id)}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                          >
                            {expanded ? 'Tutup' : `${alert.affectedSkus.length} SKU →`}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                {['SKU', 'Stok Saat Ini', 'Extra Unit', 'Est. Biaya', 'Deadline'].map(h => (
                                  <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {alert.affectedSkus.map(sku => (
                                <tr key={sku.sku}>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}><strong>{sku.sku}</strong><div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{sku.name}</div></td>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{sku.currentStock} unit</td>
                                  <td style={{ padding: '6px 8px', color: '#f59e0b', fontWeight: 700 }}>+{sku.extraUnitsNeeded} unit</td>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>{formatRupiah(sku.estimatedCost)}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <span style={{ color: sku.urgencyDays <= 0 ? '#ef4444' : sku.urgencyDays <= 7 ? '#f97316' : 'var(--text-muted)', fontWeight: sku.urgencyDays <= 7 ? 700 : 400 }}>
                                      {sku.urgencyDays <= 0 ? 'TERLEWAT' : `${sku.urgencyDays} hari lagi`}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supplier Highlights + Quick Actions */}
          <div style={s.grid2}>
            {/* Supplier List */}
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={s.sectionTitle}>🏭 Supplier Highlights</div>
                <Link href="/suppliers" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>Lihat Semua →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suppliers.slice(0, 5).map(sup => (
                  <div key={sup.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#3b82f6' }}>
                      🏪
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{sup.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sup.email || sup.phone || sup.address || '—'}</div>
                    </div>
                  </div>
                ))}
                {suppliers.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data supplier</div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Inventory Summary */}
            <div style={s.card}>
              <div style={s.sectionTitle}>📦 Status Inventori</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {invItems.length} SKU aktif terdaftar di Jubelio WMS. Kunjungi halaman{' '}
                  <Link href="/inventory" style={{ color: '#3b82f6' }}>Inventory</Link>
                  {' '}untuk detail status stok per SKU.
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={s.card}>
              <div style={s.sectionTitle}>⚡ Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { href: '/planner', icon: '🛒', label: 'Buat Draft PO Sekarang', desc: 'Purchase planner berbasis stok', color: '#ef4444' },
                  { href: '/inventory', icon: '📦', label: 'Cek Stok Live', desc: `${invItems.length} SKU aktif`, color: '#3b82f6' },
                  { href: '/suppliers', icon: '🤝', label: 'Lihat Daftar Supplier', desc: `${suppliers.length} supplier di Jubelio`, color: '#10b981' },
                  { href: '/cogs', icon: '💹', label: 'Analisa Margin', desc: `Avg margin ${invKpis.avgMargin.toFixed(1)}%`, color: '#8b5cf6' },
                  { href: '/settings', icon: '⚙️', label: 'Settings Jubelio', desc: 'Konfigurasi API key', color: '#f97316' },
                ].map(action => (
                  <Link key={action.href} href={action.href} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                  }}>
                    <span style={{ fontSize: 20 }}>{action.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{action.desc}</div>
                    </div>
                    <span style={{ color: action.color, fontSize: 16 }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 32, padding: '16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#3b82f6' }}>🔄 Fase 2 — Data Live dari Jubelio WMS</strong>
          {' '}· Data inventory, supplier, dan PO diambil langsung dari Jubelio API. Konfigurasi API key di halaman{' '}
          <Link href="/settings" style={{ color: '#3b82f6' }}>Settings</Link>.
        </div>
      </div>
    </div>
  );
}
