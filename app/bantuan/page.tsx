'use client';

const s = {
  page: { padding: '24px', maxWidth: 900 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 } as React.CSSProperties,
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-card)', padding: 24, marginBottom: 20 } as React.CSSProperties,
  sectionTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  term: { fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 } as React.CSSProperties,
  def: { color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 4 } as React.CSSProperties,
  formula: { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontFamily: 'monospace', fontSize: 13, color: '#3b82f6', display: 'inline-block', marginTop: 4, marginBottom: 4 } as React.CSSProperties,
  badge: (bg: string, color: string) => ({ background: bg, color, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, display: 'inline-block', marginRight: 8 } as React.CSSProperties),
  row: { paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' } as React.CSSProperties,
};

const sections = [
  {
    icon: '📦',
    title: 'Status Stok',
    items: [
      {
        badge: <><span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>🔴 Kritis</span></>,
        term: 'KRITIS',
        def: 'Sisa stok ≤ Lead Time. Stok akan habis SEBELUM barang baru tiba. Harus beli sekarang!',
        formula: 'Sisa Hari ≤ Lead Time Supplier',
      },
      {
        badge: <><span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>🟡 Rendah</span></>,
        term: 'RENDAH',
        def: 'Sisa stok antara 1–1.5× Lead Time. Hampir habis, perlu segera persiapan order.',
        formula: 'Lead Time < Sisa Hari ≤ Lead Time × 1.5',
      },
      {
        badge: <><span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>🟢 Aman</span></>,
        term: 'AMAN',
        def: 'Stok cukup untuk memenuhi kebutuhan dalam periode normal. Tidak perlu tindakan segera.',
        formula: 'Sisa Hari > Lead Time × 1.5 (dan ≤ 30 hari)',
      },
      {
        badge: <><span style={s.badge('rgba(139,92,246,0.15)', '#8b5cf6')}>📦 Overstock</span></>,
        term: 'OVERSTOCK',
        def: 'Stok berlebih, jauh di atas kebutuhan normal. Tahan order, evaluasi pola penjualan.',
        formula: 'Sisa Hari > 30 hari',
      },
    ],
  },
  {
    icon: '🚀',
    title: 'Movement Category (Kategori Pergerakan)',
    items: [
      {
        badge: <><span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>A — Super Fast</span></>,
        term: 'A (Super Fast Moving)',
        def: 'Produk terjual sangat cepat, sisa stok ≤ 7 hari. Prioritas utama untuk selalu ada stok.',
        formula: 'Sisa Hari ≤ 7',
      },
      {
        badge: <><span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>B — Fast</span></>,
        term: 'B (Fast Moving)',
        def: 'Produk terjual cepat, sisa stok 7–14 hari. Perlu monitoring rutin.',
        formula: '7 < Sisa Hari ≤ 14',
      },
      {
        badge: <><span style={s.badge('rgba(59,130,246,0.15)', '#3b82f6')}>C — Medium</span></>,
        term: 'C (Medium Moving)',
        def: 'Produk dengan perputaran sedang, sisa stok 15–30 hari.',
        formula: '14 < Sisa Hari ≤ 30',
      },
      {
        badge: <><span style={s.badge('rgba(100,116,139,0.15)', '#64748b')}>Slow</span></>,
        term: 'Slow Moving',
        def: 'Produk perputaran lambat, sisa stok > 30 hari. Pertimbangkan sistem PO khusus atau kurangi safety stock.',
        formula: 'Sisa Hari > 30',
      },
    ],
  },
  {
    icon: '⏳',
    title: 'Stock Aging (Umur Stok)',
    items: [
      {
        badge: <><span style={s.badge('rgba(16,185,129,0.15)', '#10b981')}>FRESH</span></>,
        term: 'FRESH',
        def: 'Stok baru masuk, usia < 30 hari di gudang. Kondisi optimal.',
        formula: 'Usia Stok < 30 hari',
      },
      {
        badge: <><span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>AGING</span></>,
        term: 'AGING',
        def: 'Stok sudah 30–60 hari di gudang. Mulai perhatikan rotasi produk (FIFO).',
        formula: '30 ≤ Usia < 60 hari',
      },
      {
        badge: <><span style={s.badge('rgba(249,115,22,0.15)', '#f97316')}>OLD</span></>,
        term: 'OLD',
        def: 'Stok sudah 60–90 hari di gudang. Evaluasi apakah perlu promosi untuk percepat penjualan.',
        formula: '60 ≤ Usia < 90 hari',
      },
      {
        badge: <><span style={s.badge('rgba(148,163,184,0.15)', '#94a3b8')}>DEAD</span></>,
        term: 'DEAD STOCK',
        def: 'Stok > 90 hari di gudang. Tanda produk tidak terjual dengan baik. Perlu tindakan: diskon, bundling, atau return ke supplier.',
        formula: 'Usia Stok ≥ 90 hari',
      },
    ],
  },
  {
    icon: '📊',
    title: 'Analisis ABC',
    items: [
      {
        term: 'Apa itu ABC Analysis?',
        def: 'Metode klasifikasi produk berdasarkan kontribusi nilai penjualan. Membantu menentukan mana produk yang perlu diprioritaskan dalam manajemen stok.',
      },
      {
        badge: <><span style={s.badge('rgba(239,68,68,0.15)', '#ef4444')}>A</span></>,
        term: 'Kategori A — Top 20% SKU',
        def: '20% produk teratas yang menyumbang nilai penjualan terbesar. Harus selalu tersedia, monitoring ketat, reorder otomatis.',
      },
      {
        badge: <><span style={s.badge('rgba(245,158,11,0.15)', '#f59e0b')}>B</span></>,
        term: 'Kategori B — 30% SKU Berikutnya',
        def: 'Produk kelas menengah. Monitoring berkala, safety stock moderat.',
      },
      {
        badge: <><span style={s.badge('rgba(100,116,139,0.15)', '#64748b')}>C</span></>,
        term: 'Kategori C — 50% SKU Terbawah',
        def: 'Produk dengan kontribusi nilai kecil. Bisa order berdasarkan permintaan (just-in-time), minimal safety stock.',
      },
    ],
  },
  {
    icon: '🎯',
    title: 'Reorder Point (ROP)',
    items: [
      {
        term: 'Apa itu ROP?',
        def: 'Titik stok minimum yang memicu perintah pembelian (order). Ketika stok mencapai ROP, order harus segera dilakukan agar barang tiba sebelum stok habis.',
        formula: 'ROP = Rata-rata Penjualan Harian × Lead Time × Safety Factor',
      },
      {
        term: 'Contoh',
        def: 'Penjualan 10 unit/hari, Lead Time 5 hari, Safety Factor 1.2 → ROP = 10 × 5 × 1.2 = 60 unit. Saat stok turun ke 60, langsung order.',
      },
    ],
  },
  {
    icon: '📐',
    title: 'EOQ — Economic Order Quantity',
    items: [
      {
        term: 'Apa itu EOQ?',
        def: 'Jumlah optimal pemesanan yang meminimalkan total biaya (biaya order + biaya simpan). Menghindari order terlalu sedikit (sering order = mahal) atau terlalu banyak (stok menumpuk = modal tertahan).',
        formula: 'EOQ = √( 2 × Permintaan Tahunan × Biaya Order / (HPP × Holding Rate) )',
      },
      {
        term: 'Parameter yang digunakan',
        def: 'Biaya Order Default: Rp 50.000/order · Holding Rate: 2% dari nilai stok per bulan (dapat diubah di Settings)',
      },
    ],
  },
  {
    icon: '💰',
    title: 'Cost of Fund (Biaya Modal)',
    items: [
      {
        term: 'Apa itu Cost of Fund?',
        def: 'Biaya modal yang tertahan dalam bentuk stok di gudang. Setiap rupiah yang ada di stok sebenarnya memiliki biaya opportunity — uang tersebut bisa dipakai untuk hal lain atau menghasilkan bunga.',
        formula: 'Cost of Fund = Nilai Stok × Rate Modal (2%/bulan) × (Hari / 30)',
      },
      {
        term: 'Mengapa penting?',
        def: 'Membantu melihat berapa besar biaya "parkir modal" di gudang. Produk Slow Moving dengan nilai stok tinggi → Cost of Fund besar → pertimbangkan kurangi stok atau promosi.',
      },
    ],
  },
  {
    icon: '📈',
    title: 'Velocity (Kecepatan Penjualan)',
    items: [
      {
        term: 'Apa itu Velocity?',
        def: 'Rata-rata unit yang terjual per hari untuk setiap SKU. Ini adalah input utama untuk semua kalkulasi: ROP, EOQ, Forecast, dan status stok.',
        formula: 'Velocity = Total Terjual 30 Hari Terakhir ÷ 30',
      },
      {
        term: 'Cara mengisi Velocity',
        def: '1) Tarik otomatis dari Jubelio (tombol "Tarik dari Jubelio" di Settings → Tab Stok & Velocity)\n2) Upload CSV manual dengan kolom: sku, avg_daily_sales',
      },
    ],
  },
  {
    icon: '🚚',
    title: 'Lead Time',
    items: [
      {
        term: 'Apa itu Lead Time?',
        def: 'Jumlah hari dari saat order dikirim ke supplier sampai barang tiba di gudang. Semakin panjang lead time, semakin besar safety stock yang dibutuhkan.',
      },
      {
        term: 'Cara mengatur Lead Time',
        def: 'Di Settings → Tab Lead Time: bisa set per-SKU, per-kategori, atau default global. Default: 3 hari.',
      },
    ],
  },
  {
    icon: '💹',
    title: 'COGS & Margin',
    items: [
      {
        term: 'COGS (Cost of Goods Sold)',
        def: 'Total biaya pokok dari barang yang sudah terjual. Mencakup HPP (harga beli) × unit terjual.',
        formula: 'COGS = HPP per unit × Qty Terjual',
      },
      {
        term: 'HPP (Harga Pokok Penjualan)',
        def: 'Biaya pembelian per unit dari supplier. Di-input manual di Settings atau diambil dari harga beli terakhir di Jubelio.',
      },
      {
        term: 'Gross Margin',
        def: 'Selisih antara harga jual dan HPP, dalam persen. Menunjukkan profitabilitas per produk.',
        formula: 'Gross Margin = (Harga Jual - HPP) / Harga Jual × 100%',
      },
    ],
  },
];

export default function BantuanPage() {
  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <div style={s.title}>❓ Bantuan & Kamus Istilah</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Penjelasan semua istilah dan metrik yang digunakan di dashboard Foodstocks WMS
        </div>
      </div>

      {sections.map(section => (
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

      <div style={{ ...s.card, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#3b82f6', marginBottom: 8 }}>💡 Tips Memulai</div>
        <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 2 }}>
          <li>Isi <strong style={{ color: 'var(--text-primary)' }}>Velocity</strong> di Settings → Tarik dari Jubelio untuk aktivasi semua kalkulasi</li>
          <li>Isi <strong style={{ color: 'var(--text-primary)' }}>HPP</strong> di Settings → Tab HPP agar margin dan COGS akurat</li>
          <li>Set <strong style={{ color: 'var(--text-primary)' }}>Lead Time</strong> per supplier atau kategori di Settings → Tab Lead Time</li>
          <li>Set <strong style={{ color: 'var(--text-primary)' }}>Budget PO Bulanan</strong> di Settings → Tab Parameter Bisnis</li>
          <li>Tambah <strong style={{ color: 'var(--text-primary)' }}>Event</strong> musiman di Settings → Tab Event Calendar untuk forecast lebih akurat</li>
        </ol>
      </div>
    </div>
  );
}
