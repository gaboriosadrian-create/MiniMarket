import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  Product, 
  ReplenishmentList, 
  ReplenishmentItem 
} from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { 
  getActiveDraftReplenishment, 
  saveReplenishmentDraft, 
  finalizeAndExportReplenishment, 
  cancelReplenishmentDraft, 
  getDistinctReplenishmentSuppliers
} from '../lib/replenishmentService';
import { 
  formatRequestCode,
  shareReplenishmentPDF, 
  downloadReplenishmentPDF 
} from '../lib/replenishmentPdf';
import { ShareOrderModal } from './ShareOrderModal';
import { hasPermission } from '../lib/permissions';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useMobileBackHandler } from '../lib/navigationContext';
import { findMatchingSupplier, getUniqueSuppliers, normalizeText } from '../lib/categoryUtils';
import { 
  ClipboardList, 
  Lightbulb, 
  Plus, 
  Trash2, 
  FileText, 
  Save, 
  X, 
  Search, 
  Barcode, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Download,
  Info,
  Share2,
  ArrowLeft,
  ShoppingBag,
  ListPlus,
  PlusCircle,
  Truck
} from 'lucide-react';

export const ReplenishmentModule: React.FC = () => {
  const { userProfile, business } = useAuth();

  const canView = hasPermission(userProfile, 'replenishment.view');
  const canCreate = hasPermission(userProfile, 'replenishment.create');
  const canExport = hasPermission(userProfile, 'replenishment.export');

  // Main UI Mode: 'OVERVIEW' (dashboard/list) | 'WIZARD' (step-by-step assistant)
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'WIZARD'>('OVERVIEW');

  // Wizard Step: 1 = Sugerencias automáticas, 2 = Carga manual / escáner, 3 = Resumen y finalización
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Sub-tabs in OVERVIEW
  const [activeTab, setActiveTab] = useState<'SOLICITUD' | 'SUGGESTIONS'>('SOLICITUD');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Active Draft State
  const [activeDraft, setActiveDraft] = useState<ReplenishmentList | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [draftItems, setDraftItems] = useState<ReplenishmentItem[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearchFocus, setSupplierSearchFocus] = useState(false);
  const supplierInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Suggestion selection checkboxes in Wizard Step 1
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [suggestionQuantities, setSuggestionQuantities] = useState<Record<string, number>>({});

  // Sharing and Post-Export State
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);
  const [orderToShare, setOrderToShare] = useState<ReplenishmentList | null>(null);
  const [exportedSuccessModal, setExportedSuccessModal] = useState<ReplenishmentList | null>(null);

  // Available suppliers for predictive auto-completion
  const [availableSuppliers, setAvailableSuppliers] = useState<string[]>([]);

  // Product Search / Scanner state inside Step 2
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(new Set());

  // Confirm cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const showNotify = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Mobile Back Button / Hardware Gesture Handlers
  useMobileBackHandler(viewMode === 'WIZARD', () => {
    if (wizardStep === 3) {
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(1);
    } else {
      setViewMode('OVERVIEW');
    }
  });

  useMobileBackHandler(showScanner, () => {
    setShowScanner(false);
  });

  useMobileBackHandler(orderToShare !== null, () => {
    setOrderToShare(null);
  });

  useMobileBackHandler(exportedSuccessModal !== null, () => {
    setExportedSuccessModal(null);
  });

  useMobileBackHandler(showCancelModal, () => {
    setShowCancelModal(false);
  });

  // Load products
  const loadProductsData = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    try {
      const data = await getProductsByBusiness(business.id);
      setProducts(data.filter(p => p.active));
    } catch (err) {
      console.error('Error loading products for replenishment:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load Active Draft
  const loadDraftData = async () => {
    if (!business?.id) return;
    setLoadingDraft(true);
    try {
      const draft = await getActiveDraftReplenishment(business.id);
      if (draft) {
        setActiveDraft(draft);
        setDraftItems(draft.items || []);
        setSupplierName(draft.supplierName || '');
        setNotes(draft.notes || '');
      } else {
        setActiveDraft(null);
        setDraftItems([]);
        setSupplierName('');
        setNotes('');
      }
    } catch (err) {
      console.error('Error loading draft replenishment:', err);
    } finally {
      setLoadingDraft(false);
    }
  };

  // Load available suppliers for predictive suggestions in draft
  const loadSuppliersData = async () => {
    if (!business?.id) return;
    try {
      const sups = await getDistinctReplenishmentSuppliers(business.id);
      setAvailableSuppliers(getUniqueSuppliers(sups));
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  useEffect(() => {
    loadProductsData();
    loadDraftData();
    loadSuppliersData();
  }, [business?.id]);

  // Compute Auto Suggestions (products where stock < reorderPoint)
  const suggestions = useMemo(() => {
    return products.filter(p => {
      if (p.tracksStock === false || p.isCombo === true) return false;
      const reorderPt = p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock;
      const isBelowReorder = p.stock < reorderPt;
      const notInDraft = !draftItems.some(item => item.productId === p.id);
      const notRejected = !rejectedSuggestionIds.has(p.id);
      return isBelowReorder && notInDraft && notRejected;
    });
  }, [products, draftItems, rejectedSuggestionIds]);

  // Initialize selected suggestions when suggestions list updates
  useEffect(() => {
    const initialSelected = new Set<string>();
    const initialQtys: Record<string, number> = {};

    suggestions.forEach(p => {
      initialSelected.add(p.id);
      const reorderPt = p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock;
      let qty = 1;
      if (p.targetStock !== undefined && p.targetStock > p.stock) {
        qty = p.targetStock - p.stock;
      } else if (reorderPt > p.stock) {
        qty = reorderPt - p.stock;
      }
      initialQtys[p.id] = Math.max(1, qty);
    });

    setSelectedSuggestionIds(initialSelected);
    setSuggestionQuantities(initialQtys);
  }, [suggestions.length]);

  const totalSuggestionsCount = suggestions.length;

  // Matching existing supplier to prevent duplicates with different casing / spaces
  const matchingSupplier = useMemo(() => {
    if (!supplierName.trim()) return null;
    return findMatchingSupplier(supplierName, availableSuppliers);
  }, [supplierName, availableSuppliers]);

  const hasSupplierCasingDifference = useMemo(() => {
    if (!matchingSupplier) return false;
    return matchingSupplier.toLowerCase() === supplierName.trim().toLowerCase() && matchingSupplier !== supplierName;
  }, [matchingSupplier, supplierName]);

  // Filtered suppliers for predictive autocomplete
  const filteredSuppliers = useMemo(() => {
    const term = supplierName.trim().toLowerCase();
    if (!term) return availableSuppliers;
    return availableSuppliers.filter(s => s.toLowerCase().includes(term));
  }, [availableSuppliers, supplierName]);

  // Filtered search products
  const filteredSearchProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return products.filter(p => {
      if (p.tracksStock === false || p.isCombo === true) return false;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    }).slice(0, 8);
  }, [products, searchTerm]);

  // Start Wizard assistant
  const handleStartWizard = () => {
    if (suggestions.length > 0) {
      setWizardStep(1);
    } else {
      setWizardStep(2);
    }
    setViewMode('WIZARD');
  };

  // Add single product to draft (Auto-add on select, no duplicate lines)
  const handleAddProductToDraft = (product: Product, customQty?: number) => {
    if (!canCreate) {
      showNotify('No tienes permisos para modificar solicitudes', 'warning');
      return;
    }

    if (product.tracksStock === false || product.isCombo === true) {
      showNotify(`"${product.name}" no admite reposición (servicio o combo).`, 'warning');
      return;
    }

    let alreadyExists = false;
    setDraftItems(prev => {
      const existingIdx = prev.findIndex(i => i.productId === product.id);
      if (existingIdx >= 0) {
        alreadyExists = true;
        // Do not create another duplicate line, keep existing line & quantity
        return prev;
      } else {
        const reorderPt = product.reorderPoint !== undefined ? product.reorderPoint : product.minimumStock;
        const initialQty = customQty !== undefined && customQty > 0 ? customQty : 1;
        const newItem: ReplenishmentItem = {
          productId: product.id,
          productName: product.name,
          ...(product.barcode !== undefined && product.barcode !== null && { barcode: product.barcode }),
          ...(product.category !== undefined && product.category !== null && { category: product.category }),
          currentStock: typeof product.stock === 'number' ? product.stock : 0,
          ...(reorderPt !== undefined && reorderPt !== null && { reorderPoint: reorderPt }),
          ...(product.targetStock !== undefined && product.targetStock !== null && { targetStock: product.targetStock }),
          requestedQuantity: initialQty
        };
        return [...prev, newItem];
      }
    });

    setSearchTerm('');
    if (alreadyExists) {
      showNotify(`"${product.name}" ya está en la solicitud. Modificá la cantidad en la lista inferior.`, 'info');
    } else {
      showNotify(`"${product.name}" agregado a la solicitud.`, 'success');
    }
  };

  // Add selected suggestions in Wizard Step 1
  const handleAddSelectedSuggestions = () => {
    if (!canCreate) return;
    const selectedProds = suggestions.filter(p => selectedSuggestionIds.has(p.id));
    if (selectedProds.length === 0) {
      setWizardStep(2);
      return;
    }

    let addedCount = 0;
    setDraftItems(prev => {
      const newItems = [...prev];
      selectedProds.forEach(p => {
        const reorderPt = p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock;
        const qty = suggestionQuantities[p.id] || 1;
        const existingIdx = newItems.findIndex(i => i.productId === p.id);
        if (existingIdx >= 0) {
          newItems[existingIdx] = {
            ...newItems[existingIdx],
            requestedQuantity: newItems[existingIdx].requestedQuantity + qty
          };
        } else {
          newItems.push({
            productId: p.id,
            productName: p.name,
            ...(p.barcode !== undefined && p.barcode !== null && { barcode: p.barcode }),
            ...(p.category !== undefined && productHasCategory(p) && { category: p.category }),
            currentStock: typeof p.stock === 'number' ? p.stock : 0,
            ...(reorderPt !== undefined && reorderPt !== null && { reorderPoint: reorderPt }),
            ...(p.targetStock !== undefined && p.targetStock !== null && { targetStock: p.targetStock }),
            requestedQuantity: Math.max(1, qty)
          });
        }
        addedCount++;
      });
      return newItems;
    });

    showNotify(`Se agregaron ${addedCount} productos a la solicitud.`, 'success');
    setWizardStep(2);
  };

  const productHasCategory = (p: Product) => p.category !== undefined && p.category !== null;

  // Toggle suggestion selection checkbox
  const toggleSuggestionCheck = (id: string) => {
    setSelectedSuggestionIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const updateSuggestionQty = (id: string, delta: number) => {
    setSuggestionQuantities(prev => {
      const current = prev[id] || 1;
      return {
        ...prev,
        [id]: Math.max(1, current + delta)
      };
    });
  };

  // Reject a suggestion
  const handleRejectSuggestion = (productId: string) => {
    setRejectedSuggestionIds(prev => new Set(prev).add(productId));
  };

  // Update item requested quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setDraftItems(prev =>
      prev.map(item => item.productId === productId ? { ...item, requestedQuantity: newQty } : item)
    );
  };

  // Remove item from draft
  const handleRemoveItem = (productId: string) => {
    setDraftItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Validate Step 2 inputs before proceeding
  const handleValidateStep2AndProceed = () => {
    if (!supplierName || !supplierName.trim()) {
      showNotify('Seleccioná un proveedor para continuar.', 'warning');
      supplierInputRef.current?.focus();
      return;
    }
    if (draftItems.length === 0) {
      showNotify('Agregá al menos un producto a la solicitud.', 'warning');
      return;
    }
    setWizardStep(3);
  };

  // Save draft to Firestore
  const handleSaveDraft = async () => {
    if (!business?.id) {
      showNotify('No se puede guardar la solicitud porque falta el negocio asociado.', 'error');
      return;
    }
    if (!userProfile?.uid) {
      showNotify('No se puede identificar al usuario.', 'error');
      return;
    }
    if (!canCreate) {
      showNotify('No tienes permiso para modificar la solicitud.', 'warning');
      return;
    }
    if (!supplierName || !supplierName.trim()) {
      showNotify('Seleccioná un proveedor para continuar.', 'warning');
      supplierInputRef.current?.focus();
      return;
    }
    if (draftItems.length === 0) {
      showNotify('Agregá al menos un producto a la solicitud.', 'warning');
      return;
    }

    setSavingDraft(true);
    try {
      const canonicalSupplier = (matchingSupplier || normalizeText(supplierName)).trim();
      const saved = await saveReplenishmentDraft({
        businessId: business.id,
        userId: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Vendedor',
        items: draftItems,
        supplierName: canonicalSupplier,
        notes,
        existingId: activeDraft?.id
      });
      setActiveDraft(saved);
      showNotify('Solicitud guardada como borrador con éxito.', 'success');
      setViewMode('OVERVIEW');
    } catch (err: any) {
      console.error('Error saving draft:', err);
      showNotify(err?.message || 'Ocurrió un error al guardar la solicitud.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // Share order handler - opens unified share modal (Online Order + PDF)
  const handleShareOrder = (order: ReplenishmentList) => {
    setOrderToShare(order);
  };

  // Direct download PDF handler
  const handleDownloadOrder = (order: ReplenishmentList) => {
    if (!business?.name) return;
    try {
      const fileName = downloadReplenishmentPDF(order, business.name);
      showNotify(`PDF descargado (${fileName})`, 'success');
    } catch (err) {
      console.error('Error downloading replenishment PDF:', err);
      showNotify('Ocurrió un error al descargar el PDF.', 'error');
    }
  };

  // Finalize and Export Order
  const handleExportPDF = async () => {
    if (!business?.id || !userProfile?.uid) return;
    if (!canExport) {
      showNotify('No tienes permiso para generar pedidos.', 'warning');
      return;
    }
    if (!supplierName || !supplierName.trim()) {
      showNotify('Seleccioná un proveedor para continuar.', 'warning');
      supplierInputRef.current?.focus();
      return;
    }
    if (draftItems.length === 0) {
      showNotify('Agregá al menos un producto a la solicitud.', 'warning');
      return;
    }

    const canonicalSupplier = (matchingSupplier || normalizeText(supplierName)).trim();

    setExportingPdf(true);
    try {
      const savedDraft = await saveReplenishmentDraft({
        businessId: business.id,
        userId: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Vendedor',
        items: draftItems,
        supplierName: canonicalSupplier,
        notes,
        existingId: activeDraft?.id
      });

      const exportedList = await finalizeAndExportReplenishment(
        savedDraft.id,
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Vendedor',
        draftItems,
        canonicalSupplier,
        notes
      );

      setActiveDraft(null);
      setDraftItems([]);
      setSupplierName('');
      setNotes('');
      setViewMode('OVERVIEW');
      setExportedSuccessModal(exportedList);
      showNotify('Pedido generado con éxito.', 'success');
    } catch (err: any) {
      console.error('Error exporting order:', err);
      showNotify(err?.message || 'Ocurrió un error al generar el pedido.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // Cancel draft
  const handleCancelDraft = async () => {
    if (!activeDraft?.id || !business?.id || !userProfile) return;
    try {
      await cancelReplenishmentDraft(
        activeDraft.id,
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email
      );
      setActiveDraft(null);
      setDraftItems([]);
      setSupplierName('');
      setNotes('');
      setShowCancelModal(false);
      setViewMode('OVERVIEW');
      showNotify('Borrador de solicitud descartado.', 'info');
    } catch (err) {
      console.error('Error cancelling draft:', err);
      showNotify('Error al descartar el borrador.', 'error');
    }
  };

  // Barcode scan callback: Auto-adds product to draft directly and closes scanner
  const handleBarcodeScanned = (scannedBarcode: string) => {
    const matched = products.find(p => p.barcode === scannedBarcode);
    if (matched) {
      if (matched.tracksStock === false || matched.isCombo === true) {
        showNotify(`"${matched.name}" no admite reposición (servicio o combo).`, 'warning');
        setShowScanner(false);
        return;
      }
      handleAddProductToDraft(matched);
      setShowScanner(false);
    } else {
      showNotify(`No se encontró producto con código ${scannedBarcode}`, 'warning');
    }
  };

  const totalUnitsInDraft = useMemo(() => {
    return draftItems.reduce((sum, item) => sum + (Number(item.requestedQuantity) || 0), 0);
  }, [draftItems]);

  if (!canView) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-xs border border-stone-200 text-center max-w-md mx-auto my-12 space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-stone-900">Acceso Restringido</h3>
        <p className="text-xs text-stone-500">No tienes permisos para acceder a Solicitud de Productos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border animate-in fade-in ${
          notification.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-700' :
          notification.type === 'error' ? 'bg-rose-950 text-rose-100 border-rose-700' :
          notification.type === 'warning' ? 'bg-amber-950 text-amber-100 border-amber-700' :
          'bg-stone-900 text-stone-100 border-stone-700'
        }`}>
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {notification.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {viewMode === 'WIZARD' && (
            <button
              onClick={() => setViewMode('OVERVIEW')}
              className="p-2 text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              title="Volver a la vista general"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-purple-600" />
              Solicitud de Productos
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Arma pedidos para tus proveedores rápidamente desde el celular.
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        {viewMode === 'OVERVIEW' && (
          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={handleStartWizard}
                id="btn-nueva-solicitud"
                className="w-full sm:w-auto px-5 py-2.5 bg-[#0057FF] hover:bg-[#0047DB] active:scale-98 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {draftItems.length > 0 ? (
                  <>
                    <ListPlus className="w-4 h-4" />
                    <span>[ CONTINUAR SOLICITUD ({draftItems.length}) ]</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>[ + NUEVA SOLICITUD ]</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: ASISTENTE DE CARGA GUIADA (WIZARD) */}
      {/* ========================================================================= */}
      {viewMode === 'WIZARD' && (
        <div className="space-y-4">
          
          {/* Step Indicator Header */}
          <div className="bg-stone-900 text-white p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setWizardStep(1)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  wizardStep === 1
                    ? 'bg-[#0057FF] text-white'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <span>1. Sugerencias</span>
                {totalSuggestionsCount > 0 && (
                  <span className="bg-amber-400 text-stone-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                    {totalSuggestionsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setWizardStep(2)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  wizardStep === 2
                    ? 'bg-[#0057FF] text-white'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <span>2. Carga / Escáner</span>
                {draftItems.length > 0 && (
                  <span className="bg-blue-200 text-blue-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                    {draftItems.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setWizardStep(3)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  wizardStep === 3
                    ? 'bg-[#0057FF] text-white'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <span>3. Resumen y Envío</span>
              </button>
            </div>

            <div className="shrink-0 text-right">
              <span className="text-[11px] font-mono text-stone-300 bg-stone-800 px-2.5 py-1 rounded-lg">
                {draftItems.length} prods ({totalUnitsInDraft} un)
              </span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* PASO 1: SUGERENCIAS AUTOMÁTICAS (Stock < Punto de reposición) */}
          {/* ------------------------------------------------------------- */}
          {wizardStep === 1 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Paso 1: ¿Qué querés solicitar?
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Productos detectados con stock bajo o por debajo del punto de reposición.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Omitir sugerencias →
                  </button>
                </div>
              </div>

              {suggestions.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300 space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <div>
                    <h4 className="font-bold text-stone-800 text-sm">¡Sin quiebres de stock automáticos!</h4>
                    <p className="text-xs text-stone-500 mt-0.5 max-w-sm mx-auto">
                      Todos los productos están sobre el nivel mínimo. Podes agregar lo que necesites manualmente.
                    </p>
                  </div>
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs rounded-xl shadow-2xs cursor-pointer inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>[ + AGREGAR PRODUCTOS MANUALMENTE ]</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600 px-1">
                    <span>Selecciona los que desees incluir en la solicitud:</span>
                    <button
                      onClick={() => {
                        if (selectedSuggestionIds.size === suggestions.length) {
                          setSelectedSuggestionIds(new Set());
                        } else {
                          setSelectedSuggestionIds(new Set(suggestions.map(s => s.id)));
                        }
                      }}
                      className="text-[#0057FF] font-bold hover:underline cursor-pointer"
                    >
                      {selectedSuggestionIds.size === suggestions.length ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {suggestions.map((p) => {
                      const isSelected = selectedSuggestionIds.has(p.id);
                      const qty = suggestionQuantities[p.id] || 1;
                      const reorderPt = p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock;

                      return (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-50/40 border-blue-300 shadow-2xs'
                              : 'bg-stone-50/70 border-stone-200 opacity-80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSuggestionCheck(p.id)}
                              className="mt-1 w-5 h-5 rounded text-[#0057FF] focus:ring-[#0057FF] cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-stone-900 text-sm">{p.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 flex-wrap">
                                <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                  Stock: {p.stock} un
                                </span>
                                {reorderPt !== undefined && (
                                  <span className="text-stone-600">
                                    Pto. Rep: <strong>{reorderPt}</strong>
                                  </span>
                                )}
                                {p.category && (
                                  <span className="text-stone-400">· {p.category}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-stone-200/70 pl-8">
                            <span className="text-xs font-extrabold text-stone-700">A pedir:</span>
                            <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateSuggestionQty(p.id, -1)}
                                className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 active:bg-stone-200 font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setSuggestionQuantities(prev => ({ ...prev, [p.id]: val }));
                                }}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                                className="w-12 text-center font-black text-xs text-stone-900 font-mono py-1 bg-stone-50 border-x border-stone-200 focus:bg-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateSuggestionQty(p.id, 1)}
                                className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 active:bg-stone-200 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer text-center"
                    >
                      Omitir y Cargar Manualmente
                    </button>

                    <button
                      type="button"
                      onClick={handleAddSelectedSuggestions}
                      className="w-full sm:w-auto px-6 py-3 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>[ AGREGAR SELECCIONADOS ({selectedSuggestionIds.size}) ]</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PASO 2: CARGA MANUAL Y ESCÁNER DE PRODUCTOS */}
          {/* ------------------------------------------------------------- */}
          {wizardStep === 2 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                    <Search className="w-5 h-5 text-[#0057FF]" />
                    Paso 2: Búsqueda y Selección de Productos
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Asigna el proveedor, busca productos en el catálogo o escanea con la cámara.
                  </p>
                </div>

                <button
                  onClick={handleValidateStep2AndProceed}
                  disabled={draftItems.length === 0}
                  className="px-4 py-2 bg-[#0057FF] hover:bg-[#0047DB] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Continuar al Resumen</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Proveedor (Obligatorio) con búsqueda predictiva */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Proveedor <span className="text-rose-600 font-black">* (Obligatorio)</span>
                  </label>
                  {supplierName.trim() ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> Proveedor asignado
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Requerido para continuar
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierName}
                    onFocus={() => setSupplierSearchFocus(true)}
                    onChange={(e) => {
                      setSupplierName(e.target.value);
                      setSupplierSearchFocus(true);
                    }}
                    placeholder="Buscar o ingresar proveedor (ej: Distribuidora Central)..."
                    className={`w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm border-2 rounded-xl outline-none font-medium transition-colors ${
                      !supplierName.trim()
                        ? 'border-amber-300 focus:border-[#0057FF] bg-amber-50/20'
                        : 'border-stone-200 focus:border-[#0057FF] bg-white'
                    }`}
                  />
                  {supplierName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierName('');
                        setSupplierSearchFocus(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded-full"
                      title="Borrar proveedor"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Predictivo de Proveedores */}
                {supplierSearchFocus && filteredSuppliers.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setSupplierSearchFocus(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-blue-200 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-stone-100 p-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-stone-400">
                        Proveedores Frecuentes
                      </div>
                      {filteredSuppliers.map((sup) => (
                        <div
                          key={sup}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSupplierName(sup);
                            setSupplierSearchFocus(false);
                          }}
                          className="px-3 py-2 text-xs font-bold text-stone-800 hover:bg-blue-50 hover:text-[#0057FF] rounded-xl cursor-pointer flex items-center justify-between transition-colors"
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

              {/* 2. Search Box with Camera Scanner */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Buscar Producto
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0057FF]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nombre, código de barras o categoría..."
                      className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm border-2 border-blue-300 focus:border-[#0057FF] rounded-xl outline-none bg-blue-50/20 font-medium"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setShowScanner(true)}
                    id="btn-scan-solicitud"
                    className="px-3.5 py-2.5 bg-stone-900 hover:bg-black text-white font-extrabold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
                    title="Escanear con cámara"
                  >
                    <Barcode className="w-4 h-4 text-white" />
                    <span className="hidden sm:inline">Escanear</span>
                  </button>
                </div>

                {/* Instant Search Results Dropdown: Auto-add on click */}
                {searchTerm && (
                  <div className="bg-amber-50/50 border-2 border-amber-300 rounded-2xl p-2 max-h-60 overflow-y-auto divide-y divide-amber-200/50 shadow-md">
                    {filteredSearchProducts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-stone-500">
                        No se encontró ningún producto con "{searchTerm}"
                      </div>
                    ) : (
                      filteredSearchProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleAddProductToDraft(p)}
                          className="p-2.5 hover:bg-blue-100/60 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-colors"
                        >
                          <div>
                            <p className="font-bold text-stone-900 text-xs sm:text-sm">{p.name}</p>
                            <p className="text-[11px] text-stone-500 font-mono">
                              {p.barcode ? `#${p.barcode}` : 'Sin código'} {p.category ? `· ${p.category}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-stone-200 text-stone-800 px-2 py-0.5 rounded-md font-bold">
                              Stock: {p.stock}
                            </span>
                            <span className="text-xs text-[#0057FF] font-extrabold flex items-center gap-0.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                              <Plus className="w-3.5 h-3.5" /> Agregar
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* 3. Added items list in draft */}
              <div className="space-y-2.5 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between text-xs font-extrabold text-stone-700 uppercase tracking-wider">
                  <span>Productos en la Solicitud ({draftItems.length})</span>
                  <span>Total: {totalUnitsInDraft} un</span>
                </div>

                {draftItems.length === 0 ? (
                  <div className="p-6 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-dashed border-stone-300 space-y-1">
                    <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="font-bold text-stone-700">Aún no hay productos en la solicitud</p>
                    <p className="text-stone-500">Busca arriba o escanea códigos de barra.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {draftItems.map((item) => (
                      <div
                        key={item.productId}
                        className="p-3 bg-white border border-stone-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-blue-200 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-stone-900 text-xs sm:text-sm">{item.productName}</h4>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            Stock ref: {item.currentStock} un {item.category ? `· ${item.category}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, item.requestedQuantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.requestedQuantity}
                              onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="w-12 text-center font-black text-xs text-[#0057FF] font-mono py-1 bg-stone-50 border-x border-stone-200 focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, item.requestedQuantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Navigation */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Sugerencias</span>
                </button>

                <button
                  type="button"
                  onClick={handleValidateStep2AndProceed}
                  disabled={draftItems.length === 0}
                  className="px-6 py-3 bg-[#0057FF] hover:bg-[#0047DB] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>[ VER RESUMEN / CONTINUAR ]</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* PASO 3: RESUMEN Y FINALIZACIÓN DE LA SOLICITUD */}
          {/* ------------------------------------------------------------- */}
          {wizardStep === 3 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs space-y-4 max-w-2xl mx-auto">
              <div className="border-b border-stone-100 pb-3">
                <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#0057FF]" />
                  Paso 3: Resumen y Finalización de la Solicitud
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Verifica los productos y genera el pedido oficial para el proveedor.
                </p>
              </div>

              {/* High-level metrics */}
              <div className="grid grid-cols-2 gap-3 bg-blue-50/60 border border-blue-200 rounded-2xl p-4 text-center">
                <div>
                  <span className="text-[11px] uppercase font-bold text-blue-950 block">Variedades</span>
                  <span className="text-2xl font-black text-blue-950 font-mono">{draftItems.length}</span>
                </div>
                <div>
                  <span className="text-[11px] uppercase font-bold text-blue-950 block">Total Unidades</span>
                  <span className="text-2xl font-black text-blue-950 font-mono">{totalUnitsInDraft} un</span>
                </div>
              </div>

              {/* Products Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-stone-700 uppercase tracking-wider">
                  Detalle de Productos a Solicitar
                </h4>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto bg-stone-50/50">
                  {draftItems.map((item) => (
                    <div key={item.productId} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-stone-900">{item.productName}</p>
                        <p className="text-[10px] text-stone-500 font-mono">
                          Stock actual: {item.currentStock} un
                        </p>
                      </div>
                      <span className="font-black text-[#0057FF] bg-blue-100 px-2.5 py-1 rounded-lg font-mono">
                        {item.requestedQuantity} unidades
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supplier & Notes Form */}
              <div className="space-y-3 pt-2">
                {/* Proveedor Obligatorio con Búsqueda Predictiva */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                      Proveedor <span className="text-rose-600 font-black">* (Obligatorio)</span>
                    </label>
                    {supplierName.trim() ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Confirmado
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                        Requerido
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Truck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      ref={supplierInputRef}
                      type="text"
                      value={supplierName}
                      onFocus={() => setSupplierSearchFocus(true)}
                      onBlur={() => {
                        if (matchingSupplier && matchingSupplier !== supplierName) {
                          setSupplierName(matchingSupplier);
                        }
                      }}
                      onChange={(e) => {
                        setSupplierName(e.target.value);
                        setSupplierSearchFocus(true);
                      }}
                      placeholder="Buscar o escribir proveedor (ej: Distribuidora Central)..."
                      className={`w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm border-2 rounded-xl outline-none font-medium transition-colors ${
                        !supplierName.trim()
                          ? 'border-amber-300 focus:border-[#0057FF] bg-amber-50/20'
                          : 'border-stone-200 focus:border-[#0057FF] bg-white'
                      }`}
                    />
                    {supplierName && (
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierName('');
                          setSupplierSearchFocus(true);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded-full cursor-pointer"
                        title="Borrar proveedor"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Duplicate notice */}
                  {hasSupplierCasingDifference && matchingSupplier && (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 animate-in fade-in">
                      <Check className="w-4 h-4 text-[#0057FF] shrink-0" />
                      <span>
                        El proveedor <strong>"{matchingSupplier}"</strong> ya existe. Se seleccionó el proveedor existente.
                      </span>
                    </div>
                  )}

                  {/* Dropdown Predictivo en Resumen */}
                  {supplierSearchFocus && filteredSuppliers.length > 0 && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setSupplierSearchFocus(false)} 
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-blue-200 rounded-2xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-stone-100 p-1.5">
                        <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-stone-400">
                          Proveedores Registrados
                        </div>
                        {filteredSuppliers.map((sup) => (
                          <div
                            key={sup}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSupplierName(sup);
                              setSupplierSearchFocus(false);
                            }}
                            className="px-3 py-2 text-xs font-bold text-stone-800 hover:bg-blue-50 hover:text-[#0057FF] rounded-xl cursor-pointer flex items-center justify-between transition-colors"
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

                  {/* Quick supplier chips */}
                  {availableSuppliers.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-stone-500">Proveedores habituales:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSuppliers.slice(0, 6).map((sup) => (
                          <button
                            key={sup}
                            type="button"
                            onClick={() => setSupplierName(sup)}
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-colors cursor-pointer ${
                              supplierName.trim().toLowerCase() === sup.toLowerCase()
                                ? 'bg-[#0057FF] text-white border-[#0057FF]'
                                : 'bg-stone-50 hover:bg-blue-50 text-stone-700 hover:text-[#0057FF] border-stone-200'
                            }`}
                          >
                            {sup}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Observaciones o Notas (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Aclaraciones sobre horario de entrega, formas de pago, etc..."
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-[#0057FF] outline-none bg-white font-medium resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-3 border-t border-stone-100">
                {canExport && (
                  <button
                    onClick={handleExportPDF}
                    disabled={exportingPdf || draftItems.length === 0}
                    className="w-full py-3.5 bg-[#0057FF] hover:bg-[#0047DB] disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{exportingPdf ? 'Generando Pedido...' : '[ GENERAR PEDIDO ]'}</span>
                  </button>
                )}

                <button
                  onClick={handleSaveDraft}
                  disabled={savingDraft || draftItems.length === 0}
                  className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4 text-stone-600" />
                  <span>{savingDraft ? 'Guardando...' : 'Guardar Solicitud como Borrador'}</span>
                </button>

                <button
                  onClick={() => setWizardStep(2)}
                  className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Editar Productos</span>
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: OVERVIEW Y LISTADOS */}
      {/* ========================================================================= */}
      {viewMode === 'OVERVIEW' && (
        <div className="space-y-4">
          
          {/* Active Draft Banner if exists */}
          {activeDraft && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#0057FF] flex items-center justify-center font-bold">
                  <ClipboardList className="w-5 h-5 text-[#0057FF]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-blue-200 text-blue-950 px-2 py-0.5 rounded-md">
                      Borrador Guardado
                    </span>
                    <span className="text-xs font-bold text-stone-700">
                      {activeDraft.supplierName || 'Proveedor sin especificar'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {draftItems.length} productos ({totalUnitsInDraft} un) · Editado recientemente
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  onClick={handleStartWizard}
                  className="px-4 py-2 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continuar Solicitud</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Sub-tabs in Overview */}
          <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('SOLICITUD')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'SOLICITUD'
                  ? 'bg-[#0057FF] text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Solicitud Actual</span>
              {draftItems.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'SOLICITUD' ? 'bg-[#003db3] text-white' : 'bg-stone-300 text-stone-800'
                }`}>
                  {draftItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('SUGGESTIONS')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'SUGGESTIONS'
                  ? 'bg-[#0057FF] text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>Sugerencias Automáticas</span>
              {totalSuggestionsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-stone-950">
                  {totalSuggestionsCount}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: SOLICITUD ACTUAL */}
          {activeTab === 'SOLICITUD' && (
            <div className="space-y-4">
              {draftItems.length === 0 ? (
                <div className="bg-stone-50 rounded-2xl border border-dashed border-stone-300 p-8 sm:p-12 text-center space-y-3">
                  <ClipboardList className="w-12 h-12 text-stone-400 mx-auto" />
                  <h3 className="font-bold text-stone-800 text-base">No hay ninguna solicitud activa en este momento</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Inicia una nueva solicitud para armar el pedido de reposición para tu proveedor.
                  </p>
                  {canCreate && (
                    <button
                      onClick={handleStartWizard}
                      className="px-5 py-2.5 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>[ + NUEVA SOLICITUD ]</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-xs font-extrabold text-stone-700 uppercase">
                      Productos en Borrador ({draftItems.length})
                    </span>
                    <button
                      onClick={handleStartWizard}
                      className="text-xs font-bold text-[#0057FF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Abrir Asistente de Carga</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-stone-100">
                    {draftItems.map((item) => (
                      <div key={item.productId} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-stone-900">{item.productName}</p>
                          <p className="text-[11px] text-stone-500">Stock ref: {item.currentStock} un</p>
                        </div>
                        <span className="font-black text-[#0057FF] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 font-mono">
                          {item.requestedQuantity} un
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUGERENCIAS AUTOMÁTICAS */}
          {activeTab === 'SUGGESTIONS' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Sugerencias calculadas automáticamente cuando el stock actual es inferior al punto de reposición configurado.
                </p>
              </div>

              {suggestions.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h4 className="font-bold text-stone-800 text-sm">Sin quiebres de stock detectados</h4>
                  <p className="text-xs text-stone-500">Todos los productos tienen niveles adecuados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {suggestions.map((p) => {
                    const reorderPt = p.reorderPoint !== undefined ? p.reorderPoint : p.minimumStock;
                    let suggestedQty = 1;
                    if (p.targetStock !== undefined && p.targetStock > p.stock) {
                      suggestedQty = p.targetStock - p.stock;
                    } else if (reorderPt > p.stock) {
                      suggestedQty = reorderPt - p.stock;
                    }

                    return (
                      <div key={p.id} className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-2 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-stone-900 text-sm">{p.name}</p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            Stock: <strong className="text-rose-600">{p.stock}</strong> · Punto Rep: {reorderPt}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                          <span className="text-xs font-black text-[#0057FF]">Sugerido: +{suggestedQty} un</span>
                          <button
                            onClick={() => handleAddProductToDraft(p, suggestedQty)}
                            className="px-3 py-1 bg-[#0057FF] hover:bg-[#0047DB] text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onDetected={handleBarcodeScanned}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-3 border border-stone-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <span>¿Descartar Solicitud?</span>
            </div>
            <p className="text-xs text-stone-600">
              Esta acción eliminará el borrador actual y los productos seleccionados.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Volver
              </button>
              <button
                onClick={handleCancelDraft}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-2xs cursor-pointer"
              >
                Sí, Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST-EXPORT SUCCESS MODAL */}
      {exportedSuccessModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-stone-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-stone-900">¡Pedido Generado!</h3>
              <p className="text-xs font-bold text-[#0057FF] mt-0.5">
                Solicitud N.º {formatRequestCode(exportedSuccessModal.id)}
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-left text-xs space-y-1 text-stone-700">
              <div className="flex justify-between">
                <span className="text-stone-500">Proveedor:</span>
                <strong className="text-stone-900">{exportedSuccessModal.supplierName || 'Sin especificar'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Variedades:</span>
                <strong className="text-stone-900">{exportedSuccessModal.totalProductsCount} prods</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Unidades:</span>
                <strong className="text-[#0057FF] font-bold">{exportedSuccessModal.totalUnitsRequested} un</strong>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleShareOrder(exportedSuccessModal)}
                disabled={sharingOrderId === exportedSuccessModal.id}
                className="w-full py-3 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir Pedido</span>
              </button>

              <button
                onClick={() => handleDownloadOrder(exportedSuccessModal)}
                className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-stone-600" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={() => {
                  setExportedSuccessModal(null);
                  loadDraftData();
                }}
                className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Volver a Solicitudes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED SHARE ORDER MODAL (Online Order + PDF) */}
      {orderToShare && (
        <ShareOrderModal
          order={orderToShare}
          businessName={business?.name || ''}
          userId={userProfile?.uid}
          userName={userProfile?.displayName || userProfile?.email || 'Vendedor'}
          isOpen={!!orderToShare}
          onClose={() => setOrderToShare(null)}
          onShowNotify={showNotify}
        />
      )}
    </div>
  );
};
