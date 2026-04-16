'use client';

import { useState, useEffect } from 'react';
import type { SmartEventResult, DetectedEvent } from '@/app/api/smart-events/route';

const HISTORY_STORAGE_KEY = 'foodstocks_smart_events_history';
const HPP_KEY = 'foodstocks_hpp_v1';
const VELOCITY_KEY = 'foodstocks_velocity_v1';

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

function saveStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function formatRupiah(n: number) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const typeConfig: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  holiday:  { label: 'Hari Raya',    bg: '#FEF9C3', color: '#D97706', icon: '🎉' },
  promo:    { label: 'Promo',        bg: '#EFF6FF', color: '#3B82F6', icon: '🛍️' },
  seasonal: { label: 'Musiman',      bg: '#F0FDF4', color: '#10B981', icon: '🌤️' },
  cultural: { label: 'Budaya',       bg: '#F5F3FF', color: '#8B5CF6', icon: '🎊' },
};

const s = {
  page:  { padding: '24px', maxWidth: 1100 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 20, marginBottom: 16 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  th:    { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, textAlign: 'left' as const, background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td:    { padding: '11px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F3F4F6' },
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' } as React.CSSProperties),
  btn:   (bg: string, color: string) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: bg, color } as React.CSSProperties),
};

function EventCard({ event }: { event: DetectedEvent }) {
  const [open, setOpen] = useState(true);
  const cfg = typeConfig[event.type] ?? typeConfig.cultural;
  const isUrgent = event.daysUntil <= 7;

  return (
    <div style={{ ...s.card, border: `1px solid ${isUrgent ? '#FCA5A5' : '#E4E7ED'}`, background: isUrgent ? '#FFFAFA' : '#fff' }}>
      {/* Event header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 12 }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{event.name}</span>
            {isUrgent && (
              <span style={s.badge('#FEE2E2', '#DC2626')}>⚡ URGENT — {event.daysUntil} hari lagi</span>
            )}
            {!isUrgent && (
              <span style={s.badge('#F3F4F6', '#374151')}>{event.daysUntil} hari lagi</span>
            )}
            <span style={s.badge(cfg.bg, cfg.color)}>{cfg.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#6B7280' }}>
            <span>📅 {formatDate(event.date)}</span>
            <span>📈 Demand {event.demandMultiplier}× normal</span>
            <span>💰 Est. budget: <strong style={{ color: '#3B82F6' }}>{formatRupiah(event.totalEstimatedCost)}</strong></span>
            <span>📦 {event.recommendations.length} produk direkomendasikan</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{event.summary}</div>
        </div>
        <span style={{ fontSize: 18, color: '#9CA3AF', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Recommendations table */}
      {open && event.recommendations.length > 0 && (
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Produk', 'SKU', 'Stok Sekarang', 'Jual/Hari', 'Rec. Beli Tambahan', 'HPP', 'Est. Biaya', 'Alasan'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {event.recommendations.map(rec => (
                <tr key={rec.sku}>
                  <td style={{ ...s.td, fontWeight: 600, minWidth: 160, maxWidth: 260, wordBreak: 'break-word' }}>{rec.name}</td>
                  <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{rec.sku}</span></td>
                  <td style={{ ...s.td, fontWeight: 700 }}>{rec.currentStock} pcs</td>
                  <td style={s.td}>{rec.avgDailySales > 0 ? `${rec.avgDailySales}/hr` : '—'}</td>
                  <td style={{ ...s.td, fontWeight: 700, color: '#3B82F6' }}>+{rec.recommendedAdditionalQty} pcs</td>
                  <td style={s.td}>{formatRupiah(rec.hpp)}</td>
                  <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{formatRupiah(rec.estimatedCost)}</td>
                  <td style={{ ...s.td, color: '#6B7280', fontSize: 12, maxWidth: 200 }}>{rec.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && event.recommendations.length === 0 && (
        <div style={{ marginTop: 12, padding: 12, background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
          Tidak ada rekomendasi produk spesifik untuk event ini
        </div>
      )}
    </div>
  );
}

function HistoryCard({ result, onDelete }: { result: SmartEventResult; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: '1px solid #E4E7ED', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: '#F9FAFB' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>📋 {formatDateTime(result.generatedAt)}</span>
          <span style={s.badge('#EFF6FF', '#3B82F6')}>{result.events.length} event</span>
          <span style={s.badge('#F0FDF4', '#10B981')}>Budget: {formatRupiah(result.totalBudgetNeeded)}</span>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{result.dataSnapshot.totalSKUs} SKU · {result.dataSnapshot.criticalSKUs} kritis</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: '2px 6px' }}
            title="Hapus history ini"
          >🗑️</button>
          <span style={{ fontSize: 16, color: '#9CA3AF' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {result.generalSummary && (
            <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,0.06)', borderRadius: 8, fontSize: 13, color: '#374151', marginTop: 12, marginBottom: 12, lineHeight: 1.6 }}>
              {result.generalSummary}
            </div>
          )}
          {result.events.map(ev => (
            <EventCard key={ev.name} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SmartEventsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<SmartEventResult | null>(null);
  const [history, setHistory] = useState<SmartEventResult[]>([]);
  const [activeTab, setActiveTab] = useState<'result' | 'history'>('result');

  // Load history from Supabase on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/smart-events');
        const json = await res.json();
        if (json.success && Array.isArray(json.history) && json.history.length > 0) {
          setHistory(json.history);
          setCurrentResult(json.history[0]);
        }
      } catch {
        // fallback to localStorage
        const local = loadStorage<SmartEventResult[]>(HISTORY_STORAGE_KEY, []);
        setHistory(local);
        if (local.length > 0) setCurrentResult(local[0]);
      }
    }
    fetchHistory();
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    const velocityMap = loadStorage<Record<string, number>>(VELOCITY_KEY, {});
    const hppMap = loadStorage<Record<string, number>>(HPP_KEY, {});

    try {
      const res = await fetch('/api/smart-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ velocityMap, hppMap }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? 'Terjadi kesalahan.');
        return;
      }

      const result: SmartEventResult = json.result;
      setCurrentResult(result);

      const updated = [result, ...history].slice(0, 20);
      setHistory(updated);
      saveStorage(HISTORY_STORAGE_KEY, updated);
      setActiveTab('result');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function deleteHistory(id: string) {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveStorage(HISTORY_STORAGE_KEY, updated);
    if (currentResult?.id === id) setCurrentResult(updated[0] ?? null);
  }

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={s.title}>✨ Smart Events</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>
              AI mendeteksi event mendatang dan merekomendasikan pembelian stok · <strong>{today}</strong>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              ...s.btn(loading ? '#9CA3AF' : '#3B82F6', 'white'),
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: loading ? 0.8 : 1,
              minWidth: 200,
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⏳</span>
                AI sedang menganalisa...
              </>
            ) : (
              <>✨ Generate AI Recommendations</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '14px 18px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* How it works info */}
      {!currentResult && !loading && (
        <div style={{ ...s.card, background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1D4ED8', marginBottom: 12 }}>✨ Cara Kerja Smart Events</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '📅', title: 'Tahu Tanggal Otomatis', desc: 'AI tahu hari ini tanggal berapa dan menghitung semua event dalam 60 hari ke depan.' },
              { icon: '📦', title: 'Cek Stok Jubelio', desc: 'AI membaca data inventory real-time dari Jubelio untuk rekomendasi yang akurat.' },
              { icon: '🧠', title: 'Rekomendasi Cerdas', desc: 'AI merekomendasikan produk apa yang perlu distok lebih banyak dan berapa unitnya.' },
              { icon: '💾', title: 'Tersimpan Otomatis', desc: 'Setiap hasil AI disimpan sebagai history. Bisa lihat rekomendasi masa lalu kapan saja.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, fontSize: 12, color: '#374151' }}>
            💡 Klik tombol <strong>"Generate AI Recommendations"</strong> di kanan atas untuk mulai. Proses biasanya memakan waktu 5–15 detik.
          </div>
        </div>
      )}

      {/* Tabs */}
      {(currentResult || history.length > 0) && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #E4E7ED', paddingBottom: 0 }}>
            {([
              ['result', `✨ Hasil Terbaru${currentResult ? ` · ${currentResult.events.length} event` : ''}`],
              ['history', `📋 History (${history.length})`],
            ] as [string, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                style={{
                  padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: activeTab === key ? '#fff' : 'transparent',
                  color: activeTab === key ? '#3B82F6' : '#6B7280',
                  borderBottom: activeTab === key ? '2px solid #3B82F6' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Result tab */}
          {activeTab === 'result' && currentResult && (
            <div>
              {/* Summary bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Dihasilkan', value: formatDateTime(currentResult.generatedAt), color: '#6B7280' },
                  { label: 'Event Terdeteksi', value: `${currentResult.events.length} event`, color: '#8B5CF6' },
                  { label: 'Total Budget Dibutuhkan', value: formatRupiah(currentResult.totalBudgetNeeded), color: '#3B82F6' },
                  { label: 'SKU Dianalisa', value: `${currentResult.dataSnapshot.totalSKUs} SKU`, color: '#10B981' },
                  { label: 'SKU Kritis', value: `${currentResult.dataSnapshot.criticalSKUs} SKU`, color: '#EF4444' },
                ].map(k => (
                  <div key={k.label} style={{ ...s.card, marginBottom: 0, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* General summary */}
              {currentResult.generalSummary && (
                <div style={{ padding: '14px 18px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.7 }}>
                  <strong style={{ color: '#1D4ED8' }}>📊 Ringkasan AI:</strong> {currentResult.generalSummary}
                </div>
              )}

              {/* Event cards — grouped by quarter */}
              {currentResult.events.length > 0 ? (() => {
                const QUARTERS = [
                  { label: 'Q1', months: [1,2,3], color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
                  { label: 'Q2', months: [4,5,6], color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0' },
                  { label: 'Q3', months: [7,8,9], color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                  { label: 'Q4', months: [10,11,12], color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
                ];
                const MONTH_ID = ['', 'Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
                const sorted = [...currentResult.events].sort((a, b) => a.daysUntil - b.daysUntil);
                return QUARTERS.map(q => {
                  const events = sorted.filter(ev => {
                    const m = new Date(ev.date).getMonth() + 1;
                    return q.months.includes(m);
                  });
                  if (events.length === 0) return null;
                  const qBudget = events.reduce((s, ev) => s + ev.totalEstimatedCost, 0);
                  return (
                    <div key={q.label} style={{ marginBottom: 24 }}>
                      {/* Quarter header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
                        padding: '10px 16px', borderRadius: 10,
                        background: q.bg, border: `1px solid ${q.border}`,
                      }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: q.color }}>{q.label}</span>
                        <span style={{ fontSize: 13, color: q.color, fontWeight: 500 }}>
                          {MONTH_ID[q.months[0]]} – {MONTH_ID[q.months[2]]}
                        </span>
                        <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>·</span>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{events.length} event</span>
                        {qBudget > 0 && (
                          <>
                            <span style={{ fontSize: 12, color: '#6B7280' }}>·</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: q.color }}>
                              Est. {formatRupiah(qBudget)}
                            </span>
                          </>
                        )}
                      </div>
                      {events.map(event => <EventCard key={event.name + event.date} event={event} />)}
                    </div>
                  );
                });
              })() : (
                <div style={{ ...s.card, textAlign: 'center', color: '#6B7280', padding: 40 }}>
                  AI tidak mendeteksi event relevan dalam 60 hari ke depan.
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div style={{ ...s.card, textAlign: 'center', color: '#6B7280', padding: 40 }}>
                  Belum ada history. Generate rekomendasi pertama kamu!
                </div>
              ) : (
                history.map(result => (
                  <HistoryCard
                    key={result.id}
                    result={result}
                    onDelete={() => deleteHistory(result.id)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
