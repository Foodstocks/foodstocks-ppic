'use client';

import { useState, useEffect } from 'react';
import { formatRupiah } from '@/lib/calculations';

interface JubelioSupplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface POItem {
  id: string;
  supplier: string;
  total: number;
  status: string;
  orderDate: string;
  dueDate: string;
}

interface SupplierScore {
  totalPOs: number;
  totalSpend: number;
  avgPOValue: number;
  lunasRate: number;
  pendingValue: number;
  lastOrderDate: string | null;
  grade: 'A' | 'B' | 'C' | 'D';
}

function calcGrade(score: SupplierScore): 'A' | 'B' | 'C' | 'D' {
  if (score.totalPOs === 0) return 'D';
  if (score.lunasRate >= 80 && score.totalPOs >= 3) return 'A';
  if (score.lunasRate >= 60 && score.totalPOs >= 2) return 'B';
  if (score.lunasRate >= 40) return 'C';
  return 'D';
}

function mapStatus(raw: string): 'Lunas' | 'Batal' | 'Pending' {
  const lower = raw.toLowerCase();
  if (lower.includes('closed') || lower.includes('completed') || lower.includes('lunas')) return 'Lunas';
  if (lower.includes('cancelled') || lower.includes('cancel') || lower.includes('batal')) return 'Batal';
  return 'Pending';
}

const s = {
  page: { padding: '24px', maxWidth: 1200 } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th: { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td: { padding: '12px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' } as React.CSSProperties),
  btn: { padding: '7px 14px', borderRadius: 8, border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151' } as React.CSSProperties,
};

const gradeConfig: Record<string, { bg: string; color: string; label: string }> = {
  A: { bg: '#F0FDF4', color: '#10B981', label: 'A — Terpercaya' },
  B: { bg: '#EFF6FF', color: '#3B82F6', label: 'B — Baik' },
  C: { bg: '#FFFBEB', color: '#F59E0B', label: 'C — Perlu Evaluasi' },
  D: { bg: '#F9FAFB', color: '#6B7280', label: 'D — Belum Ada Data' },
};

// Icons
const IconSupplier = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13"/>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IconTotal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconEmail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconGrade = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconSpend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconScorecard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<JubelioSupplier[]>([]);
  const [poItems, setPoItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'scorecard'>('scorecard');
  const [filterGrade, setFilterGrade] = useState('ALL');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [supRes, poRes] = await Promise.allSettled([
          fetch('/api/jubelio/suppliers').then(r => r.json()),
          fetch('/api/jubelio/pos').then(r => r.json()),
        ]);
        if (supRes.status === 'fulfilled' && supRes.value.success) setSuppliers(supRes.value.data);
        else if (supRes.status === 'rejected') throw new Error('Gagal memuat supplier');
        if (poRes.status === 'fulfilled' && poRes.value.success) setPoItems(poRes.value.data);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const scorecardMap: Record<string, SupplierScore> = {};
  for (const po of poItems) {
    const supName = po.supplier || 'Unknown';
    if (!scorecardMap[supName]) {
      scorecardMap[supName] = { totalPOs: 0, totalSpend: 0, avgPOValue: 0, lunasRate: 0, pendingValue: 0, lastOrderDate: null, grade: 'D' };
    }
    const sc = scorecardMap[supName];
    sc.totalPOs++;
    sc.totalSpend += po.total;
    const st = mapStatus(po.status);
    if (st === 'Pending') sc.pendingValue += po.total;
    if (po.orderDate && (!sc.lastOrderDate || po.orderDate > sc.lastOrderDate)) sc.lastOrderDate = po.orderDate;
  }
  for (const [name, sc] of Object.entries(scorecardMap)) {
    sc.avgPOValue = sc.totalPOs > 0 ? Math.round(sc.totalSpend / sc.totalPOs) : 0;
    const lunasPOs = poItems.filter(p => p.supplier === name && mapStatus(p.status) === 'Lunas').length;
    sc.lunasRate = sc.totalPOs > 0 ? Math.round(lunasPOs / sc.totalPOs * 100) : 0;
    sc.grade = calcGrade(sc);
  }

  const enriched = suppliers.map(sup => ({
    ...sup,
    score: scorecardMap[sup.name] ?? { totalPOs: 0, totalSpend: 0, avgPOValue: 0, lunasRate: 0, pendingValue: 0, lastOrderDate: null, grade: 'D' as const },
  }));

  const filtered = enriched.filter(sup => {
    const matchSearch = !search || sup.name.toLowerCase().includes(search.toLowerCase());
    const matchGrade = filterGrade === 'ALL' || sup.score.grade === filterGrade;
    return matchSearch && matchGrade;
  });

  const sortedBySpend = [...filtered].sort((a, b) => b.score.totalSpend - a.score.totalSpend);

  const kpis = {
    total: suppliers.length,
    withEmail: suppliers.filter(s => s.email).length,
    gradeA: enriched.filter(s => s.score.grade === 'A').length,
    totalSpend: Object.values(scorecardMap).reduce((sum, sc) => sum + sc.totalSpend, 0),
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
            <IconSupplier />
          </div>
          <div style={s.title}>Supplier Hub</div>
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>
          Data supplier dari Jubelio WMS · Scorecard dari histori PO
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Supplier', value: `${kpis.total}`, color: '#3b82f6', sub: 'Terdaftar di Jubelio', icon: <IconTotal /> },
          { label: 'Punya Email', value: `${kpis.withEmail}`, color: '#8b5cf6', sub: 'Bisa dihubungi via email', icon: <IconEmail /> },
          { label: 'Grade A', value: `${kpis.gradeA}`, color: '#10b981', sub: 'Supplier terpercaya', icon: <IconGrade /> },
          { label: 'Total Pembelian', value: formatRupiah(kpis.totalSpend), color: '#f97316', sub: 'Dari semua histori PO', icon: <IconSpend /> },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.8, fontWeight: 600 }}>{k.label}</div>
              <div style={{ color: k.color, opacity: 0.8 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Cari nama supplier..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: '#F9FAFB', border: '1px solid #E4E7ED', borderRadius: 8, padding: '7px 14px', color: '#111827', fontSize: 13, outline: 'none', width: 220 }}
        />
        <div style={{ width: 1, height: 28, background: '#E4E7ED' }} />
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['scorecard', 'list'] as const).map(v => (
            <button type="button" key={v} onClick={() => setViewMode(v)} style={{
              ...s.btn, display: 'flex', alignItems: 'center', gap: 5,
              background: viewMode === v ? '#3b82f6' : '#fff',
              color: viewMode === v ? 'white' : '#374151',
              border: `1px solid ${viewMode === v ? '#3b82f6' : '#E4E7ED'}`,
            }}>
              {v === 'scorecard' ? <IconScorecard /> : <IconList />}
              {v === 'scorecard' ? 'Scorecard' : 'List'}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 28, background: '#E4E7ED' }} />
        {/* Grade filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['ALL', 'A', 'B', 'C', 'D'] as const).map(g => (
            <button type="button" key={g} onClick={() => setFilterGrade(g)} style={{
              ...s.btn,
              background: filterGrade === g ? (g === 'ALL' ? '#3b82f6' : gradeConfig[g]?.color ?? '#3b82f6') : '#fff',
              color: filterGrade === g ? 'white' : '#374151',
              border: `1px solid ${filterGrade === g ? (gradeConfig[g]?.color ?? '#3b82f6') : '#E4E7ED'}`,
            }}>
              {g === 'ALL' ? 'Semua' : `Grade ${g}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 48, color: '#6B7280' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #E4E7ED', borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14 }}>Memuat data Jubelio...</div>
        </div>
      ) : error ? (
        <div style={{ ...s.card, padding: '20px 24px', background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#ef4444' }}>
            <IconAlert />
            <span style={{ fontSize: 14 }}>{error}</span>
          </div>
        </div>
      ) : viewMode === 'scorecard' ? (
        <div style={s.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Supplier Scorecard</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
            Grade dihitung dari histori PO — frekuensi order dan % pembayaran lunas. Supplier tanpa histori PO otomatis Grade D.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nama Supplier', 'Grade', 'Total PO', 'Total Spend', 'Avg PO Value', 'Lunas Rate', 'Pending', 'Order Terakhir', 'Kontak'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBySpend.map(sup => {
                  const gc = gradeConfig[sup.score.grade];
                  return (
                    <tr key={sup.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{sup.name}</td>
                      <td style={s.td}><span style={s.badge(gc.bg, gc.color)}>{gc.label}</span></td>
                      <td style={s.td}>{sup.score.totalPOs > 0 ? sup.score.totalPOs : <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>
                        {sup.score.totalSpend > 0 ? formatRupiah(sup.score.totalSpend) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td style={s.td}>
                        {sup.score.avgPOValue > 0 ? formatRupiah(sup.score.avgPOValue) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td style={s.td}>
                        {sup.score.totalPOs > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 6, width: 60, background: '#E4E7ED', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${sup.score.lunasRate}%`, background: sup.score.lunasRate >= 80 ? '#10b981' : sup.score.lunasRate >= 60 ? '#3b82f6' : '#f59e0b', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12, color: sup.score.lunasRate >= 80 ? '#10b981' : sup.score.lunasRate >= 60 ? '#3b82f6' : '#f59e0b', fontWeight: 600 }}>
                              {sup.score.lunasRate}%
                            </span>
                          </div>
                        ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td style={{ ...s.td, color: sup.score.pendingValue > 0 ? '#f59e0b' : '#D1D5DB' }}>
                        {sup.score.pendingValue > 0 ? formatRupiah(sup.score.pendingValue) : '—'}
                      </td>
                      <td style={{ ...s.td, color: '#6B7280', fontSize: 12 }}>
                        {sup.score.lastOrderDate
                          ? new Date(sup.score.lastOrderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td style={{ ...s.td, color: '#374151' }}>
                        {sup.email
                          ? <a href={`mailto:${sup.email}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}>{sup.email}</a>
                          : sup.phone || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedBySpend.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>Tidak ada supplier yang cocok</div>
            )}
          </div>
        </div>
      ) : (
        <div style={s.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Nama Supplier', 'Email', 'Telepon', 'Alamat', 'Grade', 'Status'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sup => {
                  const gc = gradeConfig[sup.score.grade];
                  return (
                    <tr key={sup.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{sup.name}</td>
                      <td style={{ ...s.td, color: '#374151' }}>
                        {sup.email
                          ? <a href={`mailto:${sup.email}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}>{sup.email}</a>
                          : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td style={{ ...s.td, color: '#374151' }}>{sup.phone || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={{ ...s.td, color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{sup.address || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={s.td}><span style={s.badge(gc.bg, gc.color)}>{gc.label}</span></td>
                      <td style={s.td}><span style={s.badge('rgba(16,185,129,0.12)', '#10b981')}>Aktif</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
                {suppliers.length === 0 ? 'Tidak ada data supplier dari Jubelio' : 'Tidak ada supplier yang cocok'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grade Legend */}
      <div style={{ border: '1px solid #E4E7ED', borderRadius: 10, padding: '14px 16px', background: '#F9FAFB' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 10 }}>
          Kriteria Grade Supplier
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12, color: '#6B7280' }}>
          <div><span style={s.badge('#F0FDF4', '#10B981')}>A</span><span style={{ marginLeft: 8 }}>≥80% PO lunas, ≥3 PO</span></div>
          <div><span style={s.badge('#EFF6FF', '#3B82F6')}>B</span><span style={{ marginLeft: 8 }}>≥60% PO lunas, ≥2 PO</span></div>
          <div><span style={s.badge('#FFFBEB', '#F59E0B')}>C</span><span style={{ marginLeft: 8 }}>≥40% PO lunas</span></div>
          <div><span style={s.badge('#F9FAFB', '#6B7280')}>D</span><span style={{ marginLeft: 8 }}>Belum ada histori PO atau &lt;40% lunas</span></div>
        </div>
      </div>
    </div>
  );
}
