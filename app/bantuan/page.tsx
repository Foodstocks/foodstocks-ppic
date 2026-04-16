'use client';

import { useState } from 'react';

const s = {
  page: { padding: '24px', maxWidth: 960, fontFamily: 'Inter, system-ui, sans-serif' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 24, marginBottom: 16 } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  term: { fontWeight: 700, color: '#111827', fontSize: 14 } as React.CSSProperties,
  def: { color: '#374151', fontSize: 13, lineHeight: 1.7, marginBottom: 4 } as React.CSSProperties,
  formula: { background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 12px', fontFamily: 'monospace', fontSize: 13, color: '#3B82F6', display: 'inline-block', marginTop: 4, marginBottom: 4 } as React.CSSProperties,
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block', marginRight: 8 } as React.CSSProperties),
  row: { paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #F3F4F6' } as React.CSSProperties,
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconPie = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
  </svg>
);
const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1.5"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IconGear = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Data ──────────────────────────────────────────────────────────────────────

const menus = [
  {
    path: '/',
    label: 'Dashboard',
    color: '#D60001',
    iconBg: '#FEF2F2',
    icon: <IconDashboard />,
    purpose: 'Pusat komando harian — ringkasan kondisi bisnis dalam satu layar.',
    features: [
      'KPI Cards: Total SKU aktif, stok kritis, PO pending, dan modal ratio bulan ini',
      'Stock Ticker 3-level: jumlah SKU kritis / perlu reorder / aman — klik langsung ke Planner',
      'Banner PO: notifikasi PO terlambat bayar (merah) dan PO jatuh tempo minggu ini (kuning)',
      'Smart Alerts: analisa otomatis URGENT → WARNING → INFO → PELUANG berdasarkan semua data',
      'Stock Health Chart: bar chart 8 SKU paling kritis berdasarkan sisa hari stok',
      'Recent POs: tabel 7 PO terakhir dengan status pembayaran',
    ],
    usage: 'Buka pertama kali setiap pagi. Jika ada alert URGENT merah → tindak lanjut sebelum kegiatan lain.',
    roles: ['Owner', 'Manajer', 'PPIC'],
  },
  {
    path: '/inventory',
    label: 'Inventory',
    color: '#D60001',
    iconBg: '#FEF2F2',
    icon: <IconBox />,
    purpose: 'Tampilan lengkap semua stok real-time dari Jubelio WMS.',
    features: [
      'Tabel semua SKU dengan stok aktual, harga beli, harga jual, dan kategori',
      'Filter berdasarkan kategori produk',
      'Search SKU atau nama produk',
      'Status stok per SKU: Kritis / Rendah / Aman / Overstock',
      'Data diambil langsung dari Jubelio — selalu up-to-date dengan stok fisik',
    ],
    usage: 'Gunakan untuk pengecekan stok spesifik atau audit produk. Bukan untuk keputusan beli (gunakan Planner untuk itu).',
    roles: ['PPIC', 'Admin Gudang'],
  },
  {
    path: '/planner',
    label: 'Purchase Planner',
    color: '#3B82F6',
    iconBg: '#EFF6FF',
    icon: <IconCart />,
    purpose: 'Mesin rekomendasi pembelian — hitung otomatis berapa dan kapan harus beli setiap SKU.',
    features: [
      'Status per SKU: Beli Sekarang / Persiapan / Aman / Kurang Data',
      'Badge ABC (A/B/C) per SKU berdasarkan kontribusi revenue — bantu prioritas',
      'Reorder Point: batas stok minimum sebelum order harus dilakukan',
      'EOQ: jumlah pembelian optimal untuk minimasi biaya order + biaya simpan',
      'Recommended Qty: jumlah yang disarankan dibeli saat ini',
      'Estimated Cost: total estimasi biaya untuk semua yang perlu dibeli',
      'Draft PO: generate daftar pembelian dikelompokkan per supplier',
      'Detail toggle: tampilkan kolom tambahan (velocity, margin, kategori gerak)',
    ],
    usage: 'Cek setiap pagi setelah Dashboard. SKU dengan status "Beli Sekarang" (merah) → segera buat PO ke supplier.',
    roles: ['PPIC', 'Purchasing'],
  },
  {
    path: '/po-budget',
    label: 'PO & Budget',
    color: '#F59E0B',
    iconBg: '#FFFBEB',
    icon: <IconDoc />,
    purpose: 'Tracking semua Purchase Order dan monitoring penggunaan budget pembelian bulanan.',
    features: [
      'Budget Meter: visualisasi budget terpakai vs sisa budget bulan ini',
      'Banner overdue: PO yang sudah melewati tanggal jatuh tempo (merah)',
      'Banner upcoming: PO yang jatuh tempo dalam 7 hari ke depan (kuning)',
      'Tabel semua PO dengan countdown jatuh tempo (H-N atau "Telat X hari")',
      'Filter berdasarkan status: Semua / Pending / Lunas / Batal',
      'Edit budget: klik ikon pensil untuk ubah target budget bulanan',
    ],
    usage: 'Update status PO setelah pembayaran dilakukan. Pantau setiap Senin untuk pastikan tidak ada yang terlewat.',
    roles: ['Finance', 'Owner', 'PPIC'],
  },
  {
    path: '/cogs',
    label: 'COGS & Margin',
    color: '#8B5CF6',
    iconBg: '#F5F3FF',
    icon: <IconPie />,
    purpose: 'Analisis profitabilitas per SKU — berapa margin nyata setelah diperhitungkan biaya modal dan biaya simpan.',
    features: [
      'True COGS: HPP + biaya modal tertahan + biaya penyimpanan per unit',
      'Gross Margin: margin berdasarkan HPP saja vs True COGS (perbandingan dua kolom)',
      'Alert margin negatif: banner merah jika ada SKU yang jual rugi',
      'Margin bar: visualisasi margin tiap produk dalam tabel',
      'Detail toggle: tampilkan kolom harga jual, margin sederhana, selisih vs True COGS',
      'Collapsible formula: penjelasan lengkap rumus True COGS',
      'KPI Summary: rata-rata margin, SKU margin ≥35%, SKU margin <25%, SKU negatif',
    ],
    usage: 'Review setiap 2 minggu atau setelah ada perubahan harga beli. SKU dengan margin negatif → evaluasi harga jual atau negosiasi HPP.',
    roles: ['Owner', 'Manajer', 'Finance'],
  },
  {
    path: '/forecast',
    label: 'Forecast Stok',
    color: '#10B981',
    iconBg: '#F0FDF4',
    icon: <IconTrend />,
    purpose: 'Proyeksi kehabisan stok 30–90 hari ke depan berdasarkan kecepatan jual (velocity) aktual, termasuk lonjakan demand untuk event musiman.',
    features: [
      'Tabel proyeksi per SKU: sisa stok saat ini, velocity harian, estimasi hari habis, status urgency',
      'Filter periode: 30 / 60 / 90 hari ke depan — lihat mana yang habis dalam window tersebut',
      'Filter urgency: Semua / Urgent (< lead time) / Siapkan (< 7 hari) / Aman',
      'Pre-event badges: dot merah/kuning/hijau per SKU menunjukkan urgency order sebelum event besar',
      'Event timeline strip: daftar event mendatang + deadline order (kapan harus PO agar tiba sebelum event)',
      'Notifikasi otomatis: setiap pagi jam 09:00 WIB, email dikirim jika ada SKU kritis atau PO jatuh tempo',
      'Butuh data velocity: fitur ini hanya bekerja penuh setelah velocity diisi di Settings → Stok & Velocity',
    ],
    usage: 'Cek setiap Senin untuk rencanakan PO minggu ini. Gunakan juga H-45 sebelum event besar (Lebaran, Harbolnas) untuk hitung tambahan stok yang dibutuhkan.',
    roles: ['PPIC', 'Owner', 'Purchasing'],
  },
  {
    path: '/smart-events',
    label: 'Smart Events',
    color: '#F59E0B',
    iconBg: '#FFFBEB',
    icon: <IconStar />,
    purpose: 'Analisa AI untuk event musiman mendatang — hitung otomatis berapa stok tambahan yang dibutuhkan per SKU untuk setiap event.',
    features: [
      'Deteksi event otomatis: sistem membaca Event Calendar di Settings dan menampilkan event yang akan datang',
      'Rekomendasi per event: untuk setiap event (Lebaran, Harbolnas, dll), tampilkan daftar SKU yang perlu ditambah stoknya',
      'Kolom rekomendasi: Stok Sekarang, Jual/Hari, Rec. Beli Tambahan, Est. Biaya, Alasan',
      'Badge urgency: ⚡ URGENT jika event ≤ 7 hari lagi, beserta countdown hari',
      'Demand multiplier: tiap event punya faktor pengali (misal Lebaran = 2× normal) — bisa diatur di Settings',
      'Total budget estimate: tampilkan total biaya tambahan stok yang dibutuhkan per event',
      'Riwayat analisa: simpan hasil analisa sebelumnya untuk perbandingan',
      'Butuh Event Calendar: isi event di Settings → Tab Event Calendar terlebih dahulu',
    ],
    usage: 'Gunakan 4–6 minggu sebelum event besar. Klik "Analisa Sekarang" → lihat SKU yang direkomendasikan → gunakan hasilnya untuk buat PO tambahan.',
    roles: ['PPIC', 'Owner', 'Purchasing'],
  },
  {
    path: '/suppliers',
    label: 'Supplier Hub',
    color: '#10B981',
    iconBg: '#F0FDF4',
    icon: <IconTruck />,
    purpose: 'Database dan evaluasi performa semua supplier — siapa yang handal, siapa yang perlu dievaluasi.',
    features: [
      'KPI Cards: jumlah supplier aktif, yang punya email, grade terbaik, total spend',
      'Grade A–F per supplier berdasarkan histori: ketepatan waktu, kesesuaian produk, harga',
      'View Scorecard: kartu detail per supplier dengan semua metrik',
      'View List: tabel ringkas dengan kolom grade dan status',
      'Grade legend: penjelasan A = sangat baik, F = tidak direkomendasikan',
    ],
    usage: 'Review setiap bulan. Supplier dengan grade D/F → pertimbangkan cari alternatif atau renegotiasi syarat.',
    roles: ['Purchasing', 'Owner'],
  },
  {
    path: '/settings',
    label: 'Settings',
    color: '#6B7280',
    iconBg: '#F9FAFB',
    icon: <IconGear />,
    purpose: 'Konfigurasi semua parameter bisnis — harus diisi sebelum fitur-fitur kalkulasi bekerja penuh.',
    features: [
      'Tab HPP per SKU: isi harga pokok pembelian per produk (bisa upload CSV)',
      'Tab Stok & Velocity: tarik data kecepatan jual dari Jubelio atau upload manual',
      'Tab Lead Time: set berapa hari pengiriman per supplier / kategori / default',
      'Tab Mapping Supplier: hubungkan SKU ke nama suppliernya',
      'Tab Event Calendar: tambah event musiman (Lebaran, Natal, dll) untuk forecast akurat',
      'Tab Parameter Bisnis: set budget PO bulanan, holding rate, biaya order',
      'Tab Sync & Backup: sinkronisasi data ke cloud (Supabase) dan export/import',
    ],
    usage: 'Setup awal wajib dilakukan oleh admin. Setelah itu, update HPP setiap ada perubahan harga beli dari supplier.',
    roles: ['Admin', 'Owner'],
  },
];

const workflows = [
  {
    period: 'Setiap Pagi',
    color: '#D60001',
    bg: '#FEF2F2',
    border: '#FECACA',
    steps: [
      { time: '08:00', action: 'Buka Dashboard', detail: 'Cek Smart Alerts — ada URGENT merah? Tindak langsung sebelum lanjut.' },
      { time: '08:05', action: 'Cek Stock Ticker', detail: 'Lihat jumlah Kritis / Perlu Reorder di ticker atas. Klik untuk masuk ke Planner.' },
      { time: '08:10', action: 'Buka Purchase Planner', detail: 'Filter "Beli Sekarang" (merah). Semua yang muncul → segera siapkan PO.' },
      { time: '08:20', action: 'Cek PO & Budget', detail: 'Ada banner overdue merah? Hubungi supplier. Ada banner H-3? Siapkan pembayaran.' },
    ],
  },
  {
    period: 'Setiap Senin (Weekly)',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    steps: [
      { time: 'Pagi', action: 'Review Purchase Planner lengkap', detail: 'Filter "Persiapan" (kuning) — siapkan PO untuk minggu ini sebelum jadi kritis.' },
      { time: 'Siang', action: 'Update status PO', detail: 'Di PO & Budget, update PO yang sudah dibayar menjadi Lunas.' },
      { time: 'Siang', action: 'Cek Forecast Stok', detail: 'Lihat SKU dengan status Urgent — ada yang habis sebelum PO tiba? Segera siapkan order.' },
      { time: 'Sore', action: 'Cek Smart Events', detail: 'Ada event ≤ 30 hari? Klik "Analisa Sekarang" → lihat rekomendasi stok tambahan per SKU.' },
      { time: 'Sore', action: 'Review Supplier Hub', detail: 'Ada supplier baru? Ada yang perlu di-update kontaknya?' },
    ],
  },
  {
    period: 'Setiap Bulan',
    color: '#059669',
    bg: '#F0FDF4',
    border: '#A7F3D0',
    steps: [
      { time: 'Awal Bulan', action: 'Update HPP di Settings', detail: 'Jika ada perubahan harga beli dari supplier bulan ini, update di tab HPP.' },
      { time: 'Awal Bulan', action: 'Tarik Velocity dari Jubelio', detail: 'Settings → Stok & Velocity → "Tarik dari Jubelio" untuk update data kecepatan jual.' },
      { time: 'Pekan 1', action: 'Review COGS & Margin', detail: 'Cek SKU margin negatif. Ada? → evaluasi harga jual atau negosiasi HPP supplier.' },
      { time: 'Pekan 1', action: 'Update budget bulanan', detail: 'PO & Budget → klik ikon pensil di Budget Meter → isi budget bulan baru.' },
      { time: 'Akhir Bulan', action: 'Review grade supplier', detail: 'Supplier Hub → ada yang turun grade? → evaluasi atau cari alternatif.' },
      { time: 'Akhir Bulan', action: 'Cek Forecast 90 hari', detail: 'Forecast → pilih "90 hari" → pastikan semua event 2 bulan ke depan sudah ter-plan.' },
    ],
  },
];

const roles = [
  {
    name: 'Owner / Manajer',
    color: '#D60001',
    bg: '#FEF2F2',
    pages: ['Dashboard', 'COGS & Margin', 'Forecast Stok', 'PO & Budget'],
    focus: 'Pantau kondisi bisnis, profitabilitas, dan cash flow pembelian. Tidak perlu masuk ke detail operasional harian.',
    tips: [
      'Dashboard cukup dilihat 1× sehari — Smart Alerts sudah merangkum semua yang kritis',
      'COGS & Margin minimal 2 minggu sekali — pastikan tidak ada SKU jual rugi',
      'Fokus pada KPI cards dan alert URGENT; detail tabel bisa didelegasikan ke PPIC',
    ],
  },
  {
    name: 'Tim PPIC / Purchasing',
    color: '#3B82F6',
    bg: '#EFF6FF',
    pages: ['Purchase Planner', 'Forecast Stok', 'Smart Events', 'PO & Budget', 'Supplier Hub'],
    focus: 'Operasional harian: pastikan stok tidak pernah habis, PO selalu tepat waktu, supplier terkelola.',
    tips: [
      'Mulai hari dengan Planner — filter "Beli Sekarang", buat PO untuk semua yang merah',
      'Gunakan fitur Draft PO di Planner untuk generate daftar pembelian per supplier sekaligus',
      'Smart Events: cek 4–6 minggu sebelum event besar untuk siapkan stok tambahan',
      'Set lead time akurat di Settings → kalkulasi reorder point akan lebih presisi',
      'Badge ABC di Planner: prioritaskan SKU A dulu, baru B dan C',
    ],
  },
  {
    name: 'Admin / Finance',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    pages: ['Settings', 'PO & Budget', 'COGS & Margin'],
    focus: 'Konfigurasi sistem, update HPP, dan tracking pembayaran PO.',
    tips: [
      'Setup awal Settings wajib sebelum tim lain bisa pakai sistem dengan benar',
      'Update HPP segera setelah terima invoice baru dari supplier — berpengaruh ke semua kalkulasi',
      'PO & Budget: update status Lunas setelah transfer dilakukan',
      'Gunakan fitur Sync di Settings untuk backup data ke cloud secara berkala',
    ],
  },
];

// ── Glossary (existing content) ───────────────────────────────────────────────

const glossarySections = [
  {
    icon: '📦',
    title: 'Status Stok',
    items: [
      { badge: <span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>Kritis</span>, term: 'KRITIS', def: 'Sisa stok ≤ Lead Time. Stok akan habis SEBELUM barang baru tiba. Harus beli sekarang!', formula: 'Sisa Hari ≤ Lead Time Supplier' },
      { badge: <span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>Rendah</span>, term: 'RENDAH', def: 'Sisa stok antara 1–1.5× Lead Time. Hampir habis, perlu segera persiapan order.', formula: 'Lead Time < Sisa Hari ≤ Lead Time × 1.5' },
      { badge: <span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>Aman</span>, term: 'AMAN', def: 'Stok cukup untuk memenuhi kebutuhan dalam periode normal. Tidak perlu tindakan segera.', formula: 'Sisa Hari > Lead Time × 1.5 (dan ≤ 30 hari)' },
      { badge: <span style={s.badge('rgba(139,92,246,0.15)', '#8b5cf6')}>Overstock</span>, term: 'OVERSTOCK', def: 'Stok berlebih, jauh di atas kebutuhan normal. Tahan order, evaluasi pola penjualan.', formula: 'Sisa Hari > 30 hari' },
    ],
  },
  {
    icon: '🚀',
    title: 'Movement Category (Kategori Pergerakan)',
    items: [
      { badge: <span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>A — Super Fast</span>, term: 'A (Super Fast Moving)', def: 'Produk terjual sangat cepat, sisa stok ≤ 7 hari. Prioritas utama untuk selalu ada stok.', formula: 'Sisa Hari ≤ 7' },
      { badge: <span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>B — Fast</span>, term: 'B (Fast Moving)', def: 'Produk terjual cepat, sisa stok 7–14 hari. Perlu monitoring rutin.', formula: '7 < Sisa Hari ≤ 14' },
      { badge: <span style={s.badge('rgba(59,130,246,0.15)', '#3b82f6')}>C — Medium</span>, term: 'C (Medium Moving)', def: 'Produk dengan perputaran sedang, sisa stok 15–30 hari.', formula: '14 < Sisa Hari ≤ 30' },
      { badge: <span style={s.badge('rgba(100,116,139,0.15)', '#64748b')}>Slow</span>, term: 'Slow Moving', def: 'Produk perputaran lambat, sisa stok > 30 hari. Pertimbangkan sistem PO khusus atau kurangi safety stock.', formula: 'Sisa Hari > 30' },
    ],
  },
  {
    icon: '📊',
    title: 'Analisis ABC',
    items: [
      { term: 'Apa itu ABC Analysis?', def: 'Metode klasifikasi produk berdasarkan kontribusi nilai penjualan. Membantu menentukan mana produk yang perlu diprioritaskan dalam manajemen stok.' },
      { badge: <span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>A</span>, term: 'Kategori A — top SKU covering ~80% revenue', def: 'Produk kontributor terbesar. Harus selalu tersedia, monitoring ketat, reorder tepat waktu.' },
      { badge: <span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>B</span>, term: 'Kategori B — SKU covering 80–95% revenue', def: 'Produk kelas menengah. Monitoring berkala, safety stock moderat.' },
      { badge: <span style={s.badge('rgba(100,116,139,0.15)', '#64748b')}>C</span>, term: 'Kategori C — SKU sisanya', def: 'Kontribusi nilai kecil. Order berdasarkan permintaan (just-in-time), minimal safety stock.' },
    ],
  },
  {
    icon: '🎯',
    title: 'Reorder Point (ROP)',
    items: [
      { term: 'Apa itu ROP?', def: 'Titik stok minimum yang memicu perintah pembelian. Ketika stok mencapai ROP, order harus segera dilakukan agar barang tiba sebelum stok habis.', formula: 'ROP = Rata-rata Penjualan Harian × Lead Time × Safety Factor' },
      { term: 'Contoh', def: 'Penjualan 10 unit/hari, Lead Time 5 hari, Safety Factor 1.2 → ROP = 10 × 5 × 1.2 = 60 unit. Saat stok turun ke 60, langsung order.' },
    ],
  },
  {
    icon: '📐',
    title: 'EOQ — Economic Order Quantity',
    items: [
      { term: 'Apa itu EOQ?', def: 'Jumlah optimal pemesanan yang meminimalkan total biaya (biaya order + biaya simpan). Menghindari order terlalu sedikit atau terlalu banyak.', formula: 'EOQ = √( 2 × Permintaan Tahunan × Biaya Order / (HPP × Holding Rate) )' },
      { term: 'Parameter yang digunakan', def: 'Biaya Order Default: Rp 50.000/order · Holding Rate: 2% dari nilai stok per bulan (dapat diubah di Settings)' },
    ],
  },
  {
    icon: '💹',
    title: 'COGS & Margin',
    items: [
      { term: 'COGS (Cost of Goods Sold)', def: 'Total biaya pokok dari barang yang sudah terjual. Mencakup HPP (harga beli) × unit terjual.', formula: 'COGS = HPP per unit × Qty Terjual' },
      { term: 'True COGS', def: 'HPP ditambah biaya modal tertahan (cost of fund) dan biaya penyimpanan per unit. Angka ini lebih realistis dari sekadar HPP.', formula: 'True COGS = HPP + Cost of Fund per unit + Storage Cost per unit' },
      { term: 'Gross Margin', def: 'Selisih antara harga jual dan HPP/True COGS dalam persen.', formula: 'Gross Margin = (Harga Jual - True COGS) / Harga Jual × 100%' },
    ],
  },
  {
    icon: '📈',
    title: 'Velocity & Lead Time',
    items: [
      { term: 'Velocity', def: 'Rata-rata unit yang terjual per hari untuk setiap SKU. Input utama untuk semua kalkulasi.', formula: 'Velocity = Total Terjual 30 Hari ÷ 30' },
      { term: 'Cara mengisi Velocity', def: '1) Tarik otomatis dari Jubelio (tombol "Tarik dari Jubelio" di Settings → Tab Stok & Velocity)\n2) Upload CSV manual dengan kolom: sku, avg_daily_sales' },
      { term: 'Lead Time', def: 'Jumlah hari dari order dikirim ke supplier sampai barang tiba di gudang. Semakin panjang, semakin besar safety stock yang dibutuhkan.' },
      { term: 'Cara mengatur Lead Time', def: 'Settings → Tab Lead Time: bisa set per-SKU, per-kategori, atau default global. Default: 3 hari.' },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BantuanPage() {
  const [tab, setTab] = useState<'menu' | 'workflow' | 'glossary'>('menu');

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'menu', label: 'Panduan Menu' },
    { key: 'workflow', label: 'Alur Kerja Tim' },
    { key: 'glossary', label: 'Kamus Istilah' },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Bantuan</div>
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', paddingLeft: 46 }}>Panduan penggunaan aplikasi dan referensi istilah Foodstocks PPIC</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#111827' : '#6B7280',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PANDUAN MENU ──────────────────────────────────── */}
      {tab === 'menu' && (
        <div>
          {menus.map(menu => (
            <div key={menu.path} style={s.card}>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: menu.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: menu.color, flexShrink: 0 }}>
                  {menu.icon}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{menu.label}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{menu.path}</div>
                </div>
                {/* Role badges */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {menu.roles.map(role => (
                    <span key={role} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280', fontWeight: 600 }}>
                      <IconUser />{role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Purpose */}
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 14, paddingLeft: 52 }}>
                {menu.purpose}
              </div>

              {/* Features */}
              <div style={{ paddingLeft: 52, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Fitur</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {menu.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, background: menu.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: menu.color, flexShrink: 0, marginTop: 1 }}>
                        <IconCheck />
                      </span>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usage tip */}
              <div style={{ paddingLeft: 52 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ color: menu.color, flexShrink: 0, marginTop: 1 }}>
                    <IconClock />
                  </div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}><strong>Kapan digunakan: </strong>{menu.usage}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: ALUR KERJA TIM ────────────────────────────────── */}
      {tab === 'workflow' && (
        <div>
          {/* Role cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
            {roles.map(role => (
              <div key={role.name} style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: role.color }}>
                    <IconUser />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{role.name}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, lineHeight: 1.6 }}>{role.focus}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Halaman utama</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {role.pages.map(p => (
                    <span key={p} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: role.bg, color: role.color, fontWeight: 600 }}>{p}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Tips</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {role.tips.map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: role.color, flexShrink: 0, marginTop: 7 }} />
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Workflow timelines */}
          {workflows.map(wf => (
            <div key={wf.period} style={{ ...s.card, borderLeft: `4px solid ${wf.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: wf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: wf.color }}>
                  <IconClock />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{wf.period}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {wf.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < wf.steps.length - 1 ? 16 : 0 }}>
                    {/* Timeline line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 60 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: wf.color, textAlign: 'center', lineHeight: 1.4 }}>{step.time}</div>
                      {i < wf.steps.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: wf.border, marginTop: 4 }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < wf.steps.length - 1 ? 4 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{step.action}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Quick tips box */}
          <div style={{ ...s.card, background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3B82F6', marginBottom: 12 }}>Setup Awal — Wajib Dilakukan Sebelum Mulai</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13, lineHeight: 2.2 }}>
              <li>Isi <strong style={{ color: '#111827' }}>HPP</strong> di Settings → Tab HPP per SKU (bisa CSV upload)</li>
              <li>Tarik <strong style={{ color: '#111827' }}>Velocity</strong> di Settings → Tab Stok & Velocity → klik "Tarik dari Jubelio"</li>
              <li>Set <strong style={{ color: '#111827' }}>Lead Time</strong> per supplier/kategori di Settings → Tab Lead Time</li>
              <li>Hubungkan <strong style={{ color: '#111827' }}>SKU ke Supplier</strong> di Settings → Tab Mapping Supplier</li>
              <li>Set <strong style={{ color: '#111827' }}>Budget PO</strong> bulanan di PO & Budget → klik ikon pensil di meter budget</li>
              <li>Tambah <strong style={{ color: '#111827' }}>Event Musiman</strong> di Settings → Tab Event Calendar (opsional tapi sangat disarankan)</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── TAB: KAMUS ISTILAH ─────────────────────────────────── */}
      {tab === 'glossary' && (
        <div>
          {glossarySections.map(section => (
            <div key={section.title} style={s.card}>
              <div style={s.sectionTitle}>
                <span style={{ fontSize: 20 }}>{section.icon}</span>
                {section.title}
              </div>
              {section.items.map((item, i) => (
                <div key={i} style={i < section.items.length - 1 ? s.row : { paddingBottom: 0 }}>
                  <div style={{ marginBottom: 4 }}>
                    {'badge' in item && item.badge}
                    <span style={s.term}>{item.term}</span>
                  </div>
                  <div style={s.def}>{item.def}</div>
                  {'formula' in item && item.formula && (
                    <div style={s.formula}>{item.formula}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
