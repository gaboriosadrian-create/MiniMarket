import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Sale, 
  SaleItem,
  Expense, 
  Purchase, 
  Product, 
  PaymentObligation, 
  PaymentSettlement, 
  CashMovement 
} from '../types';
import { getPaymentObligationsByBusiness } from './obligationService';
import { getCashBalance } from './purchaseService';

export interface DateRangeFilter {
  startIso: string;
  endIso: string;
  previousStartIso: string;
  previousEndIso: string;
  label: string;
}

export type BusinessAnalysisPreset = 
  | 'HOY' 
  | 'ESTA_SEMANA' 
  | 'ULTIMOS_7_DIAS'
  | 'ESTE_MES' 
  | 'MES_ANTERIOR' 
  | 'ULTIMOS_30_DIAS' 
  | 'ANIO_ACTUAL' 
  | 'CUSTOM' 
  | 'ULTIMOS_3_MESES';

export interface FinancialSummary {
  // Income
  totalIncome: number;
  cashIncome: number;
  mercadoPagoIncome: number;
  otherIncome: number;
  combinedSalesIncome: number;
  combinedSalesCount: number;
  salesCount: number;
  averageTicket: number;

  // Expenses (Paid from Business Funds)
  totalExpensesPaid: number;
  purchasesPaid: number;
  operatingExpensesPaid: number;
  settlementsPaid: number;

  // Expenses Status Breakdown
  operatingExpensesPending: number;
  operatingExpensesCancelled: number;
  personalExpenses: number;

  // Results (Separated clearly)
  financialResult: number; // Total Income - Total Business Expenses Paid (Cashflow)
  economicResult: number;  // Total Income - COGS - Operating Expenses Paid (Economic Profit)

  // Real Cash Balance & Flow
  currentCashBalance: number;
  periodCashInflow: number;
  periodCashOutflow: number;

  // Gross Margin (Ventas - CMV)
  totalCogs: number; // Cost of Goods Sold (using historical snapshots)
  grossMarginAmount: number; // Income - COGS
  grossMarginPercentage: number; // (Margin / Income) * 100

  // Pending Commitments (Separate from cashflow)
  totalPendingObligations: number;
  pendingSuppliersCount: number;

  // Previous Period Comparisons (% changes)
  incomeChangePercentage: number;
  expensesChangePercentage: number;
  resultChangePercentage: number;
  marginChangePercentage: number;
  economicResultChangePercentage: number;
}

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  category?: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
  currentSalePrice: number;
  currentCostPrice: number;
  isDeterioratedMargin: boolean;
  deteriorationReason?: string;
}

export interface CategoryPerformanceItem {
  categoryName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
  percentageOfRevenue: number;
}

export interface SupplierPurchaseItem {
  supplierName: string;
  totalPurchased: number;
  purchasesCount: number;
  totalItemsCount: number;
  pendingObligationsAmount: number;
}

export interface InventoryCapitalSummary {
  totalProductsCount: number;
  totalStockUnits: number;
  totalReplacementValue: number; // explicitly calculated with Product.costPrice vigente, differentiated from CMV
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minimumStock: number;
    costPrice: number;
    category?: string;
  }>;
  outOfStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minimumStock: number;
    costPrice: number;
    category?: string;
  }>;
}

export interface MonthlyComparisonPoint {
  monthKey: string; // e.g. "2026-06", "2026-07", "2026-08"
  monthLabel: string; // e.g. "Junio", "Julio", "Agosto"
  income: number;
  expenses: number;
  result: number;
  margin: number;
  salesCount: number;
  cogs: number;
  economicResult: number;
  financialResult: number;
  grossMarginPercentage: number;
}

export interface BusinessAnalysisData {
  summary: FinancialSummary;
  topSellingByQuantity: ProductPerformanceItem[];
  topSellingByRevenue: ProductPerformanceItem[];
  topSellingByMargin: ProductPerformanceItem[];
  lowestMarginProducts: ProductPerformanceItem[];
  zeroOrNegativeMarginProducts: ProductPerformanceItem[];
  deterioratedMarginProducts: ProductPerformanceItem[];
  categoryBreakdown: CategoryPerformanceItem[];
  supplierPurchases: SupplierPurchaseItem[];
  inventorySummary: InventoryCapitalSummary;
  monthlyComparison: MonthlyComparisonPoint[];
}

/**
 * Calculates historical Cost of Goods Sold (CMV) and unit cost for a sale item.
 * 
 * Rules:
 * 1. If it's a combo with a historical snapshot of component unit costs, use the sum of components.
 * 2. If SaleItem has a captured historical snapshot (unitCost >= 0), use item.unitCost (immutable snapshot).
 * 3. Fallback: For legacy sales before unitCost was captured, fallback to current product.costPrice.
 */
export function calculateSaleItemCogs(
  item: SaleItem,
  allProductsMap: Map<string, Product>
): { unitCost: number; totalCogs: number } {
  const qty = Number(item.quantity) || 0;
  if (qty <= 0) return { unitCost: 0, totalCogs: 0 };

  // Case 1: Combo with historical snapshot of component costs
  if (item.isCombo && Array.isArray(item.comboItems) && item.comboItems.length > 0) {
    const hasComponentCosts = item.comboItems.some(c => typeof c.unitCost === 'number' && !isNaN(c.unitCost));
    if (hasComponentCosts) {
      const comboCostPerUnit = item.comboItems.reduce((acc, c) => {
        const cQty = Number(c.quantity) || 0;
        const cUnitCost = (typeof c.unitCost === 'number' && !isNaN(c.unitCost))
          ? Number(c.unitCost)
          : Number(allProductsMap.get(c.productId)?.costPrice || 0);
        return acc + (cQty * cUnitCost);
      }, 0);
      return { unitCost: comboCostPerUnit, totalCogs: qty * comboCostPerUnit };
    }
  }

  // Case 2: Historical unitCost snapshot on the sale item
  if (typeof item.unitCost === 'number' && !isNaN(item.unitCost)) {
    const unitCost = Number(item.unitCost);
    return { unitCost, totalCogs: qty * unitCost };
  }

  // Case 3: Explicit fallback to current product catalog costPrice for legacy sales
  const prodInfo = allProductsMap.get(item.productId);
  const fallbackUnitCost = Number((item as any).costPrice ?? prodInfo?.costPrice ?? 0);
  return { unitCost: fallbackUnitCost, totalCogs: qty * fallbackUnitCost };
}

/**
 * Determines whether an operating expense represents an actual financial outflow for the business.
 * Rules:
 * 1. Expenses financed with personal funds (fundSource === 'PERSONAL') are recorded for history
 *    and audit, but do NOT reduce business financial cash/bank results.
 * 2. Unpaid/pending expenses (status === 'PENDIENTE') do NOT reduce business financial cash results until paid.
 * 3. Cancelled expenses (status === 'ANULADO' or 'CANCELLED') do NOT reduce business financial results.
 * 4. Expenses tracked via payment obligations (obligationId present) have their cash outflows recorded
 *    via payment settlements (currentSettlementsPaid) to prevent double-counting.
 */
export function isBusinessExpenseOutflow(expense?: Expense | { fundSource?: string; status?: string; obligationId?: string } | null): boolean {
  if (!expense) return false;
  if (expense.fundSource === 'PERSONAL') return false;
  const status = (expense as any).status;
  if (status === 'PENDIENTE' || status === 'ANULADO' || status === 'CANCELLED') return false;
  if ((expense as any).obligationId) return false;
  return true;
}

/**
 * Calculates date bounds for standard presets.
 */
export function calculateDateRange(
  preset: BusinessAnalysisPreset,
  customStart?: string,
  customEnd?: string
): DateRangeFilter {
  const now = new Date();

  if (preset === 'HOY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Hoy'
    };
  }

  if (preset === 'ESTA_SEMANA') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + 6, 23, 59, 59, 999);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - 7);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Esta semana'
    };
  }

  if (preset === 'ULTIMOS_7_DIAS') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const end = now;
    const prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Últimos 7 días'
    };
  }

  if (preset === 'ESTE_MES') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Previous period: Previous month
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Este mes'
    };
  }

  if (preset === 'MES_ANTERIOR') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Mes anterior'
    };
  }

  if (preset === 'ULTIMOS_30_DIAS') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = now;
    const prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 1);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Últimos 30 días'
    };
  }

  if (preset === 'ANIO_ACTUAL') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: `Año ${now.getFullYear()}`
    };
  }

  if (preset === 'ULTIMOS_3_MESES') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 2, 0, 23, 59, 59, 999);

    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      previousStartIso: prevStart.toISOString(),
      previousEndIso: prevEnd.toISOString(),
      label: 'Últimos 3 meses'
    };
  }

  // Custom
  const s = customStart ? new Date(customStart + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = customEnd ? new Date(customEnd + 'T23:59:59') : now;
  const durationMs = Math.max(0, e.getTime() - s.getTime());
  const prevS = new Date(s.getTime() - durationMs);
  const prevE = new Date(s.getTime() - 1);

  return {
    startIso: s.toISOString(),
    endIso: e.toISOString(),
    previousStartIso: prevS.toISOString(),
    previousEndIso: prevE.toISOString(),
    label: 'Período personalizado'
  };
}

/**
 * Fetches and crunches all real business data for comprehensive analysis.
 */
export async function getBusinessAnalysis(
  businessId: string,
  dateFilter: DateRangeFilter
): Promise<BusinessAnalysisData> {
  if (!businessId) throw new Error('businessId es requerido');

  // 1. Fetch Sales
  const salesRef = collection(db, 'sales');
  const salesQuery = query(salesRef, where('businessId', '==', businessId));
  const salesSnap = await getDocs(salesQuery);
  const allSales: Sale[] = [];
  salesSnap.forEach(d => {
    const s = { id: d.id, ...d.data() } as Sale;
    if (s.status === 'COMPLETED') allSales.push(s);
  });

  // 2. Fetch Operating Expenses
  const expensesRef = collection(db, 'expenses');
  const expQuery = query(expensesRef, where('businessId', '==', businessId));
  const expSnap = await getDocs(expQuery);
  const allExpenses: Expense[] = [];
  expSnap.forEach(d => allExpenses.push({ id: d.id, ...d.data() } as Expense));

  // 3. Fetch Purchases
  const purchasesRef = collection(db, 'purchases');
  const purQuery = query(purchasesRef, where('businessId', '==', businessId));
  const purSnap = await getDocs(purQuery);
  const allPurchases: Purchase[] = [];
  purSnap.forEach(d => {
    const p = { id: d.id, ...d.data() } as Purchase;
    if (p.status === 'CONFIRMED') allPurchases.push(p);
  });

  // 4. Fetch Settlements
  const setRef = collection(db, 'payment_settlements');
  const setQuery = query(setRef, where('businessId', '==', businessId));
  const setSnap = await getDocs(setQuery);
  const allSettlements: PaymentSettlement[] = [];
  setSnap.forEach(d => allSettlements.push({ id: d.id, ...d.data() } as PaymentSettlement));

  // 5. Fetch Products
  const prodRef = collection(db, 'products');
  const prodQuery = query(prodRef, where('businessId', '==', businessId));
  const prodSnap = await getDocs(prodQuery);
  const allProductsMap = new Map<string, Product>();
  prodSnap.forEach(d => {
    const p = { id: d.id, ...d.data() } as Product;
    allProductsMap.set(p.id, p);
  });

  // 6. Fetch Pending Obligations
  const obligations = await getPaymentObligationsByBusiness(businessId, { status: 'PENDING' });
  const totalPendingObligations = obligations.reduce((sum, o) => sum + (Number(o.pendingAmount ?? o.amount) || 0), 0);
  const pendingSuppliersSet = new Set(obligations.map(o => o.supplierName || 'Varios'));

  // 7. Real Cash Balance on Hand (independent source of truth)
  let currentCashBalance = 0;
  try {
    currentCashBalance = await getCashBalance(businessId);
  } catch (err) {
    console.warn('[businessAnalysisService] Error fetching cash balance:', err);
  }

  // Split data into Current Period and Previous Period
  const currentSales = allSales.filter(s => s.createdAt && s.createdAt >= dateFilter.startIso && s.createdAt <= dateFilter.endIso);
  const prevSales = allSales.filter(s => s.createdAt && s.createdAt >= dateFilter.previousStartIso && s.createdAt <= dateFilter.previousEndIso);

  const currentExpenses = allExpenses.filter(e => e.createdAt && e.createdAt >= dateFilter.startIso && e.createdAt <= dateFilter.endIso);
  const prevExpenses = allExpenses.filter(e => e.createdAt && e.createdAt >= dateFilter.previousStartIso && e.createdAt <= dateFilter.previousEndIso);

  const currentPurchases = allPurchases.filter(p => p.createdAt && p.createdAt >= dateFilter.startIso && p.createdAt <= dateFilter.endIso);
  const prevPurchases = allPurchases.filter(p => p.createdAt && p.createdAt >= dateFilter.previousStartIso && p.createdAt <= dateFilter.previousEndIso);

  const currentSettlements = allSettlements.filter(s => s.paymentDate && s.paymentDate >= dateFilter.startIso && s.paymentDate <= dateFilter.endIso);
  const prevSettlements = allSettlements.filter(s => s.paymentDate && s.paymentDate >= dateFilter.previousStartIso && s.paymentDate <= dateFilter.previousEndIso);

  // Income calculations
  let currentCashIncome = 0;
  let currentMpIncome = 0;
  let currentOtherIncome = 0;
  let currentTotalIncome = 0;
  let currentTotalCogs = 0;
  let combinedSalesIncome = 0;
  let combinedSalesCount = 0;

  // Product performance accumulator
  const productPerformanceMap = new Map<string, {
    productId: string;
    productName: string;
    category?: string;
    unitsSold: number;
    revenue: number;
    cogs: number;
  }>();

  // Category breakdown accumulator
  const categoryMap = new Map<string, {
    categoryName: string;
    unitsSold: number;
    revenue: number;
    cogs: number;
  }>();

  for (const s of currentSales) {
    const saleTotal = Number(s.total) || 0;
    currentTotalIncome += saleTotal;

    if (s.paymentMethod === 'EFECTIVO') {
      currentCashIncome += saleTotal;
    } else if (s.paymentMethod === 'MERCADO_PAGO') {
      currentMpIncome += saleTotal;
    } else if (s.paymentMethod === 'COMBINADO') {
      combinedSalesCount++;
      combinedSalesIncome += saleTotal;
      currentCashIncome += Number(s.paymentBreakdown?.cashAmount) || 0;
      currentMpIncome += Number(s.paymentBreakdown?.mpAmount) || 0;
    } else {
      currentOtherIncome += saleTotal;
    }

    // Process sale items for COGS, Product Performance, and Category Breakdown
    for (const item of (s.items || [])) {
      const pId = item.productId;
      const qty = Number(item.quantity) || 0;
      const itemSubtotal = Number(item.subtotal) || (qty * (Number(item.unitPrice) || 0));
      
      const prodInfo = allProductsMap.get(pId);
      const { totalCogs: itemCogs } = calculateSaleItemCogs(item, allProductsMap);

      currentTotalCogs += itemCogs;

      // Product performance map
      const existing = productPerformanceMap.get(pId);
      if (existing) {
        existing.unitsSold += qty;
        existing.revenue += itemSubtotal;
        existing.cogs += itemCogs;
      } else {
        productPerformanceMap.set(pId, {
          productId: pId,
          productName: item.productName || prodInfo?.name || 'Producto',
          category: prodInfo?.category,
          unitsSold: qty,
          revenue: itemSubtotal,
          cogs: itemCogs
        });
      }

      // Category map
      const catName = prodInfo?.category || (item as any).category || 'General';
      const existingCat = categoryMap.get(catName) || { categoryName: catName, unitsSold: 0, revenue: 0, cogs: 0 };
      existingCat.unitsSold += qty;
      existingCat.revenue += itemSubtotal;
      existingCat.cogs += itemCogs;
      categoryMap.set(catName, existingCat);
    }
  }

  // Previous sales total
  const prevTotalIncome = prevSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  // Expenses calculations (Only cash/paid from business funds)
  // Direct purchases paid with cash/bank
  const currentPurchasesPaid = currentPurchases
    .filter(p => p.paymentStatus !== 'A_CANCELAR' && !p.obligationId && p.fundSource !== 'PERSONAL')
    .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  const prevPurchasesPaid = prevPurchases
    .filter(p => p.paymentStatus !== 'A_CANCELAR' && !p.obligationId && p.fundSource !== 'PERSONAL')
    .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  const currentOpExpensesPaid = currentExpenses
    .filter(isBusinessExpenseOutflow)
    .reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);

  const prevOpExpensesPaid = prevExpenses
    .filter(isBusinessExpenseOutflow)
    .reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);

  // Status breakdown of operating expenses
  const operatingExpensesPending = currentExpenses
    .filter(e => (e as any).status === 'PENDIENTE')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const operatingExpensesCancelled = currentExpenses
    .filter(e => (e as any).status === 'ANULADO' || (e as any).status === 'CANCELLED')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const personalExpenses = currentExpenses
    .filter(e => e.fundSource === 'PERSONAL')
    .reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);

  const currentSettlementsPaid = currentSettlements
    .filter(s => s.fundSource !== 'PERSONAL')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const prevSettlementsPaid = prevSettlements
    .filter(s => s.fundSource !== 'PERSONAL')
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const currentTotalExpensesPaid = currentPurchasesPaid + currentOpExpensesPaid + currentSettlementsPaid;
  const prevTotalExpensesPaid = prevPurchasesPaid + prevOpExpensesPaid + prevSettlementsPaid;

  // Results (Separated clearly)
  const currentFinancialResult = currentTotalIncome - currentTotalExpensesPaid;
  const prevFinancialResult = prevTotalIncome - prevTotalExpensesPaid;

  const currentGrossMarginAmount = currentTotalIncome - currentTotalCogs;
  const currentGrossMarginPercentage = currentTotalIncome > 0 ? (currentGrossMarginAmount / currentTotalIncome) * 100 : 0;

  const economicResult = currentTotalIncome - currentTotalCogs - currentOpExpensesPaid;

  const prevTotalCogs = prevSales.reduce((sum, s) => {
    return sum + (s.items || []).reduce((iSum, it) => {
      const { totalCogs } = calculateSaleItemCogs(it, allProductsMap);
      return iSum + totalCogs;
    }, 0);
  }, 0);
  const prevGrossMarginAmount = prevTotalIncome - prevTotalCogs;
  const prevEconomicResult = prevTotalIncome - prevTotalCogs - prevOpExpensesPaid;

  // Percentage changes
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const incomeChangePercentage = calcChange(currentTotalIncome, prevTotalIncome);
  const expensesChangePercentage = calcChange(currentTotalExpensesPaid, prevTotalExpensesPaid);
  const resultChangePercentage = calcChange(currentFinancialResult, prevFinancialResult);
  const marginChangePercentage = calcChange(currentGrossMarginAmount, prevGrossMarginAmount);
  const economicResultChangePercentage = calcChange(economicResult, prevEconomicResult);

  // Compile Product Performance Array
  const performanceItems: ProductPerformanceItem[] = Array.from(productPerformanceMap.values()).map(p => {
    const prod = allProductsMap.get(p.productId);
    const salePrice = Number(prod?.salePrice || 0);
    const costPrice = Number(prod?.costPrice || 0);
    const grossMargin = p.revenue - p.cogs;
    const grossMarginPercent = p.revenue > 0 ? (grossMargin / p.revenue) * 100 : 0;

    let isDeteriorated = false;
    let deteriorationReason: string | undefined = undefined;

    if (costPrice > 0) {
      if (costPrice >= salePrice) {
        isDeteriorated = true;
        deteriorationReason = `Costo ($${costPrice}) igual o superior al precio de venta ($${salePrice})`;
      } else {
        const itemUnitMargin = ((salePrice - costPrice) / salePrice) * 100;
        if (itemUnitMargin < 15) {
          isDeteriorated = true;
          deteriorationReason = `Margen unitario bajo (${itemUnitMargin.toFixed(1)}%). Costo actual: $${costPrice}, Venta: $${salePrice}`;
        }
      }
    }

    return {
      productId: p.productId,
      productName: p.productName,
      category: p.category,
      unitsSold: p.unitsSold,
      revenue: p.revenue,
      cogs: p.cogs,
      grossMargin,
      grossMarginPercent,
      currentSalePrice: salePrice,
      currentCostPrice: costPrice,
      isDeterioratedMargin: isDeteriorated,
      deteriorationReason
    };
  });

  // Check also products in catalog that may not have sold yet but have deteriorated margins
  for (const [prodId, prod] of allProductsMap.entries()) {
    if (!productPerformanceMap.has(prodId) && prod.active) {
      const salePrice = Number(prod.salePrice || 0);
      const costPrice = Number(prod.costPrice || 0);
      if (costPrice > 0 && costPrice >= salePrice) {
        performanceItems.push({
          productId: prodId,
          productName: prod.name,
          category: prod.category,
          unitsSold: 0,
          revenue: 0,
          cogs: 0,
          grossMargin: 0,
          grossMarginPercent: 0,
          currentSalePrice: salePrice,
          currentCostPrice: costPrice,
          isDeterioratedMargin: true,
          deteriorationReason: `Costo ($${costPrice}) igual o mayor al precio de venta ($${salePrice})`
        });
      }
    }
  }

  const topSellingByQuantity = [...performanceItems].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);
  const topSellingByRevenue = [...performanceItems].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topSellingByMargin = [...performanceItems].sort((a, b) => b.grossMargin - a.grossMargin).slice(0, 10);
  
  // Lowest margin products (from items that were actually sold)
  const lowestMarginProducts = [...performanceItems]
    .filter(p => p.unitsSold > 0)
    .sort((a, b) => a.grossMarginPercent - b.grossMarginPercent)
    .slice(0, 10);

  // Products with zero or negative margin
  const zeroOrNegativeMarginProducts = [...performanceItems]
    .filter(p => p.grossMargin <= 0 || (p.currentCostPrice >= p.currentSalePrice && p.currentCostPrice > 0))
    .slice(0, 10);

  const deterioratedMarginProducts = performanceItems.filter(p => p.isDeterioratedMargin);

  // Category Breakdown
  const categoryBreakdown: CategoryPerformanceItem[] = Array.from(categoryMap.values()).map(c => {
    const grossMargin = c.revenue - c.cogs;
    const grossMarginPercent = c.revenue > 0 ? (grossMargin / c.revenue) * 100 : 0;
    const percentageOfRevenue = currentTotalIncome > 0 ? (c.revenue / currentTotalIncome) * 100 : 0;
    return {
      categoryName: c.categoryName,
      unitsSold: c.unitsSold,
      revenue: c.revenue,
      cogs: c.cogs,
      grossMargin,
      grossMarginPercent,
      percentageOfRevenue
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Supplier Purchases Breakdown
  const supplierMap = new Map<string, {
    supplierName: string;
    totalPurchased: number;
    purchasesCount: number;
    totalItemsCount: number;
  }>();

  for (const p of currentPurchases) {
    const supp = p.supplierName || 'Varios';
    const existing = supplierMap.get(supp) || { supplierName: supp, totalPurchased: 0, purchasesCount: 0, totalItemsCount: 0 };
    existing.totalPurchased += Number(p.total) || 0;
    existing.purchasesCount += 1;
    existing.totalItemsCount += (p.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    supplierMap.set(supp, existing);
  }

  const supplierPurchases: SupplierPurchaseItem[] = Array.from(supplierMap.values()).map(s => {
    const pendingAmount = obligations
      .filter(o => (o.supplierName || 'Varios').toLowerCase() === s.supplierName.toLowerCase())
      .reduce((sum, o) => sum + (Number(o.pendingAmount ?? o.amount) || 0), 0);

    return {
      supplierName: s.supplierName,
      totalPurchased: s.totalPurchased,
      purchasesCount: s.purchasesCount,
      totalItemsCount: s.totalItemsCount,
      pendingObligationsAmount: pendingAmount
    };
  }).sort((a, b) => b.totalPurchased - a.totalPurchased);

  // Inventory & Capital Summary (using current Product.costPrice strictly for replacement value)
  let totalStockUnits = 0;
  let totalReplacementValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minimumStock: number;
    costPrice: number;
    category?: string;
  }> = [];

  const outOfStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minimumStock: number;
    costPrice: number;
    category?: string;
  }> = [];

  for (const p of allProductsMap.values()) {
    if (p.tracksStock !== false && p.active) {
      const stock = Number(p.stock) || 0;
      const costPrice = Number(p.costPrice) || 0;
      const minStock = Number(p.minimumStock) || 0;

      totalStockUnits += Math.max(0, stock);
      if (stock > 0) {
        totalReplacementValue += stock * costPrice;
      }

      if (stock <= 0) {
        outOfStockCount++;
        outOfStockProducts.push({
          id: p.id,
          name: p.name,
          stock,
          minimumStock: minStock,
          costPrice,
          category: p.category
        });
      } else if (stock <= minStock) {
        lowStockCount++;
        lowStockProducts.push({
          id: p.id,
          name: p.name,
          stock,
          minimumStock: minStock,
          costPrice,
          category: p.category
        });
      }
    }
  }

  const inventorySummary: InventoryCapitalSummary = {
    totalProductsCount: allProductsMap.size,
    totalStockUnits,
    totalReplacementValue,
    lowStockCount,
    outOfStockCount,
    lowStockProducts: lowStockProducts.slice(0, 20),
    outOfStockProducts: outOfStockProducts.slice(0, 20)
  };

  // Monthly Comparison (Last 6 Months)
  const monthlyComparison: MonthlyComparisonPoint[] = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const monthLabel = `${monthNames[m]} ${y}`;

    const mStart = new Date(y, m, 1).toISOString();
    const mEnd = new Date(y, m + 1, 0, 23, 59, 59, 999).toISOString();

    const mSales = allSales.filter(s => s.createdAt && s.createdAt >= mStart && s.createdAt <= mEnd);
    const mIncome = mSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

    const mPurchasesPaid = allPurchases
      .filter(p => p.createdAt && p.createdAt >= mStart && p.createdAt <= mEnd && p.paymentStatus !== 'A_CANCELAR' && !p.obligationId && p.fundSource !== 'PERSONAL')
      .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

    const mExpensesPaid = allExpenses
      .filter(e => e.createdAt && e.createdAt >= mStart && e.createdAt <= mEnd && isBusinessExpenseOutflow(e))
      .reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);

    const mSettlementsPaid = allSettlements
      .filter(s => s.paymentDate && s.paymentDate >= mStart && s.paymentDate <= mEnd && s.fundSource !== 'PERSONAL')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    const mTotalExpenses = mPurchasesPaid + mExpensesPaid + mSettlementsPaid;
    const mResult = mIncome - mTotalExpenses;

    const mCogs = mSales.reduce((sum, s) => {
      return sum + (s.items || []).reduce((iSum, it) => {
        const { totalCogs } = calculateSaleItemCogs(it, allProductsMap);
        return iSum + totalCogs;
      }, 0);
    }, 0);
    const mMargin = mIncome - mCogs;

    const mEconomicResult = mMargin - mExpensesPaid;
    const mFinancialResult = mIncome - mTotalExpenses;
    const mGrossMarginPercentage = mIncome > 0 ? (mMargin / mIncome) * 100 : 0;

    monthlyComparison.push({
      monthKey,
      monthLabel,
      income: mIncome,
      expenses: mTotalExpenses,
      result: mResult,
      margin: mMargin,
      salesCount: mSales.length,
      cogs: mCogs,
      economicResult: mEconomicResult,
      financialResult: mFinancialResult,
      grossMarginPercentage: mGrossMarginPercentage
    });
  }

  return {
    summary: {
      totalIncome: currentTotalIncome,
      cashIncome: currentCashIncome,
      mercadoPagoIncome: currentMpIncome,
      otherIncome: currentOtherIncome,
      combinedSalesIncome,
      combinedSalesCount,
      salesCount: currentSales.length,
      averageTicket: currentSales.length > 0 ? Math.round(currentTotalIncome / currentSales.length) : 0,
      totalExpensesPaid: currentTotalExpensesPaid,
      purchasesPaid: currentPurchasesPaid,
      operatingExpensesPaid: currentOpExpensesPaid,
      settlementsPaid: currentSettlementsPaid,
      operatingExpensesPending,
      operatingExpensesCancelled,
      personalExpenses,
      financialResult: currentFinancialResult,
      economicResult,
      currentCashBalance,
      periodCashInflow: currentCashIncome,
      periodCashOutflow: currentTotalExpensesPaid,
      totalCogs: currentTotalCogs,
      grossMarginAmount: currentGrossMarginAmount,
      grossMarginPercentage: currentGrossMarginPercentage,
      totalPendingObligations,
      pendingSuppliersCount: pendingSuppliersSet.size,
      incomeChangePercentage,
      expensesChangePercentage,
      resultChangePercentage,
      marginChangePercentage,
      economicResultChangePercentage
    },
    topSellingByQuantity,
    topSellingByRevenue,
    topSellingByMargin,
    lowestMarginProducts,
    zeroOrNegativeMarginProducts,
    deterioratedMarginProducts,
    categoryBreakdown,
    supplierPurchases,
    inventorySummary,
    monthlyComparison
  };
}
