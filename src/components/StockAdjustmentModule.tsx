import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { Product, StockAdjustment, StockAdjustmentItem, StockAdjustmentType } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { 
  createDraftStockAdjustment, 
  updateStockAdjustmentDraft, 
  confirmStockAdjustmentTransaction, 
  createOfflineStockAdjustment,
  getStockAdjustmentsByBusiness, 
  deleteStockAdjustmentDraft, 
  REASONS_IN, 
  REASONS_OUT 
} from '../lib/stockAdjustmentService';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { hasPermission } from '../lib/permissions';
import { 
  Package, 
  Camera, 
  Plus, 
  Minus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowLeft, 
  History, 
  Trash2, 
  Check, 
  FileText, 
  Eye, 
  RefreshCw, 
  SlidersHorizontal, 
  ArrowRight, 
  ChevronRight, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export const StockAdjustmentModule: React.FC = () => {
  const { userProfile, business } = useAuth();

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'adjustment' | 'history'>('adjustment');
  
  // Selection mode: 'NONE' | 'IN' | 'OUT'
  const [adjustmentMode, setAdjustmentMode] = useState<'NONE' | 'IN' | 'OUT'>('NONE');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannedNotFoundCode, setScannedNotFoundCode] = useState<string | null>(null);

  // Selected product & item creation
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReasonInput, setCustomReasonInput] = useState<string>('');

  // Draft state
  const [draftAdjustment, setDraftAdjustment] = useState<StockAdjustment | null>(null);
  const [draftItems, setDraftItems] = useState<StockAdjustmentItem[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);

  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // History state
  const [historyAdjustments, setHistoryAdjustments] = useState<StockAdjustment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedHistoryAdjustment, setSelectedHistoryAdjustment] = useState<StockAdjustment | null>(null);

  const canPerformEntry = hasPermission(userProfile, 'inventory.stock_entry');
  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  // Input ref for closing mobile keyboard
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Load products
  const fetchProducts = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    try {
      const data = await getProductsByBusiness(business.id);
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products for stock adjustment:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [business?.id]);

  // Default reason initialization when mode changes
  useEffect(() => {
    if (adjustmentMode === 'IN') {
      setSelectedReason(REASONS_IN[0]);
    } else if (adjustmentMode === 'OUT') {
      setSelectedReason(REASONS_OUT[0]);
    }
    setCustomReasonInput('');
  }, [adjustmentMode]);

  // Load History
  const fetchHistory = async () => {
    if (!business?.id) return;
    setLoadingHistory(true);
    try {
      const data = await getStockAdjustmentsByBusiness(business.id);
      setHistoryAdjustments(data);
    } catch (err) {
      console.error('Error fetching stock adjustment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, business?.id]);

  // Filtered products for dropdown search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return products.filter(p => 
      p.active && (
        p.name.toLowerCase().includes(query) || 
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
      )
    ).slice(0, 10);
  }, [products, searchQuery]);

  // Ensure draft adjustment exists
  const ensureDraft = async (): Promise<StockAdjustment> => {
    if (draftAdjustment) return draftAdjustment;

    if (!business?.id || !userProfile?.uid) {
      throw new Error('Información de sesión incompleta.');
    }

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      const localDraft: StockAdjustment = {
        id: `adj_draft_${Date.now()}`,
        businessId: business.id,
        items: [],
        totalItemsCount: 0,
        totalUnitsCount: 0,
        status: 'DRAFT',
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Usuario',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generalNotes: ''
      };
      setDraftAdjustment(localDraft);
      setDraftItems([]);
      return localDraft;
    }

    try {
      const created = await createDraftStockAdjustment(
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Usuario'
      );
      setDraftAdjustment(created);
      setDraftItems([]);
      return created;
    } catch (draftErr) {
      console.warn('Could not create draft online, using local draft:', draftErr);
      const localDraft: StockAdjustment = {
        id: `adj_draft_${Date.now()}`,
        businessId: business.id,
        items: [],
        totalItemsCount: 0,
        totalUnitsCount: 0,
        status: 'DRAFT',
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Usuario',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        generalNotes: ''
      };
      setDraftAdjustment(localDraft);
      setDraftItems([]);
      return localDraft;
    }
  };

  // Handle Barcode Scan
  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const cleanCode = barcode.trim();
    const found = products.find(p => p.barcode && p.barcode.trim() === cleanCode && p.active);

    if (found) {
      setSelectedProduct(found);
      setQuantityInput(1);
      setScannedNotFoundCode(null);
    } else {
      setScannedNotFoundCode(cleanCode);
      setSelectedProduct(null);
    }
  };

  // Select product manually
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setQuantityInput(1);
    setSearchQuery('');
  };

  // Add Item to Draft
  const handleAddItemToAdjustment = async () => {
    if (!selectedProduct) return;
    if (adjustmentMode === 'NONE') return;

    const qty = Math.floor(Number(quantityInput));
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Ingresa una cantidad mayor a cero.');
      return;
    }

    // Negative adjustment validation: quantity <= current stock
    if (adjustmentMode === 'OUT') {
      if (qty > selectedProduct.stock) {
        setErrorMessage(`No puedes retirar ${qty} unidades. El stock disponible es de ${selectedProduct.stock}.`);
        return;
      }
    }

    // Reason validation
    const isCustom = selectedReason === 'Otro ingreso' || selectedReason === 'Otro ajuste';
    if (isCustom && !customReasonInput.trim()) {
      setErrorMessage('Por favor ingresa una descripción para el motivo especificado.');
      return;
    }

    setErrorMessage(null);

    // Close keyboard if open on mobile
    if (quantityInputRef.current) {
      quantityInputRef.current.blur();
    }

    try {
      setIsSavingDraft(true);
      const activeDraft = await ensureDraft();

      // Check if item already exists in draft list with SAME product and adjustmentType
      const updatedItems = [...draftItems];
      const existingIndex = updatedItems.findIndex(
        item => item.productId === selectedProduct.id && item.adjustmentType === adjustmentMode
      );

      const resolvedReason = isCustom ? customReasonInput.trim() : selectedReason;

      if (existingIndex >= 0) {
        // Accumulate quantity
        const existing = updatedItems[existingIndex];
        const newQty = existing.quantity + qty;

        if (adjustmentMode === 'OUT' && newQty > selectedProduct.stock) {
          setErrorMessage(`La cantidad acumulada (${newQty}) superaría el stock disponible (${selectedProduct.stock}).`);
          setIsSavingDraft(false);
          return;
        }

        updatedItems[existingIndex] = {
          ...existing,
          quantity: newQty,
          reason: resolvedReason,
          customReason: isCustom ? customReasonInput.trim() : undefined
        };
      } else {
        // Add new item
        const newItem: StockAdjustmentItem = {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          barcode: selectedProduct.barcode,
          category: selectedProduct.category,
          adjustmentType: adjustmentMode,
          quantity: qty,
          previousStock: selectedProduct.stock,
          reason: resolvedReason,
          customReason: isCustom ? customReasonInput.trim() : undefined
        };
        updatedItems.push(newItem);
      }

      if (activeDraft.id && !activeDraft.id.startsWith('adj_draft_') && navigator.onLine) {
        try {
          await updateStockAdjustmentDraft(
            activeDraft.id,
            updatedItems,
            userProfile?.uid,
            business?.id,
            isAdmin
          );
        } catch (updateErr) {
          console.warn('Could not sync draft update online, updated locally:', updateErr);
        }
      }

      setDraftItems(updatedItems);
      setDraftAdjustment(prev => prev ? { ...prev, items: updatedItems, totalItemsCount: updatedItems.length } : null);

      // Reset selection state
      setSelectedProduct(null);
      setQuantityInput(1);
      setCustomReasonInput('');

      setSuccessMessage(`✓ ${selectedProduct.name} agregado al ajuste (${adjustmentMode === 'IN' ? '+' : '-'}${qty})`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error('Error updating adjustment draft:', err);
      setErrorMessage(err.message || 'Error al agregar producto al ajuste.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Remove Item from Draft
  const handleRemoveItem = async (index: number) => {
    if (!draftAdjustment) return;
    const updated = draftItems.filter((_, i) => i !== index);

    try {
      setIsSavingDraft(true);
      if (draftAdjustment.id && !draftAdjustment.id.startsWith('adj_draft_') && navigator.onLine) {
        try {
          await updateStockAdjustmentDraft(
            draftAdjustment.id,
            updated,
            userProfile?.uid,
            business?.id,
            isAdmin
          );
        } catch (e) {}
      }
      setDraftItems(updated);
      setDraftAdjustment(prev => prev ? { ...prev, items: updated, totalItemsCount: updated.length } : null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar producto.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Update Item Quantity in Draft
  const handleUpdateItemQty = async (index: number, delta: number) => {
    if (!draftAdjustment) return;
    const item = draftItems[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await handleRemoveItem(index);
      return;
    }

    // Check stock if OUT
    if (item.adjustmentType === 'OUT' && item.previousStock !== undefined && newQty > item.previousStock) {
      setErrorMessage(`No se puede retirar más del stock disponible (${item.previousStock}).`);
      return;
    }

    const updated = [...draftItems];
    updated[index] = { ...item, quantity: newQty };

    try {
      setIsSavingDraft(true);
      if (draftAdjustment.id && !draftAdjustment.id.startsWith('adj_draft_') && navigator.onLine) {
        try {
          await updateStockAdjustmentDraft(
            draftAdjustment.id,
            updated,
            userProfile?.uid,
            business?.id,
            isAdmin
          );
        } catch (e) {}
      }
      setDraftItems(updated);
      setDraftAdjustment(prev => prev ? { ...prev, items: updated, totalItemsCount: updated.length } : null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar cantidad.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Confirm Adjustment Transaction
  const handleConfirmAdjustment = async () => {
    if (!draftAdjustment || draftItems.length === 0 || !business?.id || !userProfile?.uid) return;

    setIsConfirming(true);
    setErrorMessage(null);

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline || draftAdjustment.id.startsWith('adj_draft_')) {
      try {
        await createOfflineStockAdjustment(
          business.id,
          userProfile.uid,
          userProfile.displayName || userProfile.email || 'Usuario',
          draftItems,
          draftAdjustment.generalNotes || ''
        );

        await fetchProducts();

        setIsConfirmModalOpen(false);
        setDraftAdjustment(null);
        setDraftItems([]);
        setAdjustmentMode('NONE');
        setSelectedProduct(null);

        setSuccessMessage('📦 Ajuste de stock guardado localmente (Modo Offline). El inventario se actualizó y se sincronizará automáticamente.');
        setTimeout(() => setSuccessMessage(null), 6000);

        if (activeTab === 'history') {
          fetchHistory();
        }
        return;
      } catch (offlineErr: any) {
        console.error('Error creating offline stock adjustment:', offlineErr);
        setErrorMessage(offlineErr.message || 'Error al guardar el ajuste offline.');
        return;
      } finally {
        setIsConfirming(false);
      }
    }

    try {
      await confirmStockAdjustmentTransaction(
        draftAdjustment.id,
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Usuario',
        isAdmin
      );

      // Refresh product list stock
      await fetchProducts();

      setIsConfirmModalOpen(false);
      setDraftAdjustment(null);
      setDraftItems([]);
      setAdjustmentMode('NONE');
      setSelectedProduct(null);

      setSuccessMessage('🎉 ¡Ajuste de stock verificado y aplicado exitosamente al inventario!');
      setTimeout(() => setSuccessMessage(null), 5000);

      // Refresh history if opened
      if (activeTab === 'history') {
        fetchHistory();
      }

    } catch (err: any) {
      console.warn('Error online confirming stock adjustment, falling back to Outbox offline:', err);
      try {
        await createOfflineStockAdjustment(
          business.id,
          userProfile.uid,
          userProfile.displayName || userProfile.email || 'Usuario',
          draftItems,
          draftAdjustment.generalNotes || ''
        );

        await fetchProducts();

        setIsConfirmModalOpen(false);
        setDraftAdjustment(null);
        setDraftItems([]);
        setAdjustmentMode('NONE');
        setSelectedProduct(null);

        setSuccessMessage('📦 Ajuste de stock guardado en Outbox (Modo Offline). Se sincronizará automáticamente.');
        setTimeout(() => setSuccessMessage(null), 6000);

        if (activeTab === 'history') {
          fetchHistory();
        }
      } catch (fallbackErr: any) {
        setErrorMessage(fallbackErr.message || err.message || 'Error al confirmar la transacción de ajuste.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  // Cancel / Discard Draft
  const handleDiscardDraft = async () => {
    if (!draftAdjustment || !business?.id || !userProfile?.uid) {
      setDraftAdjustment(null);
      setDraftItems([]);
      setAdjustmentMode('NONE');
      return;
    }

    if (window.confirm('¿Deseas descartar este borrador de ajuste?')) {
      try {
        await deleteStockAdjustmentDraft(
          draftAdjustment.id,
          userProfile.uid,
          business.id,
          isAdmin
        );
      } catch (err) {
        console.error('Error discarding draft:', err);
      } finally {
        setDraftAdjustment(null);
        setDraftItems([]);
        setAdjustmentMode('NONE');
        setSelectedProduct(null);
      }
    }
  };

  if (!canPerformEntry) {
    return (
      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
        <div>
          <h3 className="font-bold text-base">Acceso Restringido</h3>
          <p className="text-sm">No posees el permiso <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-xs">inventory.stock_entry</code> para realizar ajustes o cargas de stock.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* HEADER CARD */}
      <div className="bg-stone-900 text-white p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Package className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Ajuste de Stock</h1>
          </div>
          <p className="text-stone-400 text-xs sm:text-sm">
            Carga rápida y controlada de inventario (ingresos y diferencias)
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex bg-stone-800 p-1 rounded-2xl border border-stone-700/60 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('adjustment')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'adjustment'
                ? 'bg-amber-400 text-stone-950 shadow-md'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            NUEVO AJUSTE
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-amber-400 text-stone-950 shadow-md'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            <History className="w-4 h-4" />
            HISTORIAL
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-emerald-900 font-medium text-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-red-900 font-medium text-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-red-100 rounded-lg text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 1: NUEVO AJUSTE                       */}
      {/* ========================================= */}
      {activeTab === 'adjustment' && (
        <div className="space-y-4">
          
          {/* STEP 1: INITIAL CHOICE BUTTONS (When no mode selected) */}
          {adjustmentMode === 'NONE' && draftItems.length === 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm text-center space-y-6">
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="text-xl font-bold text-stone-900">¿Qué tipo de ajuste deseas realizar?</h2>
                <p className="text-stone-500 text-xs sm:text-sm">
                  Selecciona la dirección del movimiento para comenzar a escanear o ingresar productos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-2">
                {/* INGRESAR STOCK */}
                <button
                  onClick={() => setAdjustmentMode('IN')}
                  className="p-6 rounded-3xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/80 transition-all flex flex-col items-center justify-center gap-3 text-emerald-950 group shadow-2xs hover:shadow-md active:scale-98"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8 stroke-[3]" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-black text-emerald-900">＋ INGRESAR STOCK</span>
                    <span className="text-xs text-emerald-700 font-medium">Productos recibidos por dueño, hallados en depósito, etc.</span>
                  </div>
                </button>

                {/* RETIRAR STOCK */}
                <button
                  onClick={() => setAdjustmentMode('OUT')}
                  className="p-6 rounded-3xl border-2 border-amber-500 bg-amber-50/50 hover:bg-amber-100/80 transition-all flex flex-col items-center justify-center gap-3 text-amber-950 group shadow-2xs hover:shadow-md active:scale-98"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Minus className="w-8 h-8 stroke-[3]" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-black text-amber-950">− RETIRAR / AJUSTAR</span>
                    <span className="text-xs text-amber-800 font-medium">Faltante físico, producto dañado, merma, vencido</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* MODE BADGER & SELECTION PANEL */}
          {(adjustmentMode !== 'NONE' || draftItems.length > 0) && (
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-sm space-y-4">
              
              {/* MODE HEADER BAR */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Modo de Operación:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAdjustmentMode('IN')}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                        adjustmentMode === 'IN'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      INGRESAR (+ STOCK)
                    </button>

                    <button
                      onClick={() => setAdjustmentMode('OUT')}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                        adjustmentMode === 'OUT'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-amber-50 hover:text-amber-700'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[3]" />
                      RETIRAR (- STOCK)
                    </button>
                  </div>
                </div>

                {draftItems.length > 0 && (
                  <button
                    onClick={handleDiscardDraft}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Descartar Borrador
                  </button>
                )}
              </div>

              {/* SEARCH & SCANNER ACTION BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setScannedNotFoundCode(null);
                    setIsScannerOpen(true);
                  }}
                  className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 active:scale-98 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all"
                >
                  <Camera className="w-5 h-5 text-amber-400" />
                  📷 ESCANEAR PRODUCTO
                </button>

                {/* SEARCH INPUT DROPDOWN */}
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="🔎 Buscar por nombre o código..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* SEARCH DROPDOWN RESULTS */}
                  {filteredProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-stone-200 shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-stone-100">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className="w-full p-3 text-left hover:bg-amber-50/70 transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div>
                            <span className="font-bold text-sm text-stone-900 block group-hover:text-amber-950">{p.name}</span>
                            <span className="text-xs text-stone-500 font-mono">
                              {p.barcode ? `Cód: ${p.barcode}` : 'Sin código'} • {p.category || 'General'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded-lg">
                              Stock: {p.stock}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* BARCODE SCANNED NOT FOUND ALERT */}
              {scannedNotFoundCode && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-bold">Producto no encontrado</p>
                      <p className="text-xs text-amber-800">Código escaneado: <code className="font-mono bg-amber-100 px-1 rounded">{scannedNotFoundCode}</code></p>
                    </div>
                  </div>
                  <button
                    onClick={() => setScannedNotFoundCode(null)}
                    className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl text-xs font-bold"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {/* SELECTED PRODUCT FORM CARD */}
              {selectedProduct && (
                <div className="p-4 sm:p-5 bg-stone-50 rounded-2xl border-2 border-amber-400/80 space-y-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">Producto Seleccionado</span>
                      <h3 className="text-lg font-black text-stone-900">{selectedProduct.name}</h3>
                      <p className="text-xs text-stone-500 font-mono">
                        {selectedProduct.barcode ? `Cód: ${selectedProduct.barcode}` : 'Sin código'} • Categoría: {selectedProduct.category || 'General'}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedProduct(null)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* CURRENT vs ADJUSTED STOCK PREVIEW CARD */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-stone-200 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase block">Stock Actual</span>
                      <span className="text-base font-black text-stone-800">{selectedProduct.stock}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase block">
                        {adjustmentMode === 'IN' ? 'Ingreso (+)' : 'Retiro (-)'}
                      </span>
                      <span className={`text-base font-black ${adjustmentMode === 'IN' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {adjustmentMode === 'IN' ? `+${quantityInput}` : `-${quantityInput}`}
                      </span>
                    </div>

                    <div className="bg-amber-50/80 rounded-lg p-1 border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block">Resultante</span>
                      <span className="text-base font-black text-amber-950">
                        {adjustmentMode === 'IN' ? selectedProduct.stock + quantityInput : selectedProduct.stock - quantityInput}
                      </span>
                    </div>
                  </div>

                  {/* QUANTITY TOUCH CONTROLS */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 block">Cantidad a {adjustmentMode === 'IN' ? 'ingresar' : 'retirar'}:</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantityInput(prev => Math.max(1, prev - 1))}
                        className="w-12 h-12 bg-white hover:bg-stone-100 border-2 border-stone-300 rounded-xl font-black text-xl flex items-center justify-center text-stone-800 active:scale-95 transition-all shadow-2xs"
                      >
                        -
                      </button>

                      <input
                        ref={quantityInputRef}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={adjustmentMode === 'OUT' ? selectedProduct.stock : 99999}
                        value={quantityInput || ''}
                        onChange={(e) => {
                          const val = Math.floor(Number(e.target.value));
                          setQuantityInput(isNaN(val) || val <= 0 ? 1 : val);
                        }}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-full h-12 text-center text-xl font-black bg-white border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                      />

                      <button
                        type="button"
                        onClick={() => setQuantityInput(prev => prev + 1)}
                        className="w-12 h-12 bg-white hover:bg-stone-100 border-2 border-stone-300 rounded-xl font-black text-xl flex items-center justify-center text-stone-800 active:scale-95 transition-all shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    {/* QUICK ACCESSIBLE BUTTONS */}
                    <div className="flex gap-2">
                      {[1, 5, 10, 20].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setQuantityInput(prev => prev + inc)}
                          className="flex-1 py-1.5 bg-white hover:bg-amber-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 transition-all active:scale-95"
                        >
                          +{inc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MANDATORY REASON SELECTION */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 block">Motivo Obligatorio:</label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full p-3 bg-white border border-stone-300 rounded-xl text-sm font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      {(adjustmentMode === 'IN' ? REASONS_IN : REASONS_OUT).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>

                    {/* CUSTOM REASON TEXT INPUT */}
                    {(selectedReason === 'Otro ingreso' || selectedReason === 'Otro ajuste') && (
                      <input
                        type="text"
                        placeholder="Especifica el motivo en detalle..."
                        value={customReasonInput}
                        onChange={(e) => setCustomReasonInput(e.target.value)}
                        className="w-full p-3 bg-white border border-amber-400 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 animate-fade-in"
                      />
                    )}
                  </div>

                  {/* ADD TO ADJUSTMENT BUTTON */}
                  <button
                    onClick={handleAddItemToAdjustment}
                    disabled={isSavingDraft || (adjustmentMode === 'OUT' && quantityInput > selectedProduct.stock)}
                    className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 ${
                      adjustmentMode === 'OUT' && quantityInput > selectedProduct.stock
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : adjustmentMode === 'IN'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {isSavingDraft ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 stroke-[3]" />
                        AGREGAR AL AJUSTE ({adjustmentMode === 'IN' ? '+' : '-'}{quantityInput})
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DRAFT ITEMS LIST (CART) */}
          {draftItems.length > 0 && (
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    Lista de Ajustes Pendientes
                  </h3>
                  <p className="text-xs text-stone-500">
                    {draftItems.length} producto(s) en este borrador
                  </p>
                </div>

                <span className="text-xs font-bold bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-200">
                  Borrador en curso
                </span>
              </div>

              {/* ITEMS LIST */}
              <div className="space-y-2.5">
                {draftItems.map((item, idx) => (
                  <div
                    key={`${item.productId}_${item.adjustmentType}_${idx}`}
                    className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-100/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                          item.adjustmentType === 'IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-950'
                        }`}>
                          {item.adjustmentType === 'IN' ? '＋ Ingreso' : '− Retiro'}
                        </span>
                        <span className="font-bold text-sm text-stone-900">{item.productName}</span>
                      </div>

                      <div className="text-xs text-stone-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Motivo: <strong className="text-stone-700">{item.reason}</strong></span>
                        {item.previousStock !== undefined && (
                          <span>
                            Stock: {item.previousStock} → <strong className="text-stone-900">
                              {item.adjustmentType === 'IN' ? item.previousStock + item.quantity : item.previousStock - item.quantity}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* QUANTITY EDIT CONTROLS */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1">
                        <button
                          onClick={() => handleUpdateItemQty(idx, -1)}
                          className="w-7 h-7 hover:bg-stone-100 rounded-lg font-bold text-stone-700 flex items-center justify-center text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-black text-stone-900 text-sm">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateItemQty(idx, 1)}
                          className="w-7 h-7 hover:bg-stone-100 rounded-lg font-bold text-stone-700 flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Eliminar ítem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* CONFIRMATION ACTION BUTTON */}
              <div className="pt-2">
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="w-full py-4 bg-stone-900 hover:bg-stone-800 active:scale-98 text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  REVISAR Y CONFIRMAR AJUSTE ({draftItems.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 2: HISTORIAL DE AJUSTES               */}
      {/* ========================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h2 className="font-black text-stone-900 text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              Historial de Ajustes
            </h2>

            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
              title="Actualizar historial"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-stone-400 font-medium text-sm">
              Cargando historial de ajustes...
            </div>
          ) : historyAdjustments.length === 0 ? (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <Package className="w-12 h-12 mx-auto text-stone-300 stroke-1" />
              <p className="font-bold text-stone-600">No hay ajustes registrados aún</p>
              <p className="text-xs">Los movimientos de ajuste de stock confirmados aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="p-4 bg-stone-50 rounded-2xl border border-stone-200 hover:border-amber-300 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          adj.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {adj.status === 'CONFIRMED' ? 'Confirmado' : adj.status === 'DRAFT' ? 'Borrador' : adj.status}
                        </span>
                        <span className="text-xs font-mono text-stone-500">
                          {new Date(adj.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Registrado por: <strong className="text-stone-900">{adj.creatorName || 'Usuario'}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedHistoryAdjustment(adj)}
                      className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-amber-50 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      Ver Ítems
                    </button>
                  </div>

                  {/* SUMMARY MINI BADGES */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-stone-200/60 text-xs">
                    <span className="font-medium text-stone-600">
                      📦 <strong>{adj.totalItemsCount || adj.items?.length || 0}</strong> producto(s)
                    </span>
                    <span className="font-medium text-stone-600">
                      🔢 <strong>{adj.totalUnitsCount || 0}</strong> unidad(es)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* CONFIRMATION BREAKDOWN MODAL               */}
      {/* ========================================= */}
      {isConfirmModalOpen && draftAdjustment && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-stone-200 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-stone-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <h3 className="text-lg font-black">Confirmar Ajuste de Stock</h3>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isConfirming}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Revisa los productos. Al confirmar, los stocks cambiarán atómicamente y se creará el movimiento auditado correspondiente.
            </p>

            {/* BREAKDOWN TABLE */}
            <div className="overflow-y-auto flex-1 space-y-2 border border-stone-200 rounded-2xl p-3 bg-stone-50/50 divide-y divide-stone-100">
              {draftItems.map((item, idx) => (
                <div key={idx} className="pt-2 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-stone-900">{item.productName}</span>
                    <span className={`font-black text-xs px-2 py-0.5 rounded ${
                      item.adjustmentType === 'IN' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'
                    }`}>
                      {item.adjustmentType === 'IN' ? `+${item.quantity}` : `-${item.quantity}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-stone-500">
                    <span>Motivo: <span className="font-medium text-stone-700">{item.reason}</span></span>
                    {item.previousStock !== undefined && (
                      <span>
                        Stock: {item.previousStock} → <strong className="text-stone-900 font-bold">
                          {item.adjustmentType === 'IN' ? item.previousStock + item.quantity : item.previousStock - item.quantity}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isConfirming}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-all"
              >
                Volver
              </button>

              <button
                onClick={handleConfirmAdjustment}
                disabled={isConfirming}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50"
              >
                {isConfirming ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[3]" />
                    SÍ, CONFIRMAR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* HISTORY DETAILS MODAL                     */}
      {/* ========================================= */}
      {selectedHistoryAdjustment && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-black text-stone-900">Detalle de Ajuste</h3>
                <p className="text-xs text-stone-500">{new Date(selectedHistoryAdjustment.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedHistoryAdjustment(null)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <p><strong>Registrado por:</strong> {selectedHistoryAdjustment.creatorName || 'Usuario'}</p>
              <p><strong>Confirmado por:</strong> {selectedHistoryAdjustment.confirmerName || selectedHistoryAdjustment.creatorName || 'Usuario'}</p>
              <p><strong>Estado:</strong> <span className="font-bold text-emerald-700">{selectedHistoryAdjustment.status === 'CONFIRMED' ? 'Confirmado' : selectedHistoryAdjustment.status === 'DRAFT' ? 'Borrador' : selectedHistoryAdjustment.status}</span></p>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 border border-stone-200 rounded-2xl p-3 divide-y divide-stone-100">
              {selectedHistoryAdjustment.items?.map((item, idx) => (
                <div key={idx} className="pt-2 first:pt-0 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-stone-900 text-sm">
                    <span>{item.productName}</span>
                    <span className={item.adjustmentType === 'IN' ? 'text-emerald-600' : 'text-amber-600'}>
                      {item.adjustmentType === 'IN' ? `+${item.quantity}` : `-${item.quantity}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Motivo: <strong>{item.reason}</strong></span>
                    {item.previousStock !== undefined && item.newStock !== undefined && (
                      <span>Stock: {item.previousStock} → <strong className="text-stone-900">{item.newStock}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedHistoryAdjustment(null)}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-2xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />
    </div>
  );
};
