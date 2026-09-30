import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Sale } from '../types';
import { getSalesByBusiness } from '../lib/saleService';
import { DateFilter } from './DateFilter';
import { Store, Banknote, QrCode, DollarSign, Receipt, Info } from 'lucide-react';

export const CajaSummary: React.FC = () => {
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');

  const loadSales = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const data = await getSalesByBusiness(business.id, start || startDateIso, end || endDateIso);
      setSales(data);
    } catch (err) {
      console.error('Error loading caja sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadSales(start, end);
  };

  const activeSales = sales.filter((s) => s.status !== 'CANCELLED');
  const cashSales = activeSales.filter((s) => s.paymentMethod === 'EFECTIVO');
  const mpSales = activeSales.filter((s) => s.paymentMethod === 'MERCADO_PAGO');
  const combinedSales = activeSales.filter((s) => s.paymentMethod === 'COMBINADO');

  const totalCash = activeSales.reduce((sum, s) => {
    if (s.paymentMethod === 'EFECTIVO') return sum + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (s.paymentBreakdown.cashAmount || 0);
    return sum;
  }, 0);

  const totalMp = activeSales.reduce((sum, s) => {
    if (s.paymentMethod === 'MERCADO_PAGO') return sum + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return sum + (s.paymentBreakdown.mpAmount || 0);
    return sum;
  }, 0);

  const totalGeneral = totalCash + totalMp;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <DateFilter viewTitle="Resumen de Caja" onDateRangeChange={handleDateRangeChange} />

      {/* Info Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 text-xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0" />
        <p>
          Resumen automático de caja basado en las ventas confirmadas durante el período <strong className="font-bold">{dateRangeLabel}</strong>.
        </p>
      </div>

      {/* Caja Method Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* EFECTIVO Card */}
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-stone-900 text-base">Efectivo</h4>
                <span className="text-xs text-stone-500 font-medium">{cashSales.length} operaciones</span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-full">
              Caja Física
            </span>
          </div>

          <div className="pt-2 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Total Recaudado</span>
            <p className="text-3xl font-black text-emerald-700 font-mono mt-0.5">
              {formatCurrency(totalCash)}
            </p>
          </div>
        </div>

        {/* MERCADO PAGO Card */}
        <div className="bg-white rounded-2xl border-2 border-sky-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-stone-900 text-base">Mercado Pago</h4>
                <span className="text-xs text-stone-500 font-medium">{mpSales.length} operaciones</span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-[11px] font-extrabold rounded-full">
              Digital
            </span>
          </div>

          <div className="pt-2 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Total Recaudado</span>
            <p className="text-3xl font-black text-sky-800 font-mono mt-0.5">
              {formatCurrency(totalMp)}
            </p>
          </div>
        </div>

        {/* TOTAL GENERAL Card */}
        <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-xl bg-stone-800 text-emerald-400 flex items-center justify-center font-bold">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Total Vendido</h4>
                <span className="text-xs text-stone-400 font-medium">{sales.length} ventas totales</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-800">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Total General Caja</span>
            <p className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
              {formatCurrency(totalGeneral)}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
