import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { Product, Receiving, ReceivingItem, ReplenishmentList } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { 
  createDraftReceiving, 
  createDraftReceivingFromReplenishment,
  updateReceivingDraft, 
  getPendingReceivings,
  getConfirmedReceivings,
  cancelDraftReceiving,
  getReceivingsByBusiness, 
  getExportedReplenishmentOrders,
  confirmReceivingTransaction,
  createOfflineReceiving
} from '../lib/receivingService';
import { cancelReplenishmentOrder } from '../lib/replenishmentService';
import { formatRequestCode } from '../lib/replenishmentPdf';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ShareOrderModal } from './ShareOrderModal';
import { hasPermission } from '../lib/permissions';
import { getUniqueSuppliers, normalizeText, findMatchingSupplier } from '../lib/categoryUtils';
import { 
  Camera, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowLeft, 
  Receipt, 
  Truck, 
  Calendar, 
  Clock, 
  Trash2, 
  ShieldAlert, 
  FileText, 
  Eye, 
  RefreshCw,
  ShoppingBag,
  ListPlus,
  ArrowRight,
  FileSpreadsheet,
  AlertTriangle,
  PlusCircle,
  Sparkles,
  Filter,
  Ban,
  Building2,
  CalendarRange,
  RotateCcw,
  Check,
  LayoutList,
  LayoutGrid
} from 'lucide-react';

interface ReceivingModuleProps {
  onBack?: () => void;
}

export const ReceivingModule: React.FC<ReceivingModuleProps> = ({ onBack }) => {
  const { userProfile, business } = useAuth();

  // Permission checks
  const canReceive = hasPermission(userProfile, 'inventory.receive') || hasPermission(userProfile, 'receiving.create');
  const canConfirm = hasPermission(userProfile, 'receiving.confirm') || hasPermission(userProfile, 'inventory.receive');

  // Products catalog
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Receivings history (CONFIRMED only)
  const [receivings, setReceivings] = useState<Receiving[]>([]);
  const [loadingReceivings, setLoadingReceivings] = useState(false);
  const [selectedReceivingDetail, setSelectedReceivingDetail] = useState<Receiving | null>(null);

  // Pending Drafts (DRAFT only)
  const [pendingDrafts, setPendingDrafts] = useState<Receiving[]>([]);
  const [loadingPendingDrafts, setLoadingPendingDrafts] = useState(false);

  // Exported replenishment orders (Pedidos / Solicitudes a proveedor)
  const [exportedOrders, setExportedOrders] = useState<ReplenishmentList[]>([]);
  const [loadingExportedOrders, setLoadingExportedOrders] = useState(false);

  // View mode for pending orders: 'ROW' (in-line) | 'GRID'
  const [orderViewMode, setOrderViewMode] = useState<'ROW' | 'GRID'>('ROW');

  // Active Tab in Overview/List
  const [activeTab, setActiveTab] = useState<'LIST' | 'HISTORIAL'>('LIST');

  // Active Stage: 'OVERVIEW' | 'CHOOSE_ORIGIN' | 'FORM_MANUAL' | 'CONTROL_ITEMS' | 'REVIEW'
  const [activeStage, setActiveStage] = useState<'OVERVIEW' | 'CHOOSE_ORIGIN' | 'FORM_MANUAL' | 'CONTROL_ITEMS' | 'REVIEW'>('OVERVIEW');

  // Active Draft state
  const [currentDraft, setCurrentDraft] = useState<Receiving | null>(null);

  // Form Init state (Manual)
  const [supplierName, setSupplierName] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [formManualError, setFormManualError] = useState('');
  const [startingReceiving, setStartingReceiving] = useState(false);

  // Modals for Order Detail, Order Cancellation and Remito Input for Solicitud
  const [selectedReplenishmentDetail, setSelectedReplenishmentDetail] = useState<ReplenishmentList | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<ReplenishmentList | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  const [orderToReceive, setOrderToReceive] = useState<ReplenishmentList | null>(null);
  const [receiveDeliveryNoteNumber, setReceiveDeliveryNoteNumber] = useState('');
  const [receiveDeliveryNoteError, setReceiveDeliveryNoteError] = useState('');

  // Filters state for Pending Orders (Tab: LIST)
  const [pendingSupplierFilter, setPendingSupplierFilter] = useState('ALL');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'>('ALL');
  const [pendingDateFilter, setPendingDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [pendingDateStart, setPendingDateStart] = useState('');
  const [pendingDateEnd, setPendingDateEnd] = useState('');
  const [pendingSearchText, setPendingSearchText] = useState('');

  // Filters state for Confirmed Receivings (Tab: HISTORIAL)
  const [historySupplierFilter, setHistorySupplierFilter] = useState('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');
  const [historySearchText, setHistorySearchText] = useState('');

  // Scanner modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Scanned / Selected product dialog state
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scannedQuantity, setScannedQuantity] = useState<number>(1);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);

  // Manual Product Search state inside Draft
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [showManualSearchModal, setShowManualSearchModal] = useState(false);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load products, receivings & exported orders
  const loadData = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    setLoadingReceivings(true);
    setLoadingExportedOrders(true);
    setLoadingPendingDrafts(true);
    try {
      const [prodsList, pendingList, confirmedList, ordersList] = await Promise.all([
        getProductsByBusiness(business.id),
        getPendingReceivings(business.id),
        getConfirmedReceivings(business.id),
        getExportedReplenishmentOrders(business.id)
      ]);
      setProducts(prodsList);
      setPendingDrafts(pendingList);
      setReceivings(confirmedList);
      setExportedOrders(ordersList);

      // Check if there's an existing active DRAFT for this user
      if (currentDraft) {
        const stillDraft = pendingList.find(r => r.id === currentDraft.id);
        if (stillDraft) {
          setCurrentDraft(stillDraft);
        } else {
          setCurrentDraft(null);
        }
      } else {
        const activeUserDraft = pendingList.find(
          (r) => r.createdBy === userProfile?.uid
        );
        if (activeUserDraft) {
          setCurrentDraft(activeUserDraft);
        }
      }
    } catch (err) {
      console.error('Error al cargar datos para recepción:', err);
    } finally {
      setLoadingProducts(false);
      setLoadingReceivings(false);
      setLoadingExportedOrders(false);
      setLoadingPendingDrafts(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business?.id]);

  const showSuccessMsg = (msg: string) => {
    setFeedback({ type: 'success', message: msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const showErrorMsg = (msg: string) => {
    setFeedback({ type: 'error', message: msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const formatDateTime = (isoStr?: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} · ${hours}:${minutes}`;
    } catch {
      return isoStr;
    }
  };

  // Distinct suppliers lists for filters (Normalized without duplicates)
  const distinctPendingSuppliers = useMemo(() => {
    return getUniqueSuppliers(exportedOrders.map((o) => o.supplierName));
  }, [exportedOrders]);

  const distinctHistorySuppliers = useMemo(() => {
    return getUniqueSuppliers(receivings.map((r) => r.supplierName));
  }, [receivings]);

  // Date range checker helper
  const isDateInRange = (dateStr?: string, filterType: string = 'ALL', start?: string, end?: string) => {
    if (!dateStr || filterType === 'ALL') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    
    const now = new Date();
    if (filterType === 'TODAY') {
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }
    if (filterType === 'WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return d >= sevenDaysAgo;
    }
    if (filterType === 'MONTH') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return d >= thirtyDaysAgo;
    }
    if (filterType === 'CUSTOM') {
      if (start) {
        const startDate = new Date(start + 'T00:00:00');
        if (d < startDate) return false;
      }
      if (end) {
        const endDate = new Date(end + 'T23:59:59');
        if (d > endDate) return false;
      }
      return true;
    }
    return true;
  };

  // Filtered Exported Orders
  const filteredExportedOrders = useMemo(() => {
    return exportedOrders.filter((order) => {
      // 1. Supplier filter
      if (pendingSupplierFilter !== 'ALL') {
        const sup = (order.supplierName || '').trim().toLowerCase();
        if (sup !== pendingSupplierFilter.trim().toLowerCase()) return false;
      }

      // 2. Status filter
      if (pendingStatusFilter !== 'ALL') {
        const isCancelled = order.status === 'CANCELLED';
        const isReceived = order.status === 'RECEIVED';
        const isConfirmed = !isCancelled && !isReceived && (!!order.providerResponse || order.publicOrderStatus === 'CONFIRMED_BY_PROVIDER');
        const isPartial = !isCancelled && !isReceived && (
          order.status === 'PARTIALLY_RECEIVED' ||
          (order.providerResponse && order.providerResponse.partialCount > 0) ||
          (order.providerResponse && order.providerResponse.totalUnitsConfirmed < order.providerResponse.totalUnitsRequested && order.providerResponse.totalUnitsConfirmed > 0)
        );
        const isPending = !isCancelled && !isReceived && !isConfirmed && !isPartial;

        if (pendingStatusFilter === 'PENDING' && !isPending) return false;
        if (pendingStatusFilter === 'CONFIRMED' && !isConfirmed) return false;
        if (pendingStatusFilter === 'PARTIAL' && !isPartial) return false;
        if (pendingStatusFilter === 'RECEIVED' && !isReceived) return false;
        if (pendingStatusFilter === 'CANCELLED' && !isCancelled) return false;
      }

      // 3. Date filter
      const dateToCheck = order.exportedAt || order.createdAt;
      if (!isDateInRange(dateToCheck, pendingDateFilter, pendingDateStart, pendingDateEnd)) {
        return false;
      }

      // 4. Search text
      if (pendingSearchText.trim()) {
        const q = pendingSearchText.trim().toLowerCase();
        const code = formatRequestCode(order.id).toLowerCase();
        const sup = (order.supplierName || '').toLowerCase();
        const hasItem = (order.items || []).some(i => i.productName.toLowerCase().includes(q));
        if (!code.includes(q) && !sup.includes(q) && !hasItem) {
          return false;
        }
      }

      return true;
    });
  }, [exportedOrders, pendingSupplierFilter, pendingStatusFilter, pendingDateFilter, pendingDateStart, pendingDateEnd, pendingSearchText]);

  // Filtered History Receivings
  const filteredReceivings = useMemo(() => {
    return receivings.filter((rec) => {
      // 1. Supplier filter
      if (historySupplierFilter !== 'ALL') {
        const sup = (rec.supplierName || '').trim().toLowerCase();
        if (sup !== historySupplierFilter.trim().toLowerCase()) return false;
      }

      // 2. Date filter
      const dateToCheck = rec.confirmedAt || rec.createdAt;
      if (!isDateInRange(dateToCheck, historyDateFilter, historyDateStart, historyDateEnd)) {
        return false;
      }

      // 3. Search text
      if (historySearchText.trim()) {
        const q = historySearchText.trim().toLowerCase();
        const sup = (rec.supplierName || '').toLowerCase();
        const remito = (rec.deliveryNoteNumber || '').toLowerCase();
        const repCode = (rec.replenishmentCode || '').toLowerCase();
        const hasItem = (rec.items || []).some(i => i.productName.toLowerCase().includes(q));
        if (!sup.includes(q) && !remito.includes(q) && !repCode.includes(q) && !hasItem) {
          return false;
        }
      }

      return true;
    });
  }, [receivings, historySupplierFilter, historyDateFilter, historyDateStart, historyDateEnd, historySearchText]);

  // Filtered manual search products inside draft
  const filteredProducts = useMemo(() => {
    const term = manualSearchTerm.toLowerCase().trim();
    if (!term) return products.slice(0, 10);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.category.toLowerCase().includes(term)
    );
  }, [products, manualSearchTerm]);

  // Computed summary for active draft items
  const draftSummary = useMemo(() => {
    if (!currentDraft || !currentDraft.items) {
      return {
        totalRequested: 0,
        totalReceived: 0,
        totalShortage: 0,
        totalSurplus: 0,
        countComplete: 0,
        countPartial: 0,
        countNotDelivered: 0,
        countUnsolicited: 0,
        hasDifferences: false,
        differencesList: [] as { productName: string; requested: number; received: number; type: string }[]
      };
    }

    let totalRequested = 0;
    let totalReceived = 0;
    let totalShortage = 0;
    let totalSurplus = 0;
    let countComplete = 0;
    let countPartial = 0;
    let countNotDelivered = 0;
    let countUnsolicited = 0;
    const differencesList: { productName: string; requested: number; received: number; type: string }[] = [];

    currentDraft.items.forEach((item) => {
      const rec = Math.max(0, item.quantity || 0);
      const req = item.requestedQuantity;
      totalReceived += rec;

      if (req !== undefined && req > 0) {
        totalRequested += req;
        if (rec === req) {
          countComplete++;
        } else if (rec === 0) {
          countNotDelivered++;
          totalShortage += req;
          differencesList.push({
            productName: item.productName,
            requested: req,
            received: 0,
            type: 'NO_ENTREGADO'
          });
        } else if (rec < req) {
          countPartial++;
          totalShortage += (req - rec);
          differencesList.push({
            productName: item.productName,
            requested: req,
            received: rec,
            type: 'FALTANTE'
          });
        } else if (rec > req) {
          totalSurplus += (rec - req);
          differencesList.push({
            productName: item.productName,
            requested: req,
            received: rec,
            type: 'SOBRANTE'
          });
        }
      } else {
        countUnsolicited++;
        if (rec > 0) {
          differencesList.push({
            productName: item.productName,
            requested: 0,
            received: rec,
            type: 'NO_SOLICITADO'
          });
        }
      }
    });

    return {
      totalRequested,
      totalReceived,
      totalShortage,
      totalSurplus,
      countComplete,
      countPartial,
      countNotDelivered,
      countUnsolicited,
      hasDifferences: differencesList.length > 0,
      differencesList
    };
  }, [currentDraft]);

  // 1. INICIAR RECEPCIÓN MANUAL
  const handleStartReceivingManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !userProfile) return;

    const cleanDeliveryNote = deliveryNoteNumber.trim();
    if (!cleanDeliveryNote) {
      setFormManualError('El número de comprobante o remito es obligatorio.');
      return;
    }
    setFormManualError('');

    setStartingReceiving(true);

    const allKnownSuppliers = getUniqueSuppliers([...distinctPendingSuppliers, ...distinctHistorySuppliers]);
    const matching = findMatchingSupplier(supplierName, allKnownSuppliers);
    const cleanSupplier = matching || (supplierName.trim() ? normalizeText(supplierName) : 'Recepción Manual');

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      const localDraft: Receiving = {
        id: `rcv_draft_${Date.now()}`,
        businessId: business.id,
        supplierName: cleanSupplier,
        hasDeliveryNote: true,
        deliveryNoteNumber: cleanDeliveryNote,
        status: 'DRAFT',
        items: [],
        totalProductsCount: 0,
        totalUnitsCount: 0,
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Vendedor',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCurrentDraft(localDraft);
      setActiveStage('CONTROL_ITEMS');
      showSuccessMsg(`Recepción iniciada en modo local (Remito #${cleanDeliveryNote}).`);
      setStartingReceiving(false);
      return;
    }

    try {
      const newDraft = await createDraftReceiving(
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Vendedor',
        cleanSupplier,
        true,
        cleanDeliveryNote
      );

      setCurrentDraft(newDraft);
      setActiveStage('CONTROL_ITEMS');
      showSuccessMsg(`Recepción iniciada (Remito #${cleanDeliveryNote}). Escanea o agrega los productos recibidos.`);
      await loadData();
    } catch (err: any) {
      console.warn('Could not create draft online, falling back to local draft:', err);
      const localDraft: Receiving = {
        id: `rcv_draft_${Date.now()}`,
        businessId: business.id,
        supplierName: cleanSupplier,
        hasDeliveryNote: true,
        deliveryNoteNumber: cleanDeliveryNote,
        status: 'DRAFT',
        items: [],
        totalProductsCount: 0,
        totalUnitsCount: 0,
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Vendedor',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setCurrentDraft(localDraft);
      setActiveStage('CONTROL_ITEMS');
      showSuccessMsg(`Recepción iniciada localmente (Remito #${cleanDeliveryNote}).`);
    } finally {
      setStartingReceiving(false);
    }
  };

  // 2. ABRIR DIÁLOGO DE REMITO ANTES DE RECIBIR SOLICITUD
  const handleOpenReceiveOrderPrompt = (order: ReplenishmentList) => {
    setOrderToReceive(order);
    setReceiveDeliveryNoteNumber('');
    setReceiveDeliveryNoteError('');
  };

  // CONFIRMAR INICIO DE RECEPCIÓN DESDE SOLICITUD
  const handleConfirmStartReceivingFromOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToReceive || !business?.id || !userProfile) return;

    const cleanDeliveryNote = receiveDeliveryNoteNumber.trim();
    if (!cleanDeliveryNote) {
      setReceiveDeliveryNoteError('Debes ingresar el número de comprobante/remito para continuar.');
      return;
    }
    setReceiveDeliveryNoteError('');

    setStartingReceiving(true);
    try {
      const draft = await createDraftReceivingFromReplenishment(
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Vendedor',
        orderToReceive,
        cleanDeliveryNote
      );

      setOrderToReceive(null);
      if (selectedReplenishmentDetail) {
        setSelectedReplenishmentDetail(null);
      }
      setCurrentDraft(draft);
      setActiveStage('CONTROL_ITEMS');
      showSuccessMsg(`Solicitud cargada (${orderToReceive.supplierName || 'Proveedor'} · Remito #${cleanDeliveryNote}). Coteja las cantidades recibidas.`);
      await loadData();
    } catch (err: any) {
      showErrorMsg('Error al cargar solicitud para recepción: ' + err.message);
    } finally {
      setStartingReceiving(false);
    }
  };

  // 3. CANCELAR SOLICITUD
  const handleExecuteCancelOrder = async () => {
    if (!orderToCancel || !business?.id || !userProfile) return;

    setIsCancellingOrder(true);
    try {
      await cancelReplenishmentOrder(
        orderToCancel.id,
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Usuario',
        cancelReason.trim() || 'Cancelado desde Recepción de productos'
      );

      showSuccessMsg(`Solicitud ${formatRequestCode(orderToCancel.id)} cancelada correctamente.`);
      setOrderToCancel(null);
      setCancelReason('');
      if (selectedReplenishmentDetail?.id === orderToCancel.id) {
        setSelectedReplenishmentDetail(null);
      }
      await loadData();
    } catch (err: any) {
      showErrorMsg(err?.message || 'Error al cancelar la solicitud.');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // 4. Scan Barcode Handler
  const handleBarcodeScanned = (barcode: string) => {
    if (!barcode) return;
    const cleanCode = barcode.trim();

    const matched = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanCode.toLowerCase()
    );

    if (matched) {
      setScannedProduct(matched);
      setScannedQuantity(1);
      setUnknownBarcode(null);
    } else {
      setScannedProduct(null);
      setUnknownBarcode(cleanCode);
    }
  };

  // 5. Add Scanned / Selected Product to Draft
  const handleAddProductToDraft = async () => {
    if (!scannedProduct || !currentDraft) return;

    const qtyToAdd = Number(scannedQuantity) || 1;
    if (qtyToAdd < 0) {
      showErrorMsg('La cantidad no puede ser negativa.');
      return;
    }

    const existingItems = [...(currentDraft.items || [])];
    const existingIndex = existingItems.findIndex(
      (item) => item.productId === scannedProduct.id
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex] = {
        ...existingItems[existingIndex],
        quantity: existingItems[existingIndex].quantity + qtyToAdd
      };
    } else {
      existingItems.push({
        productId: scannedProduct.id,
        productName: scannedProduct.name,
        barcode: scannedProduct.barcode || null,
        category: scannedProduct.category,
        requestedQuantity: 0,
        quantity: qtyToAdd,
        currentStockAtScan: scannedProduct.stock
      });
    }

    const updatedDraft: Receiving = {
      ...currentDraft,
      items: existingItems,
      totalProductsCount: existingItems.length,
      totalUnitsCount: existingItems.reduce((sum, i) => sum + i.quantity, 0)
    };
    setCurrentDraft(updatedDraft);

    const addedProdName = scannedProduct.name;
    setScannedProduct(null);
    setScannedQuantity(1);

    try {
      await updateReceivingDraft(
        currentDraft.id, 
        existingItems, 
        userProfile?.uid, 
        business?.id, 
        userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN'
      );
      showSuccessMsg(`+${qtyToAdd} "${addedProdName}" controlado.`);
    } catch (err: any) {
      console.error('Error al actualizar borrador:', err);
    }
  };

  // Update item quantity directly in draft list
  const handleSetItemQuantity = async (productId: string, newQuantity: number) => {
    if (!currentDraft) return;
    const sanitizedQty = Math.max(0, Math.floor(Number(newQuantity) || 0));

    const updatedItems = currentDraft.items.map((item) => {
      if (item.productId === productId) {
        return { ...item, quantity: sanitizedQty };
      }
      return item;
    });

    const updatedDraft: Receiving = {
      ...currentDraft,
      items: updatedItems,
      totalProductsCount: updatedItems.length,
      totalUnitsCount: updatedItems.reduce((sum, i) => sum + i.quantity, 0)
    };
    setCurrentDraft(updatedDraft);

    try {
      await updateReceivingDraft(
        currentDraft.id, 
        updatedItems, 
        userProfile?.uid, 
        business?.id, 
        userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN'
      );
    } catch (err) {
      console.error('Error al actualizar cantidad:', err);
    }
  };

  const handleUpdateItemQuantityDelta = async (productId: string, delta: number) => {
    if (!currentDraft) return;
    const item = currentDraft.items.find((i) => i.productId === productId);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    await handleSetItemQuantity(productId, newQty);
  };

  // Remove item from draft list
  const handleRemoveItem = async (productId: string) => {
    if (!currentDraft) return;

    const updatedItems = currentDraft.items.filter((i) => i.productId !== productId);
    const updatedDraft: Receiving = {
      ...currentDraft,
      items: updatedItems,
      totalProductsCount: updatedItems.length,
      totalUnitsCount: updatedItems.reduce((sum, i) => sum + i.quantity, 0)
    };
    setCurrentDraft(updatedDraft);

    try {
      await updateReceivingDraft(
        currentDraft.id, 
        updatedItems, 
        userProfile?.uid, 
        business?.id, 
        userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN'
      );
      showSuccessMsg('Producto quitado de la recepción.');
    } catch (err) {
      console.error('Error al eliminar item:', err);
    }
  };

  // CONFIRMAR RECEPCIÓN DEFINITIVA
  const handleConfirmReceiving = async () => {
    if (!currentDraft || !business?.id || !userProfile) return;

    setIsSubmittingConfirm(true);

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline || currentDraft.id.startsWith('rcv_draft_')) {
      try {
        await createOfflineReceiving(
          business.id,
          userProfile.uid,
          userProfile.displayName || userProfile.email || 'Vendedor',
          currentDraft.items,
          currentDraft.supplierName,
          currentDraft.hasDeliveryNote,
          currentDraft.deliveryNoteNumber,
          currentDraft.replenishmentId,
          currentDraft.replenishmentCode
        );

        setShowConfirmModal(false);
        setCurrentDraft(null);
        setActiveStage('OVERVIEW');
        showSuccessMsg('📦 Recepción guardada en modo offline. El stock local se actualizó y se sincronizará automáticamente.');
        await loadData();
        return;
      } catch (offlineErr: any) {
        showErrorMsg('Error al guardar recepción offline: ' + offlineErr.message);
        return;
      } finally {
        setIsSubmittingConfirm(false);
      }
    }

    try {
      await confirmReceivingTransaction(
        currentDraft.id,
        business.id,
        userProfile.uid,
        userProfile.displayName || userProfile.email || 'Vendedor',
        userProfile.role === 'ADMIN' || userProfile.role === 'SUPER_ADMIN'
      );

      setShowConfirmModal(false);
      setCurrentDraft(null);
      setActiveStage('OVERVIEW');
      showSuccessMsg('¡Recepción confirmada exitosamente! El stock ha sido actualizado.');
      await loadData();
    } catch (err: any) {
      console.warn('Online confirm failed, attempting offline Outbox fallback:', err);
      try {
        await createOfflineReceiving(
          business.id,
          userProfile.uid,
          userProfile.displayName || userProfile.email || 'Vendedor',
          currentDraft.items,
          currentDraft.supplierName,
          currentDraft.hasDeliveryNote,
          currentDraft.deliveryNoteNumber,
          currentDraft.replenishmentId,
          currentDraft.replenishmentCode
        );

        setShowConfirmModal(false);
        setCurrentDraft(null);
        setActiveStage('OVERVIEW');
        showSuccessMsg('📦 Recepción registrada en Outbox (Modo Offline). El inventario local fue actualizado.');
        await loadData();
      } catch (fallbackErr: any) {
        showErrorMsg('Error al confirmar recepción: ' + (fallbackErr.message || err.message));
      }
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  if (!canReceive) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3 max-w-md mx-auto my-12">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-stone-900">Acceso Restringido</h3>
        <p className="text-xs text-stone-500">
          No tienes permisos para realizar recepciones de productos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between border shadow-xl animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : feedback.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-700'
              : 'bg-stone-900 text-stone-100 border-stone-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {feedback.type === 'info' && <Clock className="w-5 h-5 text-blue-400 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="ml-3 text-stone-400 hover:white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          {activeStage !== 'OVERVIEW' && (
            <button
              onClick={() => {
                if (activeStage === 'REVIEW') setActiveStage('CONTROL_ITEMS');
                else if (activeStage === 'CONTROL_ITEMS') setActiveStage('OVERVIEW');
                else setActiveStage('OVERVIEW');
              }}
              className="p-2 text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-indigo-600" />
              Recepción de Productos
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Controla y confirma el ingreso de productos a tu stock con número de remito obligatorio.
            </p>
          </div>
        </div>

        {/* Big Action Button & Refresh in Overview */}
        {activeStage === 'OVERVIEW' && (
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loadingExportedOrders || loadingReceivings}
              className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer border border-stone-200"
              title="Refrescar solicitudes e historial"
              aria-label="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingExportedOrders || loadingReceivings ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              onClick={() => {
                if (currentDraft) {
                  setActiveStage('CONTROL_ITEMS');
                } else {
                  setActiveStage('CHOOSE_ORIGIN');
                }
              }}
              id="btn-nueva-recepcion"
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {currentDraft ? (
                <>
                  <ListPlus className="w-4 h-4" />
                  <span>[ CONTINUAR RECEPCIÓN ACTIVA ]</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>[ + NUEVA RECEPCIÓN ]</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* STAGE 1: ELECCIÓN DE ORIGEN (WIZARD STEP 1) */}
      {/* ========================================================================= */}
      {activeStage === 'CHOOSE_ORIGIN' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-4 max-w-2xl mx-auto">
          <div className="border-b border-stone-100 pb-3 text-center sm:text-left">
            <h3 className="font-extrabold text-stone-900 text-base flex items-center justify-center sm:justify-start gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              Paso 1: ¿Cómo llegaron los productos?
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Selecciona el origen del ingreso para comparar o cargar directamente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* OPTION A: DESDE UNA SOLICITUD PREVIA */}
            <div
              onClick={() => {
                if (exportedOrders.length > 0) {
                  setActiveStage('OVERVIEW');
                  setActiveTab('LIST');
                }
              }}
              className="p-5 bg-indigo-50/60 hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 rounded-3xl space-y-3 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h4 className="font-black text-stone-900 text-sm">Desde una Solicitud</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Precarga automáticamente los productos solicitados al proveedor para cotejar lo que realmente llegó.
                </p>
              </div>

              <div className="pt-3 border-t border-indigo-200/60">
                {exportedOrders.length === 0 ? (
                  <span className="text-[11px] font-bold text-stone-500 block">
                    No hay solicitudes pendientes
                  </span>
                ) : (
                  <span className="text-xs font-black text-indigo-700 block">
                    {exportedOrders.length} solicitudes disponibles →
                  </span>
                )}
              </div>
            </div>

            {/* OPTION B: INGRESO MANUAL LIBRE */}
            <div
              onClick={() => {
                setSupplierName('');
                setDeliveryNoteNumber('');
                setFormManualError('');
                setActiveStage('FORM_MANUAL');
              }}
              className="p-5 bg-stone-50 hover:bg-stone-100 border-2 border-stone-200 hover:border-stone-400 rounded-3xl space-y-3 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="w-12 h-12 bg-stone-800 text-white rounded-2xl flex items-center justify-center font-bold shadow-xs">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <h4 className="font-black text-stone-900 text-sm">Carga Manual Directa</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Para compras directas o recepciones espontáneas sin una solicitud previa registrada.
                </p>
              </div>

              <div className="pt-3 border-t border-stone-200">
                <span className="text-xs font-black text-stone-800 block">
                  Ingreso libre con escáner →
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 2: FORMULARIO DE INGRESO MANUAL */}
      {/* ========================================================================= */}
      {activeStage === 'FORM_MANUAL' && (
        <form onSubmit={handleStartReceivingManual} className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-4 max-w-lg mx-auto">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Datos de Recepción Manual
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Ingresa el proveedor y el número de remito obligatorio para iniciar el control.
            </p>
          </div>

          {formManualError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formManualError}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Proveedor / Origen (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Distribuidora Arcoiris, Panadería Central..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Número de Remito / Comprobante <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 0001-00045892 o FACT-1298"
                value={deliveryNoteNumber}
                onChange={(e) => {
                  setDeliveryNoteNumber(e.target.value);
                  if (formManualError) setFormManualError('');
                }}
                className="w-full px-3.5 py-2.5 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50/10 font-bold"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                El comprobante es obligatorio para garantizar la trazabilidad de los productos recibidos.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActiveStage('CHOOSE_ORIGIN')}
              className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
            >
              Volver
            </button>

            <button
              type="submit"
              disabled={startingReceiving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              {startingReceiving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <span>[ INICIAR CONTROL DE MERCADERÍA ]</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STAGE 3: ASISTENTE DE CONTROL DE CANTIDADES Y ESCANEO (CONTROL_ITEMS) */}
      {/* ========================================================================= */}
      {activeStage === 'CONTROL_ITEMS' && currentDraft && (
        <div className="space-y-4">
          
          {/* Header Info Banner */}
          <div className="bg-stone-900 text-white p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black bg-indigo-500 text-white px-2 py-0.5 rounded-md">
                  EN CONTROL
                </span>
                <h3 className="text-sm sm:text-base font-bold">{currentDraft.supplierName}</h3>
                {currentDraft.replenishmentCode && (
                  <span className="text-xs font-mono font-bold bg-indigo-900 text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-700">
                    Solicitud #{currentDraft.replenishmentCode}
                  </span>
                )}
                {currentDraft.deliveryNoteNumber ? (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-stone-800 px-2.5 py-0.5 rounded-md border border-stone-700">
                    Remito: #{currentDraft.deliveryNoteNumber}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-rose-300 bg-stone-800 px-2 py-0.5 rounded-md">
                    Sin Remito
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Verifica las unidades recibidas de cada producto antes de confirmar el ingreso al stock.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold bg-stone-800 text-stone-200 px-3 py-1.5 rounded-xl border border-stone-700 font-mono">
                {currentDraft.totalProductsCount} prods · Recibidos: {draftSummary.totalReceived} un
              </span>
            </div>
          </div>

          {/* DYNAMIC METRICS SUMMARY BAR */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Solicitadas</span>
                <span className="font-black text-stone-900 text-base font-mono">{draftSummary.totalRequested} un</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Recibidas</span>
                <span className="font-black text-indigo-600 text-base font-mono">{draftSummary.totalReceived} un</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Faltantes</span>
                <span className={`font-black text-base font-mono ${draftSummary.totalShortage > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                  {draftSummary.totalShortage} un
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Sobrantes</span>
                <span className={`font-black text-base font-mono ${draftSummary.totalSurplus > 0 ? 'text-blue-600' : 'text-stone-400'}`}>
                  +{draftSummary.totalSurplus} un
                </span>
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold pt-1 border-t border-stone-200">
              <span className="text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                🟢 Completo: {draftSummary.countComplete}
              </span>
              {draftSummary.countPartial > 0 && (
                <span className="text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-md">
                  🟡 Parcial: {draftSummary.countPartial}
                </span>
              )}
              {draftSummary.countNotDelivered > 0 && (
                <span className="text-red-800 bg-red-100/80 px-2.5 py-0.5 rounded-md">
                  🔴 No entregado: {draftSummary.countNotDelivered}
                </span>
              )}
              {draftSummary.countUnsolicited > 0 && (
                <span className="text-purple-800 bg-purple-100/80 px-2.5 py-0.5 rounded-md">
                  🆕 No solicitado: {draftSummary.countUnsolicited}
                </span>
              )}
            </div>
          </div>

          {/* QUICK ACTION BUTTONS: SCANNER + MANUAL FINDER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => setIsScannerOpen(true)}
              id="btn-scan-receiving"
              className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5 text-emerald-200" />
              <span>📷 ESCANEAR PRODUCTO</span>
            </button>

            <button
              onClick={() => setShowManualSearchModal(true)}
              className="py-3.5 px-4 bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 font-bold text-xs sm:text-sm rounded-2xl border border-stone-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-stone-600" />
              <span>+ Agregar Producto No Solicitado</span>
            </button>
          </div>

          {/* ITEM LIST CARDS */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
                Productos a Controlar ({currentDraft.items?.length || 0})
              </h4>

              {currentDraft.items && currentDraft.items.length > 0 && (
                <button
                  onClick={() => setActiveStage('REVIEW')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Revisar y Confirmar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {!currentDraft.items || currentDraft.items.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-dashed border-stone-300 space-y-2">
                <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="font-bold text-stone-700">Aún no hay productos cargados en esta recepción</p>
                <p className="text-stone-500">Usa "ESCANEAR PRODUCTO" para comenzar.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentDraft.items.map((item) => {
                  const req = item.requestedQuantity;
                  const conf = item.confirmedQuantity;
                  const rec = item.quantity;
                  const hasConf = conf !== undefined;

                  let statusBadge = null;
                  if (hasConf) {
                    if (conf === 0 && rec === 0) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full border border-red-200">
                          🔴 SIN STOCK
                        </span>
                      );
                    } else if (rec === conf && conf === req) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          🟢 COMPLETO ({rec} un)
                        </span>
                      );
                    } else if (rec === conf && conf < (req || 0)) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-200">
                          🟡 PARCIAL CONFIRMADO ({rec}/{req})
                        </span>
                      );
                    } else if (rec < conf) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-orange-100 text-orange-900 px-2.5 py-0.5 rounded-full border border-orange-200">
                          ⚠️ FALTAN {conf - rec} UN DEL PROV.
                        </span>
                      );
                    } else if (rec > conf) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                          ➕ SOBRANTE (+{rec - conf})
                        </span>
                      );
                    }
                  } else if (req !== undefined && req > 0) {
                    if (rec === req) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          🟢 COMPLETO
                        </span>
                      );
                    } else if (rec === 0) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full border border-red-200">
                          🔴 NO ENTREGADO
                        </span>
                      );
                    } else if (rec < req) {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-200">
                          🟡 FALTAN {req - rec} UN
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                          ⚠️ SOBRANTE (+{rec - req})
                        </span>
                      );
                    }
                  } else {
                    statusBadge = (
                      <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                        🆕 NO SOLICITADO
                      </span>
                    );
                  }

                  const targetMatchQty = hasConf ? conf : (req || 0);

                  return (
                    <div
                      key={item.productId}
                      className={`p-3.5 bg-white border rounded-2xl space-y-3 shadow-2xs transition-all ${
                        rec === 0 ? 'border-red-200 bg-red-50/10' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-stone-900">{item.productName}</p>
                          <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                            {item.barcode ? `#${item.barcode}` : 'Sin código'} {item.category ? `· ${item.category}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0">{statusBadge}</div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-stone-100">
                        <div className="text-xs font-medium text-stone-700 flex items-center gap-2 flex-wrap">
                          {req !== undefined && req > 0 ? (
                            <span>Solicitado: <strong className="text-stone-900 font-mono text-sm">{req}</strong> un</span>
                          ) : (
                            <span className="text-purple-700 font-semibold">No figuraba en el pedido</span>
                          )}

                          {hasConf && (
                            <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded-md font-medium border border-indigo-100">
                              Confirmó prov.: <strong className="font-mono text-indigo-700 font-bold">{conf}</strong> un
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-extrabold text-stone-500 uppercase mr-1">Recibido:</span>
                            <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantityDelta(item.productId, -1)}
                                className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={rec}
                                onChange={(e) => handleSetItemQuantity(item.productId, parseInt(e.target.value) || 0)}
                                className="w-12 text-center font-black text-xs text-stone-900 font-mono py-1 border-x border-stone-200 bg-stone-50 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantityDelta(item.productId, 1)}
                                className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Quick Instant Match Button */}
                          {targetMatchQty > 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetItemQuantity(item.productId, targetMatchQty)}
                              className={`px-2.5 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                                rec === targetMatchQty
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {hasConf ? `✓ CONFIRMADO (${targetMatchQty})` : `✓ COMPLETO (${targetMatchQty})`}
                            </button>
                          )}

                          {/* Quick increments */}
                          <div className="flex items-center gap-1">
                            {[1, 5, 10].map((inc) => (
                              <button
                                key={inc}
                                type="button"
                                onClick={() => handleUpdateItemQuantityDelta(item.productId, inc)}
                                className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] rounded-lg border border-stone-200 cursor-pointer"
                              >
                                +{inc}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer ml-auto"
                            title="Quitar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Review Bar */}
          {currentDraft.items && currentDraft.items.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setActiveStage('REVIEW')}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>[ REVISAR Y CONFIRMAR RECEPCIÓN ]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 4: RESUMEN FINAL Y CONFIRMACIÓN (REVIEW) */}
      {/* ========================================================================= */}
      {activeStage === 'REVIEW' && currentDraft && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-4 max-w-xl mx-auto">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              Resumen Final de Recepción
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Revisa las cantidades y el remito antes de confirmar el ingreso definitivo al stock.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
            <div>
              <span className="text-stone-500 block">Proveedor:</span>
              <strong className="text-stone-900 text-sm">{currentDraft.supplierName}</strong>
            </div>
            <div>
              <span className="text-stone-500 block">Origen:</span>
              <strong className="text-stone-900 text-sm">
                {currentDraft.replenishmentCode ? `Solicitud #${currentDraft.replenishmentCode}` : 'Manual'}
              </strong>
            </div>
            <div>
              <span className="text-stone-500 block">Comprobante / Remito:</span>
              <strong className="text-indigo-700 font-mono font-bold text-sm">
                {currentDraft.deliveryNoteNumber
                  ? `Remito #${currentDraft.deliveryNoteNumber}`
                  : 'Sin Remito'}
              </strong>
            </div>
            <div>
              <span className="text-stone-500 block">Total a Ingresar:</span>
              <strong className="text-emerald-700 font-bold text-sm font-mono">
                {draftSummary.totalReceived} unidades
              </strong>
            </div>
          </div>

          {/* Differences Notice */}
          {draftSummary.hasDifferences && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Se detectaron diferencias con lo solicitado</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Faltantes: {draftSummary.totalShortage} un · Sobrantes: {draftSummary.totalSurplus} un. El inventario solo aumentará por las unidades efectivamente recibidas.
              </p>
            </div>
          )}

          {/* Detailed Item List */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
              Detalle de Productos ({currentDraft.totalProductsCount} variedades)
            </h4>
            <div className="divide-y divide-stone-100 bg-stone-50/50 border border-stone-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
              {currentDraft.items.map((item) => (
                <div key={item.productId} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-stone-900">{item.productName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono mt-0.5">
                      {item.requestedQuantity !== undefined && (
                        <span>Solicitado: {item.requestedQuantity} un</span>
                      )}
                      {item.confirmedQuantity !== undefined && (
                        <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                          Confirmó: {item.confirmedQuantity} un
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-black px-2.5 py-1 rounded-lg font-mono text-xs ${
                      item.quantity > 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200'
                    }`}>
                      Recibido: +{item.quantity} un
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Confirm Buttons */}
          <div className="space-y-2.5 pt-3 border-t border-stone-100">
            {canConfirm ? (
              <button
                onClick={() => setShowConfirmModal(true)}
                id="btn-confirm-receiving"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>[ CONFIRMAR RECEPCIÓN E INGRESAR AL STOCK ]</span>
              </button>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
                Requiere permisos para confirmar recepciones.
              </div>
            )}

            <button
              onClick={() => setActiveStage('CONTROL_ITEMS')}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Editar Cantidades</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OVERVIEW / HISTORIAL LISTINGS */}
      {/* ========================================================================= */}
      {activeStage === 'OVERVIEW' && (
        <div className="space-y-4">
          {/* Sub-tabs in Overview */}
          <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'LIST'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Recepciones Pendientes</span>
              {exportedOrders.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'LIST' ? 'bg-indigo-800 text-white' : 'bg-stone-300 text-stone-800'
                }`}>
                  {exportedOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('HISTORIAL')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'HISTORIAL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Historial Confirmado ({receivings.length})</span>
            </button>
          </div>

          {/* TAB 1: RECEPCIONES PENDIENTES */}
          {activeTab === 'LIST' && (
            <div className="space-y-3.5">
              {/* Active Draft Alert */}
              {currentDraft && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Receipt className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                          Borrador en Curso
                        </span>
                        <span className="text-xs font-bold text-stone-800">{currentDraft.supplierName}</span>
                        {currentDraft.deliveryNoteNumber && (
                          <span className="text-xs font-mono font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                            Remito #{currentDraft.deliveryNoteNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {currentDraft.totalProductsCount} prods ({currentDraft.totalUnitsCount} un)
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveStage('CONTROL_ITEMS')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Continuar Control</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* FILTER BAR FOR PENDING ORDERS */}
              <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    Filtros de Solicitudes
                  </span>
                  {(pendingSupplierFilter !== 'ALL' || pendingStatusFilter !== 'ALL' || pendingDateFilter !== 'ALL' || pendingSearchText) && (
                    <button
                      onClick={() => {
                        setPendingSupplierFilter('ALL');
                        setPendingStatusFilter('ALL');
                        setPendingDateFilter('ALL');
                        setPendingDateStart('');
                        setPendingDateEnd('');
                        setPendingSearchText('');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpiar Filtros</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Search text */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Buscar por código, proveedor o producto..."
                      value={pendingSearchText}
                      onChange={(e) => setPendingSearchText(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  {/* Supplier filter */}
                  <div>
                    <select
                      value={pendingSupplierFilter}
                      onChange={(e) => setPendingSupplierFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="ALL">Todos los Proveedores ({distinctPendingSuppliers.length})</option>
                      {distinctPendingSuppliers.map((sup) => (
                        <option key={sup} value={sup}>{sup}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status filter */}
                  <div>
                    <select
                      value={pendingStatusFilter}
                      onChange={(e) => setPendingStatusFilter(e.target.value as any)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium cursor-pointer"
                    >
                      <option value="ALL">Todos los Estados</option>
                      <option value="PENDING">Solicitado</option>
                      <option value="CONFIRMED">Confirmado por proveedor</option>
                      <option value="PARTIAL">Parcialmente recibido</option>
                      <option value="RECEIVED">Recibido</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                  </div>

                  {/* Date quick filter */}
                  <div>
                    <select
                      value={pendingDateFilter}
                      onChange={(e) => setPendingDateFilter(e.target.value as any)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="ALL">Todas las Fechas</option>
                      <option value="TODAY">Hoy</option>
                      <option value="WEEK">Últimos 7 días</option>
                      <option value="MONTH">Últimos 30 días</option>
                      <option value="CUSTOM">Rango personalizado</option>
                    </select>
                  </div>
                </div>

                {/* Custom Date Range picker if selected */}
                {pendingDateFilter === 'CUSTOM' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <span className="text-[11px] font-bold text-stone-600">Desde:</span>
                    <input
                      type="date"
                      value={pendingDateStart}
                      onChange={(e) => setPendingDateStart(e.target.value)}
                      className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
                    />
                    <span className="text-[11px] font-bold text-stone-600">Hasta:</span>
                    <input
                      type="date"
                      value={pendingDateEnd}
                      onChange={(e) => setPendingDateEnd(e.target.value)}
                      className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Pending Orders from Replenishment */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
                    Solicitudes enviadas a Proveedores ({filteredExportedOrders.length})
                  </h4>
                  <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setOrderViewMode('ROW')}
                      className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                        orderViewMode === 'ROW' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title="Vista en Lista / Filas"
                      aria-label="Vista en Lista"
                    >
                      <LayoutList className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderViewMode('GRID')}
                      className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
                        orderViewMode === 'GRID' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                      title="Vista en Tarjetas"
                      aria-label="Vista en Tarjetas"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {loadingExportedOrders ? (
                  <div className="p-8 text-center text-stone-500 text-xs">Cargando solicitudes...</div>
                ) : filteredExportedOrders.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                    <FileSpreadsheet className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="font-bold text-stone-700">No se encontraron solicitudes pendientes</p>
                    <p className="text-stone-500 max-w-sm mx-auto">
                      {exportedOrders.length > 0
                        ? 'No hay solicitudes que coincidan con los filtros seleccionados.'
                        : 'Puedes iniciar una recepción manual con el botón superior o generar una nueva solicitud.'}
                    </p>
                  </div>
                ) : orderViewMode === 'ROW' ? (
                  /* ================= VISTA EN LÍNEA / FILAS ================= */
                  <div className="space-y-2.5">
                    {filteredExportedOrders.map((order) => {
                      const totalUnits = (order.items || []).reduce((sum, i) => sum + i.requestedQuantity, 0);
                      const reqCode = formatRequestCode(order.id);
                      const orderDate = formatDateTime(order.exportedAt || order.createdAt);
                      const isConfirmed = !!order.providerResponse || order.publicOrderStatus === 'CONFIRMED_BY_PROVIDER';
                      const pResp = order.providerResponse;

                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-2xl p-3.5 sm:p-4 transition-all shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 hover:shadow-xs ${
                            isConfirmed ? 'border-emerald-300 ring-1 ring-emerald-400/30' : 'border-stone-200 hover:border-indigo-300'
                          }`}
                        >
                          {/* Info Column */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-black bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                {reqCode}
                              </span>
                              {isConfirmed ? (
                                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>CONFIRMADO POR PROV.</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase border border-amber-200">
                                  SOLICITADO
                                </span>
                              )}
                              <span className="text-xs font-black text-stone-900 truncate">
                                {order.supplierName || 'Proveedor sin especificar'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                              <span className="font-semibold text-stone-700">
                                {order.items?.length || 0} variedades · {totalUnits} un. solicitadas
                              </span>
                              <span className="text-stone-300 hidden sm:inline">|</span>
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-stone-400" />
                                {orderDate}
                              </span>
                              {order.exporterName && (
                                <>
                                  <span className="text-stone-300 hidden sm:inline">|</span>
                                  <span className="text-stone-600 text-[11px]">Por: {order.exporterName}</span>
                                </>
                              )}
                            </div>

                            {/* Supplier Confirmation Note if present */}
                            {pResp && (
                              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-xs text-emerald-950 flex items-center gap-2 flex-wrap mt-1">
                                <span className="font-bold text-[11px] text-emerald-900">Entrega confirmada:</span>
                                <span className="font-mono text-emerald-800 bg-white px-2 py-0.2 rounded border border-emerald-200 font-black text-[11px]">
                                  {pResp.totalUnitsConfirmed} / {pResp.totalUnitsRequested} un
                                </span>
                                {pResp.noStockCount > 0 && (
                                  <span className="text-[10px] text-red-700 font-semibold">
                                    ⚠️ {pResp.noStockCount} sin stock
                                  </span>
                                )}
                                {pResp.providerNote && (
                                  <span className="text-[11px] text-stone-600 italic">
                                    "{pResp.providerNote}"
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions Column (Aligned Right) */}
                          <div className="flex items-center gap-2 self-stretch lg:self-center shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-stone-100">
                            <button
                              onClick={() => handleOpenReceiveOrderPrompt(order)}
                              disabled={startingReceiving}
                              className="flex-1 lg:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <span>[ RECIBIR ESTA SOLICITUD ]</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setSelectedReplenishmentDetail(order)}
                              className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5 text-stone-500" />
                              <span>[ VER DETALLE ]</span>
                            </button>

                            <button
                              onClick={() => setOrderToCancel(order)}
                              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                              title="Cancelar solicitud"
                              aria-label="Cancelar solicitud"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ================= VISTA EN TARJETAS / GRID ================= */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredExportedOrders.map((order) => {
                      const totalUnits = (order.items || []).reduce((sum, i) => sum + i.requestedQuantity, 0);
                      const reqCode = formatRequestCode(order.id);
                      const orderDate = formatDateTime(order.exportedAt || order.createdAt);
                      const isConfirmed = !!order.providerResponse || order.publicOrderStatus === 'CONFIRMED_BY_PROVIDER';
                      const pResp = order.providerResponse;

                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-2xl p-4 space-y-3.5 transition-all shadow-2xs flex flex-col justify-between ${
                            isConfirmed ? 'border-emerald-300 ring-1 ring-emerald-400/30' : 'border-stone-200 hover:border-indigo-300'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-mono font-black bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                {reqCode}
                              </span>
                              {isConfirmed ? (
                                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>CONFIRMADO POR PROV.</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full uppercase border border-amber-200">
                                  SOLICITADO
                                </span>
                              )}
                            </div>

                            <div>
                              <h4 className="font-bold text-stone-900 text-sm">
                                {order.supplierName || 'Proveedor sin especificar'}
                              </h4>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {order.items?.length || 0} variedades · {totalUnits} unidades solicitadas
                              </p>
                            </div>

                            {/* Supplier Confirmation highlight if available */}
                            {pResp && (
                              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 space-y-1 text-xs text-emerald-950">
                                <div className="flex items-center justify-between font-bold text-[11px]">
                                  <span>Entrega Confirmada:</span>
                                  <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-black">
                                    {pResp.totalUnitsConfirmed} / {pResp.totalUnitsRequested} un
                                  </span>
                                </div>
                                {pResp.noStockCount > 0 && (
                                  <p className="text-[10px] text-red-700 font-semibold">
                                    ⚠️ {pResp.noStockCount} producto(s) sin stock según proveedor
                                  </p>
                                )}
                                {pResp.providerNote && (
                                  <p className="text-[11px] text-stone-600 italic mt-0.5 border-t border-emerald-200/50 pt-1">
                                    "{pResp.providerNote}"
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                              <span className="flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5 text-stone-400" />
                                {orderDate}
                              </span>
                              {order.exporterName && (
                                <span className="text-stone-600 font-medium">
                                  Por: {order.exporterName}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-stone-100">
                            <button
                              onClick={() => handleOpenReceiveOrderPrompt(order)}
                              disabled={startingReceiving}
                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>[ RECIBIR ESTA SOLICITUD ]</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedReplenishmentDetail(order)}
                                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-stone-500" />
                                <span>[ VER DETALLE ]</span>
                              </button>

                              <button
                                onClick={() => setOrderToCancel(order)}
                                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Cancelar solicitud"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Cancelar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HISTORIAL CONFIRMADO */}
          {activeTab === 'HISTORIAL' && (
            <div className="space-y-3.5">
              {/* Filter bar for History */}
              <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    Filtros del Historial
                  </span>
                  {(historySupplierFilter !== 'ALL' || historyDateFilter !== 'ALL' || historySearchText) && (
                    <button
                      onClick={() => {
                        setHistorySupplierFilter('ALL');
                        setHistoryDateFilter('ALL');
                        setHistoryDateStart('');
                        setHistoryDateEnd('');
                        setHistorySearchText('');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpiar Filtros</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Buscar por proveedor, remito o producto..."
                      value={historySearchText}
                      onChange={(e) => setHistorySearchText(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <select
                      value={historySupplierFilter}
                      onChange={(e) => setHistorySupplierFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="ALL">Todos los Proveedores ({distinctHistorySuppliers.length})</option>
                      {distinctHistorySuppliers.map((sup) => (
                        <option key={sup} value={sup}>{sup}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={historyDateFilter}
                      onChange={(e) => setHistoryDateFilter(e.target.value as any)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    >
                      <option value="ALL">Todas las Fechas</option>
                      <option value="TODAY">Hoy</option>
                      <option value="WEEK">Últimos 7 días</option>
                      <option value="MONTH">Últimos 30 días</option>
                      <option value="CUSTOM">Rango personalizado</option>
                    </select>
                  </div>
                </div>

                {historyDateFilter === 'CUSTOM' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <span className="text-[11px] font-bold text-stone-600">Desde:</span>
                    <input
                      type="date"
                      value={historyDateStart}
                      onChange={(e) => setHistoryDateStart(e.target.value)}
                      className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
                    />
                    <span className="text-[11px] font-bold text-stone-600">Hasta:</span>
                    <input
                      type="date"
                      value={historyDateEnd}
                      onChange={(e) => setHistoryDateEnd(e.target.value)}
                      className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Receivings list */}
              {loadingReceivings ? (
                <div className="p-8 text-center text-stone-500 text-xs">Cargando recepciones...</div>
              ) : filteredReceivings.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-xs bg-stone-50 rounded-2xl border border-stone-200">
                  {receivings.length > 0
                    ? 'No hay recepciones que coincidan con los filtros seleccionados.'
                    : 'No hay recepciones confirmadas registradas en el historial.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredReceivings.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedReceivingDetail(rec)}
                      className="p-3.5 bg-white border border-stone-200 hover:border-stone-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer shadow-2xs transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            rec.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm">{rec.supplierName}</span>
                            {rec.deliveryNoteNumber && (
                              <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md">
                                Remito #{rec.deliveryNoteNumber}
                              </span>
                            )}
                            {rec.replenishmentCode && (
                              <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">
                                Solicitud #{rec.replenishmentCode}
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
                              CONFIRMADA
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {rec.totalProductsCount} prods ({rec.totalUnitsCount} un) · {formatDateTime(rec.confirmedAt || rec.createdAt)}
                          </p>
                        </div>
                      </div>

                      <button className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Detalle</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REMITO / COMPROBANTE PROMPT BEFORE STARTING RECEIVING FROM ORDER */}
      {/* ========================================================================= */}
      {orderToReceive && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleConfirmStartReceivingFromOrder}
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-stone-900 text-base">Comprobante de Recepción</h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderToReceive(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Solicitud:</span>
                <strong className="text-indigo-900 font-mono">{formatRequestCode(orderToReceive.id)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Proveedor:</span>
                <strong className="text-stone-900">{orderToReceive.supplierName || 'Sin especificar'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Solicitado:</span>
                <strong className="text-stone-900">
                  {(orderToReceive.items || []).reduce((sum, i) => sum + i.requestedQuantity, 0)} unidades
                </strong>
              </div>
            </div>

            {receiveDeliveryNoteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{receiveDeliveryNoteError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700">
                Número de Remito / Comprobante de Entrega <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ej: 0001-00034567 o FACT-8891"
                value={receiveDeliveryNoteNumber}
                onChange={(e) => {
                  setReceiveDeliveryNoteNumber(e.target.value);
                  if (receiveDeliveryNoteError) setReceiveDeliveryNoteError('');
                }}
                className="w-full px-3.5 py-2.5 border-2 border-indigo-300 focus:border-indigo-600 rounded-xl text-sm font-mono outline-none bg-indigo-50/20 font-bold"
              />
              <p className="text-[11px] text-stone-500">
                Ingresa el número impreso en el remito o factura que acompaña la entrega.
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderToReceive(null)}
                className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={startingReceiving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {startingReceiving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Iniciando...</span>
                  </>
                ) : (
                  <>
                    <span>[ INICIAR CONTROL ]</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER DETALLE / COMPARTIR SOLICITUD (UNIFICADO) */}
      {/* ========================================================================= */}
      {selectedReplenishmentDetail && (
        <ShareOrderModal
          order={selectedReplenishmentDetail}
          businessName={business?.name || 'MiniMarket'}
          userId={userProfile?.uid}
          userName={userProfile?.displayName || userProfile?.email || 'Usuario'}
          isOpen={!!selectedReplenishmentDetail}
          onClose={() => setSelectedReplenishmentDetail(null)}
          onShowNotify={(msg, type) => {
            if (type === 'error') showErrorMsg(msg);
            else showSuccessMsg(msg);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR CANCELACIÓN DE SOLICITUD */}
      {/* ========================================================================= */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-stone-200">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Ban className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-base sm:text-lg font-black text-stone-900">¿Cancelar Solicitud?</h3>
              <p className="text-xs font-mono font-bold text-indigo-700 mt-0.5">
                {formatRequestCode(orderToCancel.id)} · {orderToCancel.supplierName || 'Sin proveedor'}
              </p>
              <p className="text-xs text-stone-600 mt-2">
                Esta acción anulará la solicitud y no podrá ser recibida. La operación quedará registrada en la auditoría.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase text-stone-600">
                Motivo de cancelación (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ej: Proveedor sin stock, pedido duplicado..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none bg-stone-50 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReason('');
                }}
                disabled={isCancellingOrder}
                className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleExecuteCancelOrder}
                disabled={isCancellingOrder}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {isCancellingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <span>Sí, Cancelar Solicitud</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRODUCTO ENCONTRADO AL ESCANEAR */}
      {/* ========================================================================= */}
      {scannedProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Producto Encontrado
              </span>
              <button onClick={() => setScannedProduct(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="text-base font-black text-stone-900 leading-snug">{scannedProduct.name}</h4>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {scannedProduct.barcode ? `#${scannedProduct.barcode}` : 'Sin código'} · Stock actual: {scannedProduct.stock} un
              </p>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700">
                Cantidad Recibida:
              </label>
              <div className="flex items-center justify-between">
                <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setScannedQuantity(Math.max(1, scannedQuantity - 1))}
                    className="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={scannedQuantity}
                    onChange={(e) => setScannedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 text-center font-black text-sm text-stone-900 font-mono py-2 bg-stone-50 border-x border-stone-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setScannedQuantity(scannedQuantity + 1)}
                    className="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 5, 10].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setScannedQuantity(scannedQuantity + delta)}
                      className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      +{delta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddProductToDraft}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>[ AGREGAR A LA RECEPCIÓN ]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUSCADOR MANUAL DE PRODUCTOS */}
      {/* ========================================================================= */}
      {showManualSearchModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-black text-stone-900 text-sm flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                Agregar Producto No Solicitado
              </h4>
              <button onClick={() => setShowManualSearchModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o categoría..."
                value={manualSearchTerm}
                onChange={(e) => setManualSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm outline-none bg-indigo-50/20"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 max-h-60 pr-1">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setScannedProduct(p);
                    setScannedQuantity(1);
                    setShowManualSearchModal(false);
                    setManualSearchTerm('');
                  }}
                  className="p-2.5 hover:bg-indigo-50/70 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-colors"
                >
                  <div>
                    <p className="font-bold text-stone-900 text-xs sm:text-sm">{p.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      {p.barcode ? `#${p.barcode}` : 'Sin código'} {p.category ? `· ${p.category}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                    + Seleccionar
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMACIÓN DEFINITIVA DE RECEPCIÓN */}
      {/* ========================================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-stone-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-stone-900">¿Confirmar Recepción?</h3>
              <p className="text-xs text-stone-600 mt-1">
                Se incrementará el stock de los <strong className="text-stone-900">{currentDraft?.items?.length || 0} productos</strong> ({draftSummary.totalReceived} unidades) con remito #{currentDraft?.deliveryNoteNumber || 'S/N'}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmittingConfirm}
                className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmReceiving}
                disabled={isSubmittingConfirm}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
              >
                {isSubmittingConfirm ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Actualizando Stock...</span>
                  </>
                ) : (
                  <span>Sí, Confirmar Recepción</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCANNER MODAL */}
      {/* ========================================================================= */}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onDetected={(code) => {
            handleBarcodeScanned(code);
            setIsScannerOpen(false);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* DETAIL MODAL FOR HISTORICAL RECEIVINGS */}
      {/* ========================================================================= */}
      {selectedReceivingDetail && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div>
                <h4 className="font-bold text-stone-900 text-sm">Detalle de Recepción</h4>
                <p className="text-[11px] text-stone-500">{formatDateTime(selectedReceivingDetail.confirmedAt || selectedReceivingDetail.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedReceivingDetail(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div>
                <span className="text-stone-500 block">Proveedor:</span>
                <strong className="text-stone-900">{selectedReceivingDetail.supplierName}</strong>
              </div>
              <div>
                <span className="text-stone-500 block">Remito / Comprobante:</span>
                <strong className="text-indigo-700 font-mono font-bold">
                  {selectedReceivingDetail.deliveryNoteNumber ? `#${selectedReceivingDetail.deliveryNoteNumber}` : 'Sin remito'}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 block">Solicitud Vinculada:</span>
                <strong className="text-stone-900 font-mono">
                  {selectedReceivingDetail.replenishmentCode ? `#${selectedReceivingDetail.replenishmentCode}` : 'Manual'}
                </strong>
              </div>
              <div>
                <span className="text-stone-500 block">Total Unidades Ingresadas:</span>
                <strong className="text-emerald-700 font-bold font-mono">+{selectedReceivingDetail.totalUnitsCount} un</strong>
              </div>
            </div>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden text-xs">
              {selectedReceivingDetail.items.map((it) => (
                <div key={it.productId} className="p-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-stone-900">{it.productName}</span>
                    {it.requestedQuantity !== undefined && (
                      <span className="text-[10px] text-stone-500 block">Solicitado: {it.requestedQuantity} un</span>
                    )}
                  </div>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                    +{it.quantity} un
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReceivingDetail(null)}
                className="px-4 py-2 bg-stone-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
