import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  Product, 
  CreateProductInput, 
  UpdateProductInput, 
  InventoryMovement, 
  ExcelImportSummary, 
  ExcelImportRow 
} from '../types';
import { 
  getProductsByBusiness, 
  createProduct, 
  updateProduct, 
  toggleProductActive, 
  adjustProductStock, 
  getInventoryMovements,
  executeExcelImport
} from '../lib/productService';
import { 
  downloadExcelTemplate, 
  parseAndValidateExcel 
} from '../lib/excelService';
import { 
  Package, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Download, 
  Edit3, 
  Sliders, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  X, 
  Barcode, 
  Tag, 
  DollarSign, 
  Boxes, 
  ArrowUpRight, 
  ArrowDownRight,
  Upload,
  AlertCircle,
  Eye
} from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock' | 'out_of_stock'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Product | null>(null);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState<Product | null>(null);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateProductInput>({
    name: '',
    barcode: '',
    category: '',
    costPrice: 0,
    salePrice: 0,
    initialStock: 0,
    minimumStock: 5
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<UpdateProductInput>({
    name: '',
    barcode: '',
    category: '',
    costPrice: 0,
    salePrice: 0,
    minimumStock: 5,
    active: true
  });

  // Adjust Stock Form State
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Movements State
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ExcelImportSummary | null>(null);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  // General Form Errors
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const data = await getProductsByBusiness(business.id);
      setProducts(data);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business?.id]);

  // Dynamic categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        p.name.toLowerCase().includes(term) || 
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term));

      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = p.active;
      if (statusFilter === 'inactive') matchesStatus = !p.active;
      if (statusFilter === 'out_of_stock') matchesStatus = p.stock <= 0;
      if (statusFilter === 'low_stock') matchesStatus = p.stock > 0 && p.stock <= p.minimumStock;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, statusFilter]);

  // Stock Badge Helper
  const getStockBadge = (stock: number, minStock: number) => {
    if (stock <= 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 mr-1 text-red-600" /> Sin Stock ({stock})
        </span>
      );
    }
    if (stock <= minStock) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> Stock Bajo ({stock})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Normal ({stock})
      </span>
    );
  };

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  // CREATE PRODUCT HANDLER
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!business?.id || !userProfile?.uid) return;

    if (!createForm.name.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      await createProduct(business.id, userProfile.uid, createForm);
      setCreateForm({
        name: '',
        barcode: '',
        category: '',
        costPrice: 0,
        salePrice: 0,
        initialStock: 0,
        minimumStock: 5
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al crear el producto');
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT PRODUCT HANDLER
  const handleOpenEdit = (p: Product) => {
    setShowEditModal(p);
    setEditForm({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      minimumStock: p.minimumStock,
      active: p.active
    });
    setFormError(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !business?.id) return;
    setFormError(null);

    setSubmitting(true);
    try {
      await updateProduct(showEditModal.id, business.id, editForm);
      setShowEditModal(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al actualizar producto');
    } finally {
      setSubmitting(false);
    }
  };

  // TOGGLE ACTIVE STATUS
  const handleToggleActive = async (p: Product) => {
    try {
      await toggleProductActive(p.id, p.active);
      await loadData();
    } catch (err: any) {
      alert('Error al cambiar estado: ' + err.message);
    }
  };

  // ADJUST STOCK HANDLER
  const handleOpenAdjustStock = (p: Product) => {
    setShowAdjustStockModal(p);
    setAdjustType('IN');
    setAdjustQuantity(1);
    setAdjustReason('');
    setFormError(null);
  };

  const handleConfirmAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustStockModal || !business?.id || !userProfile?.uid) return;

    if (adjustQuantity <= 0) {
      setFormError('La cantidad debe ser mayor a 0.');
      return;
    }

    const delta = adjustType === 'IN' ? adjustQuantity : -adjustQuantity;

    setSubmitting(true);
    try {
      await adjustProductStock(
        showAdjustStockModal.id,
        business.id,
        userProfile.uid,
        delta,
        adjustReason
      );
      setShowAdjustStockModal(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error al ajustar stock');
    } finally {
      setSubmitting(false);
    }
  };

  // VIEW MOVEMENTS LOG HANDLER
  const handleOpenMovements = async () => {
    if (!business?.id) return;
    setShowMovementsModal(true);
    setLoadingMovements(true);
    try {
      const logs = await getInventoryMovements(business.id);
      setMovements(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMovements(false);
    }
  };

  // EXCEL IMPORT HANDLERS
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setParsingExcel(true);
    setFormError(null);

    try {
      const summary = await parseAndValidateExcel(file, products);
      setExcelSummary(summary);
    } catch (err: any) {
      setFormError(err.message || 'Error al procesar el archivo Excel');
      setExcelSummary(null);
    } finally {
      setParsingExcel(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelSummary || !business?.id || !userProfile?.uid) return;

    const validRows = excelSummary.rows.filter(r => r.status !== 'ERROR');
    if (validRows.length === 0) {
      setFormError('No hay filas válidas para importar.');
      return;
    }

    setImportingExcel(true);
    setFormError(null);

    try {
      const res = await executeExcelImport(business.id, userProfile.uid, validRows);
      alert(`¡Importación completada con éxito!\n\n- ${res.created} productos nuevos creados\n- ${res.updated} productos actualizados`);
      setShowExcelModal(false);
      setExcelFile(null);
      setExcelSummary(null);
      await loadData();
    } catch (err: any) {
      setFormError('Error al importar datos: ' + err.message);
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider">Productos</p>
            <p className="text-xl sm:text-2xl font-black text-stone-900">{products.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider">Stock Normal</p>
            <p className="text-xl sm:text-2xl font-black text-stone-900">
              {products.filter((p) => p.stock > p.minimumStock).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider">Stock Bajo</p>
            <p className="text-xl sm:text-2xl font-black text-stone-900">
              {products.filter((p) => p.stock > 0 && p.stock <= p.minimumStock).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-3 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-stone-500 uppercase tracking-wider">Sin Stock</p>
            <p className="text-xl sm:text-2xl font-black text-stone-900">
              {products.filter((p) => p.stock <= 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* Main Actions & Filters Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-4">
        
        {/* Action Buttons Header */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setFormError(null); setShowCreateModal(true); }}
              id="btn-new-product"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Producto</span>
            </button>

            <button
              onClick={() => { setExcelFile(null); setExcelSummary(null); setFormError(null); setShowExcelModal(true); }}
              id="btn-import-excel"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-sm transition-colors shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Importar Excel</span>
            </button>

            <button
              onClick={downloadExcelTemplate}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs border border-stone-200 transition-colors shrink-0"
              title="Descargar archivo modelo de Excel"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Plantilla Excel</span>
            </button>
          </div>

          <button
            onClick={handleOpenMovements}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs border border-stone-200 transition-colors shrink-0"
          >
            <History className="w-4 h-4 text-stone-600" />
            <span>Historial de Movimientos</span>
          </button>

        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-stone-100">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre o código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas las Categorías ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
              <option value="low_stock">Con Stock Bajo</option>
              <option value="out_of_stock">Sin Stock</option>
            </select>
          </div>

        </div>

        {/* Table View (Desktop) */}
        <div className="hidden md:block overflow-x-auto border border-stone-200 rounded-xl">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Costo
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Precio Venta
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-500 text-sm">
                    Cargando productos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-stone-500 text-sm">
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className={`hover:bg-stone-50/80 transition-colors ${!p.active ? 'opacity-60 bg-stone-50' : ''}`}>
                    
                    {/* Name */}
                    <td className="px-4 py-3.5 font-bold text-sm text-stone-900">
                      {p.name}
                    </td>

                    {/* Barcode */}
                    <td className="px-4 py-3.5 text-xs font-mono text-stone-600">
                      {p.barcode ? (
                        <span className="bg-stone-100 px-2 py-1 rounded-md border border-stone-200 flex items-center w-max gap-1">
                          <Barcode className="w-3 h-3 text-stone-400" />
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Sin código</span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 text-xs font-medium text-stone-700">
                      <span className="bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
                        {p.category}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3.5 text-right text-xs font-mono text-stone-500">
                      {formatCurrency(p.costPrice)}
                    </td>

                    {/* Sale Price */}
                    <td className="px-4 py-3.5 text-right text-sm font-bold font-mono text-stone-900">
                      {formatCurrency(p.salePrice)}
                    </td>

                    {/* Stock & Badge */}
                    <td className="px-4 py-3.5 text-center">
                      {getStockBadge(p.stock, p.minimumStock)}
                    </td>

                    {/* Active Status */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        p.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenAdjustStock(p)}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                        title="Ajustar stock de este producto"
                      >
                        Ajustar Stock
                      </button>

                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
                        title="Editar datos del producto"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          p.active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={p.active ? 'Desactivar producto' : 'Activar producto'}
                      >
                        {p.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List Cards View */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="text-center py-8 text-stone-500 text-sm">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm">No hay productos.</div>
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-stone-900 text-base">{p.name}</h4>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      {p.barcode ? `Código: ${p.barcode}` : 'Sin código de barras'}
                    </p>
                  </div>
                  {getStockBadge(p.stock, p.minimumStock)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                  <div>
                    <span className="text-stone-400 block">Categoría:</span>
                    <span className="font-semibold text-stone-700">{p.category}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Precio Venta:</span>
                    <span className="font-bold text-stone-900 text-sm">{formatCurrency(p.salePrice)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className="text-xs font-semibold text-stone-500"
                  >
                    {p.active ? '🔴 Desactivar' : '🟢 Activar'}
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleOpenAdjustStock(p)}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200"
                    >
                      Ajustar Stock
                    </button>
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="px-3 py-1.5 text-xs font-semibold bg-stone-100 text-stone-700 rounded-lg"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* MODAL: Crear Producto */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Nuevo Producto
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alfajor Jorgito Chocolate 50g"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Código de Barras (Opcional)</label>
                  <input
                    type="text"
                    placeholder="7791234567890"
                    value={createForm.barcode || ''}
                    onChange={(e) => setCreateForm({ ...createForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  />
                  <span className="text-[10px] text-stone-400">Preserva ceros iniciales</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Alfajores, Bebidas"
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Costo ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={createForm.costPrice}
                    onChange={(e) => setCreateForm({ ...createForm, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Venta ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={createForm.salePrice}
                    onChange={(e) => setCreateForm({ ...createForm, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.initialStock}
                    onChange={(e) => setCreateForm({ ...createForm, initialStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.minimumStock}
                    onChange={(e) => setCreateForm({ ...createForm, minimumStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  id="btn-save-product"
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
                >
                  {submitting ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Editar Producto (Stock NO modificable directamente) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Editar Producto</h3>
                <p className="text-xs text-stone-500">ID: {showEditModal.id}</p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Código de Barras</label>
                  <input
                    type="text"
                    value={editForm.barcode || ''}
                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Costo ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Venta ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editForm.salePrice}
                    onChange={(e) => setEditForm({ ...editForm, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.minimumStock}
                    onChange={(e) => setEditForm({ ...editForm, minimumStock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Actual (Solo Lectura)</label>
                  <div className="px-3 py-2 bg-stone-100 border border-stone-300 rounded-xl font-bold text-stone-700">
                    {showEditModal.stock} unidades
                  </div>
                  <span className="text-[10px] text-stone-500 mt-1 block">Para cambiar el stock utilice "Ajustar stock"</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="active-check"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
                />
                <label htmlFor="active-check" className="text-sm font-semibold text-stone-800">
                  Producto Activo
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  {submitting ? 'Guardando...' : 'Actualizar Producto'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Ajustar Stock Manual */}
      {showAdjustStockModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                Ajustar Stock Manual
              </h3>
              <button onClick={() => setShowAdjustStockModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
              <p className="font-bold text-stone-900 text-sm">{showAdjustStockModal.name}</p>
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span>Stock Actual: <strong className="text-stone-900">{showAdjustStockModal.stock}</strong></span>
                <span>Stock Mínimo: <strong>{showAdjustStockModal.minimumStock}</strong></span>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAdjustStock} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Tipo de Ajuste</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('IN')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'IN' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                        : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    + Entradas (Reposición)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('OUT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'OUT' 
                        ? 'bg-red-600 text-white border-red-600 shadow-xs' 
                        : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    - Salidas (Pérdida/Daño)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Cantidad a {adjustType === 'IN' ? 'Aumentar' : 'Disminuir'} *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Motivo (Opcional)</label>
                <input
                  type="text"
                  placeholder={adjustType === 'IN' ? 'Ej: Reposición de mercadería' : 'Ej: Producto vencido / roto'}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 flex justify-between items-center font-bold">
                <span>Nuevo Stock Resultante:</span>
                <span className="text-sm font-black">
                  {showAdjustStockModal.stock + (adjustType === 'IN' ? adjustQuantity : -adjustQuantity)} unidades
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAdjustStockModal(null)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  {submitting ? 'Guardando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Historial de Movimientos de Inventario */}
      {showMovementsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[85vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-stone-700" />
                  Historial de Movimientos de Inventario
                </h3>
                <p className="text-xs text-stone-500">
                  Registro auditado de entradas, salidas y stock inicial
                </p>
              </div>
              <button onClick={() => setShowMovementsModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-stone-200 rounded-xl">
              {loadingMovements ? (
                <div className="p-8 text-center text-stone-500 text-sm">Cargando movimientos...</div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-sm">No hay movimientos registrados.</div>
              ) : (
                <table className="min-w-full divide-y divide-stone-200 text-xs">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-bold text-stone-500 uppercase">Fecha</th>
                      <th className="px-3 py-2.5 text-left font-bold text-stone-500 uppercase">Producto</th>
                      <th className="px-3 py-2.5 text-center font-bold text-stone-500 uppercase">Tipo</th>
                      <th className="px-3 py-2.5 text-center font-bold text-stone-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2.5 text-center font-bold text-stone-500 uppercase">Anterior → Nuevo</th>
                      <th className="px-3 py-2.5 text-left font-bold text-stone-500 uppercase">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-stone-200">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2.5 font-mono text-stone-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          {m.productName || m.productId}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {m.type === 'INITIAL' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">INICIAL</span>
                          )}
                          {m.type === 'ADJUSTMENT_IN' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">+ ENTRADA</span>
                          )}
                          {m.type === 'ADJUSTMENT_OUT' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-bold text-[10px]">- SALIDA</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-stone-800">
                          {m.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-stone-600">
                          {m.previousStock} → <strong className="text-stone-900">{m.newStock}</strong>
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 italic">
                          {m.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setShowMovementsModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-xl text-sm"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Importación Excel */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-stone-200 space-y-5 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  Importar Productos desde Excel (.xlsx)
                </h3>
                <p className="text-xs text-stone-500">
                  Crea productos nuevos y actualiza precios/costos por código de barras sin sobrescribir el stock actual.
                </p>
              </div>
              <button onClick={() => setShowExcelModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File Upload Box */}
            {!excelSummary && (
              <div className="border-2 border-dashed border-stone-300 rounded-2xl p-8 text-center bg-stone-50 hover:bg-stone-100/80 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleExcelFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                <p className="font-bold text-stone-800 text-sm">
                  Haz clic aquí o arrastra tu archivo Excel (.xlsx)
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Usa la opción "Plantilla Excel" para descargar el formato recomendado.
                </p>

                {parsingExcel && (
                  <p className="mt-4 text-xs font-bold text-blue-600 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Procesando y validando Excel...
                  </p>
                )}
              </div>
            )}

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Excel Preview Table */}
            {excelSummary && (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                
                {/* Summary Badges */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">✓ Productos Nuevos</span>
                    <span className="text-xl font-black text-emerald-900">{excelSummary.newCount}</span>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-blue-700 block">↻ A Actualizar (Precios)</span>
                    <span className="text-xl font-black text-blue-900">{excelSummary.updateCount}</span>
                  </div>

                  <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-red-700 block">⚠ Filas con Error</span>
                    <span className="text-xl font-black text-red-900">{excelSummary.errorCount}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-700">Vista Previa de Filas</span>
                  <button
                    onClick={() => { setExcelSummary(null); setExcelFile(null); }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Cargar otro archivo
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-stone-200 rounded-xl">
                  <table className="min-w-full divide-y divide-stone-200 text-xs">
                    <thead className="bg-stone-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-stone-500">Fila</th>
                        <th className="px-3 py-2 text-left font-bold text-stone-500">Código</th>
                        <th className="px-3 py-2 text-left font-bold text-stone-500">Producto</th>
                        <th className="px-3 py-2 text-right font-bold text-stone-500">Costo</th>
                        <th className="px-3 py-2 text-right font-bold text-stone-500">Precio Venta</th>
                        <th className="px-3 py-2 text-center font-bold text-stone-500">Stock</th>
                        <th className="px-3 py-2 text-center font-bold text-stone-500">Estado / Nota</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-stone-200">
                      {excelSummary.rows.map((r) => (
                        <tr key={r.rowNumber} className={r.status === 'ERROR' ? 'bg-red-50/50' : 'hover:bg-stone-50'}>
                          <td className="px-3 py-2 font-mono text-stone-400">{r.rowNumber}</td>
                          <td className="px-3 py-2 font-mono text-stone-700">{r.barcode || '-'}</td>
                          <td className="px-3 py-2 font-bold text-stone-900">{r.name || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono">${r.costPrice}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">${r.salePrice}</td>
                          <td className="px-3 py-2 text-center font-bold">{r.stock}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {r.status === 'NEW' && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                                NUEVO
                              </span>
                            )}
                            {r.status === 'UPDATE' && (
                              <div className="flex flex-col items-center">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">
                                  ACTUALIZAR
                                </span>
                                <span className="text-[9px] text-blue-600 italic mt-0.5">Stock actual conservado</span>
                              </div>
                            )}
                            {r.status === 'ERROR' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-bold text-[10px]" title={r.errorReason}>
                                ERROR: {r.errorReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-stone-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl text-sm"
              >
                Cancelar
              </button>

              {excelSummary && (
                <button
                  type="button"
                  onClick={handleConfirmExcelImport}
                  disabled={importingExcel || (excelSummary.newCount === 0 && excelSummary.updateCount === 0)}
                  id="btn-confirm-import"
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors text-sm disabled:opacity-50"
                >
                  {importingExcel ? 'Importando...' : `Importar Filas Válidas (${excelSummary.newCount + excelSummary.updateCount})`}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
