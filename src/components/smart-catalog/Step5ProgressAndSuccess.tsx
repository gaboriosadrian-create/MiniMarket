import React from 'react';
import { ImportExecutionResult } from '../../lib/smartCatalogTypes';
import { 
  CheckCircle2, 
  ShoppingCart, 
  ArrowRight, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Step5ProgressAndSuccessProps {
  isImporting: boolean;
  progressCurrent: number;
  progressTotal: number;
  currentItemName: string;
  result: ImportExecutionResult | null;
  onGoToPOS: () => void;
  onViewProducts: () => void;
  onReviewPending?: () => void;
}

export const Step5ProgressAndSuccess: React.FC<Step5ProgressAndSuccessProps> = ({
  isImporting,
  progressCurrent,
  progressTotal,
  currentItemName,
  result,
  onGoToPOS,
  onViewProducts,
  onReviewPending
}) => {
  const percentage = progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0;

  // Phase 1: Importing in Progress
  if (isImporting) {
    return (
      <div className="py-8 px-2 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-stone-900">
            Importando catálogo a uwi...
          </h3>
          <p className="text-xs text-stone-600">
            Guardando tus productos, categorías y stock inicial. Por favor no cierres esta ventana.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-stone-600 font-mono">
              {progressCurrent} de {progressTotal} productos
            </span>
            <span className="text-emerald-700 font-bold">{percentage}%</span>
          </div>

          <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden p-0.5 border border-stone-300">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all duration-200 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {currentItemName && (
            <p className="text-[10px] text-stone-500 truncate pt-0.5 font-mono">
              Procesando: <span className="text-stone-800 font-semibold">{currentItemName}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Phase 2: Finished with Success
  if (result) {
    const totalSuccessful = result.createdCount + result.updatedCount;

    return (
      <div className="py-4 px-2 max-w-md mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Celebration Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-black text-stone-900 tracking-tight pt-1">
            ¡Tu catálogo está listo!
          </h2>
          <p className="text-xs text-stone-600">
            Importaste <strong className="text-emerald-700">{totalSuccessful} productos</strong> y ya podés comenzar a vender en tu negocio con uwi.
          </p>
        </div>

        {/* Success Metrics Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-emerald-50/80 p-2 rounded-xl border border-emerald-200 text-center">
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Nuevos</span>
            <span className="text-base font-black text-emerald-900">{result.createdCount}</span>
          </div>

          <div className="bg-blue-50/80 p-2 rounded-xl border border-blue-200 text-center">
            <span className="text-[9px] font-bold text-blue-700 uppercase tracking-wider block">Actualiz.</span>
            <span className="text-base font-black text-blue-900">{result.updatedCount}</span>
          </div>

          <div className="bg-purple-50/80 p-2 rounded-xl border border-purple-200 text-center">
            <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider block">Rubros</span>
            <span className="text-base font-black text-purple-900">{result.createdCategoryCount}</span>
          </div>

          <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 text-center">
            <span className="text-[9px] font-bold text-stone-600 uppercase tracking-wider block">Tiempo</span>
            <span className="text-base font-black text-stone-800">
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Skipped notice if any */}
        {result.skippedCount > 0 && (
          <div className="p-2 bg-stone-100 rounded-lg border border-stone-200 text-[11px] text-stone-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>
              Se omitieron {result.skippedCount} filas con errores o descartadas.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Main Primary CTA: IR A VENDER */}
          <button
            type="button"
            onClick={onGoToPOS}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black rounded-xl shadow-md shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>IR A VENDER</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Secondary CTA: VER PRODUCTOS */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onViewProducts}
              className="py-1.5 px-3 bg-white hover:bg-stone-100 text-stone-800 font-bold rounded-lg border border-stone-300 text-xs transition-colors cursor-pointer"
            >
              Ver productos
            </button>

            {result.skippedCount > 0 && onReviewPending && (
              <button
                type="button"
                onClick={onReviewPending}
                className="py-1.5 px-3 text-stone-600 hover:text-stone-900 text-xs font-semibold hover:underline cursor-pointer"
              >
                Completar pendientes
              </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  return null;
};
