import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  Product, 
  CreateProductInput, 
  UpdateProductInput, 
  InventoryMovement, 
  ExcelImportSummary, 
  ExcelImportRow,
  ComboItem
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
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CategoryIcon } from './CategoryIcon';
import { 
  CATEGORIES_PRESETS, 
  CATEGORY_ICONS, 
  normalizeCategoryName, 
  findMatchingCategory, 
  getUniqueCategories 
} from '../lib/categoryUtils';
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
  Eye,
  Camera,
  Trash2,
  Layers,
  Sparkles,
  Filter,
  Calendar,
  Info
} from 'lucide-react';

export const ProductManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'low_stock' | 'out_of_stock'>('all');

  // Scanner modal state
  const [scannerTarget, setScannerTarget] = useState<'create' | 'edit' | 'search' | null>(null);

  // Group by category state
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Product | null>(null);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState<Product | null>(null);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Combo component search in modal
  const [comboSearch, setComboSearch] = useState('');

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateProductInput>({
    name: '',
    barcode: '',
    category: '',
    costPrice: 0,
    salePrice: 0,
    initialStock: 0,
    minimumStock: 5,
    reorderPoint: 5,
    targetStock: 20,
    tracksStock: true,
    isCombo: false,
    comboItems: []
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<UpdateProductInput>({
    name: '',
    barcode: '',
    category: '',
    costPrice: 0,
    salePrice: 0,
    minimumStock: 5,
    reorderPoint: 5,
    targetStock: 20,
    active: true,
    tracksStock: true,
    isCombo: false,
    comboItems: []
  });

  // Adjust Stock Form State
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Movements State & Filters
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'INITIAL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RECEPTION' | 'SALE'>('ALL');
  const [movementDateFilter, setMovementDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [movementDateStart, setMovementDateStart] = useState('');
  const [movementDateEnd, setMovementDateEnd] = useState('');

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ExcelImportSummary | null>(null);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  // General Form Errors & Category Feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
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

  // Dynamic unique categories list (normalized and sorted)
  const categories = useMemo(() => {
    return getUniqueCategories(products.map(p => p.category));
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
      if (statusFilter === 'out_of_stock') matchesStatus = !p.isCombo && p.tracksStock !== false && p.stock <= 0;
      if (statusFilter === 'low_stock') matchesStatus = !p.isCombo && p.tracksStock !== false && p.stock > 0 && p.stock <= (p.reorderPoint ?? p.minimumStock);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, statusFilter]);

  // Grouped products by category
  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredProducts) {
      const cat = p.category || 'General';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProducts]);

  // Filtered Movements for History Modal
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      // 1. Text search
      const term = movementSearch.toLowerCase().trim();
      if (term) {
        const prodName = (m.productName || '').toLowerCase();
        const reason = (m.reason || '').toLowerCase();
        const id = (m.id || '').toLowerCase();
        const user = ((m as any).userName || (m as any).createdBy || '').toLowerCase();
        if (!prodName.includes(term) && !reason.includes(term) && !id.includes(term) && !user.includes(term)) {
          return false;
        }
      }

      // 2. Movement Type filter
      if (movementTypeFilter !== 'ALL') {
        if (m.type !== movementTypeFilter) return false;
      }

      // 3. Date Filter
      if (movementDateFilter !== 'ALL') {
        const movDate = new Date(m.createdAt);
        const now = new Date();

        if (movementDateFilter === 'TODAY') {
          const isToday = movDate.getDate() === now.getDate() &&
                          movDate.getMonth() === now.getMonth() &&
                          movDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (movementDateFilter === 'WEEK') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (movDate < weekAgo) return false;
        } else if (movementDateFilter === 'MONTH') {
          const monthAgo = new Date();
          monthAgo.setMonth(now.getMonth() - 1);
          if (movDate < monthAgo) return false;
        } else if (movementDateFilter === 'CUSTOM') {
          if (movementDateStart) {
            const start = new Date(movementDateStart);
            start.setHours(0, 0, 0, 0);
            if (movDate < start) return false;
          }
          if (movementDateEnd) {
            const end = new Date(movementDateEnd);
            end.setHours(23, 59, 59, 999);
            if (movDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [movements, movementSearch, movementTypeFilter, movementDateFilter, movementDateStart, movementDateEnd]);

  // Stock Badge Helper
  const getStockBadge = (p: Product) => {
    if (p.isCombo) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <Boxes className="w-3 h-3 mr-1 text-purple-600" /> Combo ({p.comboItems?.length || 0})
        </span>
      );
    }
    if (p.tracksStock === false) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
          Sin Control Stock
        </span>
      );
    }
    if (p.stock <= 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 mr-1 text-red-600" /> Sin Stock ({p.stock})
        </span>
      );
    }
    if (p.stock <= p.minimumStock) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" /> Stock Bajo ({p.stock})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Normal ({p.stock})
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

  // Helper to calculate total cost of combo components
  const calculateComboTotalCost = (items: ComboItem[] = []) => {
    return items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.unitCost) || 0)), 0);
  };

  // Combo component helpers
  const handleAddComboItem = (target: 'create' | 'edit', productToAdd: Product) => {
    const form = target === 'create' ? createForm : editForm;
    const setForm = target === 'create' ? setCreateForm : setEditForm;
    const items = form.comboItems || [];
    const existing = items.find(i => i.productId === productToAdd.id);

    let newItems: ComboItem[];
    if (existing) {
      newItems = items.map(i => i.productId === productToAdd.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      newItems = [
        ...items,
        {
          productId: productToAdd.id,
          productName: productToAdd.name,
          quantity: 1,
          unitCost: Number(productToAdd.costPrice) || 0,
          tracksStock: productToAdd.tracksStock !== false,
          trackStock: productToAdd.tracksStock !== false
        }
      ];
    }

    const newCost = calculateComboTotalCost(newItems);
    setForm({
      ...form,
      comboItems: newItems,
      costPrice: newCost
    });
  };

  const handleUpdateComboItemQty = (target: 'create' | 'edit', productId: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveComboItem(target, productId);
      return;
    }
    const form = target === 'create' ? createForm : editForm;
    const setForm = target === 'create' ? setCreateForm : setEditForm;
    const newItems = (form.comboItems || []).map(i => i.productId === productId ? { ...i, quantity: qty } : i);
    const newCost = calculateComboTotalCost(newItems);
    setForm({
      ...form,
      comboItems: newItems,
      costPrice: newCost
    });
  };

  const handleUpdateComboItemCost = (target: 'create' | 'edit', productId: string, cost: number) => {
    const form = target === 'create' ? createForm : editForm;
    const setForm = target === 'create' ? setCreateForm : setEditForm;
    const newItems = (form.comboItems || []).map(i => i.productId === productId ? { ...i, unitCost: Math.max(0, cost) } : i);
    const newCost = calculateComboTotalCost(newItems);
    setForm({
      ...form,
      comboItems: newItems,
      costPrice: newCost
    });
  };

  const handleToggleComboItemStock = (target: 'create' | 'edit', productId: string) => {
    const form = target === 'create' ? createForm : editForm;
    const setForm = target === 'create' ? setCreateForm : setEditForm;
    const newItems = (form.comboItems || []).map(i => {
      if (i.productId === productId) {
        const currentTrack = i.tracksStock !== undefined 
          ? Boolean(i.tracksStock) 
          : (i.trackStock !== undefined ? Boolean(i.trackStock) : true);
        return {
          ...i,
          tracksStock: !currentTrack,
          trackStock: !currentTrack
        };
      }
      return i;
    });
    setForm({
      ...form,
      comboItems: newItems
    });
  };

  const handleRemoveComboItem = (target: 'create' | 'edit', productId: string) => {
    const form = target === 'create' ? createForm : editForm;
    const setForm = target === 'create' ? setCreateForm : setEditForm;
    const newItems = (form.comboItems || []).filter(i => i.productId !== productId);
    const newCost = calculateComboTotalCost(newItems);
    setForm({
      ...form,
      comboItems: newItems,
      costPrice: newCost
    });
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

    if (createForm.isCombo && (!createForm.comboItems || createForm.comboItems.length === 0)) {
      setFormError('Un combo debe contener al menos un producto componente.');
      return;
    }

    // Auto-normalize category name or match with existing canonical category
    const rawCat = createForm.category || '';
    const matchedCat = findMatchingCategory(rawCat, categories) || normalizeCategoryName(rawCat);

    setSubmitting(true);
    try {
      await createProduct(business.id, userProfile.uid, {
        ...createForm,
        category: matchedCat || 'General'
      });
      setCreateForm({
        name: '',
        barcode: '',
        category: '',
        costPrice: 0,
        salePrice: 0,
        initialStock: 0,
        minimumStock: 5,
        reorderPoint: 5,
        targetStock: 20,
        tracksStock: true,
        isCombo: false,
        comboItems: []
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

    const isCombo = !!p.isCombo;
    const enrichedComboItems: ComboItem[] = isCombo && p.comboItems ? p.comboItems.map(ci => {
      const matchProd = products.find(prod => prod.id === ci.productId);
      return {
        productId: ci.productId,
        productName: ci.productName || matchProd?.name || 'Componente',
        quantity: Math.max(1, Number(ci.quantity) || 1),
        unitCost: ci.unitCost !== undefined ? Number(ci.unitCost) : (matchProd?.costPrice || 0),
        tracksStock: ci.tracksStock !== undefined 
          ? Boolean(ci.tracksStock) 
          : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : (matchProd?.tracksStock !== false)),
        trackStock: ci.tracksStock !== undefined 
          ? Boolean(ci.tracksStock) 
          : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : (matchProd?.tracksStock !== false))
      };
    }) : [];

    const computedCost = isCombo 
      ? calculateComboTotalCost(enrichedComboItems)
      : p.costPrice;

    setEditForm({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category,
      costPrice: computedCost,
      salePrice: p.salePrice,
      minimumStock: p.minimumStock,
      reorderPoint: p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock,
      targetStock: p.targetStock,
      active: p.active,
      tracksStock: isCombo ? false : (p.tracksStock !== false),
      isCombo,
      comboItems: enrichedComboItems
    });
    setFormError(null);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal || !business?.id) return;
    setFormError(null);

    // Auto-normalize category name or match with existing canonical category
    const rawCat = editForm.category || '';
    const matchedCat = findMatchingCategory(rawCat, categories) || normalizeCategoryName(rawCat);

    setSubmitting(true);
    try {
      await updateProduct(showEditModal.id, business.id, {
        ...editForm,
        category: matchedCat || 'General'
      });
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-stone-100 items-center">
          
          {/* Search Box with Camera Scanner */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-16 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setScannerTarget('search')}
                className="p-1.5 bg-stone-900 hover:bg-stone-800 text-amber-400 rounded-lg shadow-2xs transition-all cursor-pointer"
                title="Escanear código de barras para buscar"
                aria-label="Escanear código de barras"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
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

          {/* Group By Category Toggle */}
          <div className="flex items-center justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => setGroupByCategory(!groupByCategory)}
              className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                groupByCategory
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs'
                  : 'bg-stone-50 border-stone-300 text-stone-600 hover:bg-stone-100'
              }`}
              title="Agrupar listado por categorías"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>{groupByCategory ? 'Agrupado por Categoría' : 'Agrupar por Categoría'}</span>
            </button>
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
              ) : groupByCategory ? (
                /* Grouped Table Rows */
                groupedProducts.map(([catName, catProducts]) => (
                  <React.Fragment key={catName}>
                    <tr className="bg-stone-100/80 border-y border-stone-200">
                      <td colSpan={8} className="px-4 py-2 text-xs font-black text-stone-800">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CategoryIcon category={catName} className="w-4 h-4 text-indigo-600" />
                            <span>{catName}</span>
                            <span className="text-[10px] font-bold text-stone-500 bg-white px-2 py-0.5 rounded-full border border-stone-200">
                              {catProducts.length} {catProducts.length === 1 ? 'producto' : 'productos'}
                            </span>
                          </span>
                          <span className="text-[11px] font-medium text-stone-600">
                            Stock total: <strong className="text-stone-900">{catProducts.reduce((sum, p) => sum + p.stock, 0)} un.</strong>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {catProducts.map((p) => (
                      <tr key={p.id} className={`hover:bg-stone-50/80 transition-colors ${!p.active ? 'opacity-60 bg-stone-50' : ''}`}>
                        <td className="px-4 py-3.5 font-bold text-sm text-stone-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                              <CategoryIcon iconName={p.icon} category={p.category} className="w-4 h-4 text-indigo-600" />
                            </div>
                            <span>{p.name}</span>
                          </div>
                        </td>
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
                        <td className="px-4 py-3.5 text-xs font-medium text-stone-700">
                          <span className="bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200 inline-flex items-center gap-1.5">
                            <CategoryIcon category={p.category} className="w-3.5 h-3.5 text-indigo-500" />
                            {p.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs font-mono text-stone-500">
                          {formatCurrency(p.costPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold font-mono text-stone-900">
                          {formatCurrency(p.salePrice)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {getStockBadge(p)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            p.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-200 text-stone-600'
                          }`}>
                            {p.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {p.tracksStock !== false && !p.isCombo && (
                            <button
                              onClick={() => handleOpenAdjustStock(p)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                              title="Ajustar stock de este producto"
                            >
                              Ajustar Stock
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                            title="Editar datos del producto"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleActive(p)}
                            className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              p.active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={p.active ? 'Desactivar producto' : 'Activar producto'}
                          >
                            {p.active ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                /* Flat Table Rows */
                filteredProducts.map((p) => (
                  <tr key={p.id} className={`hover:bg-stone-50/80 transition-colors ${!p.active ? 'opacity-60 bg-stone-50' : ''}`}>
                    <td className="px-4 py-3.5 font-bold text-sm text-stone-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                          <CategoryIcon iconName={p.icon} category={p.category} className="w-4 h-4 text-indigo-600" />
                        </div>
                        <span>{p.name}</span>
                      </div>
                    </td>
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
                    <td className="px-4 py-3.5 text-xs font-medium text-stone-700">
                      <span className="bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200 inline-flex items-center gap-1.5">
                        <CategoryIcon category={p.category} className="w-3.5 h-3.5 text-indigo-500" />
                        {p.category || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs font-mono text-stone-500">
                      {formatCurrency(p.costPrice)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold font-mono text-stone-900">
                      {formatCurrency(p.salePrice)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {getStockBadge(p)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        p.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {p.tracksStock !== false && !p.isCombo && (
                        <button
                          onClick={() => handleOpenAdjustStock(p)}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                          title="Ajustar stock de este producto"
                        >
                          Ajustar Stock
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                        title="Editar datos del producto"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
          ) : groupByCategory ? (
            groupedProducts.map(([catName, catProducts]) => (
              <div key={catName} className="space-y-2.5">
                <div className="flex items-center justify-between bg-stone-100/90 px-3 py-2 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-1.5 font-black text-xs text-stone-800">
                    <CategoryIcon category={catName} className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{catName}</span>
                    <span className="text-[10px] font-bold text-stone-500 bg-white px-1.5 py-0.5 rounded-full border border-stone-200">
                      {catProducts.length}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-600 font-medium">
                    Stock: <strong className="text-stone-900">{catProducts.reduce((s, p) => s + p.stock, 0)}</strong>
                  </span>
                </div>
                {catProducts.map((p) => (
                  <div key={p.id} className={`bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3 ${!p.active ? 'opacity-60 bg-stone-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                          <CategoryIcon iconName={p.icon} category={p.category} className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-900 text-base">{p.name}</h4>
                          <p className="text-xs text-stone-500 font-mono mt-0.5">
                            {p.barcode ? `Código: ${p.barcode}` : 'Sin código de barras'}
                          </p>
                        </div>
                      </div>
                      {getStockBadge(p)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                      <div>
                        <span className="text-stone-400 block">Categoría:</span>
                        <span className="font-semibold text-stone-700 inline-flex items-center gap-1 mt-0.5">
                          <CategoryIcon category={p.category} className="w-3 h-3 text-indigo-500" />
                          {p.category || 'General'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Precio Venta:</span>
                        <span className="font-bold text-stone-900 text-sm">{formatCurrency(p.salePrice)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className="text-xs font-semibold text-stone-500 cursor-pointer"
                      >
                        {p.active ? '🔴 Desactivar' : '🟢 Activar'}
                      </button>

                      <div className="flex space-x-2">
                        {p.tracksStock !== false && !p.isCombo && (
                          <button
                            onClick={() => handleOpenAdjustStock(p)}
                            className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 cursor-pointer"
                          >
                            Ajustar Stock
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-3 py-1.5 text-xs font-semibold bg-stone-100 text-stone-700 rounded-lg cursor-pointer"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            filteredProducts.map((p) => (
              <div key={p.id} className={`bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3 ${!p.active ? 'opacity-60 bg-stone-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                      <CategoryIcon iconName={p.icon} category={p.category} className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-base">{p.name}</h4>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">
                        {p.barcode ? `Código: ${p.barcode}` : 'Sin código de barras'}
                      </p>
                    </div>
                  </div>
                  {getStockBadge(p)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                  <div>
                    <span className="text-stone-400 block">Categoría:</span>
                    <span className="font-semibold text-stone-700 inline-flex items-center gap-1 mt-0.5">
                      <CategoryIcon category={p.category} className="w-3 h-3 text-indigo-500" />
                      {p.category || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Precio Venta:</span>
                    <span className="font-bold text-stone-900 text-sm">{formatCurrency(p.salePrice)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className="text-xs font-semibold text-stone-500 cursor-pointer"
                  >
                    {p.active ? '🔴 Desactivar' : '🟢 Activar'}
                  </button>

                  <div className="flex space-x-2">
                    {p.tracksStock !== false && !p.isCombo && (
                      <button
                        onClick={() => handleOpenAdjustStock(p)}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200 cursor-pointer"
                      >
                        Ajustar Stock
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(p)}
                      className="px-3 py-1.5 text-xs font-semibold bg-stone-100 text-stone-700 rounded-lg cursor-pointer"
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

            <form onSubmit={handleCreateProduct} className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-1">
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

              {/* Product Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1.5">Tipo de Producto</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, isCombo: false })}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !createForm.isCombo
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Package className={`w-4 h-4 ${!createForm.isCombo ? 'text-emerald-600' : 'text-stone-400'}`} />
                    <span className="font-bold">Producto Estándar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const currentComboCost = calculateComboTotalCost(createForm.comboItems || []);
                      setCreateForm({ 
                        ...createForm, 
                        isCombo: true, 
                        tracksStock: false,
                        costPrice: currentComboCost > 0 ? currentComboCost : createForm.costPrice 
                      });
                    }}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      createForm.isCombo
                        ? 'bg-purple-50 border-purple-500 text-purple-950 ring-1 ring-purple-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Boxes className={`w-4 h-4 ${createForm.isCombo ? 'text-purple-600' : 'text-stone-400'}`} />
                    <span className="font-bold">Combo / Promo</span>
                  </button>
                </div>
              </div>

              {/* Standard Product: Independent Stock Control Checkbox */}
              {!createForm.isCombo && (
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={createForm.tracksStock !== false}
                        onChange={(e) => setCreateForm({ ...createForm, tracksStock: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-black uppercase text-stone-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Controlar Stock
                      </span>
                    </label>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      createForm.tracksStock !== false 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-stone-200 text-stone-700'
                    }`}>
                      {createForm.tracksStock !== false ? 'Inventario Activado' : 'Sin Control de Stock'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {createForm.tracksStock !== false
                      ? 'Este producto descuenta inventario físico con cada venta y genera alertas de reposición.'
                      : 'El producto se venderá sin descontar inventario ni exigir stock inicial.'}
                  </p>
                </div>
              )}

              {/* Combo Items Builder if isCombo */}
              {createForm.isCombo && (
                <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-purple-950 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-purple-600" />
                      Componentes del Combo
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      {createForm.comboItems?.length || 0} productos incluidos
                    </span>
                  </div>

                  {/* Add component input */}
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Buscar producto para agregar al combo..."
                      value={comboSearch}
                      onChange={(e) => setComboSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {comboSearch.trim() && (
                      <div className="bg-white rounded-xl border border-purple-200 shadow-md max-h-40 overflow-y-auto divide-y divide-purple-100">
                        {products
                          .filter(p => !p.isCombo && p.name.toLowerCase().includes(comboSearch.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleAddComboItem('create', p);
                                setComboSearch('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between text-xs cursor-pointer"
                            >
                              <div>
                                <div className="font-bold text-stone-900">{p.name}</div>
                                <div className="text-[10px] text-stone-500">Costo: {formatCurrency(p.costPrice)} | {p.tracksStock !== false ? `Stock: ${p.stock}` : 'Sin control de stock'}</div>
                              </div>
                              <span className="text-purple-600 font-bold hover:underline">+ Agregar</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Added components list */}
                  {createForm.comboItems && createForm.comboItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-purple-900">Configuración individual por componente:</div>
                      {createForm.comboItems.map(item => {
                        const isTracking = item.tracksStock !== undefined ? Boolean(item.tracksStock) : (item.trackStock !== undefined ? Boolean(item.trackStock) : true);
                        const subtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                        return (
                          <div key={item.productId} className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-stone-800 text-xs truncate flex-1">{item.productName || item.productId}</span>
                              
                              {/* Toggle stock control for this component */}
                              <button
                                type="button"
                                onClick={() => handleToggleComboItemStock('create', item.productId)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                                  isTracking
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                                }`}
                                title={isTracking ? "Al venderse este combo, se descontará stock de este producto" : "No descontará stock de este producto"}
                              >
                                {isTracking ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Sliders className="w-3 h-3 text-stone-400" />}
                                <span>{isTracking ? 'Controla Stock' : 'Sin Stock'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveComboItem('create', item.productId)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Quitar componente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-purple-100 items-center text-xs">
                              {/* Quantity Stepper */}
                              <div>
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Cantidad</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComboItemQty('create', item.productId, item.quantity - 1)}
                                    className="w-5 h-5 bg-stone-100 rounded font-black text-stone-700 hover:bg-stone-200 flex items-center justify-center cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateComboItemQty('create', item.productId, parseInt(e.target.value, 10) || 1)}
                                    className="w-10 text-center font-bold font-mono py-0.5 border border-stone-200 rounded text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComboItemQty('create', item.productId, item.quantity + 1)}
                                    className="w-5 h-5 bg-stone-100 rounded font-black text-stone-700 hover:bg-stone-200 flex items-center justify-center cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Unit Cost */}
                              <div>
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Costo Unit.</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="any"
                                  value={item.unitCost !== undefined ? item.unitCost : ''}
                                  onChange={(e) => handleUpdateComboItemCost('create', item.productId, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-0.5 border border-stone-200 rounded text-xs font-mono font-bold"
                                />
                              </div>

                              {/* Subtotal */}
                              <div className="text-right">
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Subtotal</label>
                                <div className="font-mono font-bold text-stone-900 text-xs">
                                  {formatCurrency(subtotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Combo Financial Summary */}
                      <div className="grid grid-cols-2 gap-2 bg-purple-100/70 p-2.5 rounded-xl border border-purple-200 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-purple-800">Costo Total del Combo</div>
                          <div className="font-black font-mono text-purple-950 text-sm">
                            {formatCurrency(calculateComboTotalCost(createForm.comboItems))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-purple-800">Margen Estimado</div>
                          {(() => {
                            const totalCost = calculateComboTotalCost(createForm.comboItems);
                            const margin = createForm.salePrice - totalCost;
                            const marginPct = createForm.salePrice > 0 ? ((margin / createForm.salePrice) * 100).toFixed(0) : '0';
                            return (
                              <div className={`font-black font-mono text-sm ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {formatCurrency(margin)} ({marginPct}%)
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-700 italic text-center py-2 bg-white/70 rounded-xl border border-dashed border-purple-200">
                      Busca y selecciona los productos que integran este combo. Podrás configurar si cada uno descuenta stock físico o no.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Código de Barras (Opcional)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="7791234567890"
                      value={createForm.barcode || ''}
                      onChange={(e) => setCreateForm({ ...createForm, barcode: e.target.value })}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerTarget('create')}
                      className="px-2.5 py-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-xs transition-all"
                      title="Escanear código con cámara"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                  <span className="text-[10px] text-stone-400">Preserva ceros iniciales</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    list="create-category-list"
                    placeholder="Ej: Alfajores, Bebidas"
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  />
                  <datalist id="create-category-list">
                    {categories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {/* Duplicate detection feedback */}
                  {createForm.category.trim() && (() => {
                    const match = findMatchingCategory(createForm.category, categories);
                    if (match && match.toLowerCase() === createForm.category.trim().toLowerCase() && match !== createForm.category.trim()) {
                      return (
                        <div className="mt-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>La categoría <strong>"{match}"</strong> ya existe. Se seleccionó la categoría existente.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Quick Select Category Pills */}
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                    {categories.slice(0, 6).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, category: cat })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                          createForm.category.trim().toLowerCase() === cat.toLowerCase()
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border-stone-200'
                        }`}
                      >
                        <CategoryIcon category={cat} className="w-2.5 h-2.5" />
                        <span>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-stone-700">Precio Costo ($)</label>
                    {createForm.isCombo && (
                      <span className="text-[10px] text-purple-700 font-bold">Auto de componentes</span>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    disabled={createForm.isCombo}
                    value={createForm.costPrice}
                    onChange={(e) => setCreateForm({ ...createForm, costPrice: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className={`w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono ${
                      createForm.isCombo ? 'bg-purple-50/50 text-purple-900 font-bold border-purple-200 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Venta ($) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    required
                    value={createForm.salePrice}
                    onChange={(e) => setCreateForm({ ...createForm, salePrice: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {!createForm.isCombo && createForm.tracksStock !== false && (
                <div className="grid grid-cols-3 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Inicial</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={createForm.initialStock}
                      onChange={(e) => setCreateForm({ ...createForm, initialStock: parseInt(e.target.value, 10) || 0 })}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Punto de Reposición</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={createForm.reorderPoint ?? createForm.minimumStock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setCreateForm({ ...createForm, reorderPoint: val, minimumStock: val });
                      }}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Objetivo</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={createForm.targetStock ?? ''}
                      placeholder="Opcional"
                      onChange={(e) => setCreateForm({ ...createForm, targetStock: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  id="btn-save-product"
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
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
                <p className="text-xs text-stone-500">{showEditModal.category || 'Categoría no asignada'}</p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-1">
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

              {/* Product Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1.5">Tipo de Producto</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, isCombo: false })}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !editForm.isCombo
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Package className={`w-4 h-4 ${!editForm.isCombo ? 'text-emerald-600' : 'text-stone-400'}`} />
                    <span className="font-bold">Producto Estándar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const currentComboCost = calculateComboTotalCost(editForm.comboItems || []);
                      setEditForm({ 
                        ...editForm, 
                        isCombo: true, 
                        tracksStock: false,
                        costPrice: currentComboCost > 0 ? currentComboCost : editForm.costPrice 
                      });
                    }}
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editForm.isCombo
                        ? 'bg-purple-50 border-purple-500 text-purple-950 ring-1 ring-purple-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Boxes className={`w-4 h-4 ${editForm.isCombo ? 'text-purple-600' : 'text-stone-400'}`} />
                    <span className="font-bold">Combo / Promo</span>
                  </button>
                </div>
              </div>

              {/* Standard Product: Independent Stock Control Checkbox */}
              {!editForm.isCombo && (
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editForm.tracksStock !== false}
                        onChange={(e) => setEditForm({ ...editForm, tracksStock: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-black uppercase text-stone-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Controlar Stock
                      </span>
                    </label>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      editForm.tracksStock !== false 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-stone-200 text-stone-700'
                    }`}>
                      {editForm.tracksStock !== false ? 'Inventario Activado' : 'Sin Control de Stock'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {editForm.tracksStock !== false
                      ? 'Este producto descuenta inventario físico con cada venta y genera alertas de reposición.'
                      : 'El producto se venderá sin descontar inventario.'}
                  </p>
                </div>
              )}

              {/* Combo Items Builder if isCombo */}
              {editForm.isCombo && (
                <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-purple-950 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-purple-600" />
                      Componentes del Combo
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                      {editForm.comboItems?.length || 0} productos incluidos
                    </span>
                  </div>

                  {/* Add component input */}
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Buscar producto para agregar al combo..."
                      value={comboSearch}
                      onChange={(e) => setComboSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {comboSearch.trim() && (
                      <div className="bg-white rounded-xl border border-purple-200 shadow-md max-h-40 overflow-y-auto divide-y divide-purple-100">
                        {products
                          .filter(p => !p.isCombo && p.id !== showEditModal.id && p.name.toLowerCase().includes(comboSearch.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleAddComboItem('edit', p);
                                setComboSearch('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between text-xs cursor-pointer"
                            >
                              <div>
                                <div className="font-bold text-stone-900">{p.name}</div>
                                <div className="text-[10px] text-stone-500">Costo: {formatCurrency(p.costPrice)} | {p.tracksStock !== false ? `Stock: ${p.stock}` : 'Sin control de stock'}</div>
                              </div>
                              <span className="text-purple-600 font-bold hover:underline">+ Agregar</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Added components list */}
                  {editForm.comboItems && editForm.comboItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-purple-900">Configuración individual por componente:</div>
                      {editForm.comboItems.map(item => {
                        const isTracking = item.tracksStock !== undefined ? Boolean(item.tracksStock) : (item.trackStock !== undefined ? Boolean(item.trackStock) : true);
                        const subtotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

                        return (
                          <div key={item.productId} className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-stone-800 text-xs truncate flex-1">{item.productName || item.productId}</span>
                              
                              {/* Toggle stock control for this component */}
                              <button
                                type="button"
                                onClick={() => handleToggleComboItemStock('edit', item.productId)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                                  isTracking
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                                }`}
                                title={isTracking ? "Al venderse este combo, se descontará stock de este producto" : "No descontará stock de este producto"}
                              >
                                {isTracking ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Sliders className="w-3 h-3 text-stone-400" />}
                                <span>{isTracking ? 'Controla Stock' : 'Sin Stock'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveComboItem('edit', item.productId)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Quitar componente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-purple-100 items-center text-xs">
                              {/* Quantity Stepper */}
                              <div>
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Cantidad</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComboItemQty('edit', item.productId, item.quantity - 1)}
                                    className="w-5 h-5 bg-stone-100 rounded font-black text-stone-700 hover:bg-stone-200 flex items-center justify-center cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateComboItemQty('edit', item.productId, parseInt(e.target.value, 10) || 1)}
                                    className="w-10 text-center font-bold font-mono py-0.5 border border-stone-200 rounded text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateComboItemQty('edit', item.productId, item.quantity + 1)}
                                    className="w-5 h-5 bg-stone-100 rounded font-black text-stone-700 hover:bg-stone-200 flex items-center justify-center cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Unit Cost */}
                              <div>
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Costo Unit.</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="any"
                                  value={item.unitCost !== undefined ? item.unitCost : ''}
                                  onChange={(e) => handleUpdateComboItemCost('edit', item.productId, parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-0.5 border border-stone-200 rounded text-xs font-mono font-bold"
                                />
                              </div>

                              {/* Subtotal */}
                              <div className="text-right">
                                <label className="block text-[10px] text-stone-500 uppercase font-bold mb-0.5">Subtotal</label>
                                <div className="font-mono font-bold text-stone-900 text-xs">
                                  {formatCurrency(subtotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Combo Financial Summary */}
                      <div className="grid grid-cols-2 gap-2 bg-purple-100/70 p-2.5 rounded-xl border border-purple-200 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-purple-800">Costo Total del Combo</div>
                          <div className="font-black font-mono text-purple-950 text-sm">
                            {formatCurrency(calculateComboTotalCost(editForm.comboItems))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-purple-800">Margen Estimado</div>
                          {(() => {
                            const totalCost = calculateComboTotalCost(editForm.comboItems);
                            const margin = editForm.salePrice - totalCost;
                            const marginPct = editForm.salePrice > 0 ? ((margin / editForm.salePrice) * 100).toFixed(0) : '0';
                            return (
                              <div className={`font-black font-mono text-sm ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {formatCurrency(margin)} ({marginPct}%)
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-700 italic text-center py-2 bg-white/70 rounded-xl border border-dashed border-purple-200">
                      Busca y selecciona los productos que integran este combo. Podrás configurar si cada uno descuenta stock físico o no.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Código de Barras</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={editForm.barcode || ''}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                      className="flex-1 px-3 py-2 border border-stone-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerTarget('edit')}
                      className="px-2.5 py-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white rounded-xl flex items-center justify-center cursor-pointer shadow-xs transition-all"
                      title="Escanear código con cámara"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    list="edit-category-list"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                  <datalist id="edit-category-list">
                    {categories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {/* Duplicate detection feedback */}
                  {editForm.category.trim() && (() => {
                    const match = findMatchingCategory(editForm.category, categories);
                    if (match && match.toLowerCase() === editForm.category.trim().toLowerCase() && match !== editForm.category.trim()) {
                      return (
                        <div className="mt-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>La categoría <strong>"{match}"</strong> ya existe. Se seleccionó la categoría existente.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Quick Select Category Pills */}
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                    {categories.slice(0, 6).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, category: cat })}
                        className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                          editForm.category.trim().toLowerCase() === cat.toLowerCase()
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border-stone-200'
                        }`}
                      >
                        <CategoryIcon category={cat} className="w-2.5 h-2.5" />
                        <span>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-stone-700">Precio Costo ($)</label>
                    {editForm.isCombo && (
                      <span className="text-[10px] text-purple-700 font-bold">Auto de componentes</span>
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    disabled={editForm.isCombo}
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className={`w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono ${
                      editForm.isCombo ? 'bg-purple-50/50 text-purple-900 font-bold border-purple-200 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Precio Venta ($) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    required
                    value={editForm.salePrice}
                    onChange={(e) => setEditForm({ ...editForm, salePrice: parseFloat(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {!editForm.isCombo && editForm.tracksStock !== false && (
                <div className="grid grid-cols-3 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Punto de Reposición</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={editForm.reorderPoint ?? editForm.minimumStock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setEditForm({ ...editForm, reorderPoint: val, minimumStock: val });
                      }}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Objetivo</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={editForm.targetStock ?? ''}
                      placeholder="Opcional"
                      onChange={(e) => setEditForm({ ...editForm, targetStock: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Stock Actual</label>
                    <div className="px-3 py-2 bg-stone-100 border border-stone-300 rounded-xl font-bold text-stone-700 text-xs font-mono">
                      {showEditModal.stock} un.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="active-check"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="active-check" className="text-sm font-semibold text-stone-800 cursor-pointer">
                  Producto Activo
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
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
              <button onClick={() => setShowAdjustStockModal(null)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
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
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
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
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
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
                  inputMode="numeric"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 1)}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold text-lg focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Motivo (Opcional)</label>
                <input
                  type="text"
                  placeholder={adjustType === 'IN' ? 'Ej: Reposición de productos' : 'Ej: Producto vencido / roto'}
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
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-stone-700" />
                  Historial de Movimientos de Inventario
                </h3>
                <p className="text-xs text-stone-500">
                  Registro auditado de entradas, salidas, recepciones y stock inicial
                </p>
              </div>
              <button onClick={() => setShowMovementsModal(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter controls */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Search */}
                <div className="relative sm:col-span-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto, motivo, ID..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {movementSearch && (
                    <button
                      onClick={() => setMovementSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Type Filter */}
                <div>
                  <select
                    value={movementTypeFilter}
                    onChange={(e) => setMovementTypeFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Todos los Tipos</option>
                    <option value="INITIAL">Inicial</option>
                    <option value="ADJUSTMENT_IN">+ Entrada (Ajuste)</option>
                    <option value="ADJUSTMENT_OUT">- Salida (Ajuste)</option>
                    <option value="RECEPTION">Recepción Proveedor</option>
                    <option value="SALE">Venta / POS</option>
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <select
                    value={movementDateFilter}
                    onChange={(e) => setMovementDateFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Todas las Fechas</option>
                    <option value="TODAY">Hoy</option>
                    <option value="WEEK">Últimos 7 días</option>
                    <option value="MONTH">Últimos 30 días</option>
                    <option value="CUSTOM">Rango Personalizado</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM is selected */}
              {movementDateFilter === 'CUSTOM' && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-stone-500 font-bold">Desde:</span>
                    <input
                      type="date"
                      value={movementDateStart}
                      onChange={(e) => setMovementDateStart(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-stone-500 font-bold">Hasta:</span>
                    <input
                      type="date"
                      value={movementDateEnd}
                      onChange={(e) => setMovementDateEnd(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Count & Reset */}
              <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                <span>
                  Mostrando <strong className="text-stone-800 font-mono">{filteredMovements.length}</strong> de <strong className="text-stone-800 font-mono">{movements.length}</strong> movimientos
                </span>
                {(movementSearch || movementTypeFilter !== 'ALL' || movementDateFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setMovementSearch('');
                      setMovementTypeFilter('ALL');
                      setMovementDateFilter('ALL');
                      setMovementDateStart('');
                      setMovementDateEnd('');
                    }}
                    className="text-blue-600 hover:text-blue-800 font-bold text-[11px] underline cursor-pointer"
                  >
                    Restablecer Filtros
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-stone-200 rounded-xl">
              {loadingMovements ? (
                <div className="p-8 text-center text-stone-500 text-sm">Cargando movimientos...</div>
              ) : filteredMovements.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-sm">No se encontraron movimientos con los filtros seleccionados.</div>
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
                    {filteredMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2.5 font-mono text-stone-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-stone-900">
                          {m.productName || m.productId}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {m.type === 'INITIAL' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">Inicial</span>
                          )}
                          {m.type === 'ADJUSTMENT_IN' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">+ Entrada</span>
                          )}
                          {m.type === 'ADJUSTMENT_OUT' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-bold text-[10px]">- Salida</span>
                          )}
                          {m.type === 'RECEPTION' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full font-bold text-[10px]">Recepción</span>
                          )}
                          {m.type === 'SALE' && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">Venta</span>
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
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-xl text-sm cursor-pointer"
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
                                Nuevo
                              </span>
                            )}
                            {r.status === 'UPDATE' && (
                              <div className="flex flex-col items-center">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[10px]">
                                  Actualizar
                                </span>
                                <span className="text-[9px] text-blue-600 italic mt-0.5">Stock actual conservado</span>
                              </div>
                            )}
                            {r.status === 'ERROR' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-bold text-[10px]" title={r.errorReason}>
                                Error: {r.errorReason}
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

      {/* Barcode Scanner Modal */}
      {scannerTarget && (
        <BarcodeScannerModal
          isOpen={true}
          onClose={() => setScannerTarget(null)}
          onScan={(scannedBarcode) => {
            if (scannerTarget === 'create') {
              setCreateForm(prev => ({ ...prev, barcode: scannedBarcode }));
            } else if (scannerTarget === 'edit') {
              setEditForm(prev => ({ ...prev, barcode: scannedBarcode }));
            } else if (scannerTarget === 'search') {
              setSearchTerm(scannedBarcode);
            }
            setScannerTarget(null);
          }}
        />
      )}

    </div>
  );
};
