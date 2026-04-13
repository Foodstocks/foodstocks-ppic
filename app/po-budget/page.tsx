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
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 20, marginBottom: 20 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, display: 'inline-block' }),
};

const statusCfg: Record<string, { bg: string; color: string; label: string }> = {
  Lunas: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: '✅ Lunas' },
  Pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '⏳ Pending' },
  Batal: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: '❌ Batal' },
};

function mapStatus(raw: string): 'Lunas' | 'Batal' | 'Pending' {
  const lower = raw.toLowerCase();
  if (lower.includes('closed') || lower.includes('completed') || lower.includes('lunas')) return 'Lunas';
  if (lower.includes('cancelled') || lower.includes('cancel') || lower.includes('batal')) return 'Batal';
  return 'Pending';
}

// Group POs by week of month based on orderDate
function groupByWeek(pos: DisplayPO[]): { week: string; total: number; lunas: number; pending: number }[] {
  const weeks: Record<number, { total: number; lunas: number; pending: number }> = { 1: { total: 0, lunas: 0, pending: 0 }, 2: { total: 0, lunas: 0, pending: 0 }, 3: { total: 0, lunas: 0, pending: 0 }, 4: { total: 0, lunas: 0, pending: 0 } };
  pos.forEach(po => {
    const d = po.orderDate ? new Date(po.orderDate) : null;
    const day = d && !isNaN(d.getTime()) ? d.getDate() : 1;
    const wk = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
    weeks[wk].total += po.total;
    if (po.displayStatus === 'Lunas') weeks[wk].lunas += po.total;
    else weeks[wk].pending += po.total;
  });
  return [
    { week: 'M1 (1-7)', ...weeks[1] },
    { week: 'M2 (8-14)', ...weeks[2] },
    { week: 'M3 (15-21)', ...weeks[3] },
    { week: 'M4 (22+)', ...weeks[4] },
  ];
}

function formatMonth(ym: string) {
  return new Date(ym + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export default function POBudgetPage() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [poList, setPoList] = useState<DisplayPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(50_000_000);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const today = new Date();

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

  function prevMonth() {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  }
  function nextMonth() {
    const d = new Date(selectedMonth + '-01');
    d.setMonth(d.getMonth() + 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  }

  // Filter by selected month
  const monthPOs = poList.filter(p => p.orderDate?.slice(0, 7) === selectedMonth);

  const totalBudget = monthPOs.reduce((s, p) => s + p.total, 0);
  const lunas = monthPOs.filter(p => p.displayStatus === 'Lunas').reduce((s, p) => s + p.total, 0);
  const pending = monthPOs.filter(p => p.displayStatus === 'Pending').reduce((s, p) => s + p.total, 0);
  const budgetUsed = (totalBudget / monthlyBudget) * 100;

  const filtered = (filterStatus === 'ALL' ? monthPOs : monthPOs.filter(p => p.displayStatus === filterStatus));

  const bySupplier = monthPOs.reduce((acc, p) => {
    if (!acc[p.supplier]) acc[p.supplier] = 0;
    acc[p.supplier] += p.total;
    return acc;
  }, {} as Record<string, number>);
  const supplierList = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]);

  const weeklySpend = groupByWeek(monthPOs);

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 16 }}>
        <div style={s.title}>📋 PO & Budget</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Rencana pembelian bulanan, status pembayaran, dan cashflow</div>
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>← Sebelumnya</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', minWidth: 180, textAlign: 'center' }}>{formatMonth(selectedMonth)}</div>
        <button onClick={nextMonth} disabled={selectedMonth >= new Date().toISOString().slice(0, 7)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: selectedMonth >= new Date().toISOString().slice(0, 7) ? 0.4 : 1 }}>Berikutnya →</button>
        {selectedMonth !== new Date().toISOString().slice(0, 7) && (
          <button onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Bulan Ini</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{monthPOs.length} PO · {poList.length} total semua bulan</span>
      </div>

      {/* Budget Tracker */}
      <div style={s.card}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>💰 Budget Tracker {formatMonth(selectedMonth)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Budget Bulanan', value: formatRupiah(monthlyBudget), color: '#3b82f6' },
            { label: 'Total PO', value: formatRupiah(totalBudget), color: 'var(--text-primary)' },
            { label: 'Sudah Lunas', value: formatRupiah(lunas), color: '#10b981' },
            { label: 'Belum Bayar', value: formatRupiah(pending), color: '#f59e0b' },
            { label: 'Sisa Budget', value: formatRupiah(monthlyBudget - totalBudget), color: '#06b6d4' },
          ].map(k => (
            <div key={k.label} style={{ padding: 14, background: 'var(--bg-hover)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color, margin: '6px 0' }}>{k.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Budget Used: {budgetUsed.toFixed(1)}%</span>
          <span style={{ color: budgetUsed > 90 ? '#ef4444' : budgetUsed > 75 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
            {budgetUsed > 90 ? '⚠️ Hampir Habis' : budgetUsed > 75 ? '📊 Perhatikan' : '✅ Aman'}
          </span>
        </div>
        <div style={{ height: 10, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, budgetUsed)}%`, height: '100%', background: budgetUsed > 90 ? '#ef4444' : budgetUsed > 75 ? '#f59e0b' : '#10b981', borderRadius: 5 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Weekly Spend Chart */}
        <div style={s.card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>📈 Spend per Minggu</div>
          {weeklySpend.map(w => {
            const maxVal = Math.max(...weeklySpend.map(x => x.total), 1);
            return (
              <div key={w.week} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{w.week}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatRupiah(w.total)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(w.lunas / maxVal) * 100}%`, height: '100%', background: '#10b981' }} />
                  <div style={{ width: `${(w.pending / maxVal) * 100}%`, height: '100%', background: '#f59e0b' }} />
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            <span>🟢 Lunas</span><span>🟡 Pending</span>
          </div>
        </div>

        {/* Spend by Supplier */}
        <div style={s.card}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>🏭 Spend per Supplier</div>
          {supplierList.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data</div>
          ) : (
            supplierList.map(([sup, total]) => {
              const pct = totalBudget > 0 ? (total / totalBudget) * 100 : 0;
              return (
                <div key={sup} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{sup || '(unknown)'}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatRupiah(total)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Daftar Purchase Orders</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'Lunas', 'Pending', 'Batal'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${filterStatus === f ? '#3b82f6' : 'var(--border)'}`,
                background: filterStatus === f ? '#3b82f6' : 'var(--bg-card)',
                color: filterStatus === f ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
                {f === 'ALL' ? `Semua (${monthPOs.length})` : `${f} (${monthPOs.filter(p => p.displayStatus === f).length})`}
              </button>
            ))}
          </div>
        </div>

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
                  {['No. PO', 'Supplier', 'Total', 'Tgl Order', 'Jatuh Tempo', 'Status', 'Terms'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(po => {
                  const due = po.dueDate ? new Date(po.dueDate) : null;
                  const diffDays = due && !isNaN(due.getTime()) ? Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const cfg = statusCfg[po.displayStatus] ?? statusCfg['Pending'];
                  return (
                    <tr key={po.id} style={{ background: po.displayStatus === 'Batal' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                      <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{po.poNumber || po.id}</td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{po.supplier || '—'}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{formatRupiah(po.total)}</td>
                      <td style={{ ...s.td, color: 'var(--text-muted)' }}>{po.orderDate || '—'}</td>
                      <td style={{ ...s.td, color: po.displayStatus === 'Pending' && diffDays !== null && diffDays <= 3 ? '#ef4444' : 'var(--text-primary)', fontWeight: po.displayStatus === 'Pending' ? 600 : 400 }}>
                        {po.dueDate || '—'}
                        {po.displayStatus === 'Pending' && diffDays !== null && (
                          <div style={{ fontSize: 10, color: diffDays <= 3 ? '#ef4444' : '#f59e0b' }}>H-{Math.max(0, diffDays)}</div>
                        )}
                      </td>
                      <td style={s.td}><span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span></td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{po.paymentTerms || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {poList.length === 0 ? 'Tidak ada data PO dari Jubelio' : monthPOs.length === 0 ? `Tidak ada PO di ${formatMonth(selectedMonth)}` : 'Tidak ada PO yang cocok dengan filter'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
