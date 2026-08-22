import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Sale, Purchase, Expense } from '../types';
import { getSalesByBusiness } from '../lib/saleService';
import { getPurchasesByBusiness } from '../lib/purchaseService';
import { getExpensesByBusiness } from '../lib/expenseService';
import { DateFilter } from './DateFilter';
import { 
  TrendingUp, 
  ShoppingCart, 
  Receipt, 
  Calculator, 
  Banknote, 
  QrCode, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  PieChart,
  DollarSign
} from 'lucide-react';

export const DailyControlOverview: React.FC = () => {
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');

  const loadData = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const sIso = start || startDateIso;
      const eIso = end || endDateIso;

      const [salesData, purchasesData, expensesData] = await Promise.all([
        getSalesByBusiness(business.id, sIso, eIso),
        getPurchasesByBusiness(business.id, sIso, eIso),
        getExpensesByBusiness(business.id, sIso, eIso)
      ]);

      setSales(salesData);
      setPurchases(purchasesData);
      setExpenses(expensesData);
    } catch (err) {
      console.error('Error loading overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadData(start, end);
  };

  // Filter confirmed purchases for daily control and financial calculation
  const confirmedPurchases = purchases.filter(
    (p) => p.status === 'CONFIRMED' || (!p.status && (p.amount !== undefined || p.total !== undefined))
  );

  // Calculations
  const totalVentas = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalCompras = confirmedPurchases.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);
  const totalGastos = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const resultadoOperativo = totalVentas - totalCompras - totalGastos;
  const isPositive = resultadoOperativo >= 0;

  // Breakdown sales (Efectivo, Mercado Pago, and Combined portions)
  const salesCash = sales.reduce((sum, s) => {
    if (s.paymentMethod === 'EFECTIVO') return sum + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (s.paymentBreakdown.cashAmount || 0);
    return sum;
  }, 0);

  const salesMp = sales.reduce((sum, s) => {
    if (s.paymentMethod === 'MERCADO_PAGO') return sum + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (s.paymentBreakdown.mpAmount || 0);
    return sum;
  }, 0);

  const combinedSalesCount = sales.filter((s) => s.paymentMethod === 'COMBINADO').length;

  // Breakdown expenses by category
  const expenseCategories = ['Servicios', 'Limpieza', 'Mantenimiento', 'Transporte', 'Otros'];
  const expensesByCategory = expenseCategories.map((cat) => {
    const sum = expenses
      .filter((e) => e.category === cat)
      .reduce((acc, e) => acc + (e.amount || 0), 0);
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
      <DateFilter viewTitle="Control Diario" onDateRangeChange={handleDateRangeChange} />

      {/* Main Resultado Operativo Hero Card */}
      <div className="bg-white p-5 sm:p-6 rounded border border-stone-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                isPositive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                Control Diario — Resultado Operativo
              </span>
              <span className="text-xs text-stone-500 font-medium">({dateRangeLabel})</span>
            </div>

            <h3 className={`text-2xl sm:text-4xl font-black font-mono tracking-tight ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(resultadoOperativo)}
            </h3>

            <p className="text-xs text-stone-600 flex items-center gap-1 font-medium">
              {isPositive ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Ganancia Operativa Neta:</span> Ventas superan compras y gastos del período.
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-red-700 font-bold">Déficit Operativo:</span> Los egresos superan las ventas del período.
                </>
              )}
            </p>
          </div>

          {/* Equation summary */}
          <div className="bg-stone-50 p-3.5 rounded border border-stone-200 text-xs space-y-1.5 shrink-0 w-full md:w-64">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Ventas (+)
              </span>
              <span className="font-mono font-bold text-emerald-700">{formatCurrency(totalVentas)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-600" /> Compras (-)
              </span>
              <span className="font-mono font-bold text-amber-700">-{formatCurrency(totalCompras)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-600 font-medium flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-rose-600" /> Gastos (-)
              </span>
              <span className="font-mono font-bold text-rose-700">-{formatCurrency(totalGastos)}</span>
            </div>

            <div className="pt-1.5 border-t border-stone-200 flex items-center justify-between font-black font-mono text-xs">
              <span className="text-stone-800">Resultado</span>
              <span className={isPositive ? 'text-emerald-700' : 'text-red-700'}>
                {formatCurrency(resultadoOperativo)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        
        {/* Ventas Card */}
        <div className="bg-white rounded border border-stone-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-stone-900 text-xs">Ventas</h4>
                <p className="text-[10px] text-stone-500 font-medium">{sales.length} transacciones</p>
              </div>
            </div>
            <span className="text-base font-black font-mono text-emerald-700">
              {formatCurrency(totalVentas)}
            </span>
          </div>

          <div className="space-y-1 pt-2.5 border-t border-stone-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Efectivo
              </span>
              <span className="font-mono font-bold text-stone-900">{formatCurrency(salesCash)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-blue-600" /> Mercado Pago
              </span>
              <span className="font-mono font-bold text-stone-900">{formatCurrency(salesMp)}</span>
            </div>
            {combinedSalesCount > 0 && (
              <div className="text-[10px] text-stone-400 font-medium text-right pt-0.5">
                (Incluye {combinedSalesCount} cobro{combinedSalesCount > 1 ? 's' : ''} combinado{combinedSalesCount > 1 ? 's' : ''})
              </div>
            )}
          </div>
        </div>

        {/* Compras Card */}
        <div className="bg-white rounded border border-stone-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-stone-900 text-xs">Compras</h4>
                <p className="text-[10px] text-stone-500 font-medium">{confirmedPurchases.length} compras confirmadas</p>
              </div>
            </div>
            <span className="text-base font-black font-mono text-amber-700">
              {formatCurrency(totalCompras)}
            </span>
          </div>

          <div className="pt-2.5 border-t border-stone-100 text-[11px] text-stone-500 font-medium">
            Egreso por reposición e insumos de productos.
          </div>
        </div>

        {/* Gastos Card */}
        <div className="bg-white rounded border border-stone-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-stone-900 text-xs">Gastos Operativos</h4>
                <p className="text-[10px] text-stone-500 font-medium">{expenses.length} gastos</p>
              </div>
            </div>
            <span className="text-base font-black font-mono text-rose-700">
              {formatCurrency(totalGastos)}
            </span>
          </div>

          <div className="space-y-1 pt-2.5 border-t border-stone-100 text-xs">
            {expensesByCategory.length === 0 ? (
              <span className="text-stone-400 italic text-[11px]">Sin gastos en este período</span>
            ) : (
              expensesByCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-500">{cat.category}</span>
                  <span className="font-mono font-bold text-stone-800">{formatCurrency(cat.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
