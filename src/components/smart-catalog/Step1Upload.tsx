import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  HelpCircle, 
  Sparkles, 
  Layers, 
  AlertCircle, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { SheetInfo } from '../../lib/smartCatalogTypes';
import { downloadOfficialUwiTemplate } from '../../lib/smartCatalogTemplate';

interface Step1UploadProps {
  onFileSelected: (file: File, selectedSheet?: string) => Promise<void>;
  isAnalyzing: boolean;
  availableSheets?: SheetInfo[];
  selectedSheet?: string;
  onSheetChange?: (sheetName: string) => void;
  error?: string | null;
  onOpenAssistedHelp: () => void;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
  onFileSelected,
  isAnalyzing,
  availableSheets = [],
  selectedSheet = '',
  onSheetChange,
  error,
  onOpenAssistedHelp
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await onFileSelected(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileSelected(file);
    }
  };

  return (
    <div className="space-y-3.5 max-w-2xl mx-auto">
      
      {/* Short instructions */}
      <div className="text-center space-y-1">
        <p className="text-xs text-stone-600">
          Analizamos tu archivo para identificar productos, precios, stock y categorías automáticamente.
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      {isAnalyzing ? (
        <div className="bg-stone-50 border-2 border-dashed border-emerald-300 rounded-xl p-6 text-center flex flex-col items-center justify-center space-y-2 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900">
              Analizando tu archivo...
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Identificando columnas, productos, precios y categorías
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 sm:p-6 text-center transition-all cursor-pointer relative group ${
            dragOver
              ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
              : 'border-stone-300 bg-stone-50/60 hover:bg-stone-100/70 hover:border-emerald-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-stone-200 text-emerald-600 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
            <Upload className="w-5 h-5" />
          </div>

          <p className="text-xs font-bold text-stone-900">
            Arrastrá tu Excel o CSV aquí
          </p>
          <p className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 mt-0.5">
            o seleccioná un archivo
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 text-[10px] text-stone-500">
            <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 font-mono font-bold">XLSX</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 font-mono font-bold">XLS</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 font-mono font-bold">CSV</span>
            <span className="text-stone-400 ml-1">• Hasta 15 MB / 10.000 productos</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">No pudimos procesar el archivo</p>
            <p className="text-red-700 text-[11px]">{error}</p>
          </div>
        </div>
      )}

      {/* Multiple Sheets Selection (if applicable) */}
      {availableSheets.length > 1 && (
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <h4 className="text-[11px] font-bold text-stone-900 uppercase tracking-wider">
              Elegí la hoja a importar ({availableSheets.length} hojas encontradas)
            </h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableSheets.map((sheet) => {
              const isSelected = sheet.sheetName === selectedSheet;
              return (
                <button
                  key={sheet.sheetName}
                  type="button"
                  onClick={() => onSheetChange && onSheetChange(sheet.sheetName)}
                  className={`p-2.5 rounded-lg border text-left flex items-start justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-500/20'
                      : 'bg-stone-50 hover:bg-stone-100 border-stone-200'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3 text-stone-500" />
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {sheet.sheetName}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {sheet.rowCount} productos • {sheet.columnCount} columnas
                    </p>
                  </div>
                  {sheet.isRecommended && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold shrink-0">
                      Recomendada
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Secondary Options: Template & Assisted */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        
        {/* Template Button */}
        <div className="p-2.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <p className="text-[11px] font-bold text-stone-800 truncate">Plantilla modelo</p>
              <p className="text-[10px] text-stone-500 truncate">Formato oficial uwi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadOfficialUwiTemplate}
            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold rounded-lg border border-stone-200 shrink-0 transition-colors cursor-pointer"
          >
            Descargar
          </button>
        </div>

        {/* Assisted Import Button */}
        <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <p className="text-[11px] font-bold text-blue-950 truncate">¿Necesitás ayuda?</p>
              <p className="text-[10px] text-blue-700 truncate">Adaptamos tu archivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAssistedHelp}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-2xs shrink-0 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Asistencia</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

      </div>

    </div>
  );
};
