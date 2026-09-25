import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  getBusinessAnalysis, 
  calculateDateRange, 
  BusinessAnalysisData, 
  BusinessAnalysisPreset 
} from '../lib/businessAnalysisService';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  ShoppingCart, 
  AlertTriangle, 
  Calendar, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Package, 
  ShieldAlert, 
  RefreshCw, 
  ChevronRight,
  Filter,
  Layers,
  Truck,
  Archive,
  ArrowRight,
  Info,
  Building2,
  Wallet
} from 'lucide-react';

interface BusinessAnalysisProps {
  onNavigateToObligations?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToPurchases?: () => void;
}

export const BusinessAnalysis: React.FC<BusinessAnalysisProps> = ({ 
  onNavigateToObligations,
  onNavigateToProducts,
  onNavigateToPurchases
}) => {
  const { business } = useAuth();
  const [preset, setPreset] = useState<BusinessAnalysisPreset>('ESTE_MES');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<BusinessAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeProductTab, setActiveProductTab] = useState<'revenue' | 'units' | 'margin' | 'lowest' | 'negative' | 'deteriorated'>('revenue');
  const [activeSection, setActiveSection] = useState<'overview' | 'categories' | 'suppliers' | 'inventory'>('overview');

  const loadAnalysis = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const dateRange = calculateDateRange(preset, customStart, customEnd);
      const res = await getBusinessAnalysis(business.id, dateRange);
      setData(res);
    } catch (err) {
      console.error('[BusinessAnalysis] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, [business?.id, preset, customStart, customEnd]);

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Top Header & Period Filter */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-900">Análisis del Negocio y Rentabilidad Económica</h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                Auditoría Financiera
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Distinción transparente entre Resultado Económico (Utilidad Operativa), Flujo de Caja Real, Margen Bruto (CMV histórico) y Capital Inmovilizado.
            </p>
          </div>
        </div>

        {/* Date Filter Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs font-medium flex-wrap gap-0.5">
            {[
              { id: 'HOY', label: 'Hoy' },
              { id: 'ESTA_SEMANA', label: 'Semana' },
              { id: 'ULTIMOS_7_DIAS', label: '7 días' },
              { id: 'ESTE_MES', label: 'Este mes' },
              { id: 'MES_ANTERIOR', label: 'Mes ant.' },
              { id: 'ULTIMOS_30_DIAS', label: '30 días' },
              { id: 'ANIO_ACTUAL', label: 'Año' },
              { id: 'ULTIMOS_3_MESES', label: '3 meses' },
              { id: 'CUSTOM', label: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id as BusinessAnalysisPreset)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  preset === p.id 
                    ? 'bg-white font-bold text-stone-900 shadow-xs' 
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 bg-stone-50 p-1 rounded-lg border border-stone-200 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 bg-white border border-stone-200 rounded text-xs"
              />
              <span className="text-stone-400">a</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 bg-white border border-stone-200 rounded text-xs"
              />
            </div>
          )}

          <button
            onClick={loadAnalysis}
            disabled={loading}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center transition-colors cursor-pointer"
            title="Recargar análisis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-xs text-xs font-semibold overflow-x-auto">
        {[
          { id: 'overview', label: 'Visión General y Resultados', icon: BarChart3 },
          { id: 'categories', label: 'Desglose por Categoría', icon: Layers },
          { id: 'suppliers', label: 'Compras y Proveedores', icon: Truck },
          { id: 'inventory', label: 'Capital e Inventario', icon: Archive }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading && !data ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm font-semibold">Consolidando y procesando métricas del negocio...</p>
        </div>
      ) : summary ? (
        <>
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {/* PRIMARY DUO: Economic Result vs. Financial Cashflow Result */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Resultado Económico (Utilidad Operativa) */}
                <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 p-4 rounded-xl border border-indigo-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                          <DollarSign className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Resultado Económico (Utilidad Operativa)</p>
                          <p className="text-[11px] text-indigo-700">Ventas Cobradas - CMV Histórico - Gastos Operativos</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        summary.economicResult >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {summary.economicResult >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA OPERATIVA'}
                      </span>
                    </div>

                    <p className={`text-3xl font-black mt-3 ${summary.economicResult >= 0 ? 'text-indigo-950' : 'text-rose-700'}`}>
                      {summary.economicResult >= 0 ? `+$${summary.economicResult.toLocaleString('es-AR')}` : `-$${Math.abs(summary.economicResult).toLocaleString('es-AR')}`}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-indigo-100/80 text-xs space-y-1.5 text-indigo-950">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Ventas totales cobradas:</span>
                        <span className="font-bold text-emerald-700">+${summary.totalIncome.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Costo mercadería vendida (CMV):</span>
                        <span className="font-bold text-rose-600">-${summary.totalCogs.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Gastos operativos pagados (Negocio):</span>
                        <span className="font-bold text-rose-600">-${summary.operatingExpensesPaid.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-indigo-100 flex items-center justify-between text-[11px] text-indigo-800">
                    <span>CMV calculado estrictamente con costos históricos (`unitCost`)</span>
                    <span className="font-semibold">
                      Var: {summary.economicResultChangePercentage >= 0 ? `+${summary.economicResultChangePercentage}%` : `${summary.economicResultChangePercentage}%`}
                    </span>
                  </div>
                </div>

                {/* 2. Resultado Financiero (Flujo de Caja Real) */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-600 text-white rounded-lg">
                          <Wallet className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Resultado Financiero (Flujo de Caja)</p>
                          <p className="text-[11px] text-emerald-700">Ingresos Totales Cobrados - Egresos Totales Pagados</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        summary.financialResult >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {summary.financialResult >= 0 ? 'SUPERÁVIT DE CAJA' : 'DÉFICIT DE CAJA'}
                      </span>
                    </div>

                    <p className={`text-3xl font-black mt-3 ${summary.financialResult >= 0 ? 'text-emerald-950' : 'text-rose-700'}`}>
                      {summary.financialResult >= 0 ? `+$${summary.financialResult.toLocaleString('es-AR')}` : `-$${Math.abs(summary.financialResult).toLocaleString('es-AR')}`}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-emerald-100/80 text-xs space-y-1.5 text-emerald-950">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Total Ingresos cobrados:</span>
                        <span className="font-bold text-emerald-700">+${summary.totalIncome.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Compras directas pagadas:</span>
                        <span className="font-bold text-rose-600">-${summary.purchasesPaid.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Gastos op. y pagos deuda:</span>
                        <span className="font-bold text-rose-600">-${(summary.operatingExpensesPaid + summary.settlementsPaid).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                    <span>Saldo actual en Caja Física: <strong>${summary.currentCashBalance.toLocaleString('es-AR')}</strong></span>
                    <span className="font-semibold">
                      Var: {summary.resultChangePercentage >= 0 ? `+${summary.resultChangePercentage}%` : `${summary.resultChangePercentage}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Secondary Metrics Cards (4 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Ingresos Cobrados */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Ingresos Cobrados</p>
                      <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-emerald-700 mt-2">${summary.totalIncome.toLocaleString('es-AR')}</p>
                    
                    {/* Payment breakdown */}
                    <div className="mt-2.5 pt-2 border-t border-stone-100 text-[11px] space-y-1 text-stone-500">
                      <div className="flex justify-between">
                        <span>Efectivo (CASH):</span>
                        <span className="font-semibold text-stone-700">${summary.cashIncome.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mercado Pago:</span>
                        <span className="font-semibold text-stone-700">${summary.mercadoPagoIncome.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ventas Combinadas:</span>
                        <span className="font-semibold text-stone-700">{summary.combinedSalesCount} ops. (${summary.combinedSalesIncome.toLocaleString('es-AR')})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ticket promedio:</span>
                        <span className="font-semibold text-stone-700">${summary.averageTicket.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[11px]">
                    {summary.incomeChangePercentage >= 0 ? (
                      <span className="flex items-center font-bold text-emerald-600">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        +{summary.incomeChangePercentage}%
                      </span>
                    ) : (
                      <span className="flex items-center font-bold text-rose-600">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {summary.incomeChangePercentage}%
                      </span>
                    )}
                    <span className="text-stone-400">vs período anterior</span>
                  </div>
                </div>

                {/* 2. Egresos Pagados */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Egresos Pagados</p>
                      <div className="p-1.5 bg-rose-50 rounded-md text-rose-600">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-rose-700 mt-2">${summary.totalExpensesPaid.toLocaleString('es-AR')}</p>

                    {/* Expense breakdown */}
                    <div className="mt-2.5 pt-2 border-t border-stone-100 text-[11px] space-y-1 text-stone-500">
                      <div className="flex justify-between">
                        <span>Compras pagadas:</span>
                        <span className="font-semibold text-stone-700">${summary.purchasesPaid.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gastos operativos:</span>
                        <span className="font-semibold text-stone-700">${summary.operatingExpensesPaid.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cancelación deudas:</span>
                        <span className="font-semibold text-stone-700">${summary.settlementsPaid.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[11px]">
                    {summary.expensesChangePercentage <= 0 ? (
                      <span className="flex items-center font-bold text-emerald-600">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {summary.expensesChangePercentage}%
                      </span>
                    ) : (
                      <span className="flex items-center font-bold text-rose-600">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        +{summary.expensesChangePercentage}%
                      </span>
                    )}
                    <span className="text-stone-400">vs período anterior</span>
                  </div>
                </div>

                {/* 3. Margen Bruto de Ventas */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Margen Bruto (Ventas)</p>
                      <div className="p-1.5 bg-blue-50 rounded-md text-blue-600">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-blue-700 mt-2">${summary.grossMarginAmount.toLocaleString('es-AR')}</p>

                    <div className="mt-2.5 pt-2 border-t border-stone-100 text-[11px] space-y-1 text-stone-500">
                      <div className="flex justify-between">
                        <span>Rentabilidad bruta:</span>
                        <span className="font-bold text-blue-700">{summary.grossMarginPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Costo mercadería (CMV):</span>
                        <span className="font-semibold text-stone-700">${summary.totalCogs.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ventas totales:</span>
                        <span className="font-semibold text-stone-700">{summary.salesCount} operaciones</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[11px] text-stone-400">
                    <span>CMV basado en snapshots históricos</span>
                  </div>
                </div>

                {/* 4. Gastos por Estado y Fondos */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Gastos por Estado</p>
                      <div className="p-1.5 bg-amber-50 rounded-md text-amber-600">
                        <Receipt className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-stone-800 mt-2">
                      ${(summary.operatingExpensesPaid + summary.operatingExpensesPending).toLocaleString('es-AR')}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-stone-100 text-[11px] space-y-1 text-stone-500">
                      <div className="flex justify-between">
                        <span>Pagados (del Negocio):</span>
                        <span className="font-bold text-rose-600">${summary.operatingExpensesPaid.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pendientes de pago:</span>
                        <span className="font-bold text-amber-600">${summary.operatingExpensesPending.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fondos PERSONAL (no caja):</span>
                        <span className="font-semibold text-stone-500">${summary.personalExpenses.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[11px] text-stone-400">
                    <span>Anulados excluidos: ${summary.operatingExpensesCancelled.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              {/* Pending Commitments Banner */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Compromisos Pendientes de Pago (Deudas a Proveedores y Gastos)</p>
                    <p className="text-lg font-black text-amber-950 mt-0.5">
                      ${summary.totalPendingObligations.toLocaleString('es-AR')} <span className="text-xs font-semibold text-amber-800">({summary.pendingSuppliersCount} proveedores con saldo pendiente)</span>
                    </p>
                    <p className="text-[11px] text-amber-700">Este pasivo se mantiene separado del flujo de caja hasta su cancelación efectiva.</p>
                  </div>
                </div>

                {onNavigateToObligations && (
                  <button
                    onClick={onNavigateToObligations}
                    className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <span>Gestionar Deudas y Pagos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Deteriorated Margin Warning Banner (if any) */}
              {data.deterioratedMarginProducts.length > 0 && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-600 text-white rounded-lg">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-rose-900">⚠️ Alerta: {data.deterioratedMarginProducts.length} Productos con Margen Deteriorado</p>
                      <p className="text-xs text-rose-700 mt-0.5">El costo de reposición aumentó y superó o redujo drásticamente el margen de ganancia.</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveProductTab('deteriorated')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Ver Productos Afectados
                  </button>
                </div>
              )}

              {/* Product Performance Section with Expanded Tabs */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">Rendimiento de Productos en el Período</h3>
                    <p className="text-xs text-stone-500">Ranking detallado según facturación, rotación, rentabilidad y alertas de margen</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs font-medium flex-wrap gap-0.5">
                    <button
                      onClick={() => setActiveProductTab('revenue')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'revenue' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                      }`}
                    >
                      Mayor Facturación
                    </button>
                    <button
                      onClick={() => setActiveProductTab('units')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'units' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                      }`}
                    >
                      Más Vendidos (u.)
                    </button>
                    <button
                      onClick={() => setActiveProductTab('margin')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'margin' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                      }`}
                    >
                      Mayor Margen ($)
                    </button>
                    <button
                      onClick={() => setActiveProductTab('lowest')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'lowest' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600'
                      }`}
                    >
                      Menor Margen (%)
                    </button>
                    <button
                      onClick={() => setActiveProductTab('negative')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'negative' ? 'bg-rose-600 font-bold text-white shadow-xs' : 'text-rose-700'
                      }`}
                    >
                      Margen Cero/Negativo ({data.zeroOrNegativeMarginProducts.length})
                    </button>
                    <button
                      onClick={() => setActiveProductTab('deteriorated')}
                      className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        activeProductTab === 'deteriorated' ? 'bg-amber-600 font-bold text-white shadow-xs' : 'text-amber-700'
                      }`}
                    >
                      Deteriorados ({data.deterioratedMarginProducts.length})
                    </button>
                  </div>
                </div>

                {/* Product Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-3 py-2.5">Producto</th>
                        <th className="px-3 py-2.5">Unidades Vendidas</th>
                        <th className="px-3 py-2.5">Facturación Total</th>
                        <th className="px-3 py-2.5">Costo Total (CMV)</th>
                        <th className="px-3 py-2.5">Margen Bruto ($)</th>
                        <th className="px-3 py-2.5">Margen %</th>
                        <th className="px-3 py-2.5">Estado / Alerta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(activeProductTab === 'revenue' 
                        ? data.topSellingByRevenue 
                        : activeProductTab === 'units' 
                        ? data.topSellingByQuantity 
                        : activeProductTab === 'margin' 
                        ? data.topSellingByMargin 
                        : activeProductTab === 'lowest'
                        ? data.lowestMarginProducts
                        : activeProductTab === 'negative'
                        ? data.zeroOrNegativeMarginProducts
                        : data.deterioratedMarginProducts
                      ).map((item) => (
                        <tr key={item.productId} className="hover:bg-stone-50/60 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-stone-900">{item.productName}</p>
                            <p className="text-[10px] text-stone-400">{item.category || 'Sin categoría'}</p>
                          </td>
                          <td className="px-3 py-2.5 font-bold text-stone-800">
                            {item.unitsSold} u.
                          </td>
                          <td className="px-3 py-2.5 font-bold text-stone-900">
                            ${item.revenue.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5 text-stone-500">
                            ${item.cogs.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-emerald-600">
                            ${item.grossMargin.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              item.grossMarginPercent >= 30 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : item.grossMarginPercent >= 15 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-rose-50 text-rose-700'
                            }`}>
                              {item.grossMarginPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {item.isDeterioratedMargin ? (
                              <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>{item.deteriorationReason || 'Margen deteriorado'}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-stone-400">Normal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Evolution Table */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">Evolución Mensual (Últimos 6 Meses)</h3>
                    <p className="text-xs text-stone-500">Comparativa histórica diferenciando Resultado Económico (Devengado) de Resultado Financiero (Caja)</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-stone-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Económico (Utilidad)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Financiero (Caja)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-3 py-2.5">Mes</th>
                        <th className="px-3 py-2.5">Ventas Cobradas</th>
                        <th className="px-3 py-2.5">Costo (CMV)</th>
                        <th className="px-3 py-2.5">Margen Bruto</th>
                        <th className="px-3 py-2.5">Resultado Económico</th>
                        <th className="px-3 py-2.5">Egresos Pagados</th>
                        <th className="px-3 py-2.5">Resultado Financiero</th>
                        <th className="px-3 py-2.5">Operaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.monthlyComparison.map((m) => (
                        <tr key={m.monthKey} className="hover:bg-stone-50/60 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-stone-900">
                            {m.monthLabel}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-emerald-700">
                            ${m.income.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5 text-stone-500">
                            ${m.cogs.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5 text-blue-700 font-semibold">
                            ${m.margin.toLocaleString('es-AR')}
                            <span className="text-[10px] text-stone-400 block font-normal">
                              ({m.grossMarginPercentage.toFixed(1)}%)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              m.economicResult >= 0 ? 'bg-indigo-50 text-indigo-800' : 'bg-rose-50 text-rose-800'
                            }`}>
                              {m.economicResult >= 0 ? `+$${m.economicResult.toLocaleString('es-AR')}` : `-$${Math.abs(m.economicResult).toLocaleString('es-AR')}`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-rose-700">
                            ${m.expenses.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              m.financialResult >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                            }`}>
                              {m.financialResult >= 0 ? `+$${m.financialResult.toLocaleString('es-AR')}` : `-$${Math.abs(m.financialResult).toLocaleString('es-AR')}`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-stone-500">
                            {m.salesCount} ventas
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'categories' && (
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Rentabilidad y Participación por Categoría</h3>
                <p className="text-xs text-stone-500">Facturación, costo de mercadería vendida y margen bruto discriminado por rubro</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-3 py-2.5">Categoría</th>
                      <th className="px-3 py-2.5">Unidades Vendidas</th>
                      <th className="px-3 py-2.5">Facturación</th>
                      <th className="px-3 py-2.5">Costo (CMV)</th>
                      <th className="px-3 py-2.5">Margen Bruto ($)</th>
                      <th className="px-3 py-2.5">Margen %</th>
                      <th className="px-3 py-2.5">% de las Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.categoryBreakdown.map((cat) => (
                      <tr key={cat.categoryName} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          {cat.categoryName}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-stone-800">
                          {cat.unitsSold} u.
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          ${cat.revenue.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5 text-stone-500">
                          ${cat.cogs.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-emerald-600">
                          ${cat.grossMargin.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5 font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            cat.grossMarginPercent >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {cat.grossMarginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 font-semibold">
                          {cat.percentageOfRevenue.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'suppliers' && (
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Compras y Pasivos por Proveedor</h3>
                  <p className="text-xs text-stone-500">Volumen adquirido y obligaciones de pago pendientes por cada proveedor</p>
                </div>
                {onNavigateToPurchases && (
                  <button
                    onClick={onNavigateToPurchases}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Ver Compras Directas
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                    <tr>
                      <th className="px-3 py-2.5">Proveedor</th>
                      <th className="px-3 py-2.5">Total Comprado</th>
                      <th className="px-3 py-2.5">Órdenes</th>
                      <th className="px-3 py-2.5">Unidades Recibidas</th>
                      <th className="px-3 py-2.5">Deuda Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.supplierPurchases.map((supp) => (
                      <tr key={supp.supplierName} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          {supp.supplierName}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          ${supp.totalPurchased.toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5 text-stone-600">
                          {supp.purchasesCount} compras
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 font-semibold">
                          {supp.totalItemsCount} u.
                        </td>
                        <td className="px-3 py-2.5">
                          {supp.pendingObligationsAmount > 0 ? (
                            <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[11px]">
                              ${supp.pendingObligationsAmount.toLocaleString('es-AR')}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[11px]">Al día ($0)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'inventory' && (
            <div className="space-y-4">
              {/* Capital & Stock Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Valor de Reposición Total</p>
                  <p className="text-2xl font-black text-indigo-700 mt-2">
                    ${data.inventorySummary.totalReplacementValue.toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-2">
                    Capital inmovilizado calculado al costo de reposición vigente
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Unidades en Stock</p>
                  <p className="text-2xl font-black text-stone-800 mt-2">
                    {data.inventorySummary.totalStockUnits.toLocaleString('es-AR')} u.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-2">
                    Total físico en {data.inventorySummary.totalProductsCount} artículos activos
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Stock Bajo Mínimo</p>
                  <p className="text-2xl font-black text-amber-600 mt-2">
                    {data.inventorySummary.lowStockCount} artículos
                  </p>
                  <p className="text-[11px] text-amber-700 mt-2">
                    Requieren reorden para evitar quiebres
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Agotados (Sin Stock)</p>
                  <p className="text-2xl font-black text-rose-600 mt-2">
                    {data.inventorySummary.outOfStockCount} artículos
                  </p>
                  <p className="text-[11px] text-rose-700 mt-2">
                    Sin disponibilidad para venta
                  </p>
                </div>
              </div>

              {/* Out of Stock (Agotados) Table if any */}
              {data.inventorySummary.outOfStockCount > 0 && (
                <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-rose-900 text-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Artículos Agotados (Quiebre de Stock Total)</span>
                      </h3>
                      <p className="text-xs text-rose-700">Artículos con existencia cero o negativa que impiden ventas</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-stone-700">
                      <thead className="bg-rose-50 text-rose-900 uppercase tracking-wider font-semibold border-b border-rose-200">
                        <tr>
                          <th className="px-3 py-2.5">Producto</th>
                          <th className="px-3 py-2.5">Categoría</th>
                          <th className="px-3 py-2.5">Stock Actual</th>
                          <th className="px-3 py-2.5">Stock Mínimo</th>
                          <th className="px-3 py-2.5">Costo Unitario Vigente</th>
                          <th className="px-3 py-2.5">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {data.inventorySummary.outOfStockProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-rose-50/50 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-stone-900">
                              {p.name}
                            </td>
                            <td className="px-3 py-2.5 text-stone-500">
                              {p.category || 'Sin categoría'}
                            </td>
                            <td className="px-3 py-2.5 font-extrabold text-rose-700">
                              {p.stock} u.
                            </td>
                            <td className="px-3 py-2.5 text-stone-600">
                              {p.minimumStock} u.
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-stone-800">
                              ${p.costPrice.toLocaleString('es-AR')}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                                AGOTADO
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Low Stock Attention List */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">Artículos con Stock Bajo Mínimo</h3>
                    <p className="text-xs text-stone-500">Productos con stock actual igual o menor al mínimo configurado pero mayor a cero</p>
                  </div>
                  {onNavigateToProducts && (
                    <button
                      onClick={onNavigateToProducts}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      Gestionar Catálogo de Productos
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-3 py-2.5">Producto</th>
                        <th className="px-3 py-2.5">Categoría</th>
                        <th className="px-3 py-2.5">Stock Actual</th>
                        <th className="px-3 py-2.5">Stock Mínimo</th>
                        <th className="px-3 py-2.5">Costo Unitario Vigente</th>
                        <th className="px-3 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.inventorySummary.lowStockProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-stone-900">
                            {p.name}
                          </td>
                          <td className="px-3 py-2.5 text-stone-500">
                            {p.category || 'Sin categoría'}
                          </td>
                          <td className="px-3 py-2.5 font-bold">
                            <span className={p.stock <= 0 ? 'text-rose-700 font-extrabold' : 'text-amber-700 font-bold'}>
                              {p.stock} u.
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-stone-600">
                            {p.minimumStock} u.
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-stone-800">
                            ${p.costPrice.toLocaleString('es-AR')}
                          </td>
                          <td className="px-3 py-2.5">
                            {p.stock <= 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                                AGOTADO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                                BAJO MÍNIMO
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
