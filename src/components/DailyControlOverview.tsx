import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { Sale, Purchase, Expense, Product, PaymentSettlement } from '../types';
import { getSalesByBusiness } from '../lib/saleService';
import { getPurchasesByBusiness } from '../lib/purchaseService';
import { getExpensesByBusiness } from '../lib/expenseService';
import { getPaymentSettlementsByBusiness } from '../lib/obligationService';
import { getProductsByBusiness } from '../lib/productService';
import { calculateSaleItemCogs, isBusinessExpenseOutflow } from '../lib/businessAnalysisService';
import { DateFilter } from './DateFilter';
import { 
  TrendingUp, 
  TrendingDown,
  ShoppingCart, 
  Receipt, 
  Banknote, 
  QrCode, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  DollarSign,
  Percent,
  Building2,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface DailyControlOverviewProps {
  isSellerDailyControl?: boolean;
}

export const DailyControlOverview: React.FC<DailyControlOverviewProps> = ({ isSellerDailyControl = false }) => {
  const { userProfile, business } = useAuth();
  const isSellerRestricted = isSellerDailyControl || userProfile?.role === 'SELLER';

  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<PaymentSettlement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');

  const loadData = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      let sIso = start || startDateIso;
      let eIso = end || endDateIso;

      // In restricted seller mode, enforce today at load time
      if (isSellerRestricted) {
        const now = new Date();
        const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        sIso = s.toISOString();
        eIso = e.toISOString();
      }

      const [salesData, purchasesData, expensesData, settlementsData, productsData] = await Promise.all([
        getSalesByBusiness(business.id, sIso, eIso),
        getPurchasesByBusiness(business.id, sIso, eIso),
        getExpensesByBusiness(business.id, sIso, eIso),
        getPaymentSettlementsByBusiness(business.id, undefined, sIso, eIso),
        getProductsByBusiness(business.id)
      ]);

      setSales(salesData);
      setPurchases(purchasesData);
      setExpenses(expensesData);
      setSettlements(settlementsData);
      setProducts(productsData);
    } catch (err) {
      console.error('[DailyControlOverview] Error loading overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    if (isSellerRestricted) {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const todayFormatted = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(now);
      const todayLabel = `Hoy — ${todayFormatted}`;
      setStartDateIso(s.toISOString());
      setEndDateIso(e.toISOString());
      setDateRangeLabel(todayLabel);
      loadData(s.toISOString(), e.toISOString());
      return;
    }

    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadData(start, end);
  };

  // 1. Filter completed sales
  const activeSales = useMemo(() => {
    return sales.filter((s) => s.status === 'COMPLETED' || (!s.status && s.status !== 'CANCELLED'));
  }, [sales]);

  const totalVentas = useMemo(() => {
    return activeSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  }, [activeSales]);

  // Breakdown sales (Efectivo, Mercado Pago, and Combined portions)
  const salesCash = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      if (s.paymentMethod === 'EFECTIVO') return sum + (Number(s.total) || 0);
      if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (Number(s.paymentBreakdown.cashAmount) || 0);
      return sum;
    }, 0);
  }, [activeSales]);

  const salesMp = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      if (s.paymentMethod === 'MERCADO_PAGO') return sum + (Number(s.total) || 0);
      if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (Number(s.paymentBreakdown.mpAmount) || 0);
      return sum;
    }, 0);
  }, [activeSales]);

  const combinedSalesCount = useMemo(() => {
    return activeSales.filter((s) => s.paymentMethod === 'COMBINADO').length;
  }, [activeSales]);

  const averageTicket = useMemo(() => {
    return activeSales.length > 0 ? Math.round(totalVentas / activeSales.length) : 0;
  }, [activeSales.length, totalVentas]);

  // 2. Filter Confirmed Purchases and partition by payment status & fund source
  const confirmedPurchases = useMemo(() => {
    return purchases.filter(
      (p) => p.status === 'CONFIRMED' || (!p.status && (p.amount !== undefined || p.total !== undefined))
    );
  }, [purchases]);

  // Purchases paid with business funds (real cash/bank outflow)
  const purchasesPaid = useMemo(() => {
    return confirmedPurchases.filter(
      (p) => p.paymentStatus !== 'A_CANCELAR' && p.fundSource !== 'PERSONAL'
    );
  }, [confirmedPurchases]);

  const totalComprasPagadas = useMemo(() => {
    return purchasesPaid.reduce((sum, p) => sum + (Number(p.total ?? p.amount) || 0), 0);
  }, [purchasesPaid]);

  // Purchases on credit / deferred payment (A Cancelar - Liabilities, do not deduct from cashflow)
  const purchasesToCancel = useMemo(() => {
    return confirmedPurchases.filter((p) => p.paymentStatus === 'A_CANCELAR');
  }, [confirmedPurchases]);

  const totalComprasACancelar = useMemo(() => {
    return purchasesToCancel.reduce((sum, p) => sum + (Number(p.total ?? p.amount) || 0), 0);
  }, [purchasesToCancel]);

  // Purchases paid with personal funds (Do not deduct from business cashflow)
  const purchasesPersonal = useMemo(() => {
    return confirmedPurchases.filter((p) => p.fundSource === 'PERSONAL');
  }, [confirmedPurchases]);

  const totalComprasPersonal = useMemo(() => {
    return purchasesPersonal.reduce((sum, p) => sum + (Number(p.total ?? p.amount) || 0), 0);
  }, [purchasesPersonal]);

  // 3. Operating Expenses paid from business funds (Strict financial outflow parity)
  const expensesPaid = useMemo(() => {
    return expenses.filter(isBusinessExpenseOutflow);
  }, [expenses]);

  const totalGastosPagados = useMemo(() => {
    return expensesPaid.reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);
  }, [expensesPaid]);

  const expensesPersonal = useMemo(() => {
    return expenses.filter((e) => e.fundSource === 'PERSONAL' && e.status !== 'ANULADO');
  }, [expenses]);

  const totalGastosPersonal = useMemo(() => {
    return expensesPersonal.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expensesPersonal]);

  // 4. Payment Settlements / Supplier Debt Payments in this period
  const settlementsPaid = useMemo(() => {
    return settlements.filter((s) => s.fundSource !== 'PERSONAL');
  }, [settlements]);

  const totalSettlementsPaid = useMemo(() => {
    return settlementsPaid.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [settlementsPaid]);

  // 5. Total Paid Expenses (Real Financial Outflow from Business Funds)
  const totalEgresosPagados = totalComprasPagadas + totalGastosPagados + totalSettlementsPaid;

  // 6. Net Financial Result (Ingresos Cobrados - Egresos Efectivamente Pagados)
  const resultadoFinanciero = totalVentas - totalEgresosPagados;
  const isPositiveFinancial = resultadoFinanciero >= 0;

  // 7. Economic Profitability: CMV & Gross Margin using immutable historical snapshot
  const productsMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const totalCogs = useMemo(() => {
    return activeSales.reduce((sum, s) => {
      return sum + (s.items || []).reduce((iSum, it) => {
        const { totalCogs: itemCogs } = calculateSaleItemCogs(it, productsMap);
        return iSum + itemCogs;
      }, 0);
    }, 0);
  }, [activeSales, productsMap]);

  const margenBrutoAmount = totalVentas - totalCogs;
  const margenBrutoPercent = totalVentas > 0 ? (margenBrutoAmount / totalVentas) * 100 : 0;
  const resultadoOperativoEconomico = margenBrutoAmount - totalGastosPagados;

  // Breakdown expenses by category
  const expenseCategories = ['Servicios', 'Limpieza', 'Mantenimiento', 'Transporte', 'Otros'];
  const expensesByCategory = expenseCategories.map((cat) => {
    const sum = expensesPaid
      .filter((e) => e.category === cat)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    return { category: cat, total: sum };
  }).filter((item) => item.total > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <DateFilter 
        viewTitle={isSellerRestricted ? "Control de Caja" : "Control Diario"} 
        lockToday={isSellerRestricted}
        onDateRangeChange={handleDateRangeChange} 
      />

      {/* Main Resultado Financiero Hero Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                isPositiveFinancial ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {isSellerRestricted ? 'Control de Caja — Flujo del Turno' : 'Control Diario — Resultado Financiero'}
              </span>
              <span className="text-xs text-stone-500 font-medium">({dateRangeLabel})</span>
            </div>

            <h3 className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${isPositiveFinancial ? 'text-emerald-700' : 'text-red-700'}`}>
              {isPositiveFinancial ? `+${formatCurrency(resultadoFinanciero)}` : `-${formatCurrency(Math.abs(resultadoFinanciero))}`}
            </h3>

            <p className="text-xs text-stone-600 flex items-center gap-1 font-medium">
              {isPositiveFinancial ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-bold">Superávit Financiero:</span> Los ingresos cobrados superan los egresos efectivamente desembolsados del período.
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-red-700 font-bold">Déficit Financiero:</span> Los desembolsos de fondos superan los ingresos cobrados del período.
                </>
              )}
            </p>

            {/* Informational badges for non-cash commitments */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
              {totalComprasACancelar > 0 && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-md font-medium">
                  <Building2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Compras a crédito (A Cancelar): <strong>{formatCurrency(totalComprasACancelar)}</strong> (No restan de caja)</span>
                </div>
              )}
              {totalComprasPersonal > 0 && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-md font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                  <span>Aportes personales: <strong>{formatCurrency(totalComprasPersonal)}</strong> (Fondos personales)</span>
                </div>
              )}
            </div>
          </div>

          {/* Equation summary box */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs space-y-2 shrink-0 w-full lg:w-72">
            <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider pb-1 border-b border-stone-200">
              Desglose de Flujo de Fondos
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Ventas Cobradas (+)
              </span>
              <span className="font-mono font-bold text-emerald-700">+{formatCurrency(totalVentas)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-600" /> Compras Pagadas (-)
              </span>
              <span className="font-mono font-bold text-amber-700">-{formatCurrency(totalComprasPagadas)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-rose-600" /> Gastos Pagados (-)
              </span>
              <span className="font-mono font-bold text-rose-700">-{formatCurrency(totalGastosPagados)}</span>
            </div>

            {totalSettlementsPaid > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-600 font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-purple-600" /> Pagos Proveedores (-)
                </span>
                <span className="font-mono font-bold text-purple-700">-{formatCurrency(totalSettlementsPaid)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex items-center justify-between font-black font-mono text-xs">
              <span className="text-stone-800">Resultado Financiero</span>
              <span className={isPositiveFinancial ? 'text-emerald-700' : 'text-red-700'}>
                {isPositiveFinancial ? `+${formatCurrency(resultadoFinanciero)}` : `-${formatCurrency(Math.abs(resultadoFinanciero))}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* 1. Ventas Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 text-xs">Ingresos por Ventas</h4>
                  <p className="text-[10px] text-stone-500 font-medium">{activeSales.length} operaciones</p>
                </div>
              </div>
              <span className="text-base font-black font-mono text-emerald-700">
                {formatCurrency(totalVentas)}
              </span>
            </div>

            <div className="space-y-1 pt-2.5 mt-2 border-t border-stone-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Efectivo
                </span>
                <span className="font-mono font-bold text-stone-900 text-xs">{formatCurrency(salesCash)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 flex items-center gap-1 text-[11px]">
                  <QrCode className="w-3.5 h-3.5 text-blue-600" /> Mercado Pago
                </span>
                <span className="font-mono font-bold text-stone-900 text-xs">{formatCurrency(salesMp)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500">
                <span>Ticket promedio:</span>
                <span className="font-mono font-semibold text-stone-700">{formatCurrency(averageTicket)}</span>
              </div>
            </div>
          </div>

          {combinedSalesCount > 0 && (
            <div className="text-[10px] text-stone-400 font-medium text-right pt-1 border-t border-stone-50">
              (Incluye {combinedSalesCount} cobro{combinedSalesCount > 1 ? 's' : ''} combinado{combinedSalesCount > 1 ? 's' : ''})
            </div>
          )}
        </div>

        {/* 2. Egresos Pagados Card */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 text-xs">Egresos Pagados</h4>
                  <p className="text-[10px] text-stone-500 font-medium">{purchasesPaid.length + expensesPaid.length + settlementsPaid.length} salidas</p>
                </div>
              </div>
              <span className="text-base font-black font-mono text-rose-700">
                {formatCurrency(totalEgresosPagados)}
              </span>
            </div>

            <div className="space-y-1 pt-2.5 mt-2 border-t border-stone-100 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500">Compras pagadas:</span>
                <span className="font-mono font-bold text-stone-800">{formatCurrency(totalComprasPagadas)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500">Gastos operativos:</span>
                <span className="font-mono font-bold text-stone-800">{formatCurrency(totalGastosPagados)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500">Liquidación deudas:</span>
                <span className="font-mono font-bold text-stone-800">{formatCurrency(totalSettlementsPaid)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-stone-400 font-medium pt-1 border-t border-stone-50">
            Salidas reales de fondos del negocio.
          </div>
        </div>

        {/* 3. Margen Bruto & Rentabilidad Económica */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 text-xs">Margen Bruto (Ventas)</h4>
                  <p className="text-[10px] text-blue-600 font-bold">{margenBrutoPercent.toFixed(1)}% rentabilidad</p>
                </div>
              </div>
              <span className="text-base font-black font-mono text-blue-700">
                {formatCurrency(margenBrutoAmount)}
              </span>
            </div>

            <div className="space-y-1 pt-2.5 mt-2 border-t border-stone-100 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500">Costo mercadería (CMV):</span>
                <span className="font-mono font-bold text-stone-800">{formatCurrency(totalCogs)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500">Margen neto operativo:</span>
                <span className={`font-mono font-bold ${resultadoOperativoEconomico >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(resultadoOperativoEconomico)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-stone-400 font-medium pt-1 border-t border-stone-50">
            Calculado con costo histórico congelado al vender.
          </div>
        </div>

        {/* 4. Compromisos y Pasivos (A Cancelar) */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-stone-900 text-xs">Compras a Cancelar</h4>
                  <p className="text-[10px] text-stone-500 font-medium">{purchasesToCancel.length} compras a crédito</p>
                </div>
              </div>
              <span className="text-base font-black font-mono text-amber-700">
                {formatCurrency(totalComprasACancelar)}
              </span>
            </div>

            <div className="space-y-1 pt-2.5 mt-2 border-t border-stone-100 text-xs">
              <p className="text-[11px] text-stone-600 font-medium">
                {totalComprasACancelar > 0 
                  ? 'Compromisos comerciales generados que no reducen la caja física hasta su pago.'
                  : 'Sin compras a crédito pendientes en este período.'
                }
              </p>
              {totalComprasPersonal > 0 && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-50">
                  <span className="text-stone-500">Fondos personales:</span>
                  <span className="font-mono font-bold text-stone-700">{formatCurrency(totalComprasPersonal)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-stone-400 font-medium pt-1 border-t border-stone-50">
            Gestionables desde "Proveedores a Cancelar".
          </div>
        </div>

      </div>

      {/* Gastos Desglosados por Categoría (if any) */}
      {expensesByCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-stone-500" />
              Gastos Operativos Pagados por Categoría ({dateRangeLabel})
            </h4>
            <span className="font-mono font-bold text-xs text-rose-700">{formatCurrency(totalGastosPagados)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {expensesByCategory.map((cat) => (
              <div key={cat.category} className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/70">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">{cat.category}</span>
                <span className="font-mono font-black text-stone-900 text-sm mt-0.5 block">{formatCurrency(cat.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
