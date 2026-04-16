'use client';

import { formatRupiah } from '@/lib/calculations';
import { useState, useEffect } from 'react';

interface JubelioPO {
  id: string;
  poNumber: string;
  supplier: string;
  total: number;
  status: string;
  orderDate: string;
  dueDate: string;
  paymentTerms: string;
  items: { sku: string; name: string; qty: number; price: number }[];
}

interface DisplayPO extends JubelioPO {
  displayStatus: 'Lunas' | 'Batal' | 'Pending';
}

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' }),
};

const statusCfg: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  Lunas:   { bg: '#F0FDF4', color: '#10B981', label: 'Lunas',   dot: '#10b981' },
  Pending: { bg: '#FFFBEB', color: '#F59E0B', label: 'Pending', dot: '#f59e0b' },
  Batal:   { bg: '#FEF2F2', color: '#D60001', label: 'Batal',   dot: '#ef4444' },
};

function mapStatus(raw: string): 'Lunas' | 'Batal' | 'Pending' {
  const lower = raw.toLowerCase();
  if (lower.includes('closed') || lower.includes('completed') || lower.includes('lunas')) return 'Lunas';
  if (lower.includes('cancelled') || lower.includes('cancel') || lower.includes('batal')) return 'Batal';
  return 'Pending';
}

function groupByWeek(pos: DisplayPO[]): { week: string; total: number; lunas: number; pending: number }[] {
  const weeks: Record<number, { total: number; lunas: number; pending: number }> = {
    1: { total: 0, lunas: 0, pending: 0 }, 2: { total: 0, lunas: 0, pending: 0 },
    3: { total: 0, lunas: 0, pending: 0 }, 4: { total: 0, lunas: 0, pending: 0 },
  };
  pos.forEach(po => {
    const d = po.orderDate ? new Date(po.orderDate) : null;
    const day = d && !isNaN(d.getTime()) ? d.getDate() : 1;
    const wk = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
    weeks[wk].total += po.total;
    if (po.displayStatus === 'Lunas') weeks[wk].lunas += po.total;
    else weeks[wk].pending += po.total;
  });
  return [
    { week: 'M1 (1–7)', ...weeks[1] }, { week: 'M2 (8–14)', ...weeks[2] },
    { week: 'M3 (15–21)', ...weeks[3] }, { week: 'M4 (22+)', ...weeks[4] },
  ];
}

function formatMonth(ym: string) {
  return new Date(ym + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// SVG Icons
const IconPO = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconWallet = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
);
const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13"/>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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

export default function POBudgetPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [poList, setPoList] = useState<DisplayPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(50_000_000);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const today = new Date();
  const todayMs = today.getTime();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('foodstocks_budget_po');
      if (raw) {
        const val = Number(JSON.parse(raw));
        if (!isNaN(val) && val > 0) setMonthlyBudget(val);
      }
    } catch { /* ignore */ }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/jubelio/pos');
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Gagal memuat data PO');
        const mapped: DisplayPO[] = (json.data as JubelioPO[]).map(po => ({
          ...po,
          displayStatus: mapStatus(po.status),
        }));
        setPoList(mapped);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function saveBudget() {
    const val = Number(budgetInput.replace(/\D/g, ''));
    if (!isNaN(val) && val > 0) {
      setMonthlyBudget(val);
      localStorage.setItem('foodstocks_budget_po', JSON.stringify(val));
    }
    setEditingBudget(false);
  }

  function prevMonth() {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
    setPage(1);
  }
  function nextMonth() {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() + 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
    setPage(1);
  }

  const currentMonthISO = new Date().toISOString().slice(0, 7);
  const monthPOs = poList.filter(p => p.orderDate?.slice(0, 7) === selectedMonth);

  const totalBudget = monthPOs.reduce((sum, p) => sum + p.total, 0);
  const lunas = monthPOs.filter(p => p.displayStatus === 'Lunas').reduce((sum, p) => sum + p.total, 0);
  const pending = monthPOs.filter(p => p.displayStatus === 'Pending').reduce((sum, p) => sum + p.total, 0);
  const budgetUsed = (totalBudget / monthlyBudget) * 100;

  // Overdue & upcoming this week (from all months, pending only)
  const allPending = poList.filter(p => p.displayStatus === 'Pending' && p.dueDate);
  const overduePOs = allPending.filter(p => {
    const d = new Date(p.dueDate);
    return !isNaN(d.getTime()) && d.getTime() < todayMs;
  });
  const upcomingPOs = allPending.filter(p => {
    const d = new Date(p.dueDate);
    const diff = (d.getTime() - todayMs) / (1000 * 60 * 60 * 24);
    return !isNaN(d.getTime()) && diff >= 0 && diff <= 7;
  });
  const overdueTotal = overduePOs.reduce((sum, p) => sum + p.total, 0);
  const upcomingTotal = upcomingPOs.reduce((sum, p) => sum + p.total, 0);

  const filtered = filterStatus === 'ALL' ? monthPOs : monthPOs.filter(p => p.displayStatus === filterStatus);

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

  const bySupplier = monthPOs.reduce((acc, p) => {
    if (!acc[p.supplier]) acc[p.supplier] = 0;
    acc[p.supplier] += p.total;
    return acc;
  }, {} as Record<string, number>);
  const supplierList = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]);
  const weeklySpend = groupByWeek(monthPOs);

  return (
    <div className="page-root" style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            <IconPO />
          </div>
          <div style={s.title}>PO & Budget</div>
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>
          Rencana pembelian bulanan, status pembayaran, dan cashflow
        </div>
      </div>

      {/* Overdue / Upcoming Alerts */}
      {!loading && overduePOs.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ color: '#ef4444', marginTop: 1, flexShrink: 0 }}><IconAlert /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#991B1B', fontSize: 13, marginBottom: 2 }}>
              {overduePOs.length} PO Melewati Jatuh Tempo · Total {formatRupiah(overdueTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#B91C1C' }}>
              {overduePOs.slice(0, 3).map(p => p.poNumber || p.id).join(', ')}{overduePOs.length > 3 ? ` + ${overduePOs.length - 3} lainnya` : ''} — segera lakukan pembayaran
            </div>
          </div>
        </div>
      )}
      {!loading && upcomingPOs.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }}><IconAlert /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#92400E', fontSize: 13, marginBottom: 2 }}>
              {upcomingPOs.length} PO Jatuh Tempo Minggu Ini · Total {formatRupiah(upcomingTotal)}
            </div>
            <div style={{ fontSize: 12, color: '#B45309' }}>
              {upcomingPOs.slice(0, 3).map(p => p.poNumber || p.id).join(', ')}{upcomingPOs.length > 3 ? ` + ${upcomingPOs.length - 3} lainnya` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={prevMonth}
          style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #E4E7ED', background: '#F9FAFB', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconChevronLeft />
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', minWidth: 180, textAlign: 'center' }}>{formatMonth(selectedMonth)}</div>
        <button
          type="button"
          onClick={nextMonth}
          disabled={selectedMonth >= currentMonthISO}
          style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #E4E7ED', background: '#F9FAFB', color: '#374151', cursor: selectedMonth >= currentMonthISO ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: selectedMonth >= currentMonthISO ? 0.35 : 1 }}
        >
          <IconChevronRight />
        </button>
        {selectedMonth !== currentMonthISO && (
          <button
            type="button"
            onClick={() => { setSelectedMonth(currentMonthISO); setPage(1); }}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.08)', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Bulan Ini
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{monthPOs.length} PO bulan ini &nbsp;·&nbsp; {poList.length} total</span>
      </div>

      {/* Budget Tracker */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: '#3b82f6' }}><IconWallet /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Budget Tracker — {formatMonth(selectedMonth)}</div>
          </div>
          {editingBudget ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Rp</span>
              <input
                type="text"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') setEditingBudget(false); }}
                placeholder="Masukkan budget"
                autoFocus
                style={{ border: '1px solid #3b82f6', borderRadius: 6, padding: '5px 10px', fontSize: 13, width: 160, outline: 'none' }}
              />
              <button type="button" onClick={saveBudget} style={{ padding: '5px 12px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Simpan</button>
              <button type="button" onClick={() => setEditingBudget(false)} style={{ padding: '5px 10px', borderRadius: 6, background: '#F3F4F6', color: '#374151', border: 'none', fontSize: 12, cursor: 'pointer' }}>Batal</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setBudgetInput(String(monthlyBudget)); setEditingBudget(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#F9FAFB', color: '#374151', cursor: 'pointer', fontSize: 12 }}
            >
              <IconEdit />
              Ubah Budget
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Budget Bulanan', value: formatRupiah(monthlyBudget), color: '#3b82f6', sub: 'Ditetapkan tim' },
            { label: 'Total PO', value: formatRupiah(totalBudget), color: '#111827', sub: `${monthPOs.length} PO bulan ini` },
            { label: 'Sudah Lunas', value: formatRupiah(lunas), color: '#10b981', sub: `${monthPOs.filter(p => p.displayStatus === 'Lunas').length} PO selesai` },
            { label: 'Belum Bayar', value: formatRupiah(pending), color: '#f59e0b', sub: `${monthPOs.filter(p => p.displayStatus === 'Pending').length} PO pending` },
            { label: 'Sisa Budget', value: formatRupiah(monthlyBudget - totalBudget), color: monthlyBudget - totalBudget < 0 ? '#ef4444' : '#06b6d4', sub: monthlyBudget - totalBudget < 0 ? 'Over budget!' : 'Belum digunakan' },
          ].map(k => (
            <div key={k.label} style={{ padding: 14, background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: '#374151', fontWeight: 500 }}>Penggunaan Budget: <strong>{budgetUsed.toFixed(1)}%</strong></span>
          <span style={{ color: budgetUsed > 100 ? '#ef4444' : budgetUsed > 90 ? '#ef4444' : budgetUsed > 75 ? '#f59e0b' : '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            {budgetUsed > 100
              ? <><IconAlert /> Over Budget</>
              : budgetUsed > 90
              ? <><IconAlert /> Hampir Habis</>
              : budgetUsed > 75
              ? 'Perhatikan'
              : <><IconCheck /> Aman</>
            }
          </span>
        </div>
        <div style={{ height: 10, background: '#E4E7ED', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, budgetUsed)}%`, height: '100%', background: budgetUsed > 90 ? '#ef4444' : budgetUsed > 75 ? '#f59e0b' : '#10b981', borderRadius: 5, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Weekly Spend */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ color: '#3b82f6' }}><IconTrend /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Spend per Minggu</div>
          </div>
          {weeklySpend.every(w => w.total === 0) ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada data bulan ini</div>
          ) : (
            <>
              {weeklySpend.map(w => {
                const maxVal = Math.max(...weeklySpend.map(x => x.total), 1);
                return (
                  <div key={w.week} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: '#374151', fontWeight: 500 }}>{w.week}</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{formatRupiah(w.total)}</span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${(w.lunas / maxVal) * 100}%`, height: '100%', background: '#10b981' }} />
                      <div style={{ width: `${(w.pending / maxVal) * 100}%`, height: '100%', background: '#f59e0b' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Lunas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                  Pending
                </span>
              </div>
            </>
          )}
        </div>

        {/* Spend by Supplier */}
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ color: '#8b5cf6' }}><IconTruck /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Spend per Supplier</div>
          </div>
          {supplierList.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Belum ada data bulan ini</div>
          ) : (
            supplierList.map(([sup, total]) => {
              const pct = totalBudget > 0 ? (total / totalBudget) * 100 : 0;
              return (
                <div key={sup} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#374151', fontWeight: 500 }}>{sup || '(tidak diketahui)'}</span>
                    <span style={{ color: '#111827', fontWeight: 600 }}>{formatRupiah(total)} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#8b5cf6', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PO Table */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Daftar Purchase Orders</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['ALL', 'Lunas', 'Pending', 'Batal'] as const).map(f => {
              const count = f === 'ALL' ? monthPOs.length : monthPOs.filter(p => p.displayStatus === f).length;
              const dot = f !== 'ALL' ? statusCfg[f]?.dot : undefined;
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => { setFilterStatus(f); resetPage(); }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: `1px solid ${filterStatus === f ? '#3b82f6' : '#E4E7ED'}`,
                    background: filterStatus === f ? '#3b82f6' : '#fff',
                    color: filterStatus === f ? 'white' : '#374151',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: filterStatus === f ? 'rgba(255,255,255,0.8)' : dot, display: 'inline-block' }} />}
                  {f === 'ALL' ? `Semua (${count})` : `${f} (${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #E4E7ED', borderTopColor: '#3b82f6', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14 }}>Memuat data Jubelio...</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ef4444', fontSize: 14 }}>
            <div style={{ marginBottom: 8, color: '#ef4444', display: 'flex', justifyContent: 'center' }}><IconAlert /></div>
            Gagal memuat data: {error}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['No. PO', 'Supplier', 'Total', 'Tgl Order', 'Jatuh Tempo', 'Terms', 'Status'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(po => {
                    const due = po.dueDate ? new Date(po.dueDate) : null;
                    const diffDays = due && !isNaN(due.getTime()) ? Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24)) : null;
                    const isOverdue = po.displayStatus === 'Pending' && diffDays !== null && diffDays < 0;
                    const isDueSoon = po.displayStatus === 'Pending' && diffDays !== null && diffDays >= 0 && diffDays <= 3;
                    const cfg = statusCfg[po.displayStatus] ?? statusCfg['Pending'];
                    return (
                      <tr key={po.id} style={{ background: isOverdue ? 'rgba(239,68,68,0.04)' : po.displayStatus === 'Batal' ? 'rgba(156,163,175,0.05)' : 'transparent' }}>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{po.poNumber || po.id}</td>
                        <td style={{ ...s.td, color: '#374151' }}>{po.supplier || '—'}</td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{formatRupiah(po.total)}</td>
                        <td style={{ ...s.td, color: '#6B7280' }}>{formatDate(po.orderDate)}</td>
                        <td style={{ ...s.td }}>
                          <div style={{ fontWeight: isDueSoon || isOverdue ? 600 : 400, color: isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : '#374151' }}>
                            {formatDate(po.dueDate)}
                          </div>
                          {po.displayStatus === 'Pending' && diffDays !== null && (
                            <div style={{ fontSize: 11, marginTop: 2, color: isOverdue ? '#ef4444' : isDueSoon ? '#f59e0b' : '#9CA3AF', fontWeight: 600 }}>
                              {isOverdue ? `Telat ${Math.abs(diffDays)} hari` : `H-${diffDays}`}
                            </div>
                          )}
                        </td>
                        <td style={{ ...s.td, color: '#374151' }}>{po.paymentTerms || '—'}</td>
                        <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
                  {poList.length === 0
                    ? 'Tidak ada data PO dari Jubelio'
                    : monthPOs.length === 0
                    ? `Tidak ada PO di ${formatMonth(selectedMonth)}`
                    : 'Tidak ada PO yang cocok dengan filter'}
                </div>
              )}
            </div>

            {/* Pagination */}
            {filtered.length > perPage && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  Menampilkan <strong style={{ color: '#111827' }}>{(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)}</strong> dari <strong style={{ color: '#111827' }}>{filtered.length}</strong> PO
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    title="Jumlah PO per halaman"
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); resetPage(); }}
                    style={{ border: '1px solid #E4E7ED', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' }}
                  >
                    {[25, 50, 100].map(n => <option key={n} value={n}>{n} / hal</option>)}
                  </select>
                  <button type="button" onClick={() => setPage(1)} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>«</button>
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === 1 ? '#D1D5DB' : '#374151', cursor: safePage === 1 ? 'default' : 'pointer', fontSize: 13 }}>‹</button>
                  {pageNumbers.map((n, i) =>
                    n === '…'
                      ? <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', fontSize: 13, color: '#9CA3AF' }}>…</span>
                      : <button type="button" key={n} onClick={() => setPage(n as number)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${safePage === n ? '#3b82f6' : '#E4E7ED'}`, background: safePage === n ? '#3b82f6' : '#fff', color: safePage === n ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: safePage === n ? 600 : 400 }}>{n}</button>
                  )}
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === totalPages ? '#D1D5DB' : '#374151', cursor: safePage === totalPages ? 'default' : 'pointer', fontSize: 13 }}>›</button>
                  <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E4E7ED', background: '#fff', color: safePage === totalPages ? '#D1D5DB' : '#374151', cursor: safePage === totalPages ? 'default' : 'pointer', fontSize: 13 }}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
