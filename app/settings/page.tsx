'use client';
import { useState, useEffect, useCallback } from 'react';

// ── Storage keys ──────────────────────────────────────────────
const HPP_KEY  = 'foodstocks_hpp_v1';
const LT_KEY   = 'foodstocks_leadtime_v1';
const VEL_KEY  = 'foodstocks_velocity_v1';
const INV_KEY  = 'foodstocks_inventory_snapshot';
const SUPP_KEY = 'foodstocks_skupplier_v1'; // SKU → supplier name

const DEFAULT_LEAD_TIME = 7;

// ── Styles ────────────────────────────────────────────────────
const s = {
  page:   { padding: '24px', maxWidth: 900 } as React.CSSProperties,
  card:   { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 20 } as React.CSSProperties,
  title:  { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  label:  { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' } as React.CSSProperties,
  input:  { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', marginBottom: 16 } as React.CSSProperties,
  btn:    { padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 } as React.CSSProperties,
  thead:  { padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: 'left' as const, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const },
  td:     { padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
};

type SyncState = 'idle' | 'pushing' | 'pulling' | 'ok' | 'error';

export interface InventorySnapshot {
  sku: string;
  name: string;
  stock: number;
  sellingPrice: number;
  supplier?: string;
  leadTime?: number;
  category?: string;
}

interface SkuRow { sku: string; name: string; sellPrice: number; estimatedHPP: number; category: string; }

// ── localStorage helpers ──────────────────────────────────────
function loadLocal<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// ── CSV helpers ───────────────────────────────────────────────
function parseHppCsv(csv: string) {
  const lines = csv.split('\n').filter(l => l.trim());
  const map: Record<string, number> = {}; const errors: string[] = []; let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].trim();
    if (i === 0 && row.toLowerCase().includes('sku')) continue;
    const parts = row.split(',');
    if (parts.length < 2) { errors.push(`Baris ${i+1}: format tidak valid`); continue; }
    const sku = parts[0].trim(); const hpp = parseFloat(parts[1].replace(/[^\d.]/g, ''));
    if (!sku) { errors.push(`Baris ${i+1}: SKU kosong`); continue; }
    if (isNaN(hpp) || hpp < 0) { errors.push(`Baris ${i+1}: HPP tidak valid`); continue; }
    map[sku] = hpp; count++;
  }
  return { map, count, errors };
}

function parseVelocityCsv(csv: string) {
  const lines = csv.split('\n').filter(l => l.trim());
  const map: Record<string, number> = {}; const errors: string[] = []; let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].trim();
    if (i === 0 && /sku|kode/i.test(row)) continue;
    const parts = row.split(',');
    if (parts.length < 2) continue;
    const sku = parts[0].trim(); const vel = parseFloat(parts[1].replace(/[^\d.]/g, ''));
    if (!sku) continue;
    if (isNaN(vel) || vel < 0) { errors.push(`Baris ${i+1}: nilai tidak valid`); continue; }
    map[sku] = vel; count++;
  }
  return { map, count, errors };
}

function parseInventoryCsv(csv: string) {
  const lines = csv.split('\n').filter(l => l.trim());
  const map: Record<string, number> = {}; const errors: string[] = []; let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].trim();
    if (i === 0 && /sku|kode/i.test(row)) continue;
    const parts = row.split(',');
    if (parts.length < 2) continue;
    const sku = parts[0].trim(); const stok = parseFloat(parts[1].replace(/[^\d.]/g, ''));
    if (!sku) continue;
    if (isNaN(stok) || stok < 0) { errors.push(`Baris ${i+1}: stok tidak valid`); continue; }
    map[sku] = stok; count++;
  }
  return { map, count, errors };
}

function exportCsv(header: string, rows: [string, number][], filename: string) {
  const txt = [header, ...rows.map(([k, v]) => `${k},${v}`)].join('\n');
  const blob = new Blob([txt], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
}

// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState('hpp');

  // ── HPP ────────────────────────────────────────────────────
  const [hppSaved, setHppSaved]     = useState<Record<string, number>>({});
  const [hppEdits, setHppEdits]     = useState<Record<string, number>>({});
  const [inventory, setInventory]   = useState<SkuRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [hppSearch, setHppSearch]   = useState('');
  const [showHppImport, setShowHppImport] = useState(false);
  const [hppImportText, setHppImportText] = useState('');
  const [hppImportMsg, setHppImportMsg]   = useState<string | null>(null);
  const [hppSavedOk, setHppSavedOk] = useState(false);
  const [hppSync, setHppSync]       = useState<SyncState>('idle');
  const [hppSyncMsg, setHppSyncMsg] = useState('');

  // ── Lead time ──────────────────────────────────────────────
  const [ltMap, setLtMap]     = useState<Record<string, number>>({});
  const [ltEdits, setLtEdits] = useState<Record<string, number>>({});
  const [ltDefault, setLtDefault] = useState(String(DEFAULT_LEAD_TIME));
  const [ltSavedOk, setLtSavedOk] = useState(false);
  const [ltSync, setLtSync]   = useState<SyncState>('idle');
  const [ltSyncMsg, setLtSyncMsg] = useState('');

  // ── Supplier list (for lead time tab) ──────────────────────
  const [supplierList, setSupplierList] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // ── SKU → Supplier mapping ──────────────────────────────────
  const [skupplierMap, setSkupplierMap] = useState<Record<string, string>>({});

  // ── Velocity ───────────────────────────────────────────────
  const [velMap, setVelMap]   = useState<Record<string, number>>({});
  const [invSnap, setInvSnap] = useState<Record<string, number>>({});
  const [velImportText, setVelImportText] = useState('');
  const [invImportText, setInvImportText] = useState('');
  const [velMsg, setVelMsg]   = useState<string | null>(null);
  const [invMsg, setInvMsg]   = useState<string | null>(null);
  const [velSavedOk, setVelSavedOk] = useState(false);
  const [velSync, setVelSync]       = useState<SyncState>('idle');
  const [velSyncMsg, setVelSyncMsg] = useState('');

  // ── Jubelio test ───────────────────────────────────────────
  const [testState, setTestState] = useState<'idle'|'testing'|'ok'|'fail'>('idle');

  // ── Params ─────────────────────────────────────────────────
  const [budgetPO, setBudgetPO]     = useState('50000000');
  const [targetCOGS, setTargetCOGS] = useState('55');
  const [paramSavedOk, setParamSavedOk] = useState(false);

  // ── Event Calendar ─────────────────────────────────────────
  interface DemandEvent { id: string; name: string; startDay: number; startDate?: string; durationDays?: number; multiplier: number; category: string; }
  const EVENTS_KEY = 'foodstocks_events_v1';
  const [events, setEvents] = useState<DemandEvent[]>(() => loadLocal<DemandEvent[]>(EVENTS_KEY, []));
  const [newEventName, setNewEventName] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDuration, setNewEventDuration] = useState('7');
  const [newEventMult, setNewEventMult] = useState('1.5');
  const [newEventCat, setNewEventCat] = useState('');
  const [eventSavedOk, setEventSavedOk] = useState(false);
  const PRESET_EVENTS: Omit<DemandEvent, 'id'>[] = [
    { name: 'Lebaran / Idul Fitri', startDay: 0, durationDays: 14, multiplier: 2.0, category: '' },
    { name: 'Harbolnas 11.11', startDay: 0, durationDays: 3, multiplier: 1.8, category: '' },
    { name: 'Harbolnas 12.12', startDay: 0, durationDays: 3, multiplier: 1.8, category: '' },
    { name: 'Twin Date (e.g. 9.9)', startDay: 0, durationDays: 2, multiplier: 1.6, category: '' },
    { name: 'Natal & Tahun Baru', startDay: 0, durationDays: 7, multiplier: 1.5, category: '' },
    { name: 'Musim Hujan (Okt-Mar)', startDay: 0, durationDays: 90, multiplier: 1.2, category: 'Makanan' },
    { name: 'Back to School', startDay: 0, durationDays: 7, multiplier: 1.3, category: '' },
  ];

  // ── Init ───────────────────────────────────────────────────
  const fetchSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const res = await fetch('/api/jubelio/suppliers');
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        const names: string[] = [...new Set(json.data.map((s: Record<string, unknown>) => String(s.name ?? '')).filter(Boolean))].sort() as string[];
        setSupplierList(names);
      }
    } catch { /* noop */ }
    setLoadingSuppliers(false);
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoadingInv(true);
    try {
      const res = await fetch('/api/jubelio/inventory');
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        setInventory(json.data.map((e: Record<string, unknown>) => ({
          sku: e.sku, name: e.name,
          sellPrice: Number(e.sellPrice) || 0,
          estimatedHPP: Number(e.buyPrice) || Math.round((Number(e.sellPrice) || 0) * 0.65),
          category: String(e.category ?? ''),
        })));
        const cats = [...new Set(json.data.map((e: Record<string, unknown>) => e.category).filter(Boolean))].sort() as string[];
        setCategories(cats);
      }
    } catch { /* noop */ }
    setLoadingInv(false);
  }, []);

  useEffect(() => {
    const hpp = loadLocal<Record<string, number>>(HPP_KEY, {});
    setHppSaved(hpp); setHppEdits({ ...hpp });

    const lt = loadLocal<Record<string, number>>(LT_KEY, {});
    setLtMap(lt); setLtEdits({ ...lt });
    if (lt.__default__ !== undefined) setLtDefault(String(lt.__default__));

    setVelMap(loadLocal(VEL_KEY, {}));
    setInvSnap(loadLocal(INV_KEY, {}));
    setSkupplierMap(loadLocal(SUPP_KEY, {}));

    fetch('/api/hpp-sync', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data) { const m = { ...loadLocal<Record<string, number>>(HPP_KEY, {}), ...j.data }; setHppSaved(m); setHppEdits({ ...m }); saveLocal(HPP_KEY, m); } })
      .catch(() => {});

    fetch('/api/leadtime-sync', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data) { const m = { ...loadLocal<Record<string, number>>(LT_KEY, {}), ...j.data }; setLtMap(m); setLtEdits({ ...m }); saveLocal(LT_KEY, m); if (m.__default__ !== undefined) setLtDefault(String(m.__default__)); } })
      .catch(() => {});

    fetch('/api/kv-sync?key=skupplier_map', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.ok && j.data) { const m = { ...loadLocal<Record<string, string>>(SUPP_KEY, {}), ...j.data }; setSkupplierMap(m); saveLocal(SUPP_KEY, m); } })
      .catch(() => {});

    const savedBudget = loadLocal<string>('foodstocks_budget_po', '50000000');
    setBudgetPO(savedBudget);
    const savedCOGS = loadLocal<string>('foodstocks_target_cogs', '55');
    setTargetCOGS(savedCOGS);

    fetchInventory();
    fetchSuppliers();
  }, [fetchInventory, fetchSuppliers]);

  // ── HPP handlers ───────────────────────────────────────────
  async function saveHpp() {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(hppEdits)) if (v > 0) clean[k] = v;
    saveLocal(HPP_KEY, clean); setHppSaved(clean);
    saveLocal(SUPP_KEY, skupplierMap);
    setHppSavedOk(true); setTimeout(() => setHppSavedOk(false), 3000);
    setHppSync('pushing'); setHppSyncMsg('');
    const [res1, res2] = await Promise.allSettled([
      fetch('/api/hpp-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) }),
      fetch('/api/kv-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'skupplier_map', data: skupplierMap }) }),
    ]);
    const j = res1.status === 'fulfilled' ? await res1.value.json() : { ok: false, error: 'network' };
    if (j.ok) { setHppSync('ok'); setHppSyncMsg(`☁️ Tersinkron (${Object.keys(clean).length} SKU)`); }
    else { setHppSync('error'); setHppSyncMsg(`❌ Gagal: ${j.error}`); }
    void res2; // skupplier sync fire-and-forget
    setTimeout(() => setHppSync('idle'), 5000);
  }

  async function pullHpp() {
    setHppSync('pulling'); setHppSyncMsg('');
    const res = await fetch('/api/hpp-sync', { cache: 'no-store' });
    const j = await res.json();
    if (j.ok) { const m = j.data; setHppSaved(m); setHppEdits({ ...m }); saveLocal(HPP_KEY, m); setHppSync('ok'); setHppSyncMsg(`☁️ Diperbarui (${Object.keys(m).length} SKU)`); }
    else { setHppSync('error'); setHppSyncMsg(`❌ ${j.error}`); }
    setTimeout(() => setHppSync('idle'), 5000);
  }

  // ── Lead time handlers ─────────────────────────────────────
  async function saveLt() {
    const m: Record<string, number> = { __default__: parseInt(ltDefault) || DEFAULT_LEAD_TIME };
    for (const [k, v] of Object.entries(ltEdits)) if (k !== '__default__' && v > 0) m[k] = v;
    setLtMap(m); saveLocal(LT_KEY, m);
    setLtSavedOk(true); setTimeout(() => setLtSavedOk(false), 3000);
    setLtSync('pushing'); setLtSyncMsg('');
    const res = await fetch('/api/leadtime-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m) });
    const j = await res.json();
    if (j.ok) { setLtSync('ok'); setLtSyncMsg('☁️ Tersinkron'); }
    else { setLtSync('error'); setLtSyncMsg(`❌ ${j.error}`); }
    setTimeout(() => setLtSync('idle'), 5000);
  }

  async function pullLt() {
    setLtSync('pulling'); setLtSyncMsg('');
    const res = await fetch('/api/leadtime-sync', { cache: 'no-store' });
    const j = await res.json();
    if (j.ok) { const m = j.data; setLtMap(m); setLtEdits({ ...m }); saveLocal(LT_KEY, m); if (m.__default__ !== undefined) setLtDefault(String(m.__default__)); setLtSync('ok'); setLtSyncMsg('☁️ Diperbarui dari cloud'); }
    else { setLtSync('error'); setLtSyncMsg(`❌ ${j.error}`); }
    setTimeout(() => setLtSync('idle'), 5000);
  }

  // ── Velocity handlers ──────────────────────────────────────
  function saveVelocity() {
    saveLocal(VEL_KEY, velMap);

    // Convert invSnap (Record<string,number>) → InventorySnapshot[] agar Planner bisa baca
    if (Object.keys(invSnap).length > 0) {
      const snapArray: InventorySnapshot[] = Object.entries(invSnap).map(([sku, stock]) => {
        const jubelioItem = inventory.find(i => i.sku === sku);
        return {
          sku,
          stock,
          name: jubelioItem?.name ?? sku,
          sellingPrice: jubelioItem?.sellPrice ?? 0,
          category: jubelioItem?.category ?? '',
          supplier: '',
        };
      });
      saveLocal(INV_KEY, snapArray);
    } else {
      saveLocal(INV_KEY, []);
    }

    setVelSavedOk(true); setTimeout(() => setVelSavedOk(false), 3000);
    syncVelocityToCloud(velMap);
  }

  async function syncVelocityToCloud(map: Record<string, number>) {
    setVelSync('pushing'); setVelSyncMsg('');
    const res = await fetch('/api/kv-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'velocity_map', data: map }) });
    const j = await res.json();
    if (j.ok) { setVelSync('ok'); setVelSyncMsg(`☁️ Tersinkron (${Object.keys(map).length} SKU)`); }
    else { setVelSync('error'); setVelSyncMsg(`❌ ${j.error}`); }
    setTimeout(() => setVelSync('idle'), 5000);
  }

  async function pullVelocityFromCloud() {
    setVelSync('pulling'); setVelSyncMsg('');
    const res = await fetch('/api/kv-sync?key=velocity_map', { cache: 'no-store' });
    const j = await res.json();
    if (j.ok && j.data) { const m = j.data as Record<string, number>; setVelMap(m); saveLocal(VEL_KEY, m); setVelSync('ok'); setVelSyncMsg(`☁️ Diperbarui (${Object.keys(m).length} SKU)`); }
    else { setVelSync('error'); setVelSyncMsg(`❌ ${j.data === null ? 'Belum ada data di cloud' : j.error}`); }
    setTimeout(() => setVelSync('idle'), 5000);
  }

  // Tarik velocity otomatis dari Jubelio sales history
  const [velPullState, setVelPullState] = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [velPullMsg, setVelPullMsg] = useState('');
  async function pullVelocityFromJubelio() {
    setVelPullState('loading'); setVelPullMsg('');
    try {
      const res = await fetch('/api/jubelio/velocity');
      const json = await res.json();
      if (json.success && json.data) {
        const merged = { ...velMap, ...json.data };
        setVelMap(merged);
        saveLocal(VEL_KEY, merged);
        if (json.skuCount > 0) {
          setVelPullState('ok');
          setVelPullMsg(`✅ ${json.skuCount} SKU velocity berhasil ditarik dari Jubelio (${json.window} · ${json.orderCount ?? 0} orders)`);
        } else {
          const keys = Array.isArray(json.sampleOrderKeys) && json.sampleOrderKeys.length > 0
            ? ` Keys order: [${json.sampleOrderKeys.join(', ')}]`
            : '';
          setVelPullState('error');
          setVelPullMsg(`⚠️ 0 SKU ditarik. ${json.orderCount ?? 0} orders · source: ${json.itemsSource ?? '?'}${keys}`);
        }
      } else {
        setVelPullState('error');
        setVelPullMsg(`❌ ${json.error ?? 'Gagal menarik data'}`);
      }
    } catch (e) {
      setVelPullState('error');
      setVelPullMsg(`❌ ${String(e)}`);
    }
    setTimeout(() => setVelPullState('idle'), 8000);
  }

  // ── Derived ────────────────────────────────────────────────
  // If Jubelio returns no data, fall back to showing SKUs from saved HPP map
  const effectiveInventory: SkuRow[] = inventory.length > 0
    ? inventory
    : Object.entries(hppSaved).map(([sku, hpp]) => ({
        sku,
        name: sku,
        sellPrice: 0,
        estimatedHPP: hpp,
        category: '',
      }));

  const hppManualCount = effectiveInventory.filter(i => (hppSaved[i.sku] ?? 0) > 0).length;
  const filteredInv = effectiveInventory.filter(i =>
    !hppSearch || i.name.toLowerCase().includes(hppSearch.toLowerCase()) || i.sku.toLowerCase().includes(hppSearch.toLowerCase())
  );

  const TABS = [
    { id: 'hpp',        label: '💰 HPP per SKU' },
    { id: 'velocity',   label: '📊 Stok & Velocity' },
    { id: 'leadtime',   label: '⏱️ Lead Time' },
    { id: 'events',     label: '📅 Event Calendar' },
    { id: 'jubelio',    label: '🔗 Jubelio API' },
    { id: 'parameters', label: '📐 Parameter Bisnis' },
    { id: 'roadmap',    label: '🗺️ Roadmap' },
  ];

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 24 }}>
        <div style={s.title}>⚙️ Settings</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Konfigurasi HPP, koneksi Jubelio, dan parameter bisnis</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...s.btn, padding: '10px 16px', background: 'transparent',
            color: tab === t.id ? '#3b82f6' : 'var(--text-muted)',
            borderRadius: '8px 8px 0 0',
            borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            fontSize: 13,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── HPP TAB ────────────────────────────────────────── */}
      {tab === 'hpp' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>💰 Input HPP per SKU</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Masukkan harga beli aktual per SKU. Jika kosong, sistem pakai estimasi 65% dari harga jual.
                {hppManualCount > 0 && <span style={{ color: '#10b981', marginLeft: 8 }}>{hppManualCount} SKU sudah diinput manual.</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => exportCsv('SKU,HPP (Rp)', Object.entries(hppSaved), 'foodstocks_hpp.csv')} style={{ ...s.btn, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 14px', fontSize: 12 }}>📥 Export CSV</button>
              <button onClick={() => setShowHppImport(!showHppImport)} style={{ ...s.btn, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 14px', fontSize: 12 }}>📤 Import CSV</button>
              <button onClick={() => { if (confirm('Reset semua HPP manual?')) { setHppSaved({}); setHppEdits({}); saveLocal(HPP_KEY, {}); } }} style={{ ...s.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '7px 14px', fontSize: 12 }}>🗑️ Reset Semua</button>
            </div>
          </div>

          {showHppImport && (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Format CSV: <code style={{ color: '#f59e0b' }}>SKU,HPP</code> (satu baris per SKU)</div>
              <textarea value={hppImportText} onChange={e => setHppImportText(e.target.value)}
                placeholder={'SKU,HPP\nGH-MR-MK-PJ-0648,13500\nBP-MR-BA-SM-0018,18500'}
                style={{ ...s.input, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => {
                  const { map, count, errors } = parseHppCsv(hppImportText);
                  if (count > 0) { const merged = { ...hppEdits, ...map }; setHppEdits(merged); setHppSaved(merged); saveLocal(HPP_KEY, merged); setHppImportMsg(`✅ Import ${count} SKU${errors.length ? ` (${errors.length} error)` : ''}`); }
                  else setHppImportMsg(`❌ Tidak ada data valid. ${errors.slice(0, 3).join('; ')}`);
                  setTimeout(() => setHppImportMsg(null), 5000);
                }} style={{ ...s.btn, background: '#3b82f6', color: 'white', padding: '7px 16px', fontSize: 12 }}>Import</button>
                {hppImportMsg && <span style={{ fontSize: 12, color: hppImportMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{hppImportMsg}</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total SKU', value: effectiveInventory.length, color: '#3b82f6' },
              { label: 'HPP Manual', value: hppManualCount, color: '#10b981' },
              { label: 'Pakai Estimasi', value: Math.max(0, effectiveInventory.length - hppManualCount), color: '#f59e0b' },
            ].map(k => (
              <div key={k.label} style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 8, borderLeft: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.color, margin: '4px 0' }}>{loadingInv ? '…' : k.value}</div>
              </div>
            ))}
          </div>

          <input type="text" placeholder="🔍 Cari SKU atau nama produk..." value={hppSearch} onChange={e => setHppSearch(e.target.value)}
            style={{ ...s.input, width: 320, marginBottom: 12 }} />

          {loadingInv ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>⏳ Memuat daftar SKU dari Jubelio…</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr>
                    {['SKU', 'Nama Produk', 'Harga Jual', 'Estimasi HPP (65%)', 'HPP Manual (Rp) ✏️', 'Supplier ✏️', 'Margin'].map(h => (
                      <th key={h} style={{ ...s.thead, color: h.includes('HPP Manual') || h.includes('Supplier') ? '#10b981' : 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInv.map(item => {
                    const manual = hppEdits[item.sku];
                    const hasManual = manual !== undefined && manual > 0;
                    const effectiveHpp = hasManual ? manual : item.estimatedHPP;
                    const margin = item.sellPrice > 0 ? ((item.sellPrice - effectiveHpp) / item.sellPrice * 100) : 0;
                    return (
                      <tr key={item.sku} style={{ background: hasManual ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{item.sku}</td>
                        <td style={{ ...s.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                        <td style={s.td}>{item.sellPrice > 0 ? `Rp ${(item.sellPrice/1000).toFixed(0)}rb` : '-'}</td>
                        <td style={{ ...s.td, color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.estimatedHPP > 0 ? `Rp ${(item.estimatedHPP/1000).toFixed(0)}rb` : '-'}</td>
                        <td style={s.td}>
                          <input type="text" inputMode="numeric"
                            value={hasManual ? String(manual) : ''}
                            onChange={e => { const v = parseInt(e.target.value.replace(/\D/g, ''), 10); setHppEdits(prev => ({ ...prev, [item.sku]: isNaN(v) ? 0 : v })); }}
                            placeholder={String(item.estimatedHPP.toLocaleString('id-ID'))}
                            style={{ background: hasManual ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)', border: `1px solid ${hasManual ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 110 }} />
                        </td>
                        <td style={s.td}>
                          <select
                            value={skupplierMap[item.sku] ?? ''}
                            onChange={e => setSkupplierMap(prev => ({ ...prev, [item.sku]: e.target.value }))}
                            style={{ background: skupplierMap[item.sku] ? 'rgba(16,185,129,0.1)' : 'var(--bg-hover)', border: `1px solid ${skupplierMap[item.sku] ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 8px', color: skupplierMap[item.sku] ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, outline: 'none', maxWidth: 140 }}>
                            <option value="">— pilih —</option>
                            {supplierList.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                          </select>
                        </td>
                        <td style={{ ...s.td, fontWeight: 600, color: margin >= 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444' }}>
                          {item.sellPrice > 0 ? `${margin.toFixed(1)}%` : '-'}
                          {hasManual && <span style={{ fontSize: 9, color: '#10b981', marginLeft: 4 }}>✓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredInv.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Tidak ada SKU yang cocok</div>}
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={saveHpp} disabled={hppSync === 'pushing'} style={{ ...s.btn, background: '#10b981', color: 'white', padding: '11px 28px', opacity: hppSync === 'pushing' ? 0.7 : 1 }}>
              {hppSync === 'pushing' ? '⏳ Menyimpan…' : '💾 Simpan & Sync HPP'}
            </button>
            <button onClick={pullHpp} disabled={hppSync === 'pulling'} style={{ ...s.btn, background: 'var(--bg-hover)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '11px 18px', opacity: hppSync === 'pulling' ? 0.7 : 1 }}>
              {hppSync === 'pulling' ? '⏳ Menarik…' : '☁️ Pull dari Cloud'}
            </button>
            {hppSavedOk && <span style={{ color: '#10b981', fontSize: 13 }}>✅ Tersimpan di browser!</span>}
            {hppSyncMsg && <span style={{ fontSize: 12, color: hppSync === 'error' ? '#ef4444' : '#10b981' }}>{hppSyncMsg}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 'auto' }}>☁️ Data di-sync ke Supabase cloud</span>
          </div>
        </div>
      )}

      {/* ─── VELOCITY TAB ───────────────────────────────────── */}
      {tab === 'velocity' && (
        <div>
          <div style={{ ...s.card, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 6 }}>📖 Panduan Import Stok & Velocity</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Langkah 1:</strong> Jubelio → <strong>Laporan</strong> → <strong>Laporan Penjualan</strong> → filter 30 hari → <strong>Export CSV</strong><br />
              <strong style={{ color: 'var(--text-secondary)' }}>Langkah 2:</strong> Di Excel: hitung <code style={{ color: '#f59e0b', fontSize: 12 }}>total_qty ÷ 30</code> per SKU → simpan 2 kolom: <code style={{ color: '#f59e0b', fontSize: 12 }}>SKU,avg_harian</code><br />
              <strong style={{ color: 'var(--text-secondary)' }}>Langkah 3:</strong> Paste CSV di kotak Import → klik Import Velocity → selesai
            </div>
          </div>

          {/* Velocity */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>📈 Velocity (Rata-rata Penjualan Harian)</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Format: <code style={{ color: '#f59e0b', fontSize: 12 }}>SKU,avg_harian</code>&nbsp;&nbsp;Contoh: <code style={{ color: 'var(--text-secondary)', fontSize: 11 }}>GH-MR-MK-PJ-0648,4.5</code></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => exportCsv('SKU,avg_jual_harian', Object.entries(velMap), 'velocity.csv')} style={{ ...s.btn, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: 12 }}>📥 Export</button>
                <button onClick={() => { if (confirm('Reset data velocity?')) { setVelMap({}); saveLocal(VEL_KEY, {}); } }} style={{ ...s.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '7px 12px', fontSize: 12 }}>🗑️ Reset</button>
              </div>
            </div>
            {/* Panduan export manual dari Jubelio */}
            <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>📋 Cara Export Velocity dari Jubelio</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <strong style={{ color: 'var(--text-primary)' }}>1.</strong> Buka <strong>Jubelio</strong> → menu <strong>Laporan</strong> → <strong>Laporan Penjualan</strong><br />
                <strong style={{ color: 'var(--text-primary)' }}>2.</strong> Filter periode <strong>30 hari terakhir</strong> → klik <strong>Export Excel/CSV</strong><br />
                <strong style={{ color: 'var(--text-primary)' }}>3.</strong> Di Excel: tambah kolom baru = <code style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: 3 }}>total_qty ÷ 30</code> per SKU<br />
                <strong style={{ color: 'var(--text-primary)' }}>4.</strong> Buat CSV 2 kolom: <code style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: 3 }}>SKU,avg_harian</code> → paste di bawah
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(100,116,139,0.1)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                ℹ️ Jubelio API tidak menyediakan data penjualan per SKU — harus export manual. Data velocity dipakai untuk Forecast Stok, Reorder Point, dan Dashboard.
              </div>
            </div>

            {/* SKU match counter */}
            {(() => {
              const jubelioSkus = new Set(inventory.map(i => i.sku));
              const matched = Object.keys(velMap).filter(sku => jubelioSkus.has(sku)).length;
              const unmatched = Object.keys(velMap).filter(sku => !jubelioSkus.has(sku)).length;
              return Object.keys(velMap).length > 0 && inventory.length > 0 ? (
                <div style={{ padding: '10px 14px', background: matched > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${matched > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>✅ {matched} SKU</span>
                  <span style={{ color: 'var(--text-muted)' }}> berhasil dicocokkan dengan {inventory.length} SKU Jubelio</span>
                  {unmatched > 0 && <span style={{ color: '#f59e0b' }}> · ⚠️ {unmatched} SKU tidak ditemukan (cek format SKU)</span>}
                </div>
              ) : null;
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'SKU dengan Velocity', value: Object.keys(velMap).length, color: '#3b82f6' },
                { label: 'Avg Tertinggi/hr', value: Object.values(velMap).length ? `${Math.max(...Object.values(velMap)).toFixed(1)}` : '-', color: '#10b981' },
              ].map(k => (
                <div key={k.label} style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 8, borderLeft: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color, margin: '4px 0' }}>{k.value}</div>
                </div>
              ))}
            </div>
            <textarea value={velImportText} onChange={e => setVelImportText(e.target.value)}
              placeholder={'SKU,avg_harian\nGH-MR-MK-PJ-0648,4.5\nBP-MR-BA-SM-0018,8.2\nNN-BW-NN-NN-0649,1.0'}
              style={{ ...s.input, height: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => {
                const { map, count, errors } = parseVelocityCsv(velImportText);
                if (count > 0) { const merged = { ...velMap, ...map }; setVelMap(merged); setVelMsg(`✅ Import ${count} SKU velocity${errors.length ? ` (${errors.length} error)` : ''}`); }
                else setVelMsg(`❌ Tidak ada data valid. ${errors.slice(0, 2).join('; ')}`);
                setTimeout(() => setVelMsg(null), 5000);
              }} style={{ ...s.btn, background: '#3b82f6', color: 'white', padding: '8px 18px', fontSize: 12 }}>Import Velocity</button>
              {velMsg && <span style={{ fontSize: 12, color: velMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{velMsg}</span>}
            </div>
          </div>

          {/* Inventory snapshot */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>📦 Snapshot Stok (opsional)</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Format: <code style={{ color: '#f59e0b', fontSize: 12 }}>SKU,stok</code>&nbsp; Jika kosong, planner pakai data Jubelio live.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => exportCsv('SKU,stok', Object.entries(invSnap), 'inventory_snapshot.csv')} style={{ ...s.btn, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 12px', fontSize: 12 }}>📥 Export</button>
                <button onClick={() => { if (confirm('Reset snapshot stok?')) { setInvSnap({}); saveLocal(INV_KEY, {}); } }} style={{ ...s.btn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '7px 12px', fontSize: 12 }}>🗑️ Reset</button>
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: 8, borderLeft: '3px solid #8b5cf6', marginBottom: 16, display: 'inline-block' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>SKU dengan Snapshot</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6', margin: '4px 0' }}>{Object.keys(invSnap).length}</div>
            </div>
            <textarea value={invImportText} onChange={e => setInvImportText(e.target.value)}
              placeholder={'SKU,stok\nGH-MR-MK-PJ-0648,45\nBP-MR-BA-SM-0018,120'}
              style={{ ...s.input, height: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => {
                const { map, count, errors } = parseInventoryCsv(invImportText);
                if (count > 0) { const merged = { ...invSnap, ...map }; setInvSnap(merged); setInvMsg(`✅ Import ${count} SKU snapshot${errors.length ? ` (${errors.length} error)` : ''}`); }
                else setInvMsg(`❌ Tidak ada data valid. ${errors.slice(0, 2).join('; ')}`);
                setTimeout(() => setInvMsg(null), 5000);
              }} style={{ ...s.btn, background: '#8b5cf6', color: 'white', padding: '8px 18px', fontSize: 12 }}>Import Snapshot</button>
              {invMsg && <span style={{ fontSize: 12, color: invMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{invMsg}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={saveVelocity} disabled={velSync === 'pushing'} style={{ ...s.btn, background: '#10b981', color: 'white', padding: '11px 28px', opacity: velSync === 'pushing' ? 0.7 : 1 }}>
              {velSync === 'pushing' ? '⏳ Menyimpan…' : '💾 Simpan & Sync ke Cloud'}
            </button>
            <button onClick={pullVelocityFromCloud} disabled={velSync === 'pulling'} style={{ ...s.btn, background: 'var(--bg-hover)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '11px 18px', opacity: velSync === 'pulling' ? 0.7 : 1 }}>
              {velSync === 'pulling' ? '⏳ Menarik…' : '☁️ Pull dari Cloud'}
            </button>
            {velSavedOk && <span style={{ fontSize: 13, color: '#10b981' }}>✅ Tersimpan di browser!</span>}
            {velSyncMsg && <span style={{ fontSize: 12, color: velSync === 'error' ? '#ef4444' : '#10b981' }}>{velSyncMsg}</span>}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
            ☁️ Data di-sync ke Supabase cloud — tim lain bisa pull di device masing-masing.
          </div>
        </div>
      )}

      {/* ─── LEAD TIME TAB ──────────────────────────────────── */}
      {tab === 'leadtime' && (
        <div>
          <div style={s.card}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>⏱️ Lead Time per Supplier</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Lead time = hari dari pesan ke tiba. Dipakai untuk menghitung Reorder Point. Assign supplier ke SKU di tab HPP agar lookup akurat.</div>
            <div style={{ padding: '16px 20px', background: 'var(--bg-hover)', borderRadius: 10, marginBottom: 20, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>🌐 Default Lead Time (berlaku jika supplier tidak dikonfigurasi)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="number" min="1" max="90" value={ltDefault} onChange={e => setLtDefault(e.target.value)}
                  style={{ ...s.input, width: 80, marginBottom: 0, textAlign: 'center' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>hari</span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 8 }}>Saat ini: {ltMap.__default__ ?? DEFAULT_LEAD_TIME} hari</span>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Lead Time per Supplier</div>
            {loadingSuppliers ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>⏳ Memuat daftar supplier…</div>
            ) : supplierList.length === 0 ? (
              <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 13, color: '#f59e0b', marginBottom: 16 }}>
                ⚠️ Tidak ada supplier dari Jubelio. Pastikan ada transaksi pembelian di Jubelio.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
                {supplierList.map(sup => {
                  const val = ltEdits[sup]; const hasVal = val !== undefined && val > 0;
                  const def = ltMap.__default__ ?? DEFAULT_LEAD_TIME;
                  return (
                    <div key={sup} style={{ padding: '12px 16px', background: hasVal ? 'rgba(59,130,246,0.06)' : 'var(--bg-hover)', border: `1px solid ${hasVal ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: hasVal ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min="1" max="90" value={hasVal ? val : ''} placeholder={String(def)}
                          onChange={e => { const v = parseInt(e.target.value) || 0; setLtEdits(prev => ({ ...prev, [sup]: v })); }}
                          style={{ background: hasVal ? 'rgba(59,130,246,0.12)' : 'var(--bg-surface)', border: `1px solid ${hasVal ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`, borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 55, textAlign: 'center' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hari</span>
                        {hasVal && <button onClick={() => setLtEdits(prev => { const n = { ...prev }; delete n[sup]; return n; })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={saveLt} disabled={ltSync === 'pushing'} style={{ ...s.btn, background: '#3b82f6', color: 'white', padding: '11px 28px', opacity: ltSync === 'pushing' ? 0.7 : 1 }}>
                {ltSync === 'pushing' ? '⏳ Menyimpan…' : '💾 Simpan & Sync Lead Time'}
              </button>
              <button onClick={pullLt} disabled={ltSync === 'pulling'} style={{ ...s.btn, background: 'var(--bg-hover)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '11px 18px', opacity: ltSync === 'pulling' ? 0.7 : 1 }}>
                {ltSync === 'pulling' ? '⏳ Menarik…' : '☁️ Pull dari Cloud'}
              </button>
              {ltSavedOk && <span style={{ color: '#10b981', fontSize: 13 }}>✅ Tersimpan!</span>}
              {ltSyncMsg && <span style={{ fontSize: 12, color: ltSync === 'error' ? '#ef4444' : '#10b981' }}>{ltSyncMsg}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>{Object.keys(ltMap).filter(k => k !== '__default__').length} supplier dikonfigurasi</span>
            </div>
          </div>

          <div style={{ ...s.card, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 8 }}>📖 Cara kerja Lead Time</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Reorder Point</strong> = (Avg Jual/Hari × Lead Time) + Safety Stock<br />
              <strong style={{ color: 'var(--text-secondary)' }}>Safety Stock</strong> = Avg Jual/Hari × Multiplier (A: 3×, B: 2×, C: 1×)<br /><br />
              Contoh: SKU Kelas A jual 10/hari, lead time <strong style={{ color: '#60a5fa' }}>7 hari</strong><br />
              → Reorder Point = (10 × 7) + (10 × 3) = <strong style={{ color: '#60a5fa' }}>100 unit</strong>
            </div>
          </div>
        </div>
      )}

      {/* ─── JUBELIO TAB ────────────────────────────────────── */}
      {tab === 'jubelio' && (
        <div style={s.card}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>🔗 Jubelio WMS Integration</div>
          <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            ✅ <strong style={{ color: '#10b981' }}>Fase 2 Aktif:</strong> Koneksi Jubelio sudah terhubung via environment variable di Vercel. Credentials dikonfigurasi langsung di Vercel project settings.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { icon: '🌐', label: 'Base URL', value: 'https://api2.jubelio.com' },
              { icon: '🔑', label: 'Token Expiry', value: '12 jam (auto-refresh)' },
              { icon: '📦', label: 'SKU Dimuat', value: loadingInv ? '…' : String(inventory.length) },
            ].map(e => (
              <div key={e.label} style={{ padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{e.icon} {e.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{e.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={async () => {
              setTestState('testing');
              try { const r = await fetch('/api/jubelio/inventory'); const j = await r.json(); setTestState(j.success ? 'ok' : 'fail'); }
              catch { setTestState('fail'); }
            }} disabled={testState === 'testing'} style={{ ...s.btn, background: '#3b82f6', color: 'white', opacity: testState === 'testing' ? 0.6 : 1 }}>
              {testState === 'testing' ? '⏳ Testing…' : '🔌 Test Koneksi'}
            </button>
            {testState === 'ok' && <span style={{ fontSize: 13, color: '#10b981' }}>✅ Koneksi berhasil! {inventory.length} SKU loaded.</span>}
            {testState === 'fail' && <span style={{ fontSize: 13, color: '#ef4444' }}>❌ Koneksi gagal. Cek Vercel env vars.</span>}
          </div>
        </div>
      )}

      {/* ─── PARAMETERS TAB ─────────────────────────────────── */}
      {tab === 'parameters' && (
        <div style={s.card}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>📐 Parameter Bisnis</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={s.label}>Budget PO Bulanan (Rp)</label><input type="number" value={budgetPO} onChange={e => setBudgetPO(e.target.value)} style={s.input} /></div>
            <div><label style={s.label}>Target COGS % dari Revenue</label><input type="number" value={targetCOGS} onChange={e => setTargetCOGS(e.target.value)} style={s.input} /></div>
            <div><label style={s.label}>Ordering Cost Default (Rp/order)</label><input type="number" defaultValue="50000" style={s.input} /></div>
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Parameter ini digunakan untuk kalkulasi EOQ, True COGS, dan Reorder Point.
          </div>
          <button onClick={() => { saveLocal('foodstocks_budget_po', budgetPO); saveLocal('foodstocks_target_cogs', targetCOGS); setParamSavedOk(true); setTimeout(() => setParamSavedOk(false), 3000); }} style={{ ...s.btn, background: '#3b82f6', color: 'white', padding: '11px 28px' }}>
            💾 Simpan Parameter
          </button>
          {paramSavedOk && <span style={{ color: '#10b981', fontSize: 13, marginLeft: 12 }}>✅ Tersimpan!</span>}
        </div>
      )}

      {/* ─── EVENT CALENDAR TAB ─────────────────────────────── */}
      {tab === 'events' && (
        <div style={s.card}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>📅 Event Calendar — Demand Multiplier</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Tambahkan event yang akan meningkatkan permintaan (Lebaran, Harbolnas, musim hujan, dll). Forecast Stok dan Purchase Planner akan menyesuaikan rekomendasi qty.
          </div>

          {/* Preset Events */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Preset Event Umum</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_EVENTS.map(preset => (
                <button key={preset.name} onClick={() => {
                  setNewEventName(preset.name);
                  setNewEventMult(String(preset.multiplier));
                  setNewEventCat(preset.category);
                  setNewEventDuration(String(preset.durationDays ?? 7));
                }} style={{ ...s.btn, padding: '6px 12px', fontSize: 12, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Add Event Form */}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Tambah Event Baru</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={s.label}>Nama Event</label>
                <input value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="Lebaran 2026" style={s.input} />
              </div>
              <div>
                <label style={s.label}>Tanggal Event</label>
                <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} style={s.input} />
              </div>
              <div>
                <label style={s.label}>Durasi (hari)</label>
                <input type="number" min="1" max="365" value={newEventDuration} onChange={e => setNewEventDuration(e.target.value)} placeholder="7" style={s.input} />
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,5,7,14,30,90].map(d => (
                    <button key={d} onClick={() => setNewEventDuration(String(d))}
                      style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: newEventDuration === String(d) ? '#3b82f6' : 'var(--bg-hover)', color: newEventDuration === String(d) ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}>
                      {d}h
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={s.label}>Mulai (hari dari skrg)</label>
                <input type="number" value={newEventStart} onChange={e => setNewEventStart(e.target.value)} placeholder="14" style={s.input} />
              </div>
              <div>
                <label style={s.label}>Multiplier (1.5 = +50%)</label>
                <input type="number" step="0.1" value={newEventMult} onChange={e => setNewEventMult(e.target.value)} placeholder="1.5" style={s.input} />
              </div>
              <div>
                <label style={s.label}>Kategori (opsional)</label>
                <input value={newEventCat} onChange={e => setNewEventCat(e.target.value)} placeholder="Semua kategori" style={s.input} />
              </div>
            </div>
            <button onClick={() => {
              if (!newEventName.trim()) return;
              // auto-compute startDay from startDate if provided
              let startDay = parseInt(newEventStart) || 0;
              if (newEventDate) {
                const diff = Math.round((new Date(newEventDate).getTime() - Date.now()) / 86400000);
                startDay = diff;
              }
              const ev: DemandEvent = {
                id: Date.now().toString(),
                name: newEventName.trim(),
                startDay,
                ...(newEventDate ? { startDate: newEventDate } : {}),
                durationDays: parseInt(newEventDuration) || 14,
                multiplier: parseFloat(newEventMult) || 1.5,
                category: newEventCat.trim(),
              };
              const updated = [...events, ev];
              setEvents(updated);
              saveLocal(EVENTS_KEY, updated);
              fetch('/api/kv-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'events', data: updated }) }).catch(() => {});
              setNewEventName(''); setNewEventStart(''); setNewEventDate(''); setNewEventDuration('7'); setNewEventMult('1.5'); setNewEventCat('');
              setEventSavedOk(true); setTimeout(() => setEventSavedOk(false), 2000);
            }} style={{ ...s.btn, background: '#3b82f6', color: 'white' }}>
              + Tambah Event
            </button>
            {eventSavedOk && <span style={{ color: '#10b981', fontSize: 13, marginLeft: 12 }}>✅ Tersimpan!</span>}
          </div>

          {/* Events List */}
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              Belum ada event. Tambahkan event di atas untuk menyesuaikan forecast demand.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Nama Event', 'Tanggal', 'Durasi', 'Mulai (hari)', 'Multiplier', 'Kategori', 'Aksi'].map(h => <th key={h} style={s.thead}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td style={s.td}><strong>{ev.name}</strong></td>
                    <td style={{ ...s.td, color: ev.startDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>{ev.startDate ?? '—'}</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)' }}>{ev.durationDays ?? 14} hari</td>
                    <td style={s.td}>+{ev.startDay} hari</td>
                    <td style={{ ...s.td, fontWeight: 600, color: '#f59e0b' }}>{ev.multiplier}× demand</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)' }}>{ev.category || 'Semua'}</td>
                    <td style={s.td}>
                      <button onClick={() => {
                        const updated = events.filter(e => e.id !== ev.id);
                        setEvents(updated);
                        saveLocal(EVENTS_KEY, updated);
                        fetch('/api/kv-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'events', data: updated }) }).catch(() => {});
                      }} style={{ ...s.btn, padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            💡 Event ini digunakan di halaman <strong style={{ color: '#8b5cf6' }}>Forecast Stok</strong> dan <strong style={{ color: '#8b5cf6' }}>Purchase Planner</strong> untuk menyesuaikan proyeksi demand. Isi <strong>Tanggal Event</strong> agar sistem dapat menghitung deadline order otomatis di Dashboard.
          </div>
        </div>
      )}

      {/* ─── ROADMAP TAB ────────────────────────────────────── */}
      {tab === 'roadmap' && (
        <div style={s.card}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>🗺️ Roadmap Pengembangan</div>
          {[
            { fase: 'Fase 1',   label: 'Web App Live',              done: true,  desc: 'Dashboard Next.js online di Vercel, dark theme, data demo' },
            { fase: 'Fase 2',   label: 'Jubelio Live Integration',  done: true,  desc: 'Data real-time stok 399 SKU, tagihan, sales per channel' },
            { fase: 'Fase 2.1', label: 'HPP Manual Input',          done: true,  desc: 'Input HPP per SKU, export/import CSV, margin akurat, sync Supabase' },
            { fase: 'Fase 2.2', label: 'Lead Time per Kategori',    done: true,  desc: 'Konfigurasi lead time per supplier/kategori untuk reorder yang akurat' },
            { fase: 'Fase 2.3', label: 'Stok & Velocity Import',    done: true,  desc: 'Import snapshot stok + avg harian dari CSV → Planner otomatis' },
            { fase: 'Fase 3',   label: 'Smart Purchase Planner',    done: true,  desc: 'ABC Analysis, EOQ otomatis, Reorder Point, proyeksi 30/60/90 hari' },
            { fase: 'Fase 4',   label: 'COGS & Laporan Live',       done: false, desc: 'True COGS otomatis dari data Jubelio, laporan profit lengkap' },
          ].map(item => (
            <div key={item.fase} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: item.done ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {item.done ? '✅' : '⏳'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.fase}: {item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
