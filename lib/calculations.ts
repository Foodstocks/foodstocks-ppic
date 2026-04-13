// ============================================================
// PURCHASE PLANNING CALCULATIONS
// EOQ, Reorder Point, ABC Analysis, True COGS
// ============================================================

export interface EOQInputs {
  annualDemand: number;    // units/year
  orderingCost: number;   // Rp per order (ongkir + admin)
  holdingCostRate: number; // fraction per year (e.g. 0.24 = 24%/year)
  unitCost: number;        // Rp per unit
}

/** Economic Order Quantity */
export function calcEOQ({ annualDemand, orderingCost, holdingCostRate, unitCost }: EOQInputs): number {
  const H = holdingCostRate * unitCost;
  return Math.round(Math.sqrt((2 * annualDemand * orderingCost) / H));
}

export interface ReorderInputs {
  avgDailySales: number;
  leadTimeDays: number;
  safetyStockMultiplier: number; // 3x for A, 2x for B, 1x for C
}

/** Reorder Point */
export function calcReorderPoint({ avgDailySales, leadTimeDays, safetyStockMultiplier }: ReorderInputs): number {
  const safetyStock = avgDailySales * safetyStockMultiplier;
  return Math.round((avgDailySales * leadTimeDays) + safetyStock);
}

/** Days of stock remaining */
export function calcDaysRemaining(currentStock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999;
  return Math.round((currentStock / avgDailySales) * 10) / 10;
}

export type StockStatusCode = 'REORDER_NOW' | 'PREPARE' | 'SAFE';
export function calcStockStatus(daysRemaining: number, leadTimeDays: number): StockStatusCode {
  if (daysRemaining <= leadTimeDays) return 'REORDER_NOW';
  if (daysRemaining <= leadTimeDays * 1.5) return 'PREPARE';
  return 'SAFE';
}

// Movement Category — berdasarkan rata-rata sisa hari stok habis
export type MovementCategory = 'SUPER_FAST' | 'FAST' | 'MEDIUM' | 'SLOW';

export interface MovementCategoryConfig {
  label: string;
  daysThreshold: number; // sisa hari ≤ threshold = masuk kategori ini (ascending)
  bg: string;
  color: string;
  poRule: string;
  safetyMultiplier: number; // safety stock multiplier
}

export const MOVEMENT_CONFIGS: Record<MovementCategory, MovementCategoryConfig> = {
  SUPER_FAST: {
    label: 'Super Fast Moving',
    daysThreshold: 7,
    bg: 'rgba(239,68,68,0.15)',
    color: '#ef4444',
    poRule: 'Reorder agresif — safety stock 3× lead time',
    safetyMultiplier: 3,
  },
  FAST: {
    label: 'Fast Moving',
    daysThreshold: 14,
    bg: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    poRule: 'EOQ normal — safety stock 2× lead time',
    safetyMultiplier: 2,
  },
  MEDIUM: {
    label: 'Medium Moving',
    daysThreshold: 30,
    bg: 'rgba(59,130,246,0.15)',
    color: '#3b82f6',
    poRule: 'EOQ konservatif — safety stock 1× lead time',
    safetyMultiplier: 1,
  },
  SLOW: {
    label: 'Slow Moving',
    daysThreshold: Infinity,
    bg: 'rgba(100,116,139,0.15)',
    color: '#64748b',
    poRule: 'Sistem PO Khusus — order hanya saat ada kebutuhan pasti, perlu approval',
    safetyMultiplier: 0.5,
  },
};

export function calcMovementCategory(daysRemaining: number, hasVelocity: boolean): MovementCategory {
  if (!hasVelocity || daysRemaining <= 0 || daysRemaining === 999) return 'SLOW';
  if (daysRemaining <= 7) return 'SUPER_FAST';
  if (daysRemaining <= 14) return 'FAST';
  if (daysRemaining <= 30) return 'MEDIUM';
  return 'SLOW';
}

// ABC Analysis
export interface SKURevenue {
  sku: string;
  revenue: number;
}

export type ABCResult = Map<string, 'A' | 'B' | 'C'>;

export function calcABCAnalysis(skuRevenues: SKURevenue[]): ABCResult {
  const sorted = [...skuRevenues].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((s, x) => s + x.revenue, 0);
  let cumulative = 0;
  const result: ABCResult = new Map();
  for (const item of sorted) {
    cumulative += item.revenue;
    const pct = cumulative / total;
    result.set(item.sku, pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C');
  }
  return result;
}

// True COGS Calculator
export interface TrueCOGSInputs {
  purchasePrice: number;       // Rp per unit
  inboundShipping: number;     // total Rp for shipment
  unitsReceived: number;       // total units in shipment
  handlingCostPerUnit: number; // Rp
  avgDaysInWarehouse: number;  // days
  holdingRateMonthly: number;  // fraction (default 0.02)
  badDebtRate: number;         // fraction (for consignment, default 0)
  paymentTermDays: number;     // TOP days (0 = cash)
  costOfCapitalMonthly: number; // fraction (default 0.02)
}

export function calcTrueCOGS(inputs: TrueCOGSInputs): number {
  const {
    purchasePrice, inboundShipping, unitsReceived, handlingCostPerUnit,
    avgDaysInWarehouse, holdingRateMonthly, badDebtRate,
    paymentTermDays, costOfCapitalMonthly,
  } = inputs;

  const shippingPerUnit = inboundShipping / unitsReceived;
  const holdingCost = holdingRateMonthly / 30 * avgDaysInWarehouse * purchasePrice;
  const badDebt = badDebtRate * purchasePrice;

  // Cost of capital for cash payments; benefit for TOP
  const paymentCost = paymentTermDays > 0
    ? -(purchasePrice * costOfCapitalMonthly * (paymentTermDays / 30)) // benefit
    : 0;

  return purchasePrice + shippingPerUnit + handlingCostPerUnit + holdingCost + badDebt + paymentCost;
}

/** Gross margin percentage */
export function calcGrossMargin(sellingPrice: number, trueCogs: number): number {
  return ((sellingPrice - trueCogs) / sellingPrice) * 100;
}

// Stock Aging
export type AgingCategory = 'FRESH' | 'AGING' | 'OLD' | 'DEAD';

export interface AgingCategoryConfig {
  label: string;
  bg: string;
  color: string;
}

export const AGING_CONFIGS: Record<AgingCategory, AgingCategoryConfig> = {
  FRESH:  { label: 'Fresh',      bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  AGING:  { label: 'Aging',      bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  OLD:    { label: 'Old Stock',  bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
  DEAD:   { label: 'Dead Stock', bg: 'rgba(100,116,139,0.2)', color: '#64748b' },
};

export function calcAgingCategory(daysInWarehouse: number): AgingCategory {
  if (daysInWarehouse < 30) return 'FRESH';
  if (daysInWarehouse < 60) return 'AGING';
  if (daysInWarehouse < 90) return 'OLD';
  return 'DEAD';
}

/** Cost of Fund = Stock Value × Monthly CoC Rate × (Days / 30) */
export function calcCostOfFund(
  stockValue: number,
  daysInWarehouse: number,
  costOfCapitalMonthly: number = 0.02,
): number {
  return stockValue * costOfCapitalMonthly * (daysInWarehouse / 30);
}

// Seasonal multiplier
export function calcSeasonalMultiplier(
  avgSameWeekLastYear: number,
  overallAvgSales: number,
): number {
  if (overallAvgSales <= 0) return 1;
  return avgSameWeekLastYear / overallAvgSales;
}

// ============================================================
// STOCK FLOW & CAPITAL HEALTH
// ============================================================

export interface MonthStartSnapshot {
  month: string;       // "2026-04"
  capturedAt: string;  // ISO timestamp
  totalValue: number;  // Σ(qty × hpp)
  items: { sku: string; qty: number; hpp: number; value: number }[];
}

export interface StockFlowResult {
  openingCapital: number;
  restockInCapital: number;  // total PO grand_total diterima bulan ini
  salesOutCapital: number;   // velocity × daysElapsed × hpp
  expectedClosing: number;   // opening + restock - sales
  actualClosing: number;     // current stock × hpp
  variance: number;          // actual - expected
  daysElapsed: number;
}

export function calcStockFlowBalance(
  openingSnapshot: MonthStartSnapshot,
  restockInTotal: number,
  velocityMap: Record<string, number>,
  hppMap: Record<string, number>,
  currentInventory: { sku: string; stock: number; sellPrice: number }[],
  daysElapsed: number,
): StockFlowResult {
  const openingCapital = openingSnapshot.totalValue;

  let salesOutCapital = 0;
  let actualClosing = 0;
  for (const item of currentInventory) {
    const hpp = hppMap[item.sku] ?? item.sellPrice * 0.65;
    const velocity = velocityMap[item.sku] ?? 0;
    salesOutCapital += velocity * daysElapsed * hpp;
    actualClosing += item.stock * hpp;
  }

  const expectedClosing = openingCapital + restockInTotal - salesOutCapital;
  const variance = actualClosing - expectedClosing;

  return {
    openingCapital,
    restockInCapital: restockInTotal,
    salesOutCapital,
    expectedClosing,
    actualClosing,
    variance,
    daysElapsed,
  };
}

export interface CapitalHealthResult {
  capitalRatio: number;
  status: 'SEHAT' | 'WASPADA' | 'BAHAYA';
  estRevenue: number;
  grossProfit: number;
  truePosition: number;    // grossProfit + capitalDelta
  profitIllusion: boolean; // grossProfit > 0 && truePosition < 0
  capitalDelta: number;    // actualClosing - openingCapital
}

export function calcCapitalHealth(
  openingCapital: number,
  actualClosing: number,
  salesOutCapital: number,
  velocityMap: Record<string, number>,
  hppMap: Record<string, number>,
  currentInventory: { sku: string; stock: number; sellPrice: number }[],
  daysElapsed: number,
): CapitalHealthResult {
  let estRevenue = 0;
  for (const item of currentInventory) {
    const velocity = velocityMap[item.sku] ?? 0;
    estRevenue += velocity * daysElapsed * item.sellPrice;
  }

  const grossProfit = estRevenue - salesOutCapital;
  const capitalDelta = actualClosing - openingCapital;
  const truePosition = grossProfit + capitalDelta;
  const capitalRatio = openingCapital > 0 ? actualClosing / openingCapital : 1;
  const status: CapitalHealthResult['status'] =
    capitalRatio >= 1.0 ? 'SEHAT' : capitalRatio >= 0.9 ? 'WASPADA' : 'BAHAYA';
  const profitIllusion = grossProfit > 0 && truePosition < 0;

  return { capitalRatio, status, estRevenue, grossProfit, truePosition, profitIllusion, capitalDelta };
}

// ============================================================
// PRE-EVENT REORDER ALERTS
// ============================================================

export interface DemandEventExtended {
  id: string;
  name: string;
  startDay: number;       // legacy relative offset (days from today)
  startDate?: string;     // ISO date string "YYYY-MM-DD" — for calendar-anchored scheduling
  durationDays?: number;  // default 14
  multiplier: number;
  category?: string;
}

export interface PreEventOrderSku {
  sku: string;
  name: string;
  currentStock: number;
  extraUnitsNeeded: number;
  urgencyDays: number;
  isUrgent: boolean;
  estimatedCost: number;
}

export interface PreEventAlert {
  event: DemandEventExtended;
  daysUntilEvent: number;
  orderDeadline: Date;
  isOverdue: boolean;
  affectedSkus: PreEventOrderSku[];
  totalExtraUnitsValue: number;
}

export function calcPreEventOrders(
  events: DemandEventExtended[],
  velocityMap: Record<string, number>,
  hppMap: Record<string, number>,
  currentInventory: { sku: string; name: string; stock: number; sellPrice: number; category?: string }[],
  leadTimeMap: Record<string, number>,
  today: Date,
  lookAheadDays: number = 60,
  skupplierMap: Record<string, string> = {},
): PreEventAlert[] {
  const alerts: PreEventAlert[] = [];

  for (const event of events) {
    if (!event.startDate) continue; // skip events without calendar anchor

    const eventStart = new Date(event.startDate);
    const daysUntilEvent = Math.round((eventStart.getTime() - today.getTime()) / 86400000);

    if (daysUntilEvent > lookAheadDays) continue; // too far in future

    const durationDays = event.durationDays ?? 14;
    const defaultLeadTime = leadTimeMap['__default__'] ?? 3;

    const affectedSkus: PreEventOrderSku[] = [];

    for (const item of currentInventory) {
      // filter by category if event specifies one (empty string = all categories)
      if (event.category && event.category !== '' && item.category && item.category !== event.category) continue;

      const velocity = velocityMap[item.sku] ?? 0;
      if (velocity <= 0) continue;

      const extraUnitsNeeded = Math.ceil((event.multiplier - 1) * velocity * durationDays);
      if (extraUnitsNeeded <= 0) continue;

      const supplierName = skupplierMap[item.sku];
      const leadTime = (supplierName ? leadTimeMap[supplierName] : undefined) ?? defaultLeadTime;
      const orderDeadlineTime = eventStart.getTime() - leadTime * 86400000;
      const orderDeadline = new Date(orderDeadlineTime);
      const urgencyDays = Math.round((orderDeadlineTime - today.getTime()) / 86400000);
      const hpp = hppMap[item.sku] ?? item.sellPrice * 0.65;

      affectedSkus.push({
        sku: item.sku,
        name: item.name,
        currentStock: item.stock,
        extraUnitsNeeded,
        urgencyDays,
        isUrgent: urgencyDays <= 7,
        estimatedCost: extraUnitsNeeded * hpp,
      });
    }

    if (affectedSkus.length === 0) continue;

    affectedSkus.sort((a, b) => a.urgencyDays - b.urgencyDays);

    const leadTimeForDeadline = defaultLeadTime;
    const orderDeadline = new Date(eventStart.getTime() - leadTimeForDeadline * 86400000);
    const totalExtraUnitsValue = affectedSkus.reduce((s, x) => s + x.estimatedCost, 0);

    alerts.push({
      event,
      daysUntilEvent,
      orderDeadline,
      isOverdue: daysUntilEvent < 0,
      affectedSkus,
      totalExtraUnitsValue,
    });
  }

  alerts.sort((a, b) => a.daysUntilEvent - b.daysUntilEvent);
  return alerts;
}

// Format utilities
export function formatRupiah(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('id-ID');
}
