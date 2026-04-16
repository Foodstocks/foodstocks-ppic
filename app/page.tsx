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

  const withVelocity = invItems.map(item => {
    const vel = velocityMap[item.sku] ?? 0;
    const lt = leadTimeMap[item.sku] ?? leadTimeMap['__default__'] ?? 3;
    const days = vel > 0 ? item.stock / vel : 999;
    return { ...item, vel, leadTime: lt, daysRemaining: days };
  });

  const kritisItems = withVelocity.filter(i => i.vel > 0 && i.daysRemaining <= i.leadTime);
  const warnItems = withVelocity.filter(i => i.vel > 0 && i.daysRemaining > i.leadTime && i.daysRemaining <= 7);
  const hasVelocityData = Object.keys(velocityMap).length > 0;

  // URGENT
  if (kritisItems.length > 0) {
    alerts.push({
      level: 'URGENT',
      icon: 'critical',
      title: `${kritisItems.length} SKU kritis — stok habis dalam ≤${Math.max(...kritisItems.map(i => i.leadTime))} hari`,
      detail: kritisItems.slice(0, 5).map(i => i.name || i.sku).join(', ') + (kritisItems.length > 5 ? ` +${kritisItems.length - 5} lainnya` : ''),
    });
  }

  if (capitalHealth && capitalHealth.status === 'BAHAYA') {
    const pct = ((1 - capitalHealth.capitalRatio) * 100).toFixed(0);
    alerts.push({
      level: 'URGENT',
      icon: 'danger',
      title: `Modal stok turun ${pct}% dari awal bulan!`,
      detail: `Ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}% — perlu evaluasi pembelian atau ada kebocoran stok.`,
    });
  }

  if (capitalHealth && capitalHealth.profitIllusion) {
    const truePos = capitalHealth.truePosition;
    alerts.push({
      level: 'URGENT',
      icon: 'warning',
      title: 'PROFIT SEMU — gross profit positif tapi modal stok berkurang',
      detail: `True Position ${formatRupiah(truePos)} — jangan konsumsi profit sebelum stok terisi ulang.`,
    });
  }

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
      icon: 'payment',
      title: `${dueTodayItems.length} PO jatuh tempo hari ini — total ${formatRupiah(total)}`,
      detail: dueTodayItems.map(p => p.poNumber || p.supplier).join(', '),
    });
  }

  const overdueEvents = preEventAlerts.filter(e => e.isOverdue);
  overdueEvents.forEach(e => {
    alerts.push({ level: 'URGENT', icon: 'calendar', title: `Deadline order untuk ${e.event.name} sudah lewat!`, detail: `${e.affectedSkus.length} SKU perlu dipesan segera.` });
  });

  // WARNING
  if (warnItems.length > 0) {
    alerts.push({
      level: 'WARNING',
      icon: 'stock',
      title: `${warnItems.length} SKU perlu restock minggu ini`,
      detail: warnItems.slice(0, 4).map(i => i.name || i.sku).join(', ') + (warnItems.length > 4 ? ` +${warnItems.length - 4} lainnya` : ''),
    });
  }

  if (capitalHealth && capitalHealth.status === 'WASPADA') {
    alerts.push({
      level: 'WARNING',
      icon: 'chart',
      title: `Modal stok turun sedikit — ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}%`,
      detail: 'Perhatikan pengeluaran stok agar modal tetap terjaga.',
    });
  }

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
      icon: 'po',
      title: `${dueSoonItems.length} PO jatuh tempo dalam 3 hari — ${formatRupiah(total)}`,
      detail: dueSoonItems.map(p => p.poNumber || p.supplier).join(', '),
    });
  }

  const upcomingEvents = preEventAlerts.filter(e => {
    if (e.isOverdue) return false;
    const diff = (e.orderDeadline.getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  upcomingEvents.forEach(e => {
    const diff = Math.round((e.orderDeadline.getTime() - today.getTime()) / 86400000);
    const totalCost = e.affectedSkus.reduce((s, sk) => s + sk.estimatedCost, 0);
    alerts.push({ level: 'WARNING', icon: 'calendar', title: `${e.event.name} — order dalam ${diff} hari!`, detail: `${e.affectedSkus.length} SKU · estimasi ${formatRupiah(totalCost)}` });
  });

  // INFO
  if (stockFlow && hasVelocityData) {
    const variance = stockFlow.openingCapital > 0
      ? Math.abs(stockFlow.actualClosing - stockFlow.expectedClosing) / stockFlow.openingCapital
      : 0;
    if (variance > 0.1) {
      const pct = (variance * 100).toFixed(0);
      alerts.push({
        level: 'INFO',
        icon: 'info',
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
      icon: 'slow',
      title: `${slowItems.length} SKU slow moving senilai ${formatRupiah(slowValue)}`,
      detail: 'Stok bertahan >30 hari — pertimbangkan promo atau kurangi reorder.',
    });
  }

  // PELUANG
  if (capitalHealth && capitalHealth.status === 'SEHAT') {
    alerts.push({
      level: 'PELUANG',
      icon: 'money',
      title: `Modal stok sehat — ratio ${(capitalHealth.capitalRatio * 100).toFixed(1)}% dari awal bulan`,
      detail: 'Kondisi bisnis terjaga dengan baik.',
    });
  }

  if (kritisItems.length === 0 && hasVelocityData) {
    alerts.push({ level: 'PELUANG', icon: 'ok', title: 'Semua SKU aman — tidak ada yang perlu direstock urgent', detail: undefined });
  }

  if (capitalHealth && !capitalHealth.profitIllusion && capitalHealth.grossProfit > 0 && capitalHealth.status === 'SEHAT') {
    alerts.push({
      level: 'PELUANG',
      icon: 'trend',
      title: `True Position positif ${formatRupiah(capitalHealth.truePosition)} — bisnis dalam kondisi baik`,
      detail: 'Gross profit nyata dan modal stok terjaga.',
    });
  }

  const order: Record<SmartAlert['level'], number> = { URGENT: 0, WARNING: 1, INFO: 2, PELUANG: 3 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  if (alerts.length === 0) {
    alerts.push({ level: 'PELUANG', icon: 'ok', title: 'Semua indikator aman — tidak ada aksi mendesak hari ini', detail: undefined });
  }

  return alerts;
}

// SVG dot icon for alerts
function AlertDot({ color }: { color: string }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginTop: 3 }}>
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

// SVG icons for KPI cards
function IconSKU() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IconPO() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconModal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconSync() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function Overview() {
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const [monthStartSnapshot, setMonthStartSnapshot] = useState<MonthStartSnapshot | null>(null);
  const [hppMap, setHppMap] = useState<Record<string, number>>({});
  const [velocityMap, setVelocityMap] = useState<Record<string, number>>({});
  const [leadTimeMap, setLeadTimeMap] = useState<Record<string, number>>({});
  const [skupplierMap, setSkupplierMap] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<DemandEventExtended[]>([]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  async function loadData() {
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
      setLastSync(new Date());
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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

  // Stock health chart data: top 8 by days remaining (lowest first = most critical)
  const stockHealthData = (() => {
    return invItems
      .map(item => {
        const vel = velocityMap[item.sku] ?? 0;
        const days = vel > 0 ? Math.round(item.stock / vel) : 999;
        return { name: item.name?.slice(0, 18) || item.sku, days, sku: item.sku };
      })
      .filter(i => i.days < 999)
      .sort((a, b) => a.days - b.days)
      .slice(0, 8);
  })();

  const stockHealthColors = (days: number) => {
    if (days <= 3) return '#D60001';
    if (days <= 7) return '#F59E0B';
    if (days <= 14) return '#3B82F6';
    return '#10B981';
  };

  // Alerts
  const smartAlerts = buildSmartAlerts({ invItems, velocityMap, leadTimeMap, hppMap, capitalHealth, stockFlow, preEventAlerts, poKpis });

  const alertBorderColor: Record<SmartAlert['level'], string> = {
    URGENT: '#D60001',
    WARNING: '#F59E0B',
    INFO: '#3B82F6',
    PELUANG: '#10B981',
  };
  const alertBgColor: Record<SmartAlert['level'], string> = {
    URGENT: '#FEF2F2',
    WARNING: '#FFFBEB',
    INFO: '#EFF6FF',
    PELUANG: '#F0FDF4',
  };
  const alertTextColor: Record<SmartAlert['level'], string> = {
    URGENT: '#B91C1C',
    WARNING: '#92400E',
    INFO: '#1E40AF',
    PELUANG: '#065F46',
  };
  const alertLabelColor: Record<SmartAlert['level'], string> = {
    URGENT: '#D60001',
    WARNING: '#F59E0B',
    INFO: '#3B82F6',
    PELUANG: '#10B981',
  };

  // Modal ratio for KPI card
  const modalRatio = capitalHealth ? `${(capitalHealth.capitalRatio * 100).toFixed(1)}%` : '—';
  const modalRatioStatus = capitalHealth ? capitalHealth.status : null;
  const modalRatioColor = modalRatioStatus === 'SEHAT' ? '#10B981' : modalRatioStatus === 'WASPADA' ? '#F59E0B' : modalRatioStatus === 'BAHAYA' ? '#D60001' : '#6B7280';

  // Stok kritis count with velocity
  const kritisCount = invItems.filter(item => {
    const vel = velocityMap[item.sku] ?? 0;
    const lt = leadTimeMap[item.sku] ?? leadTimeMap['__default__'] ?? 3;
    if (vel <= 0) return false;
    return item.stock / vel <= lt;
  }).length;

  return (
    <div className="page-root" style={{ background: '#F7F8FA', minHeight: '100vh', padding: '28px 28px 48px', maxWidth: 1240, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>Dashboard</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
            {dateStr}
            {lastSync && (
              <span style={{ marginLeft: 10, color: '#9CA3AF' }}>
                · Sync terakhir: {lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={async () => {
            setSyncing(true);
            await loadData();
            setSyncing(false);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', borderRadius: 8,
            background: '#D60001', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 1px 4px rgba(214,0,1,0.25)',
            opacity: syncing ? 0.7 : 1,
          }}
        >
          <IconSync />
          {syncing ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280', fontSize: 14 }}>
          Memuat data Jubelio...
        </div>
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────────────── */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>

            {/* KPI 1: Total SKU Aktif */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px 20px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D60001' }}>
                  <IconSKU />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>Live</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>Total SKU Aktif</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>{invItems.length}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>SKU terdaftar di Jubelio</div>
            </div>

            {/* KPI 2: Stok Kritis */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px 20px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <IconAlert />
                </div>
                {kritisCount > 0
                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#FEF2F2', color: '#D60001' }}>Perlu Tindakan</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#F0FDF4', color: '#10B981' }}>Aman</span>
                }
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>Stok Kritis</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: kritisCount > 0 ? '#D60001' : '#111827', letterSpacing: '-0.5px' }}>{kritisCount}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>SKU di bawah lead time</div>
            </div>

            {/* KPI 3: PO Pending */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px 20px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <IconPO />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>{poKpis.pendingCount} PO</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>PO Pending</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>{formatRupiah(poKpis.pending)}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Belum dibayar</div>
            </div>

            {/* KPI 4: Modal Ratio */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px 20px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <IconModal />
                </div>
                {modalRatioStatus && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: modalRatioStatus === 'SEHAT' ? '#F0FDF4' : modalRatioStatus === 'WASPADA' ? '#FFFBEB' : '#FEF2F2', color: modalRatioColor }}>{modalRatioStatus}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4 }}>Modal Ratio</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: modalRatioColor, letterSpacing: '-0.5px' }}>{modalRatio}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Nilai stok aktual vs awal bulan</div>
            </div>
          </div>

          {/* ── PO Jatuh Tempo Banner ───────────────────────── */}
          {(() => {
            const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
            const dueThisWeek = poKpis.pendingItems.filter(p => {
              if (!p.dueDate) return false;
              const d = new Date(p.dueDate);
              return d >= today && d <= weekEnd;
            });
            const overdueItems = poKpis.pendingItems.filter(p => {
              if (!p.dueDate) return false;
              return new Date(p.dueDate) < today;
            });
            if (dueThisWeek.length === 0 && overdueItems.length === 0) return null;
            const totalDue = dueThisWeek.reduce((s, p) => s + p.total, 0);
            const totalOverdue = overdueItems.reduce((s, p) => s + p.total, 0);
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                {overdueItems.length > 0 && (
                  <div style={{ flex: 1, minWidth: 240, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D60001" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>{overdueItems.length} PO Terlambat Bayar</div>
                      <div style={{ fontSize: 12, color: '#DC2626' }}>{formatRupiah(totalOverdue)} — hubungi supplier segera</div>
                    </div>
                    <Link href="/po-budget" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#D60001', textDecoration: 'none', whiteSpace: 'nowrap' }}>Lihat →</Link>
                  </div>
                )}
                {dueThisWeek.length > 0 && (
                  <div style={{ flex: 1, minWidth: 240, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>{dueThisWeek.length} PO Jatuh Tempo Minggu Ini</div>
                      <div style={{ fontSize: 12, color: '#B45309' }}>{formatRupiah(totalDue)} perlu disiapkan</div>
                    </div>
                    <Link href="/po-budget" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#D97706', textDecoration: 'none', whiteSpace: 'nowrap' }}>Lihat →</Link>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Stock Level Ticker ──────────────────────────── */}
          {hasVelocity && (() => {
            const reorderItems = invItems.filter(item => {
              const vel = velocityMap[item.sku] ?? 0;
              const lt = leadTimeMap[item.sku] ?? leadTimeMap['__default__'] ?? 3;
              if (vel <= 0) return false;
              const days = item.stock / vel;
              return days > lt && days <= lt * 1.5;
            }).length;
            const safeItems = invItems.filter(item => {
              const vel = velocityMap[item.sku] ?? 0;
              const lt = leadTimeMap[item.sku] ?? leadTimeMap['__default__'] ?? 3;
              if (vel <= 0) return false;
              return item.stock / vel > lt * 1.5;
            }).length;

            const tiers: { label: string; count: number; color: string; bg: string; border: string; filter: string }[] = [
              { label: 'Kritis', count: kritisCount, color: '#D60001', bg: '#FEF2F2', border: '#FECACA', filter: 'REORDER_NOW' },
              { label: 'Perlu Reorder', count: reorderItems, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', filter: 'PREPARE' },
              { label: 'Aman', count: safeItems, color: '#059669', bg: '#F0FDF4', border: '#A7F3D0', filter: 'SAFE' },
            ];

            return (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {tiers.map(tier => (
                  <a
                    key={tier.label}
                    href={`/planner?filter=${tier.filter}`}
                    style={{
                      flex: 1, minWidth: 130,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 10,
                      textDecoration: 'none', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: tier.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: tier.color }}>{tier.count}</span>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{tier.label}</span>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </a>
                ))}
              </div>
            );
          })()}

          {/* ── Smart Alerts ────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px 20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Analisa Hari Ini</div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: smartAlerts.filter(a => a.level === 'URGENT').length > 0 ? '#FEF2F2' : '#F3F4F6', color: smartAlerts.filter(a => a.level === 'URGENT').length > 0 ? '#D60001' : '#6B7280' }}>
                  {smartAlerts.filter(a => a.level === 'URGENT').length > 0 ? `${smartAlerts.filter(a => a.level === 'URGENT').length} URGENT` : `${smartAlerts.length} notifikasi`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                {lastSync ? `Diperbarui ${lastSync.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Diperbarui otomatis'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(showAllAlerts ? smartAlerts : smartAlerts.slice(0, 5)).map((alert, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '11px 14px',
                    background: alertBgColor[alert.level],
                    borderRadius: 8,
                    borderLeft: `4px solid ${alertBorderColor[alert.level]}`,
                  }}
                >
                  <AlertDot color={alertLabelColor[alert.level]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: alertTextColor[alert.level], lineHeight: 1.4 }}>{alert.title}</div>
                    {alert.detail && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.detail}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: alertBorderColor[alert.level] + '1A',
                    color: alertLabelColor[alert.level],
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{alert.level}</span>
                </div>
              ))}
            </div>
            {smartAlerts.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllAlerts(p => !p)}
                style={{ marginTop: 10, width: '100%', padding: '8px', background: 'none', border: '1px solid #E4E7ED', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#6B7280', fontWeight: 500 }}
              >
                {showAllAlerts ? 'Tampilkan lebih sedikit ▲' : `Lihat ${smartAlerts.length - 5} notifikasi lainnya ▼`}
              </button>
            )}
          </div>

          {/* ── Two column: Stock Health Chart + Recent POs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* Stock Health Bar Chart */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Stock Health</div>
                <Link href="/inventory" style={{ fontSize: 12, color: '#D60001', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                  Lihat Semua <IconChevron />
                </Link>
              </div>
              {stockHealthData.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  {hasVelocity ? 'Semua stok aman.' : 'Lengkapi data velocity di Settings untuk melihat grafik ini.'}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Hari tersisa per SKU (terendah = paling kritis)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stockHealthData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} width={110} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v) => [`${v} hari`, 'Sisa Stok']}
                        contentStyle={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 8, fontSize: 12 }}
                        cursor={{ fill: '#F3F4F6' }}
                      />
                      <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={14}>
                        {stockHealthData.map((entry, index) => (
                          <Cell key={index} fill={stockHealthColors(entry.days)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                    {[
                      { color: '#D60001', label: '≤3 hari (Kritis)' },
                      { color: '#F59E0B', label: '≤7 hari (Waspada)' },
                      { color: '#3B82F6', label: '≤14 hari' },
                      { color: '#10B981', label: '>14 hari (Aman)' },
                    ].map(l => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: '#6B7280' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Recent POs Table */}
            <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Recent POs</div>
                <Link href="/po-budget" style={{ fontSize: 12, color: '#D60001', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                  Lihat Semua <IconChevron />
                </Link>
              </div>
              {poItems.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Belum ada Purchase Order.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['PO Number', 'Supplier', 'Total', 'Status', 'Due Date'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#9CA3AF', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {poItems.slice(0, 7).map((p, i) => {
                        const st = mapStatus(p.status);
                        const badgeBg = st === 'Lunas' ? '#F0FDF4' : st === 'Batal' ? '#F3F4F6' : '#FFFBEB';
                        const badgeColor = st === 'Lunas' ? '#10B981' : st === 'Batal' ? '#9CA3AF' : '#F59E0B';
                        const due = p.dueDate ? new Date(p.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
                        return (
                          <tr key={p.id} style={{ borderBottom: i < Math.min(poItems.length, 7) - 1 ? '1px solid #F9FAFB' : 'none' }}>
                            <td style={{ padding: '9px 8px', color: '#374151', fontWeight: 600 }}>{p.poNumber || p.id?.slice(0, 8)}</td>
                            <td style={{ padding: '9px 8px', color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.supplier || '—'}</td>
                            <td style={{ padding: '9px 8px', color: '#111827', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRupiah(p.total)}</td>
                            <td style={{ padding: '9px 8px' }}>
                              <span style={{ background: badgeBg, color: badgeColor, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{st}</span>
                            </td>
                            <td style={{ padding: '9px 8px', color: '#6B7280', whiteSpace: 'nowrap' }}>{due}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Quick Links ──────────────────────────────────── */}
          <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 14 }}>Akses Cepat</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {[
                { href: '/inventory', label: 'Inventory', desc: `${invItems.length} SKU aktif`, accentColor: '#D60001', iconBg: '#FEF2F2',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
                { href: '/planner', label: 'Purchase Planner', desc: 'Buat & kelola draft PO', accentColor: '#3B82F6', iconBg: '#EFF6FF',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg> },
                { href: '/cogs', label: 'COGS & Margin', desc: `Avg margin ${invKpis.avgMargin.toFixed(1)}%`, accentColor: '#8B5CF6', iconBg: '#F5F3FF',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg> },
                { href: '/suppliers', label: 'Supplier Hub', desc: `${suppliers.length} supplier terdaftar`, accentColor: '#10B981', iconBg: '#F0FDF4',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1.5"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
                { href: '/po-budget', label: 'PO & Budget', desc: `${poKpis.pendingCount} PO pending`, accentColor: '#F59E0B', iconBg: '#FFFBEB',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="7" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="17" y2="15"/></svg> },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: '#FAFAFA',
                    border: '1px solid #E4E7ED',
                    borderRadius: 10,
                    textDecoration: 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = '#FAFAFA'; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: link.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: link.accentColor }}>
                    {link.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{link.label}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
