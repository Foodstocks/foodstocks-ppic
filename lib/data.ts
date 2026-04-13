// ============================================================
// FOODSTOCKS WMS — Mock Data (Fase 1: hardcoded)
// Will be replaced by live Jubelio API data in Fase 2
// ============================================================

export type AbcCategory = 'A' | 'B' | 'C';
export type StockStatus = 'KRITIS' | 'RENDAH' | 'AMAN' | 'OVERSTOCK';
export type SupplierStatus = 'Aktif' | 'Pending' | 'Selesai';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  abc: AbcCategory;
  stock: number;
  unit: string;
  reorderPoint: number;
  leadTime: number; // days
  avgDailySales: number;
  hpp: number; // Rp per unit
  sellingPrice: number;
  supplier: string;
  status: StockStatus;
  daysRemaining: number;
  lastUpdated: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  tier: 'Utama' | 'Sekunder' | 'Baru';
  status: SupplierStatus;
  negotiationStatus: string;
  currentHPP: number;
  targetHPP: number;
  potential: number;
  leadTime: number; // days
  paymentTerms: string;
  contact: string;
  score: number;
  lastOrder: string;
  nextFollowUp: string;
  notes: string;
}

export interface PurchaseOrder {
  id: string;
  sku: string;
  productName: string;
  supplier: string;
  qty: number;
  unit: string;
  pricePerUnit: number;
  total: number;
  orderDate: string;
  dueDate: string;
  status: 'Lunas' | 'Pending' | 'Cicilan' | 'Overdue';
  paymentTerms: string;
  notes: string;
}

export interface PurchaseRecommendation {
  sku: string;
  name: string;
  abc: AbcCategory;
  stock: number;
  daysRemaining: number;
  status: 'REORDER_NOW' | 'PREPARE' | 'SAFE';
  recommendedQty: number;
  supplier: string;
  estimatedCost: number;
  eoq: number;
  reorderPoint: number;
}

// ============================================================
// INVENTORY DATA
// ============================================================
export const inventoryData: InventoryItem[] = [
  { id: '1', sku: 'BAPPER-ORI', name: 'Bapper Original', category: 'Keripik', abc: 'A', stock: 95, unit: 'pcs', reorderPoint: 120, leadTime: 3, avgDailySales: 45, hpp: 8000, sellingPrice: 13500, supplier: 'Bapper ID', status: 'KRITIS', daysRemaining: 2.1, lastUpdated: '2026-03-25' },
  { id: '2', sku: 'FISHSKIN-SPY', name: 'Fish Skin Spicy', category: 'Keripik Ikan', abc: 'A', stock: 40, unit: 'pcs', reorderPoint: 100, leadTime: 4, avgDailySales: 25, hpp: 12000, sellingPrice: 18500, supplier: 'Raftels', status: 'KRITIS', daysRemaining: 1.6, lastUpdated: '2026-03-25' },
  { id: '3', sku: 'MAICIH-10', name: 'Maicih Level 10', category: 'Keripik', abc: 'B', stock: 48, unit: 'pcs', reorderPoint: 60, leadTime: 5, avgDailySales: 14, hpp: 11000, sellingPrice: 16000, supplier: 'Maicih', status: 'KRITIS', daysRemaining: 3.4, lastUpdated: '2026-03-25' },
  { id: '4', sku: 'SEBLAK-ORI', name: 'Seblak Original', category: 'Seblak', abc: 'A', stock: 180, unit: 'pcs', reorderPoint: 200, leadTime: 3, avgDailySales: 40, hpp: 7500, sellingPrice: 12000, supplier: 'Shanty Baso Aci', status: 'RENDAH', daysRemaining: 4.5, lastUpdated: '2026-03-25' },
  { id: '5', sku: 'BASO-ACI', name: 'Baso Aci Shanty', category: 'Baso Aci', abc: 'A', stock: 220, unit: 'pcs', reorderPoint: 150, leadTime: 2, avgDailySales: 35, hpp: 9500, sellingPrice: 15000, supplier: 'Shanty Baso Aci', status: 'AMAN', daysRemaining: 6.3, lastUpdated: '2026-03-25' },
  { id: '6', sku: 'CIRENG-BUMBU', name: 'Cireng Bumbu Rujak', category: 'Cireng', abc: 'B', stock: 150, unit: 'pcs', reorderPoint: 100, leadTime: 3, avgDailySales: 20, hpp: 6000, sellingPrice: 10000, supplier: 'Cireng Ceu Eti', status: 'AMAN', daysRemaining: 7.5, lastUpdated: '2026-03-25' },
  { id: '7', sku: 'BASRENG-ORI', name: 'Basreng Original', category: 'Basreng', abc: 'A', stock: 300, unit: 'pcs', reorderPoint: 200, leadTime: 2, avgDailySales: 50, hpp: 8500, sellingPrice: 13000, supplier: 'Basreng Neng Via', status: 'AMAN', daysRemaining: 6.0, lastUpdated: '2026-03-25' },
  { id: '8', sku: 'FISHSKIN-BBQ', name: 'Fish Skin BBQ', category: 'Keripik Ikan', abc: 'B', stock: 85, unit: 'pcs', reorderPoint: 80, leadTime: 4, avgDailySales: 18, hpp: 12000, sellingPrice: 18000, supplier: 'Raftels', status: 'AMAN', daysRemaining: 4.7, lastUpdated: '2026-03-25' },
  { id: '9', sku: 'SIOMAY-BKT', name: 'Siomay Bandung', category: 'Siomay', abc: 'B', stock: 60, unit: 'pcs', reorderPoint: 70, leadTime: 3, avgDailySales: 12, hpp: 10500, sellingPrice: 16500, supplier: 'Siomay Pa Eko', status: 'RENDAH', daysRemaining: 5.0, lastUpdated: '2026-03-25' },
  { id: '10', sku: 'KERIPIK-TMP', name: 'Keripik Tempe', category: 'Keripik', abc: 'C', stock: 400, unit: 'pcs', reorderPoint: 100, leadTime: 3, avgDailySales: 8, hpp: 5000, sellingPrice: 8500, supplier: 'Home Industry', status: 'OVERSTOCK', daysRemaining: 50.0, lastUpdated: '2026-03-25' },
  { id: '11', sku: 'SEBLAK-PEDES', name: 'Seblak Super Pedas', category: 'Seblak', abc: 'A', stock: 130, unit: 'pcs', reorderPoint: 150, leadTime: 3, avgDailySales: 30, hpp: 8000, sellingPrice: 13500, supplier: 'Shanty Baso Aci', status: 'RENDAH', daysRemaining: 4.3, lastUpdated: '2026-03-25' },
  { id: '12', sku: 'BAPPER-PEDES', name: 'Bapper Pedas Manis', category: 'Keripik', abc: 'A', stock: 110, unit: 'pcs', reorderPoint: 120, leadTime: 3, avgDailySales: 38, hpp: 8500, sellingPrice: 14000, supplier: 'Bapper ID', status: 'RENDAH', daysRemaining: 2.9, lastUpdated: '2026-03-25' },
  { id: '13', sku: 'MAICIH-5', name: 'Maicih Level 5', category: 'Keripik', abc: 'B', stock: 90, unit: 'pcs', reorderPoint: 80, leadTime: 5, avgDailySales: 16, hpp: 10500, sellingPrice: 15500, supplier: 'Maicih', status: 'AMAN', daysRemaining: 5.6, lastUpdated: '2026-03-25' },
  { id: '14', sku: 'CIRENG-AYAM', name: 'Cireng Ayam Bawang', category: 'Cireng', abc: 'B', stock: 200, unit: 'pcs', reorderPoint: 120, leadTime: 3, avgDailySales: 22, hpp: 6500, sellingPrice: 10500, supplier: 'Cireng Ceu Eti', status: 'AMAN', daysRemaining: 9.1, lastUpdated: '2026-03-25' },
  { id: '15', sku: 'BASRENG-PEDES', name: 'Basreng Pedas Tingkat', category: 'Basreng', abc: 'A', stock: 260, unit: 'pcs', reorderPoint: 180, leadTime: 2, avgDailySales: 42, hpp: 9000, sellingPrice: 14000, supplier: 'Basreng Neng Via', status: 'AMAN', daysRemaining: 6.2, lastUpdated: '2026-03-25' },
  { id: '16', sku: 'SIOMAY-UDANG', name: 'Siomay Udang Keju', category: 'Siomay', abc: 'C', stock: 30, unit: 'pcs', reorderPoint: 40, leadTime: 3, avgDailySales: 5, hpp: 15000, sellingPrice: 22000, supplier: 'Siomay Pa Eko', status: 'RENDAH', daysRemaining: 6.0, lastUpdated: '2026-03-25' },
  { id: '17', sku: 'FISHSKIN-ORIG', name: 'Fish Skin Original', category: 'Keripik Ikan', abc: 'B', stock: 70, unit: 'pcs', reorderPoint: 75, leadTime: 4, avgDailySales: 15, hpp: 11500, sellingPrice: 17000, supplier: 'Raftels', status: 'RENDAH', daysRemaining: 4.7, lastUpdated: '2026-03-25' },
  { id: '18', sku: 'BASO-BAKSO', name: 'Baso Granat Super', category: 'Baso Aci', abc: 'B', stock: 110, unit: 'pcs', reorderPoint: 90, leadTime: 2, avgDailySales: 20, hpp: 11000, sellingPrice: 17500, supplier: 'Shanty Baso Aci', status: 'AMAN', daysRemaining: 5.5, lastUpdated: '2026-03-25' },
  { id: '19', sku: 'KERIPIK-SINGK', name: 'Keripik Singkong Balado', category: 'Keripik', abc: 'C', stock: 250, unit: 'pcs', reorderPoint: 80, leadTime: 3, avgDailySales: 6, hpp: 4500, sellingPrice: 7500, supplier: 'Home Industry', status: 'OVERSTOCK', daysRemaining: 41.7, lastUpdated: '2026-03-25' },
  { id: '20', sku: 'SEBLAK-KUAH', name: 'Seblak Kuah Instan', category: 'Seblak', abc: 'B', stock: 140, unit: 'pcs', reorderPoint: 100, leadTime: 3, avgDailySales: 18, hpp: 8000, sellingPrice: 13000, supplier: 'Shanty Baso Aci', status: 'AMAN', daysRemaining: 7.8, lastUpdated: '2026-03-25' },
];

// ============================================================
// SUPPLIER DATA
// ============================================================
export const supplierData: Supplier[] = [
  { id: '1', name: 'Shanty Baso Aci', category: 'Baso Aci & Seblak', tier: 'Utama', status: 'Aktif', negotiationStatus: 'Nego TOP 30', currentHPP: 9500, targetHPP: 8500, potential: 8400000, leadTime: 2, paymentTerms: 'TOP-21', contact: '08123456789', score: 4.8, lastOrder: '2026-03-20', nextFollowUp: '2026-03-27', notes: 'Supplier terbaik, sangat reliable. Target nego TOP-30 dari TOP-21.' },
  { id: '2', name: 'Bapper ID', category: 'Keripik Bapper', tier: 'Utama', status: 'Aktif', negotiationStatus: 'Nego Harga', currentHPP: 8000, targetHPP: 7200, potential: 6240000, leadTime: 3, paymentTerms: 'Cash', contact: '08234567890', score: 4.5, lastOrder: '2026-03-18', nextFollowUp: '2026-03-28', notes: 'Volume besar, minta diskon 10% atau TOP-14.' },
  { id: '3', name: 'Raftels', category: 'Fish Skin', tier: 'Utama', status: 'Aktif', negotiationStatus: 'Selesai', currentHPP: 12000, targetHPP: 11000, potential: 5280000, leadTime: 4, paymentTerms: 'TOP-14', contact: '08345678901', score: 4.2, lastOrder: '2026-03-15', nextFollowUp: '2026-04-01', notes: 'Sudah dapat diskon 8%, follow up lagi bulan April.' },
  { id: '4', name: 'Maicih', category: 'Keripik Maicih', tier: 'Utama', status: 'Aktif', negotiationStatus: 'Review Kontrak', currentHPP: 11000, targetHPP: 10000, potential: 4800000, leadTime: 5, paymentTerms: 'TOP-7', contact: '08456789012', score: 4.0, lastOrder: '2026-03-12', nextFollowUp: '2026-03-30', notes: 'Sedang review kontrak tahunan. Potensi diskon 9%.' },
  { id: '5', name: 'Basreng Neng Via', category: 'Basreng', tier: 'Utama', status: 'Aktif', negotiationStatus: 'Aktif', currentHPP: 8500, targetHPP: 7800, potential: 7560000, leadTime: 2, paymentTerms: 'Cash', contact: '08567890123', score: 4.6, lastOrder: '2026-03-22', nextFollowUp: '2026-03-29', notes: 'Volume tertinggi. Prioritas nego TOP-14.' },
  { id: '6', name: 'Cireng Ceu Eti', category: 'Cireng', tier: 'Sekunder', status: 'Aktif', negotiationStatus: 'Aktif', currentHPP: 6000, targetHPP: 5500, potential: 2520000, leadTime: 3, paymentTerms: 'Cash', contact: '08678901234', score: 4.3, lastOrder: '2026-03-19', nextFollowUp: '2026-04-02', notes: 'Produk baru, masih proses onboarding.' },
  { id: '7', name: 'Siomay Pa Eko', category: 'Siomay', tier: 'Sekunder', status: 'Aktif', negotiationStatus: 'Pending', currentHPP: 10500, targetHPP: 9800, potential: 1680000, leadTime: 3, paymentTerms: 'Cash', contact: '08789012345', score: 3.8, lastOrder: '2026-03-10', nextFollowUp: '2026-04-05', notes: 'Kapasitas terbatas, perlu negosiasi minimal order.' },
  { id: '8', name: 'Home Industry', category: 'Keripik Lokal', tier: 'Baru', status: 'Aktif', negotiationStatus: 'Aktif', currentHPP: 5000, targetHPP: 4500, potential: 1200000, leadTime: 3, paymentTerms: 'Cash', contact: '08890123456', score: 3.5, lastOrder: '2026-03-08', nextFollowUp: '2026-04-08', notes: 'Produk slow-moving, evaluasi apakah perlu lanjut.' },
  { id: '9', name: 'Kerupuk Mang Asep', category: 'Kerupuk', tier: 'Sekunder', status: 'Pending', negotiationStatus: 'Pending', currentHPP: 7000, targetHPP: 6300, potential: 3024000, leadTime: 4, paymentTerms: 'Cash', contact: '08901234567', score: 3.9, lastOrder: '2026-02-28', nextFollowUp: '2026-03-30', notes: 'Sedang evaluasi kualitas setelah complaint terakhir.' },
  { id: '10', name: 'Kue Cubit Neng Rini', category: 'Snack Manis', tier: 'Baru', status: 'Aktif', negotiationStatus: 'Selesai', currentHPP: 4000, targetHPP: 3600, potential: 864000, leadTime: 2, paymentTerms: 'Cash', contact: '08012345678', score: 4.1, lastOrder: '2026-03-21', nextFollowUp: '2026-04-10', notes: 'Produk baru, monitor penjualan 3 bulan.' },
  { id: '11', name: 'Mie Lidi Bu Sari', category: 'Mie Lidi', tier: 'Sekunder', status: 'Aktif', negotiationStatus: 'Nego Harga', currentHPP: 3500, targetHPP: 3000, potential: 1080000, leadTime: 3, paymentTerms: 'TOP-7', contact: '08123456780', score: 4.0, lastOrder: '2026-03-17', nextFollowUp: '2026-03-31', notes: 'Minta minimum order turun dari 100 ke 50 pcs.' },
  { id: '12', name: 'Kripik Pedas Pak Bondan', category: 'Keripik Pedas', tier: 'Baru', status: 'Pending', negotiationStatus: 'Pending', currentHPP: 6500, targetHPP: 5800, potential: 2088000, leadTime: 5, paymentTerms: 'Cash', contact: '08234567891', score: 3.7, lastOrder: '—', nextFollowUp: '2026-03-28', notes: 'Trial order pertama. Evaluasi kualitas dan konsistensi.' },
  { id: '13', name: 'PT Snack Nusantara', category: 'Mix Snack', tier: 'Baru', status: 'Pending', negotiationStatus: 'Review Kontrak', currentHPP: 9000, targetHPP: 8100, potential: 4860000, leadTime: 7, paymentTerms: 'TOP-30', contact: '08345678902', score: 3.2, lastOrder: '—', nextFollowUp: '2026-04-01', notes: 'Perusahaan besar, sedang review kontrak distribusi.' },
];

// ============================================================
// PURCHASE ORDERS DATA
// ============================================================
export const poData: PurchaseOrder[] = [
  { id: 'PO-2026-001', sku: 'BASRENG-ORI', productName: 'Basreng Original 500pcs', supplier: 'Basreng Neng Via', qty: 500, unit: 'pcs', pricePerUnit: 8500, total: 4250000, orderDate: '2026-03-01', dueDate: '2026-03-01', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-002', sku: 'BAPPER-ORI', productName: 'Bapper Original 300pcs', supplier: 'Bapper ID', qty: 300, unit: 'pcs', pricePerUnit: 8000, total: 2400000, orderDate: '2026-03-03', dueDate: '2026-03-03', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-003', sku: 'SEBLAK-ORI', productName: 'Seblak Original 400pcs', supplier: 'Shanty Baso Aci', qty: 400, unit: 'pcs', pricePerUnit: 7500, total: 3000000, orderDate: '2026-03-05', dueDate: '2026-03-26', status: 'Pending', paymentTerms: 'TOP-21', notes: 'Jatuh tempo 26 Maret' },
  { id: 'PO-2026-004', sku: 'FISHSKIN-SPY', productName: 'Fish Skin Spicy 200pcs', supplier: 'Raftels', qty: 200, unit: 'pcs', pricePerUnit: 12000, total: 2400000, orderDate: '2026-03-07', dueDate: '2026-03-21', status: 'Lunas', paymentTerms: 'TOP-14', notes: '' },
  { id: 'PO-2026-005', sku: 'BASRENG-PEDES', productName: 'Basreng Pedas 400pcs', supplier: 'Basreng Neng Via', qty: 400, unit: 'pcs', pricePerUnit: 9000, total: 3600000, orderDate: '2026-03-08', dueDate: '2026-03-08', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-006', sku: 'BAPPER-PEDES', productName: 'Bapper Pedas Manis 250pcs', supplier: 'Bapper ID', qty: 250, unit: 'pcs', pricePerUnit: 8500, total: 2125000, orderDate: '2026-03-10', dueDate: '2026-03-10', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-007', sku: 'BASO-ACI', productName: 'Baso Aci Shanty 350pcs', supplier: 'Shanty Baso Aci', qty: 350, unit: 'pcs', pricePerUnit: 9500, total: 3325000, orderDate: '2026-03-12', dueDate: '2026-04-02', status: 'Pending', paymentTerms: 'TOP-21', notes: 'Jatuh tempo 2 April' },
  { id: 'PO-2026-008', sku: 'MAICIH-10', productName: 'Maicih Level 10 150pcs', supplier: 'Maicih', qty: 150, unit: 'pcs', pricePerUnit: 11000, total: 1650000, orderDate: '2026-03-13', dueDate: '2026-03-20', status: 'Lunas', paymentTerms: 'TOP-7', notes: '' },
  { id: 'PO-2026-009', sku: 'CIRENG-BUMBU', productName: 'Cireng Bumbu Rujak 300pcs', supplier: 'Cireng Ceu Eti', qty: 300, unit: 'pcs', pricePerUnit: 6000, total: 1800000, orderDate: '2026-03-15', dueDate: '2026-03-15', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-010', sku: 'SEBLAK-PEDES', productName: 'Seblak Super Pedas 300pcs', supplier: 'Shanty Baso Aci', qty: 300, unit: 'pcs', pricePerUnit: 8000, total: 2400000, orderDate: '2026-03-17', dueDate: '2026-04-07', status: 'Pending', paymentTerms: 'TOP-21', notes: 'Jatuh tempo 7 April' },
  { id: 'PO-2026-011', sku: 'BASRENG-ORI', productName: 'Basreng Original 600pcs', supplier: 'Basreng Neng Via', qty: 600, unit: 'pcs', pricePerUnit: 8500, total: 5100000, orderDate: '2026-03-19', dueDate: '2026-03-19', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-012', sku: 'FISHSKIN-BBQ', productName: 'Fish Skin BBQ 180pcs', supplier: 'Raftels', qty: 180, unit: 'pcs', pricePerUnit: 12000, total: 2160000, orderDate: '2026-03-21', dueDate: '2026-04-04', status: 'Pending', paymentTerms: 'TOP-14', notes: 'Jatuh tempo 4 April' },
  { id: 'PO-2026-013', sku: 'BAPPER-ORI', productName: 'Bapper Original 400pcs', supplier: 'Bapper ID', qty: 400, unit: 'pcs', pricePerUnit: 8000, total: 3200000, orderDate: '2026-03-22', dueDate: '2026-03-22', status: 'Lunas', paymentTerms: 'Cash', notes: '' },
  { id: 'PO-2026-014', sku: 'BASO-BAKSO', productName: 'Baso Granat Super 200pcs', supplier: 'Shanty Baso Aci', qty: 200, unit: 'pcs', pricePerUnit: 11000, total: 2200000, orderDate: '2026-03-24', dueDate: '2026-04-14', status: 'Pending', paymentTerms: 'TOP-21', notes: '' },
  { id: 'PO-2026-015', sku: 'MAICIH-5', productName: 'Maicih Level 5 200pcs', supplier: 'Maicih', qty: 200, unit: 'pcs', pricePerUnit: 10500, total: 2100000, orderDate: '2026-03-25', dueDate: '2026-04-01', status: 'Pending', paymentTerms: 'TOP-7', notes: '' },
];

// ============================================================
// PURCHASE RECOMMENDATIONS (computed from inventory)
// ============================================================
export const purchaseRecommendations: PurchaseRecommendation[] = inventoryData
  .filter(item => item.status === 'KRITIS' || item.status === 'RENDAH')
  .map(item => {
    const annualDemand = item.avgDailySales * 365;
    const orderingCost = 50000;
    const holdingCostPerUnit = item.hpp * 0.02;
    const eoq = Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit));
    const status: PurchaseRecommendation['status'] =
      item.daysRemaining <= item.leadTime ? 'REORDER_NOW' :
      item.daysRemaining <= item.leadTime * 1.5 ? 'PREPARE' : 'SAFE';
    return {
      sku: item.sku,
      name: item.name,
      abc: item.abc,
      stock: item.stock,
      daysRemaining: item.daysRemaining,
      status,
      recommendedQty: Math.max(eoq, item.reorderPoint - item.stock),
      supplier: item.supplier,
      estimatedCost: Math.max(eoq, item.reorderPoint - item.stock) * item.hpp,
      eoq,
      reorderPoint: item.reorderPoint,
    };
  })
  .sort((a, b) => a.daysRemaining - b.daysRemaining);

// ============================================================
// KPI SUMMARIES
// ============================================================
export function getInventoryKPIs() {
  const kritis = inventoryData.filter(i => i.status === 'KRITIS').length;
  const rendah = inventoryData.filter(i => i.status === 'RENDAH').length;
  const overstock = inventoryData.filter(i => i.status === 'OVERSTOCK').length;
  const aman = inventoryData.filter(i => i.status === 'AMAN').length;
  const totalValue = inventoryData.reduce((s, i) => s + i.stock * i.hpp, 0);
  const avgMargin = inventoryData.reduce((s, i) => s + ((i.sellingPrice - i.hpp) / i.sellingPrice * 100), 0) / inventoryData.length;
  return { kritis, rendah, overstock, aman, totalValue, avgMargin };
}

export function getPOKPIs() {
  const totalBudget = poData.reduce((s, p) => s + p.total, 0);
  const lunas = poData.filter(p => p.status === 'Lunas').reduce((s, p) => s + p.total, 0);
  const pending = poData.filter(p => p.status === 'Pending').reduce((s, p) => s + p.total, 0);
  const pendingCount = poData.filter(p => p.status === 'Pending').length;
  const overdueCount = poData.filter(p => p.status === 'Overdue').length;
  return { totalBudget, lunas, pending, pendingCount, overdueCount };
}

export function getSupplierKPIs() {
  const total = supplierData.length;
  const aktif = supplierData.filter(s => s.status === 'Aktif').length;
  const avgScore = supplierData.reduce((s, x) => s + x.score, 0) / total;
  const totalPotential = supplierData.reduce((s, x) => s + x.potential, 0);
  const inNego = supplierData.filter(s => ['Nego Harga', 'Nego TOP 30', 'Review Kontrak'].includes(s.negotiationStatus)).length;
  return { total, aktif, avgScore, totalPotential, inNego };
}
