import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { Product, CartItem, PosStatus, PaymentMethod, Sale, PosNote, MercadoPagoSource } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { processSale, getSalesByBusiness } from '../lib/saleService';
import { getPosNotesByBusiness } from '../lib/posNoteService';
import { PosNotesModal } from './PosNotesModal';
import { LocalDataIndicator } from './LocalDataIndicator';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { SyncOperationsModal } from './SyncOperationsModal';
import { useSyncStatus } from '../lib/useSyncStatus';
import { 
  Search, 
  Barcode, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  Store, 
  Package, 
  Zap, 
  RefreshCw, 
  RotateCcw,
  Sparkles,
  Info,
  Banknote,
  QrCode,
  Smartphone,
  CreditCard,
  Check,
  ArrowRight,
  DollarSign,
  History,
  Calculator,
  Receipt,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  NotebookPen,
  Eye
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptPrintAnimation } from './ReceiptPrintAnimation';
import { CategoryIcon } from './CategoryIcon';
import { getCategoryColorClasses } from '../lib/categoryUtils';
import { playNotificationSound } from '../lib/soundService';
import { PaymentVerification } from '../types';

export const PosCaja: React.FC = () => {
  const { userProfile, business } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  // Cart state (local frontend state only)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posStatus, setPosStatus] = useState<PosStatus>('IDLE');
  
  // Search & Scanner state
  const [searchTerm, setSearchTerm] = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
  } | null>(null);

  // Modal confirmation for cancelling cart
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Modal payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitMpAmount, setSplitMpAmount] = useState<number>(0);
  const [splitCashReceived, setSplitCashReceived] = useState<string>('');
  const [qrNeedsRegeneration, setQrNeedsRegeneration] = useState(false);
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Mercado Pago Real In-Store Order & Status States
  const [mpOrderState, setMpOrderState] = useState<'IDLE' | 'CREATING' | 'WAITING_PAYMENT' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'ERROR'>('IDLE');
  const [mpSource, setMpSource] = useState<MercadoPagoSource>('STATIC_POS_QR');
  const [mpOrderRef, setMpOrderRef] = useState<string | null>(null);
  const [mpOrderId, setMpOrderId] = useState<string | null>(null);
  const [mpPaymentId, setMpPaymentId] = useState<string | null>(null);
  const [mpOrderAmount, setMpOrderAmount] = useState<number | null>(null);
  const [mpAutoConfirmed, setMpAutoConfirmed] = useState(false);
  const [mpErrorMessage, setMpErrorMessage] = useState<string | null>(null);

  // Thermal Receipt Print Animation state
  const [showReceiptAnimation, setShowReceiptAnimation] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Today Sales History Slide-out / Modal (Block H)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTimeFrom, setHistoryTimeFrom] = useState('');
  const [historyTimeTo, setHistoryTimeTo] = useState('');
  const [historyMinAmount, setHistoryMinAmount] = useState('');
  const [historyMaxAmount, setHistoryMaxAmount] = useState('');
  const [historyMethod, setHistoryMethod] = useState<'ALL' | PaymentMethod>('ALL');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [viewingTicketSale, setViewingTicketSale] = useState<Sale | null>(null);

  // Budget Calculator Modal (Block G)
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState<number>(1000);
  const [budgetProduct, setBudgetProduct] = useState<Product | null>(null);
  const [budgetSearch, setBudgetSearch] = useState('');

  // Anotaciones / Block de Notas State
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [posNotes, setPosNotes] = useState<PosNote[]>([]);

  // Sync / Conflict Modal State
  const [showSyncConflictModal, setShowSyncConflictModal] = useState(false);
  const { stats: syncStats } = useSyncStatus(business?.id);

  // Auto-focus input for barcode scanner
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);

  // Load products for current business
  const loadProducts = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    try {
      const data = await getProductsByBusiness(business.id);
      setProducts(data.filter((p) => p.active));
    } catch (err) {
      console.error('Error loading products for POS:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load pos notes for current business
  const loadPosNotes = async () => {
    if (!business?.id) return;
    try {
      const data = await getPosNotesByBusiness(business.id);
      setPosNotes(data);
    } catch (err) {
      console.error('Error loading pos notes:', err);
    }
  };

  // Load today sales for current business
  const loadTodaySales = async () => {
    if (!business?.id) return;
    setLoadingHistory(true);
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const data = await getSalesByBusiness(business.id, startOfDay.toISOString());
      setTodaySales(data);
    } catch (err) {
      console.error('Error loading today sales:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load all business sales to compute real-time sales ranking for frequent products
  const loadSalesForRanking = async () => {
    if (!business?.id) return;
    try {
      const data = await getSalesByBusiness(business.id);
      setAllSales(data);
    } catch (err) {
      console.error('Error loading sales for ranking:', err);
    }
  };

  const [mpIntegrationConfig, setMpIntegrationConfig] = useState<{
    enabled: boolean;
    mode: 'TEST' | 'PRODUCTION';
    connectionStatus: string;
  } | null>(null);

  const isMpActive = Boolean(mpIntegrationConfig?.enabled);

  const loadMpConfig = async () => {
    try {
      const bId = business?.id || 'default';
      const res = await fetch(`/api/mercadopago/status?businessId=${encodeURIComponent(bId)}`);
      const data = await res.json();
      if (data?.config) {
        setMpIntegrationConfig({
          enabled: Boolean(data.config.enabled),
          mode: data.config.mode || 'TEST',
          connectionStatus: data.config.connectionStatus || 'NOT_VERIFIED',
        });
      }
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    loadProducts();
    loadPosNotes();
    loadMpConfig();
    loadSalesForRanking();
  }, [business?.id]);

  const pendingNotesCount = useMemo(() => {
    return posNotes.filter((n) => !n.isCompleted).length;
  }, [posNotes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.innerWidth >= 1024) {
        searchInputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [cart, notification]);

  const showNotification = (message: string, type: 'error' | 'warning' | 'success' | 'info' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      );
    });
  }, [products, searchTerm]);

  // Automatic calculation of Frequent Products / Quick Access based on actual finalized sales units for the CURRENT CALENDAR WEEK (Monday 00:00:00 -> Sunday 23:59:59)
  const frequentProducts = useMemo(() => {
    const activeProducts = products.filter((p) => p.active);
    if (activeProducts.length === 0) return [];

    // Calculate current calendar week boundaries: Monday 00:00:00.000 to Sunday 23:59:59.999
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
    const startOfWeekTime = startOfWeek.getTime();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfWeekTime = endOfWeek.getTime();

    // Map of productId -> { unitsSold: number, lastSaleTime: number }
    const salesStatsMap = new Map<string, { unitsSold: number; lastSaleTime: number }>();

    for (const sale of allSales) {
      // Only count confirmed / completed sales (exclude CANCELLED or non-finalized)
      if (sale.status && sale.status !== 'COMPLETED') {
        continue;
      }

      const rawTime = sale.createdAt ? new Date(sale.createdAt).getTime() : 0;
      const saleTime = isNaN(rawTime) ? 0 : rawTime;

      // Filter strictly to current calendar week (Monday to Sunday)
      if (saleTime < startOfWeekTime || saleTime > endOfWeekTime) {
        continue;
      }

      if (Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (!item.productId) continue;
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;

          const current = salesStatsMap.get(item.productId) || { unitsSold: 0, lastSaleTime: 0 };
          current.unitsSold += qty;
          if (saleTime > current.lastSaleTime) {
            current.lastSaleTime = saleTime;
          }
          salesStatsMap.set(item.productId, current);
        }
      }
    }

    // Sort active products:
    // 1. Highest units sold this week first
    // 2. Most recent sale time on tie
    // 3. Stable alphabetical name order on secondary tie
    return [...activeProducts]
      .map((p) => {
        const stat = salesStatsMap.get(p.id) || { unitsSold: 0, lastSaleTime: 0 };
        return {
          ...p,
          unitsSold: stat.unitsSold,
          lastSaleTime: stat.lastSaleTime,
        };
      })
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) {
          return b.unitsSold - a.unitsSold;
        }

        if (b.lastSaleTime !== a.lastSaleTime) {
          return b.lastSaleTime - a.lastSaleTime;
        }

        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      })
      .slice(0, 12);
  }, [products, allSales]);

  const filteredTodaySales = useMemo(() => {
    return todaySales.filter((sale) => {
      // Payment method filter
      if (historyMethod !== 'ALL' && sale.paymentMethod !== historyMethod) {
        return false;
      }

      // Time filter (HH:mm)
      if (sale.createdAt) {
        const saleDate = new Date(sale.createdAt);
        if (!isNaN(saleDate.getTime())) {
          const saleHours = saleDate.getHours();
          const saleMinutes = saleDate.getMinutes();
          const saleTimeStr = `${String(saleHours).padStart(2, '0')}:${String(saleMinutes).padStart(2, '0')}`;

          if (historyTimeFrom && saleTimeStr < historyTimeFrom) return false;
          if (historyTimeTo && saleTimeStr > historyTimeTo) return false;
        }
      }

      // Amount filter
      if (historyMinAmount !== '') {
        const min = parseFloat(historyMinAmount);
        if (!isNaN(min) && (sale.total || 0) < min) return false;
      }
      if (historyMaxAmount !== '') {
        const max = parseFloat(historyMaxAmount);
        if (!isNaN(max) && (sale.total || 0) > max) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [todaySales, historyMethod, historyTimeFrom, historyTimeTo, historyMinAmount, historyMaxAmount]);

  const hasHistoryFilters = historyTimeFrom !== '' || historyTimeTo !== '' || historyMinAmount !== '' || historyMaxAmount !== '' || historyMethod !== 'ALL';

  const clearHistoryFilters = () => {
    setHistoryTimeFrom('');
    setHistoryTimeTo('');
    setHistoryMinAmount('');
    setHistoryMaxAmount('');
    setHistoryMethod('ALL');
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.product.salePrice, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (product: Product, quantityToAdd = 1) => {
    if (!product.active) {
      showNotification('El producto está inactivo', 'warning');
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const requestedQty = currentQtyInCart + quantityToAdd;

    if (product.tracksStock !== false && requestedQty > product.stock) {
      showNotification(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock} u.`,
        'warning'
      );
      return;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity = requestedQty;
      setCart(newCart);
    } else {
      setCart([...cart, { product, quantity: quantityToAdd }]);
    }

    setPosStatus('SHOPPING');
    setNotification(null);
  };

  const handleSelectProduct = (product: Product, quantityToAdd = 1) => {
    addToCart(product, quantityToAdd);
    setSearchTerm('');

    if (window.innerWidth < 1024) {
      searchInputRef.current?.blur();
      setTimeout(() => {
        cartRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        if (cartListRef.current) {
          cartListRef.current.scrollTo({
            top: cartListRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    } else {
      searchInputRef.current?.focus();
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return;

    const exactBarcodeMatch = products.find(
      (p) => p.barcode && p.barcode.trim() === cleanTerm
    );

    if (exactBarcodeMatch) {
      handleSelectProduct(exactBarcodeMatch, 1);
      return;
    }

    const exactNameMatch = products.find(
      (p) => p.name.toLowerCase().trim() === cleanTerm.toLowerCase()
    );

    if (exactNameMatch) {
      handleSelectProduct(exactNameMatch, 1);
      return;
    }

    if (filteredProducts.length === 1) {
      handleSelectProduct(filteredProducts[0], 1);
      return;
    }

    showNotification('Producto no encontrado', 'error');
    searchInputRef.current?.select();
  };

  const handleCameraBarcodeScanned = (scannedCode: string) => {
    const cleanCode = scannedCode ? scannedCode.trim() : '';
    if (!cleanCode) return;

    const exactMatch = products.find(
      (p) => p.barcode && p.barcode.trim() === cleanCode
    );

    if (!exactMatch) {
      showNotification(`Producto no encontrado (Código: ${cleanCode})`, 'error');
      return;
    }

    if (!exactMatch.active) {
      showNotification(`El producto "${exactMatch.name}" está inactivo`, 'warning');
      return;
    }

    if (exactMatch.tracksStock !== false && exactMatch.stock <= 0) {
      showNotification(`Producto sin stock: "${exactMatch.name}"`, 'warning');
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === exactMatch.id);
    const currentQty = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    if (exactMatch.tracksStock !== false && currentQty + 1 > exactMatch.stock) {
      showNotification(
        `Stock insuficiente para "${exactMatch.name}". Disponible: ${exactMatch.stock} u.`,
        'warning'
      );
      return;
    }

    handleSelectProduct(exactMatch, 1);
    showNotification(`Producto agregado: ${exactMatch.name}`, 'success');
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex < 0) return;

    const item = cart[existingIndex];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (item.product.tracksStock !== false && newQty > item.product.stock) {
      showNotification(
        `Stock insuficiente para "${item.product.name}". Disponible: ${item.product.stock} u.`,
        'warning'
      );
      return;
    }

    const newCart = [...cart];
    newCart[existingIndex].quantity = newQty;
    setCart(newCart);
  };

  const setCartQuantityDirect = (productId: string, newQty: number) => {
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex < 0) return;

    const item = cart[existingIndex];
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (item.product.tracksStock !== false && newQty > item.product.stock) {
      showNotification(
        `Stock insuficiente para "${item.product.name}". Disponible: ${item.product.stock} u.`,
        'warning'
      );
      const newCart = [...cart];
      newCart[existingIndex].quantity = Math.max(1, item.product.stock);
      setCart(newCart);
      return;
    }

    const newCart = [...cart];
    newCart[existingIndex].quantity = newQty;
    setCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    const newCart = cart.filter((item) => item.product.id !== productId);
    setCart(newCart);
    if (newCart.length === 0) {
      setPosStatus('IDLE');
    }
  };

  const confirmCancelCart = () => {
    setCart([]);
    setPosStatus('CANCELLED');
    setShowCancelModal(false);
    setSearchTerm('');
    showNotification('Venta cancelada. Carrito vacío.', 'success');
    setTimeout(() => {
      setPosStatus('IDLE');
    }, 1000);
    searchInputRef.current?.focus();
  };

  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setPaymentMethod('EFECTIVO');
    setCashReceived(String(totalAmount));
    const half = Math.round(totalAmount / 2);
    setSplitCashAmount(half);
    setSplitMpAmount(totalAmount - half);
    setSplitCashReceived(String(half));
    setQrNeedsRegeneration(false);
    setSaleError(null);
    setMpOrderState('IDLE');
    setMpOrderRef(null);
    setMpOrderId(null);
    setMpOrderAmount(null);
    setMpErrorMessage(null);
    setShowPaymentModal(true);
  };

  const cancelActiveMpOrder = async () => {
    if (!isMpActive) {
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpPaymentId(null);
      setMpOrderAmount(null);
      setMpOrderState('IDLE');
      return;
    }
    if (mpOrderRef && (mpOrderState === 'WAITING_PAYMENT' || mpOrderState === 'CREATING')) {
      try {
        await fetch('/api/mercadopago/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: business?.id,
            orderId: mpOrderId,
            external_reference: mpOrderRef,
            mercadoPagoSource: mpSource,
          }),
        });
      } catch {
        // ignore cancellation error
      }
    }
  };

  const createMpOrderForPos = async (amount: number, isSplit = false, sourceOverride?: MercadoPagoSource) => {
    const targetSource = sourceOverride || mpSource;
    if (sourceOverride && sourceOverride !== mpSource) {
      setMpSource(sourceOverride);
    }

    if (!isMpActive || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpOrderAmount(null);
      setQrNeedsRegeneration(false);
      return;
    }
    if (amount <= 0 || cart.length === 0) {
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpOrderAmount(null);
      setQrNeedsRegeneration(false);
      return;
    }

    // Cancel any previous active order before generating a new one
    await cancelActiveMpOrder();

    const externalRef = `MINIMARKET-SALE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setMpOrderRef(externalRef);
    setMpOrderId(null);
    setMpPaymentId(null);
    setMpOrderAmount(amount);
    setMpOrderState('CREATING');
    setMpErrorMessage(null);
    setMpAutoConfirmed(false);

    try {
      let orderItems: Array<{
        title: string;
        unit_price: number;
        quantity: number;
        unit_measure: string;
        total_amount: number;
        external_code?: string;
      }> = [];

      if (!isSplit) {
        orderItems = cart.map((item) => ({
          title: item.product.name,
          unit_price: item.product.salePrice,
          quantity: item.quantity,
          unit_measure: 'unit',
          total_amount: item.product.salePrice * item.quantity,
          external_code: item.product.barcode || item.product.id,
        }));
      } else {
        orderItems = [
          {
            title: 'Cobro Combinado Mercado Pago',
            unit_price: amount,
            quantity: 1,
            unit_measure: 'unit',
            total_amount: amount,
          },
        ];
      }

      const res = await fetch('/api/mercadopago/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business?.id,
          sellerId: userProfile?.uid,
          sellerName: userProfile?.displayName || userProfile?.email || 'Vendedor',
          external_reference: externalRef,
          total_amount: amount,
          items: orderItems,
          mercadoPagoSource: targetSource,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMpOrderState('WAITING_PAYMENT');
        setMpOrderAmount(amount);
        setQrNeedsRegeneration(false);
        if (data.orderId) setMpOrderId(String(data.orderId));
        if (data.autoConfirm) setMpAutoConfirmed(true);
      } else {
        setMpOrderState('ERROR');
        setMpErrorMessage(data.message || 'No se pudo iniciar el cobro con Mercado Pago.');
      }
    } catch {
      setMpOrderState('ERROR');
      setMpErrorMessage('No se pudo conectar con el servidor de cobros.');
    }
  };

  const generateMpOrderForCurrentState = (customMp?: number, customCash?: number, sourceOverride?: MercadoPagoSource) => {
    const targetSource = sourceOverride || mpSource;
    if (sourceOverride && sourceOverride !== mpSource) {
      setMpSource(sourceOverride);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpOrderAmount(null);
      setQrNeedsRegeneration(false);
      return;
    }

    const isCombinado = paymentMethod === 'COMBINADO';
    const total = totalAmount;

    if (isCombinado) {
      const efectivo = customCash !== undefined ? customCash : Number(splitCashAmount);
      const mercadoPago = customMp !== undefined ? customMp : Number(splitMpAmount);

      if (efectivo < 0 || mercadoPago < 0) {
        setSaleError('Los importes no pueden ser negativos.');
        return;
      }

      if (Math.abs((efectivo + mercadoPago) - total) > 0.05) {
        setSaleError(`La suma de Efectivo (${formatCurrency(efectivo)}) y Mercado Pago (${formatCurrency(mercadoPago)}) debe ser igual al total (${formatCurrency(total)}).`);
        return;
      }

      if (!isMpActive || mercadoPago <= 0) {
        setMpOrderState('IDLE');
        setMpOrderRef(null);
        setMpOrderId(null);
        setMpOrderAmount(null);
        setQrNeedsRegeneration(false);
        return;
      }

      const qrAmount = mercadoPago;
      createMpOrderForPos(qrAmount, true, targetSource);
    } else if (paymentMethod === 'MERCADO_PAGO') {
      if (!isMpActive || total <= 0) {
        setMpOrderState('IDLE');
        setMpOrderRef(null);
        setMpOrderId(null);
        setMpOrderAmount(null);
        setQrNeedsRegeneration(false);
        return;
      }
      const qrAmount = total;
      createMpOrderForPos(qrAmount, false, targetSource);
    }
  };

  const handleSplitCashInputChange = (rawVal: string) => {
    const num = parseFloat(rawVal);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(totalAmount, num));
    const newMp = totalAmount - val;
    setSplitCashAmount(val);
    setSplitMpAmount(newMp);
    setSplitCashReceived(String(val));
    setSaleError(null);

    // Invalidate previous MP QR order if the amount changed or requires regeneration
    if (!isMpActive || newMp <= 0) {
      setQrNeedsRegeneration(false);
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpPaymentId(null);
      setMpOrderAmount(null);
      setMpAutoConfirmed(false);
    } else {
      setQrNeedsRegeneration(true);
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpPaymentId(null);
      setMpOrderAmount(null);
      setMpAutoConfirmed(false);
    }
  };

  const handleSplitMpInputChange = (rawVal: string) => {
    const num = parseFloat(rawVal);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(totalAmount, num));
    const newCash = totalAmount - val;
    setSplitMpAmount(val);
    setSplitCashAmount(newCash);
    setSplitCashReceived(String(newCash));
    setSaleError(null);

    // Invalidate previous MP QR order if the amount changed or requires regeneration
    if (!isMpActive || val <= 0) {
      setQrNeedsRegeneration(false);
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpPaymentId(null);
      setMpOrderAmount(null);
      setMpAutoConfirmed(false);
    } else {
      setQrNeedsRegeneration(true);
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpPaymentId(null);
      setMpOrderAmount(null);
      setMpAutoConfirmed(false);
    }
  };

  useEffect(() => {
    if (!isMpActive || !showPaymentModal || (paymentMethod !== 'MERCADO_PAGO' && paymentMethod !== 'COMBINADO')) {
      return;
    }
    if (!mpOrderRef || mpOrderState !== 'WAITING_PAYMENT') {
      return;
    }

    const businessParam = business?.id ? `&businessId=${encodeURIComponent(business.id)}` : '';
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mercadopago/order-status?external_reference=${encodeURIComponent(mpOrderRef)}${businessParam}`);
        const data = await res.json();
        if ((data.ok || data.success) && data.found) {
          const resolvedPaymentId = data.paymentId || data.order?.paymentId;
          const resolvedOrderId = data.orderId || data.order?.orderId;
          if (resolvedPaymentId) {
            setMpPaymentId(String(resolvedPaymentId));
          }
          if (resolvedOrderId) {
            setMpOrderId(String(resolvedOrderId));
          }

          if (data.paid || data.status === 'PAYMENT_VERIFIED' || data.status === 'CONFIRMED' || data.paymentStatus === 'approved') {
            playNotificationSound();
            if (data.autoConfirmed || data.status === 'CONFIRMED') {
              setMpOrderState('CONFIRMED');
              setMpAutoConfirmed(true);
            } else {
              setMpOrderState('PAYMENT_VERIFIED');
              setMpAutoConfirmed(false);
            }
          } else if (data.status === 'FAILED' || data.status === 'failed' || data.paymentStatus === 'rejected') {
            setMpOrderState('ERROR');
            setMpErrorMessage('Pago no acreditado');
          } else if (data.status === 'EXPIRED' || data.status === 'expired' || data.paymentStatus === 'expired') {
            setMpOrderState('ERROR');
            setMpErrorMessage('QR vencido');
          }
        }
      } catch {
        // ignore polling network errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showPaymentModal, paymentMethod, mpOrderRef, mpOrderState, business?.id]);

  const handleConfirmSale = async (opts?: { autoVerified?: boolean }) => {
    if (submittingSale) return;

    if (!business?.id || !userProfile?.uid) {
      setSaleError('Sesión o negocio no válido.');
      return;
    }

    if (cart.length === 0) {
      setSaleError('El carrito está vacío.');
      return;
    }

    let saleCashReceived: number | undefined = undefined;
    let saleChange: number | undefined = undefined;
    let paymentBreakdown: any = undefined;

    if (paymentMethod === 'EFECTIVO') {
      const received = Number(cashReceived);
      if (isNaN(received) || received < totalAmount) {
        setSaleError('El monto recibido es insuficiente.');
        return;
      }
      saleCashReceived = received;
      saleChange = received - totalAmount;
    } else if (paymentMethod === 'COMBINADO') {
      const cashPart = Number(splitCashAmount) || 0;
      const mpPart = Number(splitMpAmount) || 0;
      const received = Number(splitCashReceived);

      if (Math.abs((cashPart + mpPart) - totalAmount) > 0.01) {
        setSaleError(`La suma de Efectivo ($${cashPart}) y Mercado Pago ($${mpPart}) debe ser igual al total ($${totalAmount}).`);
        return;
      }
      if (isNaN(received) || received < cashPart) {
        setSaleError(`El efectivo recibido ($${received || 0}) debe ser al menos el monto en efectivo ($${cashPart}).`);
        return;
      }

      // Mandatory validation: MP amount must match active QR and not need regeneration
      const isOnlineCheck = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (isMpActive && mpPart > 0 && isOnlineCheck) {
        if (
          qrNeedsRegeneration ||
          mpOrderAmount === null ||
          Math.abs(mpOrderAmount - mpPart) > 0.01 ||
          mpOrderState === 'IDLE' ||
          mpOrderState === 'CREATING' ||
          mpOrderState === 'ERROR'
        ) {
          setSaleError('Importe modificado. Regenerá el QR para continuar.');
          return;
        }
      }

      const splitChange = received - cashPart;
      saleCashReceived = received;
      saleChange = splitChange;
      paymentBreakdown = {
        cashAmount: cashPart,
        mpAmount: mpPart,
        cashReceived: received,
        change: splitChange
      };
    }

    const isMpPayment = paymentMethod === 'MERCADO_PAGO' || (paymentMethod === 'COMBINADO' && (splitMpAmount || 0) > 0);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isMpPayment && isOnline && isMpActive) {
      const expectedMpAmount = paymentMethod === 'COMBINADO' ? Number(splitMpAmount) : totalAmount;
      if (qrNeedsRegeneration || mpOrderAmount === null || Math.abs(mpOrderAmount - expectedMpAmount) > 0.01) {
        setSaleError('Importe modificado. Regenerá el QR para continuar.');
        return;
      }
      if (!opts?.autoVerified && mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED') {
        setSaleError('El pago de Mercado Pago aún no ha sido verificado. Esperá la acreditación para confirmar la venta.');
        return;
      }
    }

    let verificationType: PaymentVerification = 'MANUAL';
    let paymentDetails: any = undefined;

    if (isMpPayment) {
      if (!isOnline || !isMpActive) {
        verificationType = 'MANUAL';
        paymentDetails = {
          mode: !isMpActive ? 'INTEGRATION_DISABLED' : 'OFFLINE',
          verification: 'MANUAL',
          notes: !isMpActive
            ? 'Cobro Mercado Pago registrado con integración desactivada (registro manual directo)'
            : 'Cobro Mercado Pago registrado en modo offline (verificación manual sin orden en MP)'
        };
      } else {
        const isAuto = Boolean(opts?.autoVerified || mpOrderState === 'CONFIRMED' || mpAutoConfirmed);
        const sourceLabel = mpSource === 'POINT_SMART'
          ? 'Terminal Point Smart'
          : mpSource === 'POINT_GENERATED_QR'
          ? 'QR Point/POS'
          : 'QR Físico de Caja';
        verificationType = isAuto ? 'AUTOMATIC' : 'MERCADOPAGO_VERIFIED';
        paymentDetails = {
          mode: 'ONLINE',
          verification: verificationType,
          orderId: mpOrderId || undefined,
          paymentId: mpPaymentId || undefined,
          operationId: mpPaymentId || mpOrderId || mpOrderRef || undefined,
          externalReference: mpOrderRef || undefined,
          mercadoPagoSource: mpSource,
          amount: paymentMethod === 'COMBINADO' ? Number(splitMpAmount) : totalAmount,
          currency: 'ARS',
          paymentStatus: 'approved',
          verifiedAt: new Date().toISOString(),
          notes: isAuto
            ? `Cobro Mercado Pago (${sourceLabel}) verificado automáticamente`
            : `Cobro Mercado Pago (${sourceLabel}) verificado (confirmación del vendedor)`
        };
      }
    }

    const requiresOnlinePaymentVerification = Boolean(isMpPayment && isOnline && isMpActive);

    setSubmittingSale(true);
    setSaleError(null);

    try {
      const saleResult = await processSale({
        businessId: business.id,
        sellerId: userProfile.uid,
        sellerName: userProfile.displayName || userProfile.email || 'Vendedor',
        items: cart,
        total: totalAmount,
        paymentMethod,
        paymentVerification: verificationType,
        paymentDetails,
        paymentBreakdown,
        requiresOnlinePaymentVerification,
        cashReceived: saleCashReceived,
        change: saleChange
      });

      // Explicitly blur any focused input (e.g. mobile virtual keyboard)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setCart([]);
      setPosStatus('IDLE');
      setShowPaymentModal(false);
      setCashReceived('');
      setSearchTerm('');
      setMpOrderState('IDLE');
      setMpOrderRef(null);
      setMpOrderId(null);
      setMpOrderAmount(null);
      setQrNeedsRegeneration(false);

      if (saleResult.syncStatus === 'PENDING') {
        showNotification(
          `Cobro registrado · pendiente de sincronización (#${saleResult.id?.slice(-6).toUpperCase()})`,
          'info'
        );
      } else if (isMpPayment && verificationType === 'AUTOMATIC') {
        showNotification('✓ Mercado Pago verificado automáticamente', 'success');
      } else if (isMpPayment && verificationType === 'MERCADOPAGO_VERIFIED') {
        showNotification('✓ Mercado Pago confirmado', 'success');
      } else {
        showNotification('Pago registrado correctamente', 'success');
      }

      // Update sales in state immediately so Frequent Products ranking updates in real-time
      if (saleResult) {
        setAllSales((prev) => {
          const exists = prev.some((s) => s.id === saleResult.id);
          if (exists) {
            return prev.map((s) => (s.id === saleResult.id ? saleResult : s));
          }
          return [saleResult, ...prev];
        });
        setTodaySales((prev) => {
          const exists = prev.some((s) => s.id === saleResult.id);
          if (exists) {
            return prev.map((s) => (s.id === saleResult.id ? saleResult : s));
          }
          return [saleResult, ...prev];
        });
      }

      await loadProducts();
      loadSalesForRanking().catch(() => {});

      // Trigger Thermal Receipt Printing Animation after mobile keyboard has completely closed
      setLastCompletedSale(saleResult);
      setTimeout(() => {
        setShowReceiptAnimation(true);
      }, 100);

    } catch (err: any) {
      console.error('Error in handleConfirmSale:', err);
      setSaleError(err.message || 'Error al procesar la venta. Intente nuevamente.');
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (searchTerm) {
        setSearchTerm('');
      } else if (showCancelModal) {
        setShowCancelModal(false);
      }
    }
  };

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-6 bg-red-50 rounded border border-red-200 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-lg font-black text-red-900">Negocio No Asignado</h3>
        <p className="text-xs text-red-700 font-medium">
          Su usuario no tiene un negocio activo asignado.
        </p>
      </div>
    );
  }

  const isInactive = business.status === 'inactive';

  return (
    <div className="space-y-3">
      
      {/* Business Inactive Warning */}
      {isInactive && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center space-x-3 text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-xs">Caja Desactivada - Negocio Inactivo</p>
            <p className="text-[11px] text-red-700">
              El negocio {business.name} se encuentra inactivo. Contacte al administrador.
            </p>
          </div>
        </div>
      )}

      {/* Sync Conflict / Error Attention Banner */}
      {Boolean(syncStats && (syncStats.stockConflictCount > 0 || syncStats.errorCount > 0)) && (
        <div className="bg-red-50 border border-red-300 rounded p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-black text-xs sm:text-sm text-red-900">
                {syncStats.stockConflictCount + syncStats.errorCount} venta{syncStats.stockConflictCount + syncStats.errorCount > 1 ? 's' : ''} offline requiere{syncStats.stockConflictCount + syncStats.errorCount > 1 ? 'n' : ''} atención
              </p>
              <p className="text-[11px] text-red-700">
                Existen operaciones con conflicto de stock o error de sincronización pendientes de resolución.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSyncConflictModal(true)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs shrink-0 self-end sm:self-auto cursor-pointer"
          >
            Resolver Conflictos
          </button>
        </div>
      )}

      {/* POS Top Bar Header (Desktop & Tablet) */}
      <div className="bg-white rounded p-3 sm:p-3.5 border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col items-start text-left justify-center">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#006AFF] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 leading-none">
              POS / Caja
            </span>
            <span className="text-xs text-stone-500 font-medium leading-none">
              Operador: <strong className="text-stone-800">{userProfile?.displayName || 'Vendedor'}</strong>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight mt-1 leading-tight text-left">
            {business.name}
          </h2>
        </div>

        {/* Action Buttons: Status (Desktop only), Presupuesto, Ventas de Hoy, Refresh */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* 3 Status badges: Hidden on mobile (displayed in hamburger menu), visible on desktop */}
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <LocalDataIndicator businessId={business.id} businessName={business.name} />
            <SyncStatusIndicator businessId={business.id} />

            <span className={`px-2.5 py-1 rounded font-bold text-[11px] flex items-center gap-1.5 ${
              posStatus === 'SHOPPING' 
                ? 'bg-blue-50 text-[#006AFF] border border-blue-200'
                : posStatus === 'CANCELLED'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                posStatus === 'SHOPPING' ? 'bg-[#006AFF]' : 'bg-emerald-500'
              }`} />
              {posStatus === 'SHOPPING' ? 'Venta en curso' : '✓ Caja Lista'}
            </span>
          </div>

          {/* Quick Action buttons: Aligned to the right on mobile */}
          <div className="flex items-center justify-end gap-1.5 w-full sm:w-auto ml-auto">
            {/* Anotaciones Button */}
            <button
              onClick={() => setShowNotesModal(true)}
              title="Anotaciones rápidas / Block de notas"
              id="btn-pos-notes"
              className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-98 relative shadow-2xs"
            >
              <NotebookPen className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden xs:inline">Anotaciones</span>
              {pendingNotesCount > 0 && (
                <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                  {pendingNotesCount}
                </span>
              )}
            </button>

            {/* Presupuesto Button */}
            <button
              onClick={() => {
                setBudgetProduct(null);
                setBudgetSearch('');
                setShowBudgetModal(true);
              }}
              title="Calcular unidades por presupuesto"
              className="px-2.5 py-1.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-98"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Presupuesto</span>
            </button>

            {/* Ventas de Hoy Button */}
            <button
              onClick={() => {
                loadTodaySales();
                setShowHistoryModal(true);
              }}
              title="Ver ventas del turno de hoy"
              className="px-2.5 py-1.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs border border-stone-200 transition-colors flex items-center gap-1 cursor-pointer active:scale-98"
            >
              <History className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden xs:inline">Ventas Hoy</span>
            </button>

            {/* Reload Products */}
            <button
              onClick={loadProducts}
              disabled={loadingProducts}
              title="Recargar catálogo de productos"
              className="p-1.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer border border-stone-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div className={`p-2.5 rounded border text-xs font-bold flex items-center justify-between shadow-xs ${
          notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : notification.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : notification.type === 'info'
            ? 'bg-blue-50 border-blue-200 text-blue-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${
              notification.type === 'error' ? 'text-red-600' : notification.type === 'warning' ? 'text-amber-600' : notification.type === 'info' ? 'text-blue-600' : 'text-emerald-600'
            }`} />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN POS DESKTOP & MOBILE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-stretch">
        
        {/* LEFT COLUMN: Search, Scanner & Catalog (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* SEARCH & SCANNER INPUT CARD */}
          <div className="bg-white rounded border border-stone-200 p-3 shadow-xs space-y-1.5 focus-within:border-[#006AFF] transition-colors">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-[#006AFF]" />
                Buscar Producto / Escanear Código
              </span>
              <span className="text-[10px] font-normal text-stone-400 hidden sm:inline">
                Soporta Scanner HID / Teclado
              </span>
            </label>

            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Escanear código o buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  id="pos-search-input"
                  className="w-full pl-9 pr-8 py-2 border border-stone-300 rounded font-medium text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20"
                  disabled={isInactive}
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                disabled={isInactive}
                id="btn-scan-camera"
                className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white font-bold rounded text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                title="Escanear código de barras"
              >
                <Barcode className="w-4 h-4 text-white" />
                <span className="hidden xs:inline sm:inline">Escanear</span>
              </button>

              <button
                type="submit"
                disabled={isInactive || !searchTerm.trim()}
                className="px-3.5 py-2 bg-[#006AFF] hover:bg-[#0052CC] disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold rounded text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            </form>
          </div>

          {/* SEARCH RESULTS DROPDOWN / LIST */}
          {searchTerm.trim() !== '' && (
            <div className="bg-white rounded border border-stone-200 shadow-sm overflow-hidden space-y-1">
              <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-600 flex justify-between items-center">
                <span>Resultados de Búsqueda ({filteredProducts.length})</span>
                <span className="text-[10px] text-stone-400 font-normal">Tocar para agregar</span>
              </div>

              <div className="max-h-48 sm:max-h-56 overflow-y-auto divide-y divide-stone-100">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-stone-500 font-medium">
                    Sin coincidencias para "{searchTerm}"
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p, 1)}
                      className="p-2.5 hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#006AFF]">{p.name}</p>
                        <p className="text-[10px] text-stone-500 font-mono">
                          {p.barcode ? `Código: ${p.barcode}` : 'Sin código'} • {p.category}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-xs sm:text-sm text-[#006AFF] font-mono">{formatCurrency(p.salePrice)}</p>
                        <p className={`text-[10px] font-bold ${
                          p.stock <= 0 ? 'text-red-600' : p.stock <= p.minimumStock ? 'text-amber-600' : 'text-stone-500'
                        }`}>
                          Stock: {p.stock} u.
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* FREQUENT PRODUCTS / QUICK SELECTION GRID (Desktop only: hidden on mobile to maximize vertical space) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-stone-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                </div>
                <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-stone-800">
                  Productos Frecuentes / Acceso Rápido
                </h3>
              </div>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 sm:px-2 py-0.5 rounded-full border border-stone-200">
                4 cols • Más Vendidos
              </span>
            </div>

            {loadingProducts ? (
              <div className="py-6 text-center text-xs text-stone-400 font-medium">Cargando catálogo...</div>
            ) : frequentProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400 font-medium">No hay productos activos cargados.</div>
            ) : (
              <div className="grid grid-cols-4 gap-3 sm:gap-3.5 p-2 sm:p-2.5 overflow-visible">
                {frequentProducts.map((p) => {
                  const colorTheme = getCategoryColorClasses(p.category || p.name);
                  const hasImage = Boolean(p.imageUrl || p.image);
                  const imgSrc = p.imageUrl || p.image;

                  const tracksStock = p.tracksStock !== false;
                  const currentStock = Number(p.stock ?? 0);
                  const reorderPoint = p.reorderPoint !== undefined && p.reorderPoint !== null
                    ? Number(p.reorderPoint)
                    : (p.minimumStock !== undefined && p.minimumStock !== null ? Number(p.minimumStock) : 0);

                  // Stock status: NORMAL | REORDER | OUT_OF_STOCK
                  let stockStatus: 'NORMAL' | 'REORDER' | 'OUT_OF_STOCK' = 'NORMAL';
                  if (tracksStock) {
                    if (currentStock <= 0) {
                      stockStatus = 'OUT_OF_STOCK';
                    } else if (currentStock <= reorderPoint) {
                      stockStatus = 'REORDER';
                    } else {
                      stockStatus = 'NORMAL';
                    }
                  }

                  const statusClass =
                    stockStatus === 'OUT_OF_STOCK'
                      ? 'status-out-of-stock'
                      : stockStatus === 'REORDER'
                      ? 'status-reorder'
                      : 'status-normal';

                  return (
                    <div
                      key={p.id}
                      tabIndex={isInactive ? -1 : 0}
                      role="button"
                      aria-label={`Agregar ${p.name}, precio ${formatCurrency(p.salePrice)}`}
                      onClick={() => {
                        if (!isInactive) handleSelectProduct(p, 1);
                      }}
                      onKeyDown={(e) => {
                        if (!isInactive && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSelectProduct(p, 1);
                        }
                      }}
                      className={`frequent-product-card ${
                        isInactive ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                      }`}
                    >
                      <div className={`frequent-card-content ${statusClass}`}>
                        {/* 1. Category Icon or Product Image */}
                        <div className="w-[28px] h-[28px] sm:w-[30px] sm:h-[30px] rounded-md bg-stone-50 border border-stone-200/80 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {hasImage ? (
                            <img
                              src={imgSrc}
                              alt={p.name}
                              className="w-full h-full object-contain p-0.5"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <CategoryIcon
                              iconName={p.icon}
                              category={p.category}
                              productName={p.name}
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${colorTheme.text} stroke-[2.2]`}
                            />
                          )}
                        </div>

                        {/* 2. Product Name (up to 2 lines, centered, clear compact typography) */}
                        <div className="my-0.5 w-full flex-1 flex items-center justify-center px-0.5">
                          <p
                            className="font-bold text-[10px] sm:text-[10.5px] text-stone-900 line-clamp-2 leading-tight break-words text-center"
                            title={p.name}
                          >
                            {p.name}
                          </p>
                        </div>

                        {/* 3. Sale Price (prominent & crisp) */}
                        <div className="w-full pt-1 border-t border-stone-100 flex items-center justify-center shrink-0 mt-auto">
                          <span className="font-extrabold text-[11px] sm:text-[11.5px] text-stone-900 font-mono tracking-tight">
                            {formatCurrency(p.salePrice)}
                          </span>
                        </div>

                        {/* 4. Stock: XX unidades */}
                        <div className="w-full pt-0.5 flex items-center justify-center shrink-0">
                          {tracksStock ? (
                            <span
                              className={`text-[9px] sm:text-[9.5px] leading-none text-center ${
                                stockStatus === 'OUT_OF_STOCK'
                                  ? 'text-red-600 font-black'
                                  : stockStatus === 'REORDER'
                                  ? 'text-amber-700 font-bold'
                                  : 'text-stone-500 font-medium'
                              }`}
                            >
                              Stock: {currentStock} unidades
                            </span>
                          ) : (
                            <span className="text-[8.5px] sm:text-[9px] text-stone-400 font-medium leading-none text-center">
                              Sin control de stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: CART & TOTAL DISPLAY (5 cols on desktop) */}
        <div 
          ref={cartRef}
          className="lg:col-span-5 bg-white rounded border border-stone-200 shadow-xs flex flex-col overflow-hidden h-full scroll-mt-4"
        >
          
          {/* Cart Header */}
          <div className="bg-stone-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-stone-800 shrink-0">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-4 h-4 text-[#006AFF]" />
              <h3 className="font-black text-xs sm:text-sm tracking-tight">Carrito de Venta</h3>
            </div>
            <span className="text-[10px] font-bold bg-stone-800 text-stone-300 px-2 py-0.5 rounded border border-stone-700">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Cart Items List */}
          <div 
            ref={cartListRef}
            className="p-3 flex-1 min-h-[160px] max-h-[260px] sm:max-h-[300px] lg:max-h-[280px] xl:max-h-[340px] overflow-y-auto divide-y divide-stone-100"
          >
            {cart.length === 0 ? (
              <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center py-6 space-y-1.5">
                <div className="w-9 h-9 rounded bg-stone-100 text-stone-400 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-stone-700 text-xs">Carrito Vacío</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 max-w-xs">
                    Escanee un código o busque un producto para agregarlo.
                  </p>
                </div>
              </div>
            ) : (
              cart.map((item) => {
                const itemSubtotal = item.quantity * item.product.salePrice;
                return (
                  <div key={item.product.id} className="py-2 flex items-center justify-between gap-2">
                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-stone-900 truncate">
                        {item.product.name}
                      </p>
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {formatCurrency(item.product.salePrice)} c/u
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-1 shrink-0 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded bg-white hover:bg-stone-200 active:scale-95 text-stone-800 font-bold flex items-center justify-center text-xs shadow-2xs transition-all cursor-pointer"
                        title="Disminuir cantidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) setCartQuantityDirect(item.product.id, val);
                        }}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="w-10 h-7 text-center font-black text-xs text-stone-900 font-mono border border-stone-300 rounded bg-white focus:ring-1 focus:ring-[#006AFF] focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded bg-white hover:bg-stone-200 active:scale-95 text-stone-800 font-bold flex items-center justify-center text-xs shadow-2xs transition-all cursor-pointer"
                        title="Aumentar cantidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal & Remove */}
                    <div className="text-right shrink-0 min-w-[65px]">
                      <p className="font-black text-xs text-stone-900 font-mono">
                        {formatCurrency(itemSubtotal)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors p-0.5 mt-0.5 cursor-pointer"
                        title="Eliminar de carrito"
                      >
                        <Trash2 className="w-3 h-3 ml-auto" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* TOTAL & CANCEL FOOTER */}
          <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2 shrink-0">
            
            {/* Total Row */}
            <div className="bg-stone-900 text-white px-3.5 py-2.5 rounded flex items-center justify-between shadow-xs border border-stone-800">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block leading-none">
                  Total a Cobrar
                </span>
                <span className="text-[10px] text-stone-300 font-medium leading-tight">
                  {totalItemsCount} {totalItemsCount === 1 ? 'producto' : 'productos'}
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight" id="pos-cart-total">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Action Buttons: COBRAR and CANCELAR */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={cart.length === 0}
                id="btn-cancel-cart"
                className="w-1/3 py-2.5 px-2 bg-white hover:bg-red-50 disabled:bg-stone-100 disabled:text-stone-400 text-red-700 font-bold rounded text-xs transition-colors border border-stone-200 disabled:border-stone-200 flex items-center justify-center gap-1 cursor-pointer active:scale-98"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Cancelar</span>
              </button>

              <button
                onClick={openPaymentModal}
                disabled={cart.length === 0 || isInactive}
                id="btn-cobrar"
                className="w-2/3 py-2.5 px-3 bg-[#006AFF] hover:bg-[#0052CC] disabled:bg-stone-200 disabled:text-stone-400 text-white font-black rounded text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 group"
              >
                <Banknote className="w-3.5 h-3.5 text-white" />
                <span>COBRAR</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Mobile Thumb-Friendly Green Barcode Scan Button */}
            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                disabled={isInactive}
                id="btn-mobile-cart-scan"
                aria-label="Escanear código de barras"
                title="Escanear código de barras"
                className="w-14 h-14 min-w-[56px] min-h-[56px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-2xl shadow-md transition-all flex items-center justify-center cursor-pointer active:scale-95 border border-emerald-500/20"
              >
                <Barcode className="w-7 h-7 text-white shrink-0" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL: CONFIRMAR CANCELAR CARRITO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-sm w-full p-5 text-center shadow-xl border border-stone-200 space-y-3">
            <div className="w-10 h-10 rounded bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
              <RotateCcw className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-900">¿Cancelar la venta actual?</h3>
              <p className="text-xs text-stone-500 mt-1">
                Se vaciará el carrito con {totalItemsCount} productos por un total de {formatCurrency(totalAmount)}.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded text-xs cursor-pointer border border-stone-200"
              >
                Volver
              </button>
              <button
                onClick={confirmCancelCart}
                id="btn-confirm-cancel"
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow-xs cursor-pointer active:scale-98"
              >
                Sí, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANTALLA DE COBRO (PAYMENT MODAL) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90dvh] sm:max-h-[86vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header (Fixed at top) */}
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 pt-3.5 sm:pt-4 pb-2.5 border-b border-stone-100 bg-white">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#006AFF] border border-blue-200 flex items-center justify-center font-bold">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 leading-tight">Cobrar Venta</h3>
                  <p className="text-[10px] text-stone-500">{totalItemsCount} productos en carrito</p>
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={submittingSale}
                className="text-stone-400 hover:text-stone-700 hover:bg-stone-100 p-1.5 rounded-xl cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body (min-h-0 prevents flex overflow on mobile) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5 sm:space-y-3">

            {/* Error Banner inside Modal */}
            {saleError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-900 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{saleError}</span>
              </div>
            )}

            {/* Total Display */}
            <div
              className="relative overflow-hidden text-white p-3.5 rounded text-center space-y-0.5 bg-stone-900 border border-stone-800"
              style={{
                backgroundImage: `url('${
                  paymentMethod === 'EFECTIVO'
                    ? '/assets/payment-modes/pago-efectivo.png'
                    : paymentMethod === 'MERCADOPAGO'
                    ? '/assets/payment-modes/pago-qr-fisico.png'
                    : paymentMethod === 'COMBINADO'
                    ? '/assets/payment-modes/pago-combinado.png'
                    : '/assets/payment-modes/pago-qr-fisico.png'
                }')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-300 drop-shadow-xs">
                Total A Cobrar
              </span>
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight drop-shadow-xs">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-600">
                Medio de Pago
              </label>
              
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('EFECTIVO');
                    setCashReceived(String(totalAmount));
                    setSaleError(null);
                    setQrNeedsRegeneration(false);
                  }}
                  id="btn-pay-efectivo"
                  className={`btn-uiverse-pay btn-uiverse-efectivo p-2 ${
                    paymentMethod === 'EFECTIVO' ? 'is-selected' : ''
                  }`}
                >
                  <span className="btn-uiverse-content flex-col sm:flex-row">
                    <Banknote className="w-4 h-4 shrink-0 stroke-[2.2]" />
                    <span>Efectivo</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('MERCADO_PAGO');
                    setSaleError(null);
                    setMpOrderState('IDLE');
                    setMpOrderRef(null);
                    setMpOrderId(null);
                    setMpOrderAmount(null);
                    setQrNeedsRegeneration(false);
                    if (isMpActive) {
                      createMpOrderForPos(totalAmount, false);
                    }
                  }}
                  id="btn-pay-mp"
                  className={`btn-uiverse-pay btn-uiverse-mp p-2 ${
                    paymentMethod === 'MERCADO_PAGO' ? 'is-selected' : ''
                  }`}
                >
                  <span className="btn-uiverse-content flex-col sm:flex-row">
                    <QrCode className="w-4 h-4 shrink-0 stroke-[2.2]" />
                    <span>Mercado Pago</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('COMBINADO');
                    const half = Math.round(totalAmount / 2);
                    const mpHalf = totalAmount - half;
                    setSplitCashAmount(half);
                    setSplitMpAmount(mpHalf);
                    setSplitCashReceived(String(half));
                    setSaleError(null);
                    setMpOrderState('IDLE');
                    setMpOrderRef(null);
                    setMpOrderId(null);
                    setMpOrderAmount(null);
                    setQrNeedsRegeneration(false);
                    if (isMpActive && mpHalf > 0) {
                      createMpOrderForPos(mpHalf, true);
                    }
                  }}
                  id="btn-pay-combinado"
                  className={`btn-uiverse-pay btn-uiverse-combinado p-2 ${
                    paymentMethod === 'COMBINADO' ? 'is-selected' : ''
                  }`}
                >
                  <span className="btn-uiverse-content flex-col sm:flex-row">
                    <DollarSign className="w-4 h-4 shrink-0 stroke-[2.2]" />
                    <span>Combinado</span>
                  </span>
                </button>
              </div>
            </div>

            {/* EFECTIVO FLOW */}
            {paymentMethod === 'EFECTIVO' && (
              <div className="space-y-3 pt-1 border-t border-stone-100">
                
                {/* Cash Received Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-stone-700 flex justify-between">
                    <span>Monto Recibido</span>
                    <span className="text-[10px] text-stone-400">Ingrese el monto</span>
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 font-bold text-base">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={cashReceived}
                      onChange={(e) => {
                        setCashReceived(e.target.value);
                        setSaleError(null);
                      }}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      id="input-cash-received"
                      className="w-full pl-7 pr-3 py-1.5 border border-stone-300 rounded text-lg font-mono font-black text-stone-900 focus:outline-none focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block">Atajos de Billete</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setCashReceived(String(totalAmount))}
                      className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-[11px] font-bold border border-stone-200 cursor-pointer"
                    >
                      Exacto ({formatCurrency(totalAmount)})
                    </button>
                    {[1000, 2000, 5000, 10000, 20000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashReceived(String(val))}
                        className="px-2 py-1 bg-stone-100 hover:bg-blue-50 hover:text-[#006AFF] text-stone-700 rounded text-[11px] font-bold border border-stone-200 transition-colors cursor-pointer"
                      >
                        {formatCurrency(val)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change / Vuelto Calculation */}
                {(() => {
                  const numReceived = Number(cashReceived);
                  const isInsufficient = isNaN(numReceived) || numReceived < totalAmount;
                  const change = isInsufficient ? 0 : numReceived - totalAmount;

                  return (
                    <div className={`p-3 rounded border flex items-center justify-between ${
                      isInsufficient
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block">
                          Vuelto A Entregar
                        </span>
                        {isInsufficient && (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Faltan {formatCurrency(totalAmount - (isNaN(numReceived) ? 0 : numReceived))}
                          </span>
                        )}
                      </div>
                      <span className={`text-xl font-black font-mono ${
                        isInsufficient ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(change)}
                      </span>
                    </div>
                  );
                })()}

              </div>
            )}

            {/* COMBINADO FLOW */}
            {paymentMethod === 'COMBINADO' && (
              <div className="space-y-3 pt-1 border-t border-purple-100 bg-purple-50/40 p-2.5 rounded-xl border">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      💵 Parte en Efectivo ($)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={totalAmount}
                      value={splitCashAmount}
                      onChange={(e) => handleSplitCashInputChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      id="input-split-cash"
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-mono font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      📱 Parte Mercado Pago ($)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={totalAmount}
                      value={splitMpAmount}
                      onChange={(e) => handleSplitMpInputChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      id="input-split-mp"
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-mono font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Cash Received for Split portion */}
                <div className="space-y-1 bg-white p-2.5 rounded-lg border border-purple-200">
                  <label className="block text-[11px] font-bold text-stone-800 flex justify-between">
                    <span>Efectivo entregado por cliente:</span>
                    <span className="text-[10px] text-purple-700">Debe ser ≥ {formatCurrency(splitCashAmount)}</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={splitCashReceived}
                    onChange={(e) => {
                      setSplitCashReceived(e.target.value);
                      setSaleError(null);
                    }}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-3 py-1.5 border border-stone-300 rounded text-base font-mono font-black text-stone-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />

                  {/* Split Change */}
                  {(() => {
                    const numReceived = Number(splitCashReceived);
                    const isInsufficient = isNaN(numReceived) || numReceived < splitCashAmount;
                    const change = isInsufficient ? 0 : numReceived - splitCashAmount;

                    return (
                      <div className={`mt-2 p-2 rounded flex items-center justify-between text-xs font-bold ${
                        isInsufficient ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
                      }`}>
                        <span>Vuelto del Efectivo:</span>
                        <span className="font-mono text-base">{formatCurrency(change)}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* MP Status inside Combinado */}
                {splitMpAmount > 0 && (
                  <div className="text-[11px] pt-1 space-y-2">
                    {!isMpActive ? (
                      <div className="p-2.5 bg-stone-100/80 border border-stone-200 rounded-lg text-stone-800 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0" />
                          <span className="text-stone-700 font-semibold text-[11px]">
                            Mercado Pago: <strong className="font-mono">{formatCurrency(splitMpAmount)}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-stone-600 bg-stone-200 px-2 py-0.5 rounded-full">
                          Registro Manual
                        </span>
                      </div>
                    ) : typeof navigator !== 'undefined' && navigator.onLine ? (
                      <>
                        {/* Modality Selector for Combinado MP */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                            Modalidad Mercado Pago
                          </label>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100/90 rounded-lg border border-stone-200">
                            <button
                              type="button"
                              onClick={() => {
                                if (mpSource !== 'STATIC_POS_QR') {
                                  setMpSource('STATIC_POS_QR');
                                  generateMpOrderForCurrentState(splitMpAmount, splitCashAmount, 'STATIC_POS_QR');
                                }
                              }}
                              id="btn-mp-split-source-static"
                              className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                                mpSource === 'STATIC_POS_QR'
                                  ? 'bg-[#FFE600] text-stone-900 shadow-2xs font-extrabold border border-amber-400/80'
                                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 border border-transparent'
                              }`}
                            >
                              <QrCode className="w-3.5 h-3.5 text-[#006AFF] shrink-0" />
                              <span className="truncate">QR Físico</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (mpSource !== 'POINT_GENERATED_QR') {
                                  setMpSource('POINT_GENERATED_QR');
                                  generateMpOrderForCurrentState(splitMpAmount, splitCashAmount, 'POINT_GENERATED_QR');
                                }
                              }}
                              id="btn-mp-split-source-point"
                              className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                                mpSource === 'POINT_GENERATED_QR'
                                  ? 'bg-[#FFE600] text-stone-900 shadow-2xs font-extrabold border border-amber-400/80'
                                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 border border-transparent'
                              }`}
                            >
                              <Smartphone className="w-3.5 h-3.5 text-[#006AFF] shrink-0" />
                              <span className="truncate">QR Point</span>
                            </button>
                          </div>
                        </div>

                        {qrNeedsRegeneration ? (
                          <div className="p-2.5 bg-amber-50/90 border border-amber-300/80 rounded-lg space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center space-x-1.5 text-amber-950 font-bold text-xs">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Importe modificado. Regenerá el cobro para continuar.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => generateMpOrderForCurrentState(splitMpAmount, splitCashAmount)}
                                id="btn-regenerate-mp-split-qr"
                                className="px-3 py-1 bg-[#006AFF] hover:bg-[#0052CC] text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerar ({formatCurrency(splitMpAmount)})</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {mpOrderState === 'IDLE' && (
                              <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-lg flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-1.5 text-blue-950 font-bold text-xs">
                                  {mpSource === 'POINT_SMART' ? (
                                    <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                                  ) : mpSource === 'POINT_GENERATED_QR' ? (
                                    <Smartphone className="w-4 h-4 text-[#006AFF] shrink-0" />
                                  ) : (
                                    <QrCode className="w-4 h-4 text-[#006AFF] shrink-0" />
                                  )}
                                  <span>Parte Mercado Pago: <strong className="font-mono">{formatCurrency(splitMpAmount)}</strong></span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => generateMpOrderForCurrentState(splitMpAmount, splitCashAmount)}
                                  id="btn-generate-mp-split-qr"
                                  className="px-2.5 py-1 bg-[#006AFF] hover:bg-[#0052CC] text-white rounded text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>{mpSource === 'POINT_SMART' ? 'Enviar a Terminal' : 'Generar QR'} ({formatCurrency(splitMpAmount)})</span>
                                </button>
                              </div>
                            )}

                            {mpOrderState === 'CREATING' && (
                              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center space-x-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#006AFF]" />
                                <span>
                                  Iniciando orden en {mpSource === 'POINT_SMART' ? 'Terminal Point Smart' : mpSource === 'POINT_GENERATED_QR' ? 'QR Point/POS' : 'QR Físico'} por {formatCurrency(splitMpAmount)}...
                                </span>
                              </div>
                            )}

                            {mpOrderState === 'WAITING_PAYMENT' && (
                              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg space-y-1 text-xs text-blue-950">
                                <div className="flex items-center justify-between font-bold">
                                  <div className="flex items-center space-x-1.5 text-blue-950">
                                    {mpSource === 'POINT_SMART' ? (
                                      <CreditCard className="w-4 h-4 text-indigo-600" />
                                    ) : mpSource === 'POINT_GENERATED_QR' ? (
                                      <Smartphone className="w-4 h-4 text-[#006AFF]" />
                                    ) : (
                                      <QrCode className="w-4 h-4 text-[#006AFF]" />
                                    )}
                                    <span>
                                      {mpSource === 'POINT_SMART'
                                        ? 'Terminal Point Smart lista por'
                                        : mpSource === 'POINT_GENERATED_QR'
                                        ? 'QR Point/POS activo por'
                                        : 'QR en caja activo por'}{' '}
                                      <strong className="font-mono">{formatCurrency(mpOrderAmount || splitMpAmount)}</strong>
                                    </span>
                                  </div>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/60 text-blue-900 animate-pulse">
                                    Esperando pago...
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-stone-600 pt-0.5">
                                  <span>
                                    {mpSource === 'POINT_SMART'
                                      ? `Pase la tarjeta o aproxime chip/contactless en la terminal física Mercado Pago Point Smart para abonar ${formatCurrency(mpOrderAmount || splitMpAmount)}`
                                      : mpSource === 'POINT_GENERATED_QR'
                                      ? `El cliente debe escanear el QR en el terminal Point/POS y abonar ${formatCurrency(mpOrderAmount || splitMpAmount)}`
                                      : `El cliente debe escanear el QR físico de la caja y abonar ${formatCurrency(mpOrderAmount || splitMpAmount)}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => generateMpOrderForCurrentState(splitMpAmount, splitCashAmount)}
                                    id="btn-regenerate-mp-split-qr"
                                    className="text-[#006AFF] hover:underline font-bold ml-2 cursor-pointer flex items-center gap-0.5 shrink-0"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Reintentar</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {mpOrderState === 'PAYMENT_VERIFIED' && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs">
                                <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>
                                    {mpPaymentId && String(mpPaymentId).trim() !== '' && String(mpPaymentId) !== 'undefined' && String(mpPaymentId) !== 'null'
                                      ? `✓ Pago Mercado Pago verificado · Operación #${String(mpPaymentId).replace(/^#+/, '').trim()}`
                                      : '✓ Pago Mercado Pago verificado'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-600 mt-0.5">
                                  Pago recibido ({formatCurrency(mpOrderAmount || splitMpAmount)}) vía {mpSource === 'POINT_SMART' ? 'Terminal Point Smart' : mpSource === 'POINT_GENERATED_QR' ? 'QR Point/POS' : 'QR Físico'}. Ingrese el efectivo y presione "Confirmar Cobro" para finalizar la venta.
                                </p>
                              </div>
                            )}

                            {mpOrderState === 'CONFIRMED' && (
                              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold flex items-center space-x-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  {mpPaymentId && String(mpPaymentId).trim() !== '' && String(mpPaymentId) !== 'undefined' && String(mpPaymentId) !== 'null'
                                    ? `✓ Pago Mercado Pago verificado · Operación #${String(mpPaymentId).replace(/^#+/, '').trim()}`
                                    : '✓ Pago Mercado Pago verificado'}
                                </span>
                              </div>
                            )}

                            {mpOrderState === 'ERROR' && (
                              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg space-y-1.5 text-xs text-amber-950">
                                <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>{mpErrorMessage || 'No se pudo iniciar el cobro con Mercado Pago.'}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => generateMpOrderForCurrentState(splitMpAmount, splitCashAmount)}
                                  className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 rounded text-[11px] font-bold text-amber-950 cursor-pointer"
                                >
                                  Reintentar ({formatCurrency(splitMpAmount)})
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* MERCADO PAGO FLOW */}
            {paymentMethod === 'MERCADO_PAGO' && (
              <div className="space-y-2 pt-1">
                {/* Integration Status & Mode Pill */}
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-100/90 rounded-lg text-[11px] font-bold border border-stone-200">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${!isMpActive ? 'bg-stone-400' : 'bg-[#006AFF]'}`} />
                    <span className="text-stone-900">
                      {!isMpActive
                        ? 'Mercado Pago · Integración Desactivada'
                        : typeof navigator !== 'undefined' && !navigator.onLine
                        ? 'Mercado Pago · Modo Offline'
                        : mpIntegrationConfig?.mode === 'PRODUCTION'
                        ? 'Mercado Pago · Producción'
                        : 'Mercado Pago · Prueba'}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    !isMpActive
                      ? 'bg-stone-200 text-stone-700 font-bold'
                      : typeof navigator !== 'undefined' && !navigator.onLine
                      ? 'bg-amber-100 text-amber-900'
                      : mpIntegrationConfig?.connectionStatus === 'CONNECTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {!isMpActive
                      ? 'Desactivada (Registro Manual)'
                      : typeof navigator !== 'undefined' && !navigator.onLine
                      ? 'Offline'
                      : mpIntegrationConfig?.connectionStatus === 'CONNECTED'
                      ? '✓ Conectado'
                      : 'Activo'}
                  </span>
                </div>

                {/* Modality Section */}
                {!isMpActive ? (
                  <div className="space-y-1.5 opacity-75">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                        Modalidad de Cobro Online
                      </label>
                      <span className="text-[10px] font-extrabold text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                        Desactivada (sin cobros con QR)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100/70 rounded-lg border border-stone-200/80 cursor-not-allowed">
                      <div className="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold text-stone-400 bg-stone-50 border border-stone-200/50 select-none">
                        <QrCode className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">QR Físico (Inactivo)</span>
                      </div>
                      <div className="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold text-stone-400 bg-stone-50 border border-stone-200/50 select-none">
                        <Smartphone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">QR Point (Inactivo)</span>
                      </div>
                    </div>
                  </div>
                ) : (!navigator || navigator.onLine) ? (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                      Modalidad de Cobro Online
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100/90 rounded-lg border border-stone-200">
                      <button
                        type="button"
                        onClick={() => {
                          if (mpSource !== 'STATIC_POS_QR') {
                            setMpSource('STATIC_POS_QR');
                            createMpOrderForPos(totalAmount, false, 'STATIC_POS_QR');
                          }
                        }}
                        id="btn-mp-source-static"
                        className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                          mpSource === 'STATIC_POS_QR'
                            ? 'bg-[#FFE600] text-stone-900 shadow-2xs font-extrabold border border-amber-400/80'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 border border-transparent'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#006AFF] shrink-0" />
                        <span className="truncate">QR Físico</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (mpSource !== 'POINT_GENERATED_QR') {
                            setMpSource('POINT_GENERATED_QR');
                            createMpOrderForPos(totalAmount, false, 'POINT_GENERATED_QR');
                          }
                        }}
                        id="btn-mp-source-point"
                        className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                          mpSource === 'POINT_GENERATED_QR'
                            ? 'bg-[#FFE600] text-stone-900 shadow-2xs font-extrabold border border-amber-400/80'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 border border-transparent'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-[#006AFF] shrink-0" />
                        <span className="truncate">QR Point</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {!isMpActive ? (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5 text-stone-800 text-xs">
                    <div className="flex items-center space-x-2 font-bold text-xs text-stone-800">
                      <CreditCard className="w-4 h-4 text-stone-600" />
                      <span>Cobro Mercado Pago · Registro Manual Directo</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      La integración automática está desactivada. Verificá que el cliente haya transferido o abonado los <strong className="font-mono font-bold text-stone-900">{formatCurrency(totalAmount)}</strong> en tu cuenta de Mercado Pago y hacé clic en <strong>"Registrar la venta"</strong> para finalizar la transacción al instante.
                    </p>
                  </div>
                ) : typeof navigator !== 'undefined' && !navigator.onLine ? (
                  <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded space-y-1 text-blue-950 text-xs">
                    <div className="flex items-center space-x-2 font-bold text-xs text-blue-950">
                      <QrCode className="w-4 h-4 text-[#006AFF]" />
                      <span>Cobro por Mercado Pago (Modo Offline)</span>
                    </div>
                    <p className="text-[11px] text-stone-700">
                      El cliente abonará el total de <strong className="font-mono font-bold">{formatCurrency(totalAmount)}</strong> mediante transferencia / QR / App Mercado Pago.
                    </p>
                  </div>
                ) : (
                  <>
                    {mpOrderState === 'CREATING' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#006AFF]" />
                        <span>
                          Iniciando orden en {mpSource === 'POINT_SMART' ? 'Terminal Point Smart' : mpSource === 'POINT_GENERATED_QR' ? 'Terminal Point/POS' : 'Caja Fija'} Mercado Pago...
                        </span>
                      </div>
                    )}

                    {mpOrderState === 'WAITING_PAYMENT' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-1.5 text-xs text-blue-950">
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center space-x-1.5 text-blue-950">
                            {mpSource === 'POINT_SMART' ? (
                              <CreditCard className="w-4 h-4 text-indigo-600" />
                            ) : mpSource === 'POINT_GENERATED_QR' ? (
                              <Smartphone className="w-4 h-4 text-[#006AFF]" />
                            ) : (
                              <QrCode className="w-4 h-4 text-[#006AFF]" />
                            )}
                            <span>
                              {mpSource === 'POINT_SMART'
                                ? 'Terminal Point Smart lista'
                                : mpSource === 'POINT_GENERATED_QR'
                                ? 'QR Point / POS activo'
                                : 'QR habilitado en caja fija'}
                            </span>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/60 text-blue-900 animate-pulse">
                            Esperando pago...
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-700">
                          {mpSource === 'POINT_SMART'
                            ? `Pase la tarjeta o aproxime chip/contactless en la terminal física Mercado Pago Point Smart para abonar ${formatCurrency(totalAmount)}.`
                            : mpSource === 'POINT_GENERATED_QR'
                            ? `El cliente debe escanear el QR en el terminal Point / POS y abonar ${formatCurrency(totalAmount)}.`
                            : `El cliente puede escanear el QR físico de la caja y abonar ${formatCurrency(totalAmount)}.`}
                        </p>
                      </div>
                    )}

                    {mpOrderState === 'PAYMENT_VERIFIED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded space-y-1 text-xs text-emerald-950">
                        <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {mpPaymentId && String(mpPaymentId).trim() !== '' && String(mpPaymentId) !== 'undefined' && String(mpPaymentId) !== 'null'
                              ? `✓ Pago Mercado Pago verificado · Operación #${String(mpPaymentId).replace(/^#+/, '').trim()}`
                              : '✓ Pago Mercado Pago verificado'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-700">
                          • Confirmación manual pendiente. Presione <strong className="text-emerald-900">"Confirmar Cobro"</strong> para asentar la venta y emitir ticket.
                        </p>
                      </div>
                    )}

                    {mpOrderState === 'CONFIRMED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded space-y-1 text-xs text-emerald-950">
                        <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {mpPaymentId && String(mpPaymentId).trim() !== '' && String(mpPaymentId) !== 'undefined' && String(mpPaymentId) !== 'null'
                              ? `✓ Pago Mercado Pago verificado · Operación #${String(mpPaymentId).replace(/^#+/, '').trim()}`
                              : '✓ Pago Mercado Pago verificado'}
                          </span>
                        </div>
                      </div>
                    )}

                    {mpOrderState === 'ERROR' && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded space-y-2 text-xs text-amber-950">
                        <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{mpErrorMessage || 'No se pudo iniciar el cobro. Intentá nuevamente.'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => createMpOrderForPos(totalAmount, false, mpSource)}
                          className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 rounded text-[11px] font-bold text-amber-950 cursor-pointer"
                        >
                          Reintentar conexión
                        </button>
                      </div>
                    )}

                    {mpOrderState === 'IDLE' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-1 text-blue-900 text-xs font-medium">
                        <div className="flex items-center space-x-2 font-bold text-xs text-blue-950">
                          <QrCode className="w-4 h-4 text-[#006AFF]" />
                          <span>Cobro por Mercado Pago</span>
                        </div>
                        <p className="text-[11px]">
                          El cliente abonará el total de <strong className="font-mono">{formatCurrency(totalAmount)}</strong> mediante transferencia / QR / Point Mercado Pago.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            </div>

            {/* Modal Buttons (Fixed Sticky Footer - Always Visible Without Scrolling) */}
            <div className="shrink-0 px-5 py-3 border-t border-stone-100 bg-stone-50/95 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await cancelActiveMpOrder();
                  setShowPaymentModal(false);
                }}
                disabled={submittingSale}
                id="btn-close-payment-modal"
                className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-stone-200"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSale()}
                disabled={
                  submittingSale ||
                  (paymentMethod === 'EFECTIVO' &&
                    (isNaN(Number(cashReceived)) || Number(cashReceived) < totalAmount)) ||
                  (paymentMethod === 'MERCADO_PAGO' && isMpActive && (typeof navigator === 'undefined' || navigator.onLine) &&
                    (mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED')) ||
                  (paymentMethod === 'COMBINADO' &&
                    (Math.abs((splitCashAmount + splitMpAmount) - totalAmount) > 0.01 ||
                     isNaN(Number(splitCashReceived)) || Number(splitCashReceived) < splitCashAmount ||
                     (isMpActive && splitMpAmount > 0 && (typeof navigator === 'undefined' || navigator.onLine) &&
                       (qrNeedsRegeneration || mpOrderAmount === null || Math.abs(mpOrderAmount - splitMpAmount) > 0.01 || (mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED')))))
                }
                id="btn-confirm-sale"
                className={`w-2/3 py-2.5 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed ${
                  (paymentMethod === 'MERCADO_PAGO' && (mpOrderState === 'PAYMENT_VERIFIED' || mpOrderState === 'CONFIRMED')) ||
                  (paymentMethod === 'COMBINADO' && splitMpAmount > 0 && (mpOrderState === 'PAYMENT_VERIFIED' || mpOrderState === 'CONFIRMED'))
                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-400/40'
                    : 'bg-[#006AFF] hover:bg-[#0052CC]'
                }`}
              >
                {submittingSale ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : paymentMethod === 'MERCADO_PAGO' ? (
                  !isMpActive ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Registrar la venta ({formatCurrency(totalAmount)})</span>
                    </>
                  ) : (typeof navigator !== 'undefined' && !navigator.onLine) ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Venta Offline ({formatCurrency(totalAmount)})</span>
                    </>
                  ) : mpOrderState === 'PAYMENT_VERIFIED' || mpOrderState === 'CONFIRMED' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Cobro ({formatCurrency(totalAmount)})</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Esperando acreditación...</span>
                    </>
                  )
                ) : paymentMethod === 'COMBINADO' ? (
                  isMpActive && splitMpAmount > 0 && (typeof navigator === 'undefined' || navigator.onLine) && (mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED') ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Esperando pago MP...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Registrar la venta ({formatCurrency(totalAmount)})</span>
                    </>
                  )
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Venta ({formatCurrency(totalAmount)})</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BUDGET CALCULATOR MODAL */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 border border-stone-200 text-stone-900">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 leading-tight">Calculadora de Presupuesto</h3>
                  <p className="text-xs text-stone-500">¿Cuánto alcanza con una suma fija de dinero?</p>
                </div>
              </div>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Budget Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-stone-700">
                Presupuesto Disponible ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                value={budgetAmount || ''}
                onChange={(e) => setBudgetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-lg font-mono font-black text-stone-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[500, 1000, 2000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBudgetAmount(val)}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 transition-colors cursor-pointer"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Product */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-stone-700">
                Seleccionar Producto
              </label>
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={budgetSearch}
                onChange={(e) => setBudgetSearch(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />

              {budgetSearch.trim() && (
                <div className="bg-white rounded-xl border border-stone-200 shadow-md max-h-36 overflow-y-auto divide-y divide-stone-100">
                  {products
                    .filter((p) => p.name.toLowerCase().includes(budgetSearch.toLowerCase()) || (p.barcode && p.barcode.includes(budgetSearch)))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setBudgetProduct(p);
                          setBudgetSearch('');
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="font-bold text-stone-900">{p.name}</span>
                        <span className="font-mono font-bold text-purple-700">${p.salePrice}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Result Box */}
            {budgetProduct && (
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-stone-900 text-sm">{budgetProduct.name}</span>
                  <span className="font-mono text-xs font-bold text-purple-800">Precio: ${budgetProduct.salePrice}</span>
                </div>

                {(() => {
                  const maxUnits = budgetProduct.salePrice > 0 ? Math.floor(budgetAmount / budgetProduct.salePrice) : 0;
                  const totalCost = maxUnits * budgetProduct.salePrice;
                  const leftover = budgetAmount - totalCost;

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2 rounded-xl border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">Unidades</span>
                          <span className="text-xl font-black font-mono text-purple-700">{maxUnits}</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">Total a Cobrar</span>
                          <span className="text-sm font-black font-mono text-stone-900 pt-1 block">${totalCost}</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-stone-500 block">Sobrante</span>
                          <span className="text-sm font-black font-mono text-emerald-700 pt-1 block">${leftover}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={maxUnits <= 0}
                        onClick={() => {
                          addToCart(budgetProduct, maxUnits);
                          setShowBudgetModal(false);
                          showNotification(`Se agregaron ${maxUnits} u. de "${budgetProduct.name}" al carrito`, 'success');
                        }}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-stone-300 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Cargar {maxUnits} u. al Carrito (${totalCost})</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TODAY SALES HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-3.5 border border-stone-200 text-stone-900 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900 leading-tight">Ventas del Turno de Hoy</h3>
                  <p className="text-xs text-stone-500">Historial en tiempo real de cobros realizados hoy</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 cursor-pointer rounded-xl hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Toggle & Counter Header */}
            <div className="flex items-center justify-between gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => setShowHistoryFilters(!showHistoryFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-stone-200"
              >
                <Filter className="w-3.5 h-3.5 text-stone-500" />
                <span>Rango Horario y Filtros</span>
                {showHistoryFilters ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-600">
                  <strong className="text-stone-900">{filteredTodaySales.length}</strong> {filteredTodaySales.length === 1 ? 'venta' : 'ventas'}
                </span>
                {hasHistoryFilters && (
                  <button
                    type="button"
                    onClick={clearHistoryFilters}
                    className="text-xs font-black text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* QUICK FILTERS ACCORDION / PANEL (COLLAPSIBLE, COLLAPSED BY DEFAULT) */}
            {showHistoryFilters && (
              <div className="bg-stone-50/80 p-3 rounded-2xl border border-stone-200 space-y-2.5 shrink-0 text-xs animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Rango Horario */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-600 block uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>Rango Horario</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={historyTimeFrom}
                        onChange={(e) => setHistoryTimeFrom(e.target.value)}
                        className="w-1/2 h-8 px-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 focus:border-[#006AFF] outline-none"
                        title="Hora Desde"
                      />
                      <span className="text-stone-400 text-xs font-bold">-</span>
                      <input
                        type="time"
                        value={historyTimeTo}
                        onChange={(e) => setHistoryTimeTo(e.target.value)}
                        className="w-1/2 h-8 px-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 focus:border-[#006AFF] outline-none"
                        title="Hora Hasta"
                      />
                    </div>
                  </div>

                  {/* Rango de Importe */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-600 block uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-stone-400" />
                      <span>Importe ($)</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="Mín"
                        value={historyMinAmount}
                        onChange={(e) => setHistoryMinAmount(e.target.value)}
                        className="w-1/2 h-8 px-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 focus:border-[#006AFF] outline-none"
                      />
                      <span className="text-stone-400 text-xs font-bold">-</span>
                      <input
                        type="number"
                        placeholder="Máx"
                        value={historyMaxAmount}
                        onChange={(e) => setHistoryMaxAmount(e.target.value)}
                        className="w-1/2 h-8 px-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800 focus:border-[#006AFF] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Medio de Pago Pills */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-stone-200/60">
                  {(['ALL', 'EFECTIVO', 'MERCADO_PAGO', 'COMBINADO'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setHistoryMethod(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                        historyMethod === m
                          ? 'bg-[#006AFF] text-white shadow-2xs'
                          : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      {m === 'ALL' ? 'Todos' : m === 'EFECTIVO' ? 'Efectivo' : m === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Combinado'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sales List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingHistory ? (
                <div className="p-8 text-center text-stone-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Cargando ventas...</span>
                </div>
              ) : filteredTodaySales.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                  {hasHistoryFilters
                    ? 'No se encontraron ventas con los filtros seleccionados.'
                    : 'Aún no se registraron ventas en el turno de hoy.'}
                </div>
              ) : (
                filteredTodaySales.map((sale) => {
                  const isExpanded = expandedSaleId === sale.id;
                  const saleTime = sale.createdAt
                    ? new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--';

                  return (
                    <div
                      key={sale.id}
                      className="bg-stone-50 hover:bg-stone-100/70 rounded-2xl border border-stone-200 overflow-hidden transition-all shadow-2xs"
                    >
                      {/* Summary Row */}
                      <div
                        onClick={() => setExpandedSaleId(isExpanded ? null : (sale.id || null))}
                        className="w-full p-3 flex items-center justify-between gap-3 text-xs text-left cursor-pointer hover:bg-stone-100/50 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-stone-900 bg-white px-2 py-0.5 rounded-lg border border-stone-200">
                              #{sale.id?.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-[11px] text-stone-500 font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {saleTime}
                            </span>
                            {sale.paymentMethod === 'EFECTIVO' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Efectivo
                              </span>
                            ) : sale.paymentMethod === 'MERCADO_PAGO' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">
                                Mercado Pago
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                Combinado
                              </span>
                            )}

                            {sale.syncStatus === 'PENDING' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Pendiente Sync
                              </span>
                            ) : sale.syncMode === 'OFFLINE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Sincronizada
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-stone-600 truncate max-w-sm">
                            {sale.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-black font-mono text-stone-900 block">
                              {formatCurrency(sale.total)}
                            </span>
                            <span className="text-[10px] text-stone-400 font-bold">
                              {sale.items.reduce((acc, it) => acc + it.quantity, 0)} items
                            </span>
                          </div>

                          {/* Historical Ticket View (Eye button) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingTicketSale(sale);
                            }}
                            className="p-1.5 rounded-xl bg-white hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 border border-stone-200 transition-colors cursor-pointer shadow-2xs"
                            title="Ver ticket de venta"
                            aria-label="Ver ticket de venta"
                          >
                            <Eye className="w-4 h-4 text-stone-700" />
                          </button>

                          <div className="p-1.5 rounded-xl bg-white border border-stone-200 text-stone-500">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-1 border-t border-stone-200/80 bg-white space-y-2.5 animate-in fade-in">
                          {/* Seller & Transaction info */}
                          <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
                            <span>Vendedor: <strong className="text-stone-800">{sale.sellerName || 'Cajero'}</strong></span>
                            <span className="font-mono text-[10px]">ID: {sale.id}</span>
                          </div>

                          {/* Line Items Table */}
                          <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                            <div className="bg-stone-50 px-3 py-1.5 grid grid-cols-12 font-bold text-stone-500 text-[10px] uppercase tracking-wider">
                              <span className="col-span-6">Producto</span>
                              <span className="col-span-2 text-center">Cant.</span>
                              <span className="col-span-2 text-right">Precio</span>
                              <span className="col-span-2 text-right">Subtotal</span>
                            </div>
                            <div className="divide-y divide-stone-100">
                              {sale.items.map((it, idx) => (
                                <div key={idx} className="px-3 py-2 grid grid-cols-12 text-stone-800 text-[11px] items-center">
                                  <span className="col-span-6 font-bold truncate pr-1">{it.productName}</span>
                                  <span className="col-span-2 text-center font-mono font-bold bg-stone-100 px-1 py-0.5 rounded text-[10px]">
                                    {it.quantity} un
                                  </span>
                                  <span className="col-span-2 text-right font-mono text-stone-600">${it.unitPrice}</span>
                                  <span className="col-span-2 text-right font-mono font-bold text-stone-900">${it.subtotal}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Payment Breakdown & Change Details */}
                          <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center font-bold text-stone-800">
                              <span>Total Venta:</span>
                              <strong className="text-sm font-mono font-black text-stone-900">{formatCurrency(sale.total)}</strong>
                            </div>

                            {sale.paymentMethod === 'EFECTIVO' && (
                              <div className="pt-1 border-t border-stone-200/60 space-y-1 text-[11px]">
                                <div className="flex justify-between text-stone-600">
                                  <span>Medio de Pago:</span>
                                  <strong className="text-emerald-700">Efectivo</strong>
                                </div>
                                {sale.cashReceived !== undefined && (
                                  <div className="flex justify-between text-stone-600">
                                    <span>Efectivo Recibido:</span>
                                    <strong className="font-mono text-stone-900">{formatCurrency(sale.cashReceived)}</strong>
                                  </div>
                                )}
                                {sale.change !== undefined && (
                                  <div className="flex justify-between text-stone-600">
                                    <span>Vuelto entregado:</span>
                                    <strong className="font-mono text-emerald-700 font-bold">{formatCurrency(sale.change)}</strong>
                                  </div>
                                )}
                              </div>
                            )}

                            {sale.paymentMethod === 'MERCADO_PAGO' && (
                              <div className="pt-1 border-t border-stone-200/60 space-y-1.5 text-[11px] text-stone-600">
                                <div className="flex justify-between">
                                  <span>Medio de Pago:</span>
                                  <strong className="text-sky-700">Mercado Pago / Transferencia ({formatCurrency(sale.total)})</strong>
                                </div>
                                <div className="bg-sky-50/70 p-2 rounded-lg border border-sky-100 text-[10px] space-y-1 text-sky-950 font-mono">
                                  <div className="font-bold">
                                    {sale.syncMode === 'OFFLINE' || sale.offline ? (
                                      <span className="text-amber-800">• Registrado offline • Verificación manual</span>
                                    ) : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                                      <div className="space-y-0.5">
                                        <span className="text-sky-700 font-bold block">✓ Pago verificado</span>
                                        <span className="text-amber-800 block">• Confirmación manual pendiente</span>
                                      </div>
                                    ) : sale.paymentVerification === 'AUTOMATIC' ? (
                                      <span className="text-emerald-700">✓ Verificado automáticamente</span>
                                    ) : (
                                      <span className="text-amber-800">• Verificación manual</span>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-stone-600">
                                    <span>Modo: <strong className="text-stone-900">{sale.syncMode === 'OFFLINE' || sale.offline ? 'OFFLINE' : 'ONLINE'}</strong></span>
                                    <span>Verificación: <strong className="text-stone-900">{sale.syncMode === 'OFFLINE' || sale.offline || sale.paymentVerification === 'MANUAL' ? 'MANUAL' : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? 'PAGO VERIFICADO (MANUAL PENDIENTE)' : 'AUTOMATIC'}</strong></span>
                                  </div>
                                  {sale.paymentDetails?.paymentId && sale.syncMode !== 'OFFLINE' && !sale.offline && (
                                    <div className="flex justify-between text-stone-600">
                                      <span>Operación:</span>
                                      <strong className="text-stone-900 font-mono">#{sale.paymentDetails.paymentId.replace(/^#+/, '')}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {sale.paymentMethod === 'COMBINADO' && (
                              <div className="pt-1 border-t border-stone-200/60 space-y-1 text-[11px]">
                                <div className="text-purple-800 font-bold">Desglose de Pago Combinado:</div>
                                <div className="flex justify-between text-stone-700 pl-2">
                                  <span>💵 Efectivo:</span>
                                  <strong className="font-mono font-bold">
                                    {formatCurrency(sale.paymentBreakdown?.cashAmount || 0)}
                                  </strong>
                                </div>
                                {sale.paymentBreakdown?.cashReceived !== undefined && (
                                  <div className="flex justify-between text-stone-500 text-[10px] pl-4">
                                    <span>Recibido: {formatCurrency(sale.paymentBreakdown.cashReceived)}</span>
                                    <span>Vuelto: <strong className="text-emerald-700">{formatCurrency(sale.paymentBreakdown.change || 0)}</strong></span>
                                  </div>
                                )}
                                <div className="flex justify-between text-stone-700 pl-2">
                                  <span>📱 Mercado Pago:</span>
                                  <strong className="font-mono font-bold">
                                    {formatCurrency(sale.paymentBreakdown?.mpAmount || 0)}
                                  </strong>
                                </div>
                                <div className="bg-purple-50/70 p-2 rounded-lg border border-purple-100 text-[10px] space-y-1 text-purple-950 font-mono mt-1">
                                  <div className="font-bold">
                                    {sale.syncMode === 'OFFLINE' || sale.offline ? (
                                      <span className="text-amber-800">• MP Registrado offline • Verificación manual</span>
                                    ) : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                                      <div className="space-y-0.5">
                                        <span className="text-sky-700 font-bold block">✓ MP Pago verificado</span>
                                        <span className="text-amber-800 block">• Confirmación manual pendiente</span>
                                      </div>
                                    ) : sale.paymentVerification === 'AUTOMATIC' ? (
                                      <span className="text-emerald-700">✓ MP Verificado automáticamente</span>
                                    ) : (
                                      <span className="text-amber-800">• MP Verificación manual</span>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-stone-600">
                                    <span>Modo MP: <strong className="text-stone-900">{sale.syncMode === 'OFFLINE' || sale.offline ? 'OFFLINE' : 'ONLINE'}</strong></span>
                                    <span>Verificación: <strong className="text-stone-900">{sale.syncMode === 'OFFLINE' || sale.offline || sale.paymentVerification === 'MANUAL' ? 'MANUAL' : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? 'PAGO VERIFICADO (MANUAL PENDIENTE)' : 'AUTOMATIC'}</strong></span>
                                  </div>
                                  {sale.paymentDetails?.paymentId && sale.syncMode !== 'OFFLINE' && !sale.offline && (
                                    <div className="flex justify-between text-stone-600">
                                      <span>Operación MP:</span>
                                      <strong className="text-stone-900 font-mono">#{sale.paymentDetails.paymentId.replace(/^#+/, '')}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraBarcodeScanned}
      />

      {/* POS NOTES MODAL (BLOCK DE NOTAS OPERATIVO) */}
      <PosNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        businessId={business.id}
        userId={userProfile?.uid}
        userName={userProfile?.displayName || userProfile?.email || 'Vendedor'}
        notes={posNotes}
        onNotesChange={setPosNotes}
      />

      {/* SYNC OPERATIONS & CONFLICT RESOLUTION MODAL */}
      <SyncOperationsModal
        businessId={business.id}
        isOpen={showSyncConflictModal}
        onClose={() => setShowSyncConflictModal(false)}
      />

      {/* THERMAL RECEIPT PRINT ANIMATION (REAL SALE DATA - AUTO DISMISS) */}
      {showReceiptAnimation && lastCompletedSale && (
        <ReceiptPrintAnimation
          sale={lastCompletedSale}
          businessName={business?.name || 'MINIMARKET'}
          onComplete={() => {
            setShowReceiptAnimation(false);
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 100);
          }}
        />
      )}

      {/* HISTORICAL TICKET VIEW (PERSISTENT UNTIL USER EXPLICITLY CLOSES) */}
      {viewingTicketSale && (
        <ReceiptPrintAnimation
          sale={viewingTicketSale}
          businessName={business?.name || 'MINIMARKET'}
          autoDismiss={false}
          onComplete={() => setViewingTicketSale(null)}
        />
      )}

    </div>
  );
};
