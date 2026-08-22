import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { Product, Purchase, PurchaseItem, UserProfile } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { 
  getCashBalance, 
  getPurchasesByBusiness, 
  createPurchaseDraft, 
  confirmPurchaseTransaction,
  deletePurchaseDraft,
  consolidatePurchaseItems
} from '../lib/purchaseService';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { hasPermission } from '../lib/permissions';
import { findMatchingSupplier, getUniqueSuppliers, normalizeText } from '../lib/categoryUtils';
import { 
  ShoppingBag, 
  Camera, 
  Plus, 
  Minus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowLeft, 
  Receipt, 
  Calendar, 
  Trash2, 
  Check, 
  ShieldAlert, 
  FileText, 
  RefreshCw,
  DollarSign,
  Info,
  Banknote,
  Store,
  ChevronRight,
  Package,
  Truck
} from 'lucide-react';

interface PurchaseModuleProps {
  onBack?: () => void;
}

export const PurchaseModule: React.FC<PurchaseModuleProps> = ({ onBack }) => {
  const { userProfile, business } = useAuth();

  // Permissions checks
  const canRegisterPurchase = hasPermission(userProfile, 'purchases.create');
  const canPayWithCash = hasPermission(userProfile, 'cash.purchase_payment');
  const canEntryStock = hasPermission(userProfile, 'inventory.stock_entry');
  const canViewPurchases = hasPermission(userProfile, 'purchases.view');

  // View state: 'NEW_PURCHASE' | 'HISTORY' | 'SUCCESS'
  const [activeTab, setActiveTab] = useState<'NEW_PURCHASE' | 'HISTORY'>(
    canRegisterPurchase ? 'NEW_PURCHASE' : 'HISTORY'
  );

  // General state
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [loadingCash, setLoadingCash] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  
  // Purchases history state
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState<boolean>(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);

  // New Purchase Form state
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierSuggestionsOpen, setSupplierSuggestionsOpen] = useState<boolean>(false);
  const [supplierHighlightIdx, setSupplierHighlightIdx] = useState<number>(-1);
  const [hasReceipt, setHasReceipt] = useState<boolean>(false);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [cartItems, setCartItems] = useState<PurchaseItem[]>([]);

  // Item selector state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [productHighlightIdx, setProductHighlightIdx] = useState<number>(-1);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitCost, setItemUnitCost] = useState<string>('');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerFeedback, setScannerFeedback] = useState<string | null>(null);

  // Confirmation modal & processing
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPurchase, setSuccessPurchase] = useState<Purchase | null>(null);

  // Unique known suppliers
  const knownSuppliers = useMemo(() => {
    return getUniqueSuppliers(purchases.map(p => p.supplierName || (p as any).supplier));
  }, [purchases]);

  // Filtered supplier suggestions
  const matchingSuppliers = useMemo(() => {
    if (!supplierName.trim()) return knownSuppliers.slice(0, 8);
    const q = normalizeText(supplierName).toLowerCase();
    return knownSuppliers.filter(s => normalizeText(s).toLowerCase().includes(q)).slice(0, 8);
  }, [knownSuppliers, supplierName]);

  // Matched canonical supplier
  const canonicalSupplierMatch = useMemo(() => {
    return findMatchingSupplier(supplierName, knownSuppliers);
  }, [supplierName, knownSuppliers]);

  // Load initial data
  const loadCash = async () => {
    if (!business?.id) return;
    setLoadingCash(true);
    try {
      const balance = await getCashBalance(business.id);
      setCashBalance(balance);
    } catch (err) {
      console.error('Error fetching cash balance:', err);
    } finally {
      setLoadingCash(false);
    }
  };

  const loadProductsList = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    try {
      const list = await getProductsByBusiness(business.id);
      // Only active products
      setProducts(list.filter((p) => p.active !== false));
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadPurchasesHistory = async () => {
    if (!business?.id) return;
    setLoadingPurchases(true);
    try {
      const list = await getPurchasesByBusiness(business.id);
      setPurchases(list);
    } catch (err) {
      console.error('Error fetching purchases:', err);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadCash(), loadProductsList(), canViewPurchases ? loadPurchasesHistory() : Promise.resolve()]);
  };

  useEffect(() => {
    if (business?.id) {
      loadCash();
      loadProductsList();
      if (canViewPurchases) {
        loadPurchasesHistory();
      }
    }
  }, [business?.id]);

  // Selected Product helper
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Update default cost price when selected product changes
  useEffect(() => {
    if (selectedProduct) {
      setItemUnitCost(String(selectedProduct.costPrice || 0));
    } else {
      setItemUnitCost('');
    }
  }, [selectedProduct]);

  // Filter products for dropdown
  const filteredProducts = useMemo(() => {
    if (!searchProductQuery.trim()) return products.slice(0, 20);
    const q = searchProductQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [products, searchProductQuery]);

  // Total calculation for current cart
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cartItems]);

  // Handle adding product to cart (consolidates if duplicate)
  const handleAddProductToCart = () => {
    if (!selectedProduct) return;
    const qty = Number(itemQuantity);
    const cost = Number(itemUnitCost);

    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Ingresa una cantidad válida mayor a 0.');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setErrorMessage('Ingresa un costo unitario válido (≥ 0).');
      return;
    }

    setErrorMessage(null);

    const newItem: PurchaseItem = {
      productId: selectedProduct.id!,
      productName: selectedProduct.name,
      barcode: selectedProduct.barcode || null,
      category: selectedProduct.category,
      quantity: qty,
      unitCost: cost,
      subtotal: qty * cost
    };

    setCartItems((prev) => consolidatePurchaseItems([...prev, newItem]));

    // Reset item selector
    setSelectedProductId('');
    setSearchProductQuery('');
    setItemQuantity(1);
    setItemUnitCost('');
  };

  // Remove item from cart
  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Barcode Scanner result
  const handleBarcodeScanned = (scannedCode: string) => {
    setIsScannerOpen(false);
    if (!scannedCode) return;

    const matched = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === scannedCode.trim().toLowerCase()
    );

    if (matched) {
      setSelectedProductId(matched.id!);
      setItemQuantity(1);
      setItemUnitCost(String(matched.costPrice || 0));
      setScannerFeedback(`✅ Encontrado: ${matched.name}`);
      setTimeout(() => setScannerFeedback(null), 3000);
    } else {
      setSearchProductQuery(scannedCode);
      setScannerFeedback(`⚠️ Producto con código "${scannedCode}" no encontrado. Puedes crearlo o buscarlo manualmente.`);
    }
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (!userProfile || !business?.id) return;
    if (cartItems.length === 0) {
      setErrorMessage('Agrega al menos un producto para guardar el borrador.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const draft = await createPurchaseDraft({
        businessId: business.id,
        supplierName: supplierName,
        hasReceipt: hasReceipt,
        receiptNumber: receiptNumber,
        items: cartItems,
        total: cartTotal,
        paymentMethod: 'EFECTIVO',
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email
      });

      setSuccessPurchase(draft);
      loadPurchasesHistory();
      resetForm();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error guardando el borrador.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Confirm & Execute Purchase Transaction
  const handleConfirmPurchase = async () => {
    if (!userProfile || !business?.id) return;
    if (cartItems.length === 0) {
      setErrorMessage('Agrega al menos un producto a la compra.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // 1. Create Draft first
      const draft = await createPurchaseDraft({
        businessId: business.id,
        supplierName: supplierName,
        hasReceipt: hasReceipt,
        receiptNumber: receiptNumber,
        items: cartItems,
        total: cartTotal,
        paymentMethod: 'EFECTIVO',
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email
      });

      // 2. Execute Atomic Transaction
      await confirmPurchaseTransaction({
        purchaseId: draft.id,
        user: userProfile
      });

      // Update success state
      setSuccessPurchase({
        ...draft,
        status: 'CONFIRMED',
        confirmedBy: userProfile.uid,
        confirmerName: userProfile.displayName || userProfile.email,
        confirmedAt: new Date().toISOString()
      });

      // Refresh cash balance & history
      await loadCash();
      await loadPurchasesHistory();
      setIsConfirmModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('Error confirming purchase:', err);
      if (err.message?.includes('FONDOS_INSUFICIENTES')) {
        setErrorMessage(err.message.replace('FONDOS_INSUFICIENTES: ', ''));
      } else {
        setErrorMessage(err.message || 'Error al confirmar la compra.');
      }
      setIsConfirmModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSupplierName('');
    setHasReceipt(false);
    setReceiptNumber('');
    setCartItems([]);
    setSelectedProductId('');
    setSearchProductQuery('');
    setItemQuantity(1);
    setItemUnitCost('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Permission Guard
  if (!canRegisterPurchase && !canViewPurchases) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-stone-900">Acceso No Autorizado</h3>
        <p className="text-sm text-stone-600">
          No tienes permisos para acceder al módulo de compras. Consulta con tu administrador.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-stone-800 text-white font-bold rounded-xl text-sm"
          >
            Volver
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200"
                title="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900 leading-tight">Compras Directas</h2>
              <p className="text-xs text-stone-500 font-medium">Registro de Compra + Egreso de Caja + Stock</p>
            </div>
          </div>

          {/* Cash Balance Indicator & Refresh */}
          <div className="flex items-center space-x-2 bg-stone-900 text-white px-4 py-2.5 rounded-2xl shadow-xs">
            <Banknote className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold tracking-wider text-stone-400 uppercase block leading-none">
                Caja Disponible
              </span>
              <span className="text-lg font-black font-mono text-emerald-400 leading-tight">
                {loadingCash ? '...' : formatCurrency(cashBalance)}
              </span>
            </div>
            <button
              onClick={handleRefreshAll}
              disabled={loadingCash || loadingProducts}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors ml-1 cursor-pointer"
              title="Actualizar datos y saldo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCash || loadingProducts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-stone-100 p-1 rounded-2xl">
          {canRegisterPurchase && (
            <button
              onClick={() => {
                setActiveTab('NEW_PURCHASE');
                setSuccessPurchase(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'NEW_PURCHASE'
                  ? 'bg-amber-500 text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>NUEVA COMPRA</span>
            </button>
          )}

          {canViewPurchases && (
            <button
              onClick={() => {
                setActiveTab('HISTORY');
                setSuccessPurchase(null);
                loadPurchasesHistory();
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>HISTORIAL COMPRAS</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start space-x-3 text-red-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-extrabold text-red-900 mb-0.5">Atención:</h4>
            <p className="font-medium">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUCCESS SCREEN STATE */}
      {successPurchase && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <span className="px-3 py-1 bg-emerald-200 text-emerald-900 text-xs font-black rounded-full uppercase tracking-wider">
              {successPurchase.status === 'CONFIRMED' ? '✅ COMPRA CONFIRMADA' : '💾 BORRADOR GUARDADO'}
            </span>
            <h3 className="text-xl font-black text-stone-900 mt-2">
              {successPurchase.status === 'CONFIRMED'
                ? '¡Compra y Egreso de Caja Registrados!'
                : 'Borrador Guardado Exitosamente'}
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Proveedor: <strong className="font-bold text-stone-900">{successPurchase.supplierName || 'Sin Nombre'}</strong> | Total: <strong className="font-bold text-emerald-800 font-mono">{formatCurrency(successPurchase.total)}</strong>
            </p>
          </div>

          {successPurchase.status === 'CONFIRMED' && (
            <div className="bg-white/80 rounded-2xl p-4 border border-emerald-200 text-left text-xs space-y-1 text-stone-700 max-w-md mx-auto">
              <p>• <strong>Egreso de Caja:</strong> -{formatCurrency(successPurchase.total)} (Efectivo)</p>
              <p>• <strong>Ingreso a Stock:</strong> {successPurchase.items?.reduce((sum, i) => sum + i.quantity, 0)} unidades agregadas al inventario.</p>
              <p>• <strong>Registrado por:</strong> {successPurchase.creatorName}</p>
            </div>
          )}

          <div className="pt-2 flex justify-center space-x-3">
            <button
              onClick={() => {
                setSuccessPurchase(null);
                setActiveTab('NEW_PURCHASE');
              }}
              className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-2xl text-xs flex items-center space-x-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>REALIZAR OTRA COMPRA</span>
            </button>
          </div>
        </div>
      )}

      {/* NEW PURCHASE TAB */}
      {activeTab === 'NEW_PURCHASE' && !successPurchase && (
        <div className="space-y-6">

          {/* Step 1: Supplier & Receipt Header Form */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-amber-600" />
              1. Datos del Proveedor y Comprobante
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Supplier Input with predictive autocomplete */}
              <div className="space-y-1 relative">
                <label className="text-xs font-bold text-stone-700 block">
                  Proveedor / Comercio <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierName}
                    onFocus={() => setSupplierSuggestionsOpen(true)}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      setSupplierSuggestionsOpen(true);
                      setSupplierHighlightIdx(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSupplierSuggestionsOpen(true);
                        setSupplierHighlightIdx((prev) => 
                          prev < matchingSuppliers.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSupplierSuggestionsOpen(true);
                        setSupplierHighlightIdx((prev) => 
                          prev > 0 ? prev - 1 : matchingSuppliers.length - 1
                        );
                      } else if (e.key === 'Enter') {
                        if (supplierSuggestionsOpen && supplierHighlightIdx >= 0 && matchingSuppliers[supplierHighlightIdx]) {
                          e.preventDefault();
                          setSupplierName(matchingSuppliers[supplierHighlightIdx]);
                          setSupplierSuggestionsOpen(false);
                          setSupplierHighlightIdx(-1);
                        }
                      } else if (e.key === 'Escape') {
                        setSupplierSuggestionsOpen(false);
                        setSupplierHighlightIdx(-1);
                      }
                    }}
                    placeholder="Ej: Panadería La Esquina, Distribuidora San Martín..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                  />
                  {supplierName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierName('');
                        setSupplierSuggestionsOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Match Banner if different casing */}
                {canonicalSupplierMatch && canonicalSupplierMatch !== supplierName.trim() && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center justify-between mt-1">
                    <span>Existe: <strong>{canonicalSupplierMatch}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSupplierName(canonicalSupplierMatch)}
                      className="underline font-bold text-amber-900 hover:text-amber-950 text-[10px] ml-2"
                    >
                      Usar existente
                    </button>
                  </div>
                )}

                {/* Predictive suggestions dropdown */}
                {supplierSuggestionsOpen && matchingSuppliers.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-20" 
                      onClick={() => setSupplierSuggestionsOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-stone-100">
                      {matchingSuppliers.map((sup, idx) => (
                        <div
                          key={sup}
                          onClick={() => {
                            setSupplierName(sup);
                            setSupplierSuggestionsOpen(false);
                            setSupplierHighlightIdx(-1);
                          }}
                          className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            idx === supplierHighlightIdx ? 'bg-amber-100 text-amber-950 font-bold' : 'hover:bg-stone-50 text-stone-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{sup}</span>
                          </div>
                          {supplierName.trim().toLowerCase() === sup.toLowerCase() && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Receipt Toggle & Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700 block">Comprobante / Factura</label>
                <div className="flex items-center space-x-3 pt-1">
                  <label className="flex items-center space-x-2 text-xs font-bold text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasReceipt}
                      onChange={(e) => setHasReceipt(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Tiene comprobante</span>
                  </label>

                  {hasReceipt && (
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="N° de factura / ticket"
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-mono"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Add Products Section */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-600" />
                2. Agregar Productos a la Compra
              </h3>

              {/* Scanner Trigger Button */}
              <button
                onClick={() => setIsScannerOpen(true)}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold rounded-xl text-xs flex items-center space-x-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4 text-amber-700" />
                <span>Escanear código</span>
              </button>
            </div>

            {scannerFeedback && (
              <div className="text-xs font-bold p-2.5 bg-stone-100 rounded-xl border border-stone-200 text-stone-800">
                {scannerFeedback}
              </div>
            )}

            {/* Search or Select Product with Keyboard Navigation */}
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 block">Buscar o seleccionar producto</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchProductQuery}
                    onChange={(e) => {
                      setSearchProductQuery(e.target.value);
                      setProductHighlightIdx(-1);
                      if (selectedProductId) setSelectedProductId('');
                    }}
                    onKeyDown={(e) => {
                      if (!selectedProduct && filteredProducts.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setProductHighlightIdx((prev) => 
                            prev < filteredProducts.length - 1 ? prev + 1 : 0
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setProductHighlightIdx((prev) => 
                            prev > 0 ? prev - 1 : filteredProducts.length - 1
                          );
                        } else if (e.key === 'Enter') {
                          if (productHighlightIdx >= 0 && filteredProducts[productHighlightIdx]) {
                            e.preventDefault();
                            const p = filteredProducts[productHighlightIdx];
                            setSelectedProductId(p.id!);
                            setSearchProductQuery(p.name);
                            setProductHighlightIdx(-1);
                          }
                        } else if (e.key === 'Escape') {
                          setSearchProductQuery('');
                          setProductHighlightIdx(-1);
                        }
                      }
                    }}
                    placeholder="Escribe el nombre o código de barras (usa flechas ↑↓ y Enter)..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs bg-white font-medium"
                  />
                  {searchProductQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchProductQuery('');
                        setSelectedProductId('');
                        setProductHighlightIdx(-1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product Selector Dropdown / Search Results */}
              {searchProductQuery.trim() !== '' && !selectedProduct && (
                <div className="max-h-48 overflow-y-auto bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 shadow-xs">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-xs text-stone-500 text-center">
                      No se encontraron productos coincidentes.
                    </div>
                  ) : (
                    filteredProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id!);
                          setSearchProductQuery(p.name);
                          setProductHighlightIdx(-1);
                        }}
                        className={`p-2.5 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                          idx === productHighlightIdx ? 'bg-amber-100 font-bold' : 'hover:bg-amber-50'
                        }`}
                      >
                        <div>
                          <p className="font-extrabold text-stone-900">{p.name}</p>
                          <p className="text-[10px] text-stone-500 font-mono">
                            Código: {p.barcode || 'S/N'} | Stock actual: {p.stock}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-stone-600 font-mono">
                          Costo sugerido: {formatCurrency(p.costPrice || 0)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Selected Product Card & Quantity/Cost Inputs */}
              {selectedProduct && (
                <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 space-y-4 shadow-2xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded-md uppercase">
                        Producto Seleccionado
                      </span>
                      <h4 className="font-black text-stone-900 text-sm mt-1">{selectedProduct.name}</h4>
                      <p className="text-xs text-stone-500 font-mono">
                        Código: {selectedProduct.barcode || 'S/N'} | Stock actual: <strong className="text-stone-800">{selectedProduct.stock} u.</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProductId('');
                        setSearchProductQuery('');
                      }}
                      className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                    {/* Quantity Selector */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 block">Cantidad a ingresar</label>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                          className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-300 flex items-center justify-center font-bold text-stone-800 hover:bg-stone-200 active:scale-95 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddProductToCart();
                            }
                          }}
                          className="flex-1 py-2 text-center rounded-xl border border-stone-300 text-sm font-black font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setItemQuantity((q) => q + 1)}
                          className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-300 flex items-center justify-center font-bold text-stone-800 hover:bg-stone-200 active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quick Qty Buttons */}
                      <div className="flex space-x-1 pt-1">
                        {[1, 3, 5, 10, 12].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setItemQuantity(num)}
                            className="flex-1 py-1 bg-stone-100 hover:bg-amber-100 text-stone-700 font-bold text-[11px] rounded-lg border border-stone-200 cursor-pointer"
                          >
                            +{num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Unit Cost Input */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 block">Costo Unitario ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={itemUnitCost}
                        onChange={(e) => setItemUnitCost(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddProductToCart();
                          }
                        }}
                        placeholder="Ej: 6000"
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-black font-mono text-stone-900"
                      />
                      <span className="text-[10px] text-stone-500 block">
                        Subtotal: <strong className="font-mono text-stone-900 font-bold">{formatCurrency(itemQuantity * (Number(itemUnitCost) || 0))}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleAddProductToCart}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-xs flex items-center justify-center space-x-1.5 active:scale-98 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar a la compra</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Cart Summary Table */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-600" />
              3. Resumen de Productos de la Compra ({cartItems.length})
            </h3>

            {cartItems.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="font-bold text-stone-700">El carrito de compra está vacío</p>
                <p className="text-stone-500">Selecciona un producto arriba o escanea su código para agregarlo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1">
                        <h5 className="font-black text-stone-900 text-xs">{item.productName}</h5>
                        <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                          {item.quantity} u. x {formatCurrency(item.unitCost)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-stone-900 font-mono block text-sm">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveCartItem(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors ml-2"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total & Payment Method Card */}
                <div className="bg-stone-900 text-white p-5 rounded-2xl shadow-md space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-400 uppercase tracking-wider">Método de Pago</span>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-black rounded-full border border-emerald-500/30">
                      💵 EFECTIVO (Caja Chica)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Total a Pagar</span>
                      <span className="text-2xl font-black font-mono text-amber-400">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>

                    <div className="text-right text-[11px] text-stone-400">
                      <span>Caja disponible: <strong className="text-emerald-400 font-mono font-bold">{formatCurrency(cashBalance)}</strong></span>
                      {cashBalance < cartTotal && (
                        <p className="text-red-400 font-bold mt-0.5">⚠️ Fondos insuficientes (-{formatCurrency(cartTotal - cashBalance)})</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={isProcessing}
                    className="flex-1 py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-2 border border-stone-300 transition-all"
                  >
                    <span>Guardar Borrador</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!supplierName.trim()) {
                        setErrorMessage('Por favor, indica el nombre del proveedor antes de continuar.');
                        return;
                      }
                      if (cartTotal <= 0) {
                        setErrorMessage('El total de la compra debe ser mayor a 0.');
                        return;
                      }
                      setErrorMessage(null);
                      setIsConfirmModalOpen(true);
                    }}
                    disabled={isProcessing || cashBalance < cartTotal}
                    className={`flex-1 py-3.5 px-4 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition-all ${
                      cashBalance < cartTotal
                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Pagar con Caja</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Confirmar Compra Directa</h3>
                  <p className="text-xs text-stone-500">Revisa los detalles antes del egreso de caja</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isProcessing}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confirmation Breakdown Card */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-xs space-y-2 text-stone-800">
              <p><strong>Proveedor:</strong> {supplierName || 'Sin Nombre'}</p>
              <p><strong>Comprobante:</strong> {hasReceipt ? `Factura N° ${receiptNumber}` : 'Sin comprobante'}</p>
              <p><strong>Productos:</strong> {cartItems.length} tipo(s) ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} unidades)</p>
              
              <div className="pt-2 border-t border-stone-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Saldo caja actual:</span>
                  <span className="font-bold">{formatCurrency(cashBalance)}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Egreso de caja:</span>
                  <span>-{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-black pt-1 border-t border-stone-200">
                  <span>Saldo caja final:</span>
                  <span>{formatCurrency(cashBalance - cartTotal)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 text-center">
              Al confirmar, se descontará <strong className="font-bold text-stone-800">{formatCurrency(cartTotal)}</strong> de la caja física y los productos ingresarán inmediatamente al stock de inventario.
            </p>

            {/* Modal Actions */}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isProcessing}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-extrabold rounded-2xl text-xs"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmPurchase}
                disabled={isProcessing}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center space-x-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Sí, Confirmar Compra</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Historial de Compras Registradas
            </h3>
            <button
              onClick={loadPurchasesHistory}
              disabled={loadingPurchases}
              className="p-2 text-stone-500 hover:text-stone-900 rounded-xl hover:bg-stone-100"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPurchases ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingPurchases ? (
            <div className="p-8 text-center text-stone-500 text-xs">Cargando historial de compras...</div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
              <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-bold text-stone-700">No hay compras registradas aún</p>
              <p className="text-stone-500">Toca "Nueva Compra" para registrar el primer ingreso.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white">
              {purchases.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPurchaseDetail(p)}
                  className="p-4 hover:bg-stone-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          p.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.status === 'CONFIRMED' ? 'Confirmada' : p.status === 'DRAFT' ? 'Borrador' : 'Cancelada'}
                      </span>
                      <span className="font-black text-stone-900">{p.supplierName || p.supplier || 'Sin Proveedor'}</span>
                    </div>

                    <p className="text-stone-500 text-[11px]">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString('es-AR') : 'S/F'} | Vendedor: <strong className="text-stone-700">{p.creatorName || p.userId}</strong>
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="font-black font-mono text-sm text-stone-900">
                      {formatCurrency(p.total || p.amount || 0)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedPurchaseDetail && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold text-[10px] rounded-full uppercase">
                  Detalle de Compra
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-1">
                  {selectedPurchaseDetail.supplierName || selectedPurchaseDetail.supplier || 'Sin Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-xs space-y-2">
              <p><strong>Estado:</strong> <span className="font-bold text-emerald-800">{selectedPurchaseDetail.status === 'CONFIRMED' ? 'Confirmada' : selectedPurchaseDetail.status === 'DRAFT' ? 'Borrador' : 'Cancelada'}</span></p>
              <p><strong>Comprobante:</strong> {selectedPurchaseDetail.hasReceipt ? `Factura ${selectedPurchaseDetail.receiptNumber || 'S/N'}` : 'Sin comprobante'}</p>
              <p><strong>Método Pago:</strong> {selectedPurchaseDetail.paymentMethod === 'CASH' ? 'Efectivo' : selectedPurchaseDetail.paymentMethod}</p>
              <p><strong>Registrado por:</strong> {selectedPurchaseDetail.creatorName}</p>
              <p><strong>Fecha creación:</strong> {selectedPurchaseDetail.createdAt ? new Date(selectedPurchaseDetail.createdAt).toLocaleString('es-AR') : '-'}</p>
              {selectedPurchaseDetail.confirmedAt && (
                <p><strong>Fecha confirmación:</strong> {new Date(selectedPurchaseDetail.confirmedAt).toLocaleString('es-AR')}</p>
              )}
            </div>

            {/* Items Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase text-stone-700">Productos Ingresados</h4>
              {selectedPurchaseDetail.items && selectedPurchaseDetail.items.length > 0 ? (
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
                  {selectedPurchaseDetail.items.map((item, idx) => (
                    <div key={idx} className="p-3 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-stone-900">{item.productName}</p>
                        <p className="text-[10px] text-stone-500">{item.quantity} u. x {formatCurrency(item.unitCost)}</p>
                      </div>
                      <span className="font-mono font-bold text-stone-900">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">No hay detalle de productos para esta compra histórica.</p>
              )}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
              <span className="text-xs font-bold text-stone-600">TOTAL:</span>
              <span className="text-xl font-black font-mono text-stone-900">
                {formatCurrency(selectedPurchaseDetail.total || selectedPurchaseDetail.amount || 0)}
              </span>
            </div>

            <button
              onClick={() => setSelectedPurchaseDetail(null)}
              className="w-full py-2.5 bg-stone-900 text-white font-bold rounded-2xl text-xs"
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
