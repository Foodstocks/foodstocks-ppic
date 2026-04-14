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
  lunasRate: number; // % POs that are paid/completed
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

  // Build scorecard map from PO history
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

  // Merge suppliers with scorecard
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
    withPhone: suppliers.filter(s => s.phone).length,
    gradeA: enriched.filter(s => s.score.grade === 'A').length,
    totalSpend: Object.values(scorecardMap).reduce((s, sc) => s + sc.totalSpend, 0),
  };

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <div style={s.title}>🏭 Supplier Hub</div>
        <div style={{ fontSize: 14, color: '#6B7280' }}>Data supplier dari Jubelio WMS · Scorecard dari histori PO</div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Supplier', value: `${kpis.total}`, color: '#3b82f6' },
          { label: 'Punya Email', value: `${kpis.withEmail}`, color: '#8b5cf6' },
          { label: 'Grade A (Terpercaya)', value: `${kpis.gradeA}`, color: '#10b981' },
          { label: 'Total Pembelian', value: formatRupiah(kpis.totalSpend), color: '#f97316' },
        ].map(k => (
          <div key={k.label} style={{ ...s.card, marginBottom: 0, borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: '6px 0' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Cari nama supplier..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: '#F9FAFB', border: '1px solid #E4E7ED', borderRadius: 8, padding: '7px 14px', color: '#111827', fontSize: 13, outline: 'none', width: 220 }}
        />
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['scorecard', 'list'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              ...s.btn,
              background: viewMode === v ? '#3b82f6' : '#fff',
              color: viewMode === v ? 'white' : '#374151',
              border: `1px solid ${viewMode === v ? '#3b82f6' : '#E4E7ED'}`,
            }}>
              {v === 'scorecard' ? '📊 Scorecard' : '📋 List'}
            </button>
          ))}
        </div>
        {/* Grade filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'A', 'B', 'C', 'D'] as const).map(g => (
            <button key={g} onClick={() => setFilterGrade(g)} style={{
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
        <div style={{ ...s.card, textAlign: 'center', padding: 40, color: '#6B7280' }}>⏳ Memuat data Jubelio...</div>
      ) : error ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 40, color: '#ef4444' }}>⚠️ {error}</div>
      ) : viewMode === 'scorecard' ? (
        /* ── Scorecard View ── */
        <div style={s.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Supplier Scorecard</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
            Grade dihitung dari histori PO: frekuensi order dan % pembayaran lunas. Supplier tanpa histori PO otomatis Grade D.
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
                      <td style={s.td}>
                        <span style={s.badge(gc.bg, gc.color)}>{gc.label}</span>
                      </td>
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
                        {sup.email ? <a href={`mailto:${sup.email}`} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}>{sup.email}</a> : sup.phone || '—'}
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
        /* ── List View ── */
        <div style={s.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'Nama Supplier', 'Email', 'Telepon', 'Alamat', 'Status'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sup => (
                  <tr key={sup.id}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{sup.id}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{sup.name}</td>
                    <td style={{ ...s.td, color: '#374151' }}>{sup.email || '—'}</td>
                    <td style={{ ...s.td, color: '#374151' }}>{sup.phone || '—'}</td>
                    <td style={{ ...s.td, color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.address || '—'}</td>
                    <td style={s.td}>
                      <span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>Aktif</span>
                    </td>
                  </tr>
                ))}
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
      <div style={{ ...s.card, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Kriteria Grade Supplier
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12, color: '#6B7280' }}>
          <div><strong style={{ color: '#10b981' }}>Grade A</strong> — ≥80% PO lunas, ≥3 PO</div>
          <div><strong style={{ color: '#3b82f6' }}>Grade B</strong> — ≥60% PO lunas, ≥2 PO</div>
          <div><strong style={{ color: '#f59e0b' }}>Grade C</strong> — ≥40% PO lunas</div>
          <div><strong style={{ color: '#64748b' }}>Grade D</strong> — Belum ada histori PO atau &lt;40% lunas</div>
        </div>
      </div>
    </div>
  );
}
