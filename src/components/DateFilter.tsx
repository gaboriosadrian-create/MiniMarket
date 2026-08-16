import React, { useState, useEffect } from 'react';
import { DatePreset } from '../types';
import { Calendar, ChevronDown, Clock } from 'lucide-react';

interface DateFilterProps {
  onDateRangeChange: (startDateIso: string, endDateIso: string, label: string) => void;
}

export const DateFilter: React.FC<DateFilterProps> = ({ onDateRangeChange }) => {
  const [preset, setPreset] = useState<DatePreset>('HOY');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const calculateRange = (selectedPreset: DatePreset, startCustomStr?: string, endCustomStr?: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = 'Hoy';

    if (selectedPreset === 'HOY') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      label = 'Hoy';
    } else if (selectedPreset === 'AYER') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      label = 'Ayer';
    } else if (selectedPreset === 'ULTIMOS_7') {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      label = 'Últimos 7 Días';
    } else if (selectedPreset === 'ESTE_MES') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      label = 'Este Mes';
    } else if (selectedPreset === 'CUSTOM') {
      if (startCustomStr) {
        start = new Date(startCustomStr + 'T00:00:00');
      } else {
        start.setHours(0, 0, 0, 0);
      }
      if (endCustomStr) {
        end = new Date(endCustomStr + 'T23:59:59.999');
      } else {
        end.setHours(23, 59, 59, 999);
      }
      label = 'Personalizada';
    }

    onDateRangeChange(start.toISOString(), end.toISOString(), label);
  };

  useEffect(() => {
    calculateRange(preset, customStart, customEnd);
  }, [preset]);

  const handleApplyCustom = () => {
    calculateRange('CUSTOM', customStart, customEnd);
  };

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-stone-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Período de Consulta</span>
        </div>

        {/* Presets buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreset('HOY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === 'HOY'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Hoy
          </button>

          <button
            type="button"
            onClick={() => setPreset('AYER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === 'AYER'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Ayer
          </button>

          <button
            type="button"
            onClick={() => setPreset('ULTIMOS_7')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === 'ULTIMOS_7'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Últimos 7 Días
          </button>

          <button
            type="button"
            onClick={() => setPreset('ESTE_MES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === 'ESTE_MES'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Este Mes
          </button>

          <button
            type="button"
            onClick={() => setPreset('CUSTOM')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              preset === 'CUSTOM'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Personalizada
          </button>
        </div>
      </div>

      {/* Custom date range selector */}
      {preset === 'CUSTOM' && (
        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-stone-500">Desde:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-medium text-stone-800"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-stone-500">Hasta:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-medium text-stone-800"
            />
          </div>

          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Aplicar Filtro
          </button>
        </div>
      )}
    </div>
  );
};
