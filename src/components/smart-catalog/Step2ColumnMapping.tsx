import React from 'react';
import { 
  ColumnMapping, 
  TargetFieldKey, 
  TARGET_FIELDS, 
  SmartCatalogAnalysisResult 
} from '../../lib/smartCatalogTypes';
import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Columns, 
  Sparkles, 
  AlertCircle,
  Tag,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { formatCurrencyPreview, parseMonetaryValue } from '../../lib/smartCatalogAnalyzer';

interface Step2ColumnMappingProps {
  analysis: SmartCatalogAnalysisResult;
  mappings: ColumnMapping[];
  onMappingChange: (sourceColumn: string, newTarget: TargetFieldKey) => void;
}

export const Step2ColumnMapping: React.FC<Step2ColumnMappingProps> = ({
  analysis,
  mappings,
  onMappingChange
}) => {
  // Check if mandatory fields are mapped
  const isNameMapped = mappings.some(m => m.targetField === 'name');
  const salePriceMapping = mappings.find(m => m.targetField === 'salePrice');
  const costPriceMapping = mappings.find(m => m.targetField === 'costPrice');
  const isPriceMapped = Boolean(salePriceMapping);

  // Format samples for sale price
  const formattedSalePriceSamples = (salePriceMapping?.sampleValues || [])
    .slice(0, 3)
    .map(s => {
      const num = parseMonetaryValue(s);
      return formatCurrencyPreview(num);
    })
    .join('  ·  ');

  // Format samples for cost price if present
  const formattedCostPriceSamples = (costPriceMapping?.sampleValues || [])
    .slice(0, 3)
    .map(s => {
      const num = parseMonetaryValue(s);
      return formatCurrencyPreview(num);
    })
    .join('  ·  ');

  return (
    <div className="space-y-3.5">
      
      {/* Highlighted Detected Key Fields (Precio de Venta callout) */}
      {salePriceMapping ? (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Precio de venta detectado
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900 text-[10px] font-mono font-bold">
                  Columna: {salePriceMapping.sourceColumn}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                <span className="font-semibold text-emerald-950">Ejemplos interpretados:</span>{' '}
                <span className="font-mono font-bold text-emerald-900">
                  {formattedSalePriceSamples || 'Sin muestras'}
                </span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Se importará como <strong>Precio de venta</strong> oficial para cobrar en el POS de uwi.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Mapeado con éxito
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[11px]">
            <p className="font-bold">Columna de Precio de venta requerida</p>
            <p>
              Asigná manualmente la columna correspondiente a <strong>Precio de venta</strong> en la tabla inferior para que los artículos tengan precio en el POS.
            </p>
          </div>
        </div>
      )}

      {/* Excel -> uwi Key Fields Interpretation Summary */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Interpretación de campos detectados
          </span>
          <span className="text-[11px] text-stone-500">
            {mappings.filter(m => m.targetField !== 'ignore').length} campos asignados a uwi
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
          {mappings
            .filter(m => m.targetField !== 'ignore')
            .map(m => {
              const def = TARGET_FIELDS.find(f => f.key === m.targetField);
              const isSale = m.targetField === 'salePrice';
              const isCost = m.targetField === 'costPrice';
              const isName = m.targetField === 'name';

              return (
                <div 
                  key={m.sourceColumn}
                  className={`p-1.5 rounded-lg border text-[11px] ${
                    isSale 
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' 
                      : isCost
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : isName
                      ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                      : 'bg-white border-stone-200 text-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[10px] text-stone-500 font-mono truncate">
                    <span className="truncate" title={m.sourceColumn}>{m.sourceColumn}</span>
                    <ArrowRight className="w-2.5 h-2.5 shrink-0 text-stone-400" />
                  </div>
                  <div className="font-bold truncate mt-0.5 flex items-center gap-1">
                    <span>{def?.label || m.targetField}</span>
                  </div>
                  {isSale && formattedSalePriceSamples && (
                    <div className="text-[9.5px] font-mono text-emerald-800 truncate mt-0.5">
                      {formattedSalePriceSamples.split('·')[0]?.trim()}
                    </div>
                  )}
                  {isCost && formattedCostPriceSamples && (
                    <div className="text-[9.5px] font-mono text-amber-800 truncate mt-0.5">
                      {formattedCostPriceSamples.split('·')[0]?.trim()}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Mandatory Validation Warning if missing Name */}
      {!isNameMapped && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-[11px]">
            <p className="font-bold">Nombre del producto requerido</p>
            <p>Es obligatorio mapear una columna como "Nombre del producto".</p>
          </div>
        </div>
      )}

      {/* Column Mapping Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="px-3 py-2 border-b border-stone-200 flex items-center justify-between bg-stone-50/80 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-stone-800">
            <Columns className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Mapeo detallado de columnas ({mappings.length} detectadas)
            </span>
          </div>
          <span className="text-stone-500 font-medium truncate max-w-[200px]">
            <strong className="text-stone-700 font-mono">{analysis.fileName}</strong>
          </span>
        </div>

        <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
          <table className="min-w-full divide-y divide-stone-200 text-xs">
            <thead className="bg-stone-100/90 sticky top-0 z-10 text-[11px]">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-stone-700">Columna de tu archivo</th>
                <th className="px-3 py-2 text-left font-bold text-stone-700 min-w-[190px]">Campo en uwi</th>
                <th className="px-3 py-2 text-center font-bold text-stone-700 w-24">Certeza</th>
                <th className="px-3 py-2 text-left font-bold text-stone-700 hidden sm:table-cell">Muestras</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-100">
              {mappings.map((mapping) => {
                const isSalePrice = mapping.targetField === 'salePrice';
                const isCostPrice = mapping.targetField === 'costPrice';
                const isName = mapping.targetField === 'name';
                
                return (
                  <tr 
                    key={mapping.sourceColumn} 
                    className={`transition-colors ${
                      isSalePrice
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                        : mapping.targetField === 'ignore' 
                        ? 'bg-stone-50/40 text-stone-400' 
                        : 'hover:bg-stone-50/70'
                    }`}
                  >
                    {/* Source column name */}
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-900 text-xs font-mono">
                            {mapping.sourceColumn}
                          </span>
                          {isSalePrice && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              Precio Venta
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-stone-400 leading-tight">{mapping.reason}</p>
                      </div>
                    </td>

                    {/* Target mapping selector */}
                    <td className="px-3 py-2">
                      <select
                        value={mapping.targetField}
                        onChange={(e) => onMappingChange(mapping.sourceColumn, e.target.value as TargetFieldKey)}
                        className={`w-full px-2.5 py-1 border rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-1 ${
                          isSalePrice
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 focus:ring-emerald-500'
                            : isCostPrice
                            ? 'border-amber-400 bg-amber-50 text-amber-950 focus:ring-amber-500'
                            : isName
                            ? 'border-blue-400 bg-blue-50 text-blue-950 focus:ring-blue-500'
                            : mapping.targetField === 'ignore'
                            ? 'border-stone-200 bg-stone-100 text-stone-500 focus:ring-stone-400'
                            : 'border-stone-300 bg-white text-stone-900 focus:ring-stone-500'
                        }`}
                      >
                        <optgroup label="Campos obligatorios">
                          <option value="name">Nombre del producto (Obligatorio)</option>
                          <option value="salePrice">Precio de venta (Obligatorio)</option>
                        </optgroup>
                        <optgroup label="Precios y Stock">
                          <option value="costPrice">Precio de costo</option>
                          <option value="stock">Stock actual</option>
                          <option value="withoutStockControl">Sin control de stock</option>
                          <option value="minimumStock">Stock mínimo</option>
                        </optgroup>
                        <optgroup label="Identificación y Clasificación">
                          <option value="category">Categoría / Rubro</option>
                          <option value="barcode">Código de barras</option>
                          <option value="sku">Código / SKU</option>
                          <option value="brand">Marca</option>
                          <option value="supplier">Proveedor</option>
                          <option value="unit">Unidad de medida</option>
                          <option value="reorderPoint">Punto de reposición</option>
                          <option value="targetStock">Stock objetivo</option>
                        </optgroup>
                        <optgroup label="Descartar">
                          <option value="ignore">Ignorar columna</option>
                        </optgroup>
                      </select>
                    </td>

                    {/* Confidence badge */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {mapping.confidence === 'high' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Alta</span>
                        </span>
                      )}
                      {mapping.confidence === 'medium' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Media</span>
                        </span>
                      )}
                      {mapping.confidence === 'low' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold">
                          <HelpCircle className="w-3 h-3 text-stone-400" />
                          <span>Revisar</span>
                        </span>
                      )}
                      {mapping.confidence === 'manual' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          <span>Manual</span>
                        </span>
                      )}
                    </td>

                    {/* Sample values chips */}
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {mapping.sampleValues && mapping.sampleValues.length > 0 ? (
                          mapping.sampleValues.slice(0, 3).map((sample, idx) => {
                            let formattedDisplay = sample;
                            if (isSalePrice || isCostPrice) {
                              const numVal = parseMonetaryValue(sample);
                              formattedDisplay = `${sample} → ${formatCurrencyPreview(numVal)}`;
                            }

                            return (
                              <span 
                                key={idx} 
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono truncate max-w-[140px] border ${
                                  isSalePrice
                                    ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950 font-bold'
                                    : isCostPrice
                                    ? 'bg-amber-100/70 border-amber-300 text-amber-950'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                                title={formattedDisplay}
                              >
                                {formattedDisplay}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-stone-400 italic">Sin datos</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
