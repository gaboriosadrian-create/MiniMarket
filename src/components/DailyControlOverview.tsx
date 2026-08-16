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

  // Calculations
  const totalVentas = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalCompras = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalGastos = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const resultadoOperativo = totalVentas - totalCompras - totalGastos;
  const isPositive = resultadoOperativo >= 0;

  // Breakdown sales
  const salesCash = sales.filter((s) => s.paymentMethod === 'EFECTIVO').reduce((sum, s) => sum + s.total, 0);
  const salesMp = sales.filter((s) => s.paymentMethod === 'MERCADO_PAGO').reduce((sum, s) => sum + s.total, 0);

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
    <div className="space-y-6">
      {/* Date Filter */}
      <DateFilter onDateRangeChange={handleDateRangeChange} />

      {/* Main Resultado Operativo Hero Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm transition-all ${
        isPositive 
          ? 'bg-gradient-to-br from-emerald-900 to-stone-900 text-white border-emerald-800' 
          : 'bg-gradient-to-br from-rose-900 to-stone-900 text-white border-rose-800'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isPositive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                Control Diario — Resultado Operativo
              </span>
              <span className="text-xs text-stone-300 font-medium">({dateRangeLabel})</span>
            </div>

            <h3 className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
              {formatCurrency(resultadoOperativo)}
            </h3>

            <p className="text-xs sm:text-sm text-stone-300 flex items-center gap-1 font-medium">
              {isPositive ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Ganancia Operativa Neta:</span> Ventas superan egresos (compras + gastos) en el período.
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400 font-bold">Déficit Operativo:</span> Los egresos superan las ventas del período.
                </>
              )}
            </p>
          </div>

          {/* Equation summary */}
          <div className="bg-stone-950/60 p-4 rounded-2xl border border-white/10 text-xs space-y-2 shrink-0 min-w-[240px]">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Ventas (+)
              </span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalVentas)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <ShoppingCart className="w-3.5 h-3.5 text-amber-400" /> Compras (-)
              </span>
              <span className="font-mono font-bold text-amber-400">-{formatCurrency(totalCompras)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-rose-400" /> Gastos (-)
              </span>
              <span className="font-mono font-bold text-rose-400">-{formatCurrency(totalGastos)}</span>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between font-black font-mono text-sm">
              <span>Resultado</span>
              <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                {formatCurrency(resultadoOperativo)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Ventas Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Ventas</h4>
                <p className="text-[11px] text-stone-500">{sales.length} transacciones</p>
              </div>
            </div>
            <span className="text-lg font-black font-mono text-emerald-700">
              {formatCurrency(totalVentas)}
            </span>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-stone-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Efectivo
              </span>
              <span className="font-mono font-bold text-stone-900">{formatCurrency(salesCash)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-sky-600" /> Mercado Pago
              </span>
              <span className="font-mono font-bold text-stone-900">{formatCurrency(salesMp)}</span>
            </div>
          </div>
        </div>

        {/* Compras Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Compras Mercadería</h4>
                <p className="text-[11px] text-stone-500">{purchases.length} compras</p>
              </div>
            </div>
            <span className="text-lg font-black font-mono text-amber-700">
              {formatCurrency(totalCompras)}
            </span>
          </div>

          <div className="pt-3 border-t border-stone-100 text-xs text-stone-500">
            Egreso por reposición e insumos de mercadería.
          </div>
        </div>

        {/* Gastos Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-stone-900 text-sm">Gastos Operativos</h4>
                <p className="text-[11px] text-stone-500">{expenses.length} gastos</p>
              </div>
            </div>
            <span className="text-lg font-black font-mono text-rose-700">
              {formatCurrency(totalGastos)}
            </span>
          </div>

          <div className="space-y-1 pt-3 border-t border-stone-100 text-xs">
            {expensesByCategory.length === 0 ? (
              <span className="text-stone-400 italic">Sin gastos en este período</span>
            ) : (
              expensesByCategory.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
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
