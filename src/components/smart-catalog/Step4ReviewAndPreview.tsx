import React, { useState, useMemo } from 'react';
import { 
  ParsedCatalogProduct, 
  ImportExecutionOptions 
} from '../../lib/smartCatalogTypes';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Search, 
  CheckSquare, 
  Square, 
  Tag, 
  Truck, 
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';
import { CATEGORIES_PRESETS } from '../../lib/categoryUtils';

interface Step4ReviewAndPreviewProps {
  products: ParsedCatalogProduct[];
  categoriesList: string[];
  options: ImportExecutionOptions;
  onOptionsChange: (newOptions: ImportExecutionOptions) => void;
  onUpdateProduct: (productId: string, updates: Partial<ParsedCatalogProduct>) => void;
  onBulkUpdateProducts: (productIds: string[], updates: Partial<ParsedCatalogProduct>) => void;
}

export const Step4ReviewAndPreview: React.FC<Step4ReviewAndPreviewProps> = ({
  products,
  categoriesList,
  options,
  onOptionsChange,
  onUpdateProduct,
  onBulkUpdateProducts
}) => {
  const [selectedStatusTab, setSelectedStatusTab] = useState<'ALL' | 'READY' | 'REVIEW' | 'ERROR' | 'DUPLICATE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Bulk action states
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkCategoryInput, setBulkCategoryInput] = useState('General');
  const [showBulkSupplierModal, setShowBulkSupplierModal] = useState(false);
  const [bulkSupplierInput, setBulkSupplierInput] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Counters
  const totalCount = products.length;
  const readyCount = products.filter(p => p.status === 'READY').length;
  const reviewCount = products.filter(p => p.status === 'REVIEW').length;
  const errorCount = products.filter(p => p.status === 'ERROR').length;
  const existingCount = products.filter(p => p.isDuplicate).length;
  const newCount = totalCount - existingCount;
  const toUpdateCount = products.filter(p => p.isDuplicate && p.duplicateResolution === 'update_fields').length;
  const categoriesCount = Array.from(new Set(products.map(p => p.category).filter(Boolean))).length;
  const validForImportCount = products.filter(p => p.status !== 'ERROR' && p.duplicateResolution !== 'skip').length;

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Tab filter
      if (selectedStatusTab === 'READY' && p.status !== 'READY') return false;
      if (selectedStatusTab === 'REVIEW' && p.status !== 'REVIEW') return false;
      if (selectedStatusTab === 'ERROR' && p.status !== 'ERROR') return false;
      if (selectedStatusTab === 'DUPLICATE' && !p.isDuplicate) return false;

      // Category filter
      if (selectedCategoryFilter && p.category !== selectedCategoryFilter) return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesBarcode = p.barcode.toLowerCase().includes(term);
        const matchesSku = p.sku.toLowerCase().includes(term);
        const matchesCategory = p.category.toLowerCase().includes(term);
        const matchesSupplier = (p.supplier || '').toLowerCase().includes(term);
        if (!matchesName && !matchesBarcode && !matchesSku && !matchesCategory && !matchesSupplier) return false;
      }

      return true;
    });
  }, [products, selectedStatusTab, selectedCategoryFilter, searchTerm]);

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  const handleApplyBulkCategory = () => {
    if (bulkCategoryInput && selectedRowIds.size > 0) {
      onBulkUpdateProducts(Array.from(selectedRowIds), { category: bulkCategoryInput });
      setShowBulkCategoryModal(false);
      setSelectedRowIds(new Set());
    }
  };

  const handleApplyBulkSupplier = () => {
    if (selectedRowIds.size > 0) {
      onBulkUpdateProducts(Array.from(selectedRowIds), { supplier: bulkSupplierInput.trim() });
      setShowBulkSupplierModal(false);
      setSelectedRowIds(new Set());
    }
  };

  const handleApplyBulkStockTracking = (tracksStock: boolean) => {
    if (selectedRowIds.size > 0) {
      onBulkUpdateProducts(Array.from(selectedRowIds), { tracksStock });
      setSelectedRowIds(new Set());
    }
  };

  const handleApplyBulkDuplicateResolution = (resolution: ParsedCatalogProduct['duplicateResolution']) => {
    if (selectedRowIds.size > 0) {
      onBulkUpdateProducts(Array.from(selectedRowIds), { duplicateResolution: resolution });
      setSelectedRowIds(new Set());
    }
  };

  const allAvailableCategories = Array.from(
    new Set([...CATEGORIES_PRESETS, ...categoriesList, ...products.map(p => p.category).filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      
      {/* High-Level Pre-Import Resumen Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-2 text-center">
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Encontrados</p>
          <p className="text-base font-black text-stone-900 font-mono">{totalCount}</p>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2 text-center">
          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Nuevos</p>
          <p className="text-base font-black text-emerald-900 font-mono">{newCount}</p>
        </div>
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2 text-center">
          <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Existentes</p>
          <p className="text-base font-black text-blue-900 font-mono">{existingCount}</p>
        </div>
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2 text-center">
          <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">A actualizar</p>
          <p className="text-base font-black text-indigo-900 font-mono">{toUpdateCount}</p>
        </div>
        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2 text-center col-span-2 sm:col-span-1">
          <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Categorías</p>
          <p className="text-base font-black text-purple-900 font-mono">{categoriesCount}</p>
        </div>
      </div>

      {/* Duplicate Strategy Information Box */}
      {existingCount > 0 && (
        <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold">Pisar productos existentes activado:</span>{' '}
              <span>Los <strong>{existingCount} productos existentes</strong> serán actualizados con la información del archivo. No se crearán duplicados.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline shrink-0 cursor-pointer self-start sm:self-auto"
          >
            {showAdvancedOptions ? 'Ocultar opciones' : 'Configurar'}
          </button>
        </div>
      )}

      {/* Advanced Options Drawer */}
      {showAdvancedOptions && (
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-xs animate-in fade-in duration-100">
          <p className="font-bold text-stone-700 text-[10px] uppercase tracking-wider">
            ¿Qué hacemos con productos que ya existen?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={options.updateExistingProducts}
                onChange={(e) => {
                  const val = e.target.checked;
                  onOptionsChange({ ...options, updateExistingProducts: val });
                  onBulkUpdateProducts(
                    products.filter(p => p.isDuplicate).map(p => p.id),
                    { duplicateResolution: val ? 'update_fields' : 'keep_existing' }
                  );
                }}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
              />
              <span className="text-stone-800 font-medium">Pisar / actualizar precios y datos de productos existentes</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={options.overwriteStockForExisting}
                onChange={(e) => onOptionsChange({ ...options, overwriteStockForExisting: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
              />
              <span className="text-stone-700">Sobrescribir stock existente con el del archivo</span>
            </label>
          </div>
        </div>
      )}

      {/* Status Summary Tabs Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedStatusTab('ALL')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
              selectedStatusTab === 'ALL'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <span>Todos</span>
            <span className="opacity-75 font-mono">({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusTab('READY')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
              selectedStatusTab === 'READY'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            <span>🟢 Listos</span>
            <span className="opacity-85 font-mono">({readyCount})</span>
          </button>

          {reviewCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStatusTab('REVIEW')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                selectedStatusTab === 'REVIEW'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
              }`}
            >
              <span>🟡 Revisar</span>
              <span className="opacity-85 font-mono">({reviewCount})</span>
            </button>
          )}

          {errorCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStatusTab('ERROR')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                selectedStatusTab === 'ERROR'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-red-50 hover:bg-red-100 text-red-800'
              }`}
            >
              <span>🔴 Errores</span>
              <span className="opacity-85 font-mono">({errorCount})</span>
            </button>
          )}

          {existingCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedStatusTab('DUPLICATE')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                selectedStatusTab === 'DUPLICATE'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800'
              }`}
            >
              <span>↻ Coincidentes</span>
              <span className="opacity-85 font-mono">({existingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Non-blocking Notice for Errors if any */}
      {errorCount > 0 && selectedStatusTab !== 'ERROR' && (
        <div className="px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-xl text-[11px] text-stone-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>
              {errorCount} filas con error se omitirán automáticamente. Podés importar los <strong>{validForImportCount} productos válidos</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedStatusTab('ERROR')}
            className="text-stone-800 font-bold hover:underline shrink-0 text-[10px] cursor-pointer"
          >
            Ver errores
          </button>
        </div>
      )}

      {/* Filter and Bulk Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        
        {/* Search and Category Filter */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar producto, código, proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1 border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
            />
          </div>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-2 py-1 border border-stone-300 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white max-w-[160px]"
          >
            <option value="">Todas las categorías</option>
            {allAvailableCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Bulk Selection Actions Bar */}
        {selectedRowIds.size > 0 && (
          <div className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 animate-in fade-in duration-100 text-[11px]">
            <span className="font-bold text-indigo-950 mr-1">
              {selectedRowIds.size} sel:
            </span>

            <button
              type="button"
              onClick={() => setShowBulkCategoryModal(true)}
              className="px-1.5 py-0.5 bg-white text-indigo-800 rounded font-bold border border-indigo-200 cursor-pointer flex items-center gap-0.5"
            >
              <Tag className="w-3 h-3" />
              <span>Categoría</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkSupplierModal(true)}
              className="px-1.5 py-0.5 bg-white text-indigo-800 rounded font-bold border border-indigo-200 cursor-pointer flex items-center gap-0.5"
            >
              <Truck className="w-3 h-3" />
              <span>Proveedor</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyBulkStockTracking(false)}
              className="px-1.5 py-0.5 bg-white text-indigo-800 rounded font-bold border border-indigo-200 cursor-pointer"
            >
              Sin stock
            </button>

            <button
              type="button"
              onClick={() => handleApplyBulkDuplicateResolution('skip')}
              className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded font-bold cursor-pointer"
            >
              Omitir
            </button>
          </div>
        )}

      </div>

      {/* Main Interactive Products Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="min-w-full divide-y divide-stone-200 text-xs">
            <thead className="bg-stone-100/90 sticky top-0 z-10 text-[11px]">
              <tr>
                <th className="px-2.5 py-1.5 text-center w-8">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="cursor-pointer text-stone-500 hover:text-stone-800"
                  >
                    {selectedRowIds.size > 0 && selectedRowIds.size === filteredProducts.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left font-bold text-stone-700 w-16">Fila/Cód</th>
                <th className="px-2.5 py-1.5 text-left font-bold text-stone-700 min-w-[160px]">Producto</th>
                <th className="px-2.5 py-1.5 text-left font-bold text-stone-700 min-w-[110px]">Categoría</th>
                <th className="px-2 py-1.5 text-right font-bold text-stone-700 w-18">Costo</th>
                <th className="px-2 py-1.5 text-right font-bold text-stone-700 w-20">Precio venta</th>
                <th className="px-2 py-1.5 text-center font-bold text-stone-700 w-14">Stock</th>
                <th className="px-2.5 py-1.5 text-left font-bold text-stone-700 min-w-[100px]">Proveedor</th>
                <th className="px-2 py-1.5 text-center font-bold text-stone-700 min-w-[85px]">Estado</th>
                <th className="px-2.5 py-1.5 text-center font-bold text-stone-700 min-w-[100px]">Acción</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-stone-500 text-xs">
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedRowIds.has(p.id);

                  return (
                    <tr 
                      key={p.id}
                      className={`transition-colors ${
                        isSelected 
                          ? 'bg-indigo-50/40' 
                          : p.status === 'ERROR' 
                          ? 'bg-red-50/30' 
                          : p.status === 'REVIEW' 
                          ? 'bg-amber-50/20' 
                          : 'hover:bg-stone-50/70'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-2.5 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRow(p.id)}
                          className="cursor-pointer text-stone-400 hover:text-stone-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Row / Code */}
                      <td className="px-2 py-1.5">
                        <div className="space-y-0.2">
                          <span className="font-mono text-stone-400 text-[9px]">#{p.rowNumber}</span>
                          {p.barcode ? (
                            <span className="font-mono text-stone-800 font-bold block text-[10px] truncate max-w-[70px]" title={p.barcode}>
                              {p.barcode}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic text-[9px] block">Sin cód.</span>
                          )}
                        </div>
                      </td>

                      {/* Product Name (Normalized) */}
                      <td className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => onUpdateProduct(p.id, { name: e.target.value })}
                          className={`w-full px-1.5 py-0.5 border rounded text-xs font-bold ${
                            !p.name.trim() 
                              ? 'border-red-400 bg-red-50 text-red-900' 
                              : 'border-transparent hover:border-stone-300 focus:border-emerald-500 focus:bg-white'
                          }`}
                          placeholder="Nombre..."
                        />
                      </td>

                      {/* Category (Normalized) */}
                      <td className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={p.category}
                          onChange={(e) => onUpdateProduct(p.id, { category: e.target.value })}
                          list={`categories-${p.id}`}
                          className="w-full px-1.5 py-0.5 border border-transparent hover:border-stone-300 focus:border-emerald-500 rounded text-xs font-bold text-stone-800"
                          placeholder="Categoría..."
                        />
                        <datalist id={`categories-${p.id}`}>
                          {allAvailableCategories.map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </td>

                      {/* Cost Price */}
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={p.costPrice || ''}
                          onChange={(e) => onUpdateProduct(p.id, { costPrice: parseFloat(e.target.value) || 0 })}
                          className="w-16 px-1 py-0.5 text-right font-mono text-xs border border-transparent hover:border-stone-300 focus:border-emerald-500 rounded"
                          placeholder="0"
                        />
                      </td>

                      {/* Sale Price */}
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={p.salePrice || ''}
                          onChange={(e) => onUpdateProduct(p.id, { salePrice: parseFloat(e.target.value) || 0 })}
                          className={`w-18 px-1 py-0.5 text-right font-mono text-xs font-bold border rounded ${
                            p.salePrice <= 0 
                              ? 'border-amber-300 bg-amber-50 text-amber-900' 
                              : 'border-transparent hover:border-stone-300 focus:border-emerald-500 text-stone-900'
                          }`}
                          placeholder="0"
                        />
                      </td>

                      {/* Stock */}
                      <td className="px-2 py-1.5 text-center">
                        {p.tracksStock ? (
                          <input
                            type="number"
                            value={p.stock}
                            onChange={(e) => onUpdateProduct(p.id, { stock: parseInt(e.target.value, 10) || 0 })}
                            className="w-12 px-1 py-0.5 text-center font-bold text-xs border border-transparent hover:border-stone-300 focus:border-emerald-500 rounded"
                          />
                        ) : (
                          <span className="text-[9px] font-bold text-stone-400">
                            Sin ctl
                          </span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={p.supplier || ''}
                          onChange={(e) => onUpdateProduct(p.id, { supplier: e.target.value })}
                          className="w-full px-1.5 py-0.5 border border-transparent hover:border-stone-300 focus:border-emerald-500 rounded text-xs text-stone-700"
                          placeholder="Proveedor..."
                        />
                      </td>

                      {/* Status / Warnings */}
                      <td className="px-2 py-1.5 text-center">
                        {p.status === 'READY' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Listo</span>
                          </span>
                        )}
                        {p.status === 'REVIEW' && (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              <span>Revisar</span>
                            </span>
                            {p.warnings[0] && (
                              <span className="text-[8px] text-amber-700 font-medium max-w-[85px] truncate" title={p.warnings.join(' • ')}>
                                {p.warnings[0]}
                              </span>
                            )}
                          </div>
                        )}
                        {p.status === 'ERROR' && (
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[9px] font-bold">
                              <AlertCircle className="w-2.5 h-2.5 text-red-600" />
                              <span>Error</span>
                            </span>
                            {p.errors[0] && (
                              <span className="text-[8px] text-red-700 font-medium max-w-[85px] truncate" title={p.errors.join(' • ')}>
                                {p.errors[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action / Duplicate resolution selector */}
                      <td className="px-2.5 py-1.5 text-center">
                        {p.isDuplicate ? (
                          <select
                            value={p.duplicateResolution}
                            onChange={(e) => onUpdateProduct(p.id, { duplicateResolution: e.target.value as any })}
                            className="px-1.5 py-0.5 bg-blue-50 border border-blue-300 rounded text-[9px] font-bold text-blue-900"
                          >
                            <option value="update_fields">Actualizar</option>
                            <option value="keep_existing">Mantener</option>
                            <option value="create_as_new">Nuevo</option>
                            <option value="skip">Omitir</option>
                          </select>
                        ) : (
                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Nuevo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Bulk Assign Category */}
      {showBulkCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-900">
              Asignar categoría a {selectedRowIds.size} productos
            </h4>
            
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-700">Categoría:</label>
              <select
                value={bulkCategoryInput}
                onChange={(e) => setBulkCategoryInput(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold text-stone-900"
              >
                {allAvailableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBulkCategory}
                className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Assign Supplier */}
      {showBulkSupplierModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-900">
              Asignar proveedor a {selectedRowIds.size} productos
            </h4>
            
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-700">Proveedor:</label>
              <input
                type="text"
                value={bulkSupplierInput}
                onChange={(e) => setBulkSupplierInput(e.target.value)}
                placeholder="Nombre del proveedor..."
                className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs font-bold text-stone-900"
              />
            </div>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowBulkSupplierModal(false)}
                className="px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBulkSupplier}
                className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
