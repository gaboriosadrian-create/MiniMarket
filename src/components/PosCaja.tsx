import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { Product, CartItem, PosStatus, PaymentMethod } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { processSale } from '../lib/saleService';
import { 
  Search, 
  Barcode, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  AlertTriangle, 
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
  CreditCard,
  Check,
  ArrowRight,
  DollarSign
} from 'lucide-react';

export const PosCaja: React.FC = () => {
  const { userProfile, business } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  // Cart state (local frontend state only - NO Firestore writes)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posStatus, setPosStatus] = useState<PosStatus>('IDLE');
  
  // Search & Scanner state
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{
    message: string;
    type: 'error' | 'warning' | 'success';
  } | null>(null);

  // Modal confirmation for cancelling cart
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Modal payment state for Sprint 3 (COBRAR)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Auto-focus input for barcode scanner
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load products for current business
  const loadProducts = async () => {
    if (!business?.id) return;
    setLoadingProducts(true);
    try {
      const data = await getProductsByBusiness(business.id);
      // Only active products are available for POS sale
      setProducts(data.filter((p) => p.active));
    } catch (err) {
      console.error('Error loading products for POS:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [business?.id]);

  // Keep input focused so physical barcode scanner works seamlessly
  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [cart, notification]);

  // Flash notification helper
  const showNotification = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3000);
  };

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Filtered products list based on search term
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

  // Frequent products (quick grid)
  const frequentProducts = useMemo(() => {
    // Show up to 8 active products for fast 1-tap addition
    return products.slice(0, 8);
  }, [products]);

  // Cart calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.product.salePrice, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // ADD PRODUCT TO CART
  const addToCart = (product: Product, quantityToAdd = 1) => {
    if (!product.active) {
      showNotification('El producto está inactivo', 'warning');
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;
    const requestedQty = currentQtyInCart + quantityToAdd;

    // STOCK VALIDATION: Do not allow quantity > available stock
    if (requestedQty > product.stock) {
      showNotification(
        `Stock insuficiente para "${product.name}". Disponible: ${product.stock} u.`,
        'warning'
      );
      return;
    }

    if (existingIndex >= 0) {
      // Increment existing quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity = requestedQty;
      setCart(newCart);
    } else {
      // Add new item line
      setCart([...cart, { product, quantity: quantityToAdd }]);
    }

    setPosStatus('SHOPPING');
    setNotification(null);
  };

  // SCANNER & SEARCH SUBMIT HANDLER
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return;

    // 1. Try exact barcode match first
    const exactBarcodeMatch = products.find(
      (p) => p.barcode && p.barcode.trim() === cleanTerm
    );

    if (exactBarcodeMatch) {
      addToCart(exactBarcodeMatch, 1);
      setSearchTerm('');
      searchInputRef.current?.focus();
      return;
    }

    // 2. If no exact barcode match, check exact name match or single matching search result
    const exactNameMatch = products.find(
      (p) => p.name.toLowerCase().trim() === cleanTerm.toLowerCase()
    );

    if (exactNameMatch) {
      addToCart(exactNameMatch, 1);
      setSearchTerm('');
      searchInputRef.current?.focus();
      return;
    }

    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0], 1);
      setSearchTerm('');
      searchInputRef.current?.focus();
      return;
    }

    // 3. Product not found
    showNotification('Producto no encontrado', 'error');
    // Keep search term or select it for easy re-scanning
    searchInputRef.current?.select();
  };

  // UPDATE CART ITEM QUANTITY
  const updateCartQuantity = (productId: string, delta: number) => {
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex < 0) return;

    const item = cart[existingIndex];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      // Remove item
      removeFromCart(productId);
      return;
    }

    // STOCK VALIDATION
    if (newQty > item.product.stock) {
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

  // REMOVE ITEM FROM CART
  const removeFromCart = (productId: string) => {
    const newCart = cart.filter((item) => item.product.id !== productId);
    setCart(newCart);
    if (newCart.length === 0) {
      setPosStatus('IDLE');
    }
  };

  // CANCEL CART
  const confirmCancelCart = () => {
    setCart([]);
    setPosStatus('CANCELLED');
    setShowCancelModal(false);
    setSearchTerm('');
    showNotification('Venta cancelada. Carrito vacío.', 'info' as any);
    setTimeout(() => {
      setPosStatus('IDLE');
    }, 1000);
    searchInputRef.current?.focus();
  };

  // OPEN COBRAR / PAYMENT MODAL
  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setPaymentMethod('EFECTIVO');
    setCashReceived(String(totalAmount));
    setSaleError(null);
    setShowPaymentModal(true);
  };

  // CONFIRM SALE & PROCESS TRANSACTION
  const handleConfirmSale = async () => {
    if (submittingSale) return;

    if (!business?.id || !userProfile?.uid) {
      setSaleError('Sesión o negocio no válido.');
      return;
    }

    if (cart.length === 0) {
      setSaleError('El carrito está vacío.');
      return;
    }

    if (paymentMethod === 'EFECTIVO') {
      const received = Number(cashReceived);
      if (isNaN(received) || received < totalAmount) {
        setSaleError('El monto recibido es insuficiente.');
        return;
      }
    }

    setSubmittingSale(true);
    setSaleError(null);

    try {
      const saleResult = await processSale({
        businessId: business.id,
        sellerId: userProfile.uid,
        sellerName: userProfile.displayName || userProfile.email || 'Vendedor',
        items: cart,
        total: totalAmount,
        paymentMethod
      });

      showNotification(`¡Venta #${saleResult.id?.slice(-6).toUpperCase()} registrada con éxito!`, 'success');
      setCart([]);
      setPosStatus('IDLE');
      setShowPaymentModal(false);
      setCashReceived('');
      setSearchTerm('');

      await loadProducts();

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);

    } catch (err: any) {
      console.error('Error in handleConfirmSale:', err);
      setSaleError(err.message || 'Error al procesar la venta. Intente nuevamente.');
    } finally {
      setSubmittingSale(false);
    }
  };

  // KEYBOARD SHORTCUTS (ESC to clear search / cancel modal)
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
      <div className="max-w-4xl mx-auto my-12 p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-xl font-bold text-red-900">Negocio No Asignado</h3>
        <p className="text-sm text-red-700">
          Su usuario no tiene un negocio activo asignado.
        </p>
      </div>
    );
  }

  const isInactive = business.status === 'inactive';

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4">
      
      {/* Business Inactive Warning */}
      {isInactive && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-3 text-red-800 shadow-2xs">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Caja Desactivada - Negocio Inactivo</p>
            <p className="text-xs text-red-700">
              El negocio {business.name} se encuentra inactivo. Contacte al administrador.
            </p>
          </div>
        </div>
      )}

      {/* POS Top Bar Header */}
      <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-black shrink-0 shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800">
                POS / Caja
              </span>
              <span className="text-[10px] text-stone-400">
                {userProfile?.displayName}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
              {business.name}
            </h2>
          </div>
        </div>

        {/* Status Badge & Shortcuts */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-stone-400">Estado:</span>
            <span className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 ${
              posStatus === 'SHOPPING' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : posStatus === 'CANCELLED'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-stone-800 text-stone-300 border border-stone-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                posStatus === 'SHOPPING' ? 'bg-emerald-400' : 'bg-stone-400'
              }`} />
              {posStatus === 'SHOPPING' ? 'Venta en curso' : 'Caja Lista (IDLE)'}
            </span>
          </div>

          <button
            onClick={loadProducts}
            title="Recargar catálogo de productos"
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div className={`p-3.5 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
          notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : notification.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`w-5 h-5 shrink-0 ${
              notification.type === 'error' ? 'text-red-600' : 'text-amber-600'
            }`} />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN POS DESKTOP & MOBILE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Search, Scanner & Catalog (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* SEARCH & SCANNER INPUT CARD */}
          <div className="bg-white rounded-2xl border-2 border-stone-300 p-4 shadow-2xs space-y-2 focus-within:border-emerald-600 transition-colors">
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-emerald-600" />
                Buscar Producto / Escanear Código
              </span>
              <span className="text-[10px] font-normal text-stone-400 hidden sm:inline">
                Soporta Scanner HID / Teclado
              </span>
            </label>

            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Escanear código o buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  id="pos-search-input"
                  className="w-full pl-11 pr-10 py-3 border border-stone-300 rounded-xl font-medium text-base text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isInactive}
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-3.5 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isInactive || !searchTerm.trim()}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-bold rounded-xl text-sm transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            </form>
          </div>

          {/* SEARCH RESULTS DROPDOWN / LIST */}
          {searchTerm.trim() !== '' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-md overflow-hidden space-y-1">
              <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-600 flex justify-between items-center">
                <span>Resultados de Búsqueda ({filteredProducts.length})</span>
                <span className="text-[10px] text-stone-400">Tocar producto para agregar</span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-stone-100">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-500 font-medium">
                    Sin coincidencias para "{searchTerm}"
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        addToCart(p, 1);
                        setSearchTerm('');
                        searchInputRef.current?.focus();
                      }}
                      className="p-3 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-bold text-sm text-stone-900 group-hover:text-emerald-900">{p.name}</p>
                        <p className="text-xs text-stone-500 font-mono">
                          {p.barcode ? `Código: ${p.barcode}` : 'Sin código'} • {p.category}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-emerald-700 font-mono">{formatCurrency(p.salePrice)}</p>
                        <p className={`text-[11px] font-bold ${
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

          {/* FREQUENT PRODUCTS / QUICK SELECTION GRID */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                Productos Frecuentes / Acceso Rápido
              </h3>
              <span className="text-[11px] text-stone-400 font-medium">Toque de 1-clic</span>
            </div>

            {loadingProducts ? (
              <div className="p-8 text-center text-xs text-stone-400">Cargando catálogo...</div>
            ) : frequentProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">No hay productos activos cargados.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {frequentProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p, 1)}
                    disabled={isInactive}
                    className="p-3 bg-stone-50 hover:bg-emerald-50/80 border border-stone-200 hover:border-emerald-300 rounded-xl text-left transition-all group flex flex-col justify-between space-y-2 focus:ring-2 focus:ring-emerald-500"
                  >
                    <div>
                      <p className="font-bold text-xs text-stone-900 group-hover:text-emerald-900 line-clamp-2 leading-tight">
                        {p.name}
                      </p>
                      <span className="text-[10px] text-stone-500 block mt-0.5 font-mono">
                        Stock: {p.stock}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                      <span className="font-black text-xs text-stone-900 font-mono group-hover:text-emerald-700">
                        {formatCurrency(p.salePrice)}
                      </span>
                      <span className="w-5 h-5 rounded-md bg-stone-200 group-hover:bg-emerald-600 text-stone-700 group-hover:text-white flex items-center justify-center font-bold text-xs transition-colors">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: CART & TOTAL DISPLAY (5 cols on desktop) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border-2 border-stone-300 shadow-sm flex flex-col overflow-hidden">
          
          {/* Cart Header */}
          <div className="bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              <h3 className="font-black text-base tracking-tight">Carrito de Venta</h3>
            </div>
            <span className="text-xs font-bold bg-stone-800 text-stone-300 px-2.5 py-1 rounded-full border border-stone-700">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Cart Items List */}
          <div className="p-4 flex-1 min-h-[280px] max-h-[420px] overflow-y-auto divide-y divide-stone-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-stone-700 text-sm">Carrito Vacío</p>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs">
                    Escanee un código de barras o busque un producto para agregarlo.
                  </p>
                </div>
              </div>
            ) : (
              cart.map((item) => {
                const itemSubtotal = item.quantity * item.product.salePrice;
                return (
                  <div key={item.product.id} className="py-3.5 flex items-center justify-between gap-2">
                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-stone-900 truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">
                        {formatCurrency(item.product.salePrice)} c/u
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0 bg-stone-100 p-1 rounded-xl border border-stone-200">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-stone-200 text-stone-800 font-bold flex items-center justify-center text-sm shadow-2xs transition-colors"
                        title="Disminuir cantidad"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-8 text-center font-black text-sm text-stone-900 font-mono">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => updateCartQuantity(item.product.id, 1)}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-stone-200 text-stone-800 font-bold flex items-center justify-center text-sm shadow-2xs transition-colors"
                        title="Aumentar cantidad"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal & Remove */}
                    <div className="text-right shrink-0 min-w-[80px]">
                      <p className="font-black text-sm text-stone-900 font-mono">
                        {formatCurrency(itemSubtotal)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors p-1 mt-0.5"
                        title="Eliminar de carrito"
                      >
                        <Trash2 className="w-4 h-4 ml-auto" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* TOTAL & CANCEL FOOTER */}
          <div className="p-4 bg-stone-50 border-t-2 border-stone-200 space-y-4">
            
            {/* Total Row */}
            <div className="bg-stone-900 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
                  Total a Cobrar
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  {totalItemsCount} {totalItemsCount === 1 ? 'producto' : 'productos'} en carrito
                </span>
              </div>
              <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight" id="pos-cart-total">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Action Buttons: COBRAR and CANCELAR */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={cart.length === 0}
                id="btn-cancel-cart"
                className="w-1/3 py-3.5 px-3 bg-red-100 hover:bg-red-200 disabled:bg-stone-100 disabled:text-stone-400 text-red-800 font-bold rounded-xl text-xs sm:text-sm transition-colors border border-red-200 disabled:border-stone-200 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Cancelar</span>
              </button>

              <button
                onClick={openPaymentModal}
                disabled={cart.length === 0 || isInactive}
                id="btn-cobrar"
                className="w-2/3 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-black rounded-xl text-base transition-colors shadow-md disabled:shadow-none flex items-center justify-center gap-2 group"
              >
                <Banknote className="w-5 h-5 text-emerald-200" />
                <span>COBRAR</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL: CONFIRMAR CANCELAR CARRITO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-stone-900">¿Cancelar la venta actual?</h3>
              <p className="text-xs text-stone-500 mt-1">
                Se vaciará el carrito con {totalItemsCount} productos por un total de {formatCurrency(totalAmount)}.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-sm"
              >
                Volver
              </button>
              <button
                onClick={confirmCancelCart}
                id="btn-confirm-cancel"
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-xs"
              >
                Sí, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANTALLA DE COBRO (PAYMENT MODAL) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 leading-tight">Cobrar Venta</h3>
                  <p className="text-xs text-stone-500">{totalItemsCount} productos en carrito</p>
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={submittingSale}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner inside Modal */}
            {saleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{saleError}</span>
              </div>
            )}

            {/* Total Display */}
            <div className="bg-stone-900 text-white p-4 rounded-xl text-center space-y-1 shadow-inner">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total A Cobrar</span>
              <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                {formatCurrency(totalAmount)}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-stone-600">
                Seleccionar Medio de Pago
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('EFECTIVO');
                    setCashReceived(String(totalAmount));
                    setSaleError(null);
                  }}
                  id="btn-pay-efectivo"
                  className={`p-3.5 rounded-xl font-extrabold text-xs sm:text-sm border-2 flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'EFECTIVO'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-2xs'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <Banknote className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>💵 EFECTIVO</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('MERCADO_PAGO');
                    setSaleError(null);
                  }}
                  id="btn-pay-mp"
                  className={`p-3.5 rounded-xl font-extrabold text-xs sm:text-sm border-2 flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'MERCADO_PAGO'
                      ? 'bg-sky-50 border-sky-600 text-sky-900 shadow-2xs'
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-sky-600 shrink-0" />
                  <span>🟦 MERCADO PAGO</span>
                </button>
              </div>
            </div>

            {/* EFECTIVO FLOW */}
            {paymentMethod === 'EFECTIVO' && (
              <div className="space-y-4 pt-1 border-t border-stone-100">
                
                {/* Cash Received Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-stone-700 flex justify-between">
                    <span>Monto Recibido</span>
                    <span className="text-[10px] text-stone-400">Ingrese el billete o monto</span>
                  </label>

                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-stone-400 font-bold text-lg">$</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={cashReceived}
                      onChange={(e) => {
                        setCashReceived(e.target.value);
                        setSaleError(null);
                      }}
                      id="input-cash-received"
                      className="w-full pl-8 pr-4 py-2.5 border-2 border-stone-300 rounded-xl text-xl font-mono font-black text-stone-900 focus:outline-none focus:border-emerald-600"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-stone-400 block">Atajos de Billete</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashReceived(String(totalAmount))}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold border border-stone-200"
                    >
                      Exacto ({formatCurrency(totalAmount)})
                    </button>
                    {[1000, 2000, 5000, 10000, 20000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashReceived(String(val))}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-emerald-100 hover:text-emerald-900 text-stone-700 rounded-lg text-xs font-bold border border-stone-200 transition-colors"
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
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isInsufficient
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">
                          Vuelto A Entregar
                        </span>
                        {isInsufficient && (
                          <span className="text-[11px] font-semibold text-amber-700">
                            Faltan {formatCurrency(totalAmount - (isNaN(numReceived) ? 0 : numReceived))}
                          </span>
                        )}
                      </div>
                      <span className={`text-2xl font-black font-mono ${
                        isInsufficient ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        {formatCurrency(change)}
                      </span>
                    </div>
                  );
                })()}

              </div>
            )}

            {/* MERCADO PAGO FLOW */}
            {paymentMethod === 'MERCADO_PAGO' && (
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2 text-sky-900 text-xs font-medium">
                <div className="flex items-center space-x-2 font-bold text-sm text-sky-950">
                  <QrCode className="w-5 h-5 text-sky-600" />
                  <span>Cobro por Mercado Pago</span>
                </div>
                <p>
                  El cliente abonará el total de <strong className="font-mono">{formatCurrency(totalAmount)}</strong> mediante transferencia / QR / App Mercado Pago.
                </p>
                <p className="text-[11px] text-sky-700 italic">
                  * Registra la venta con medio de pago MERCADO_PAGO y descuenta el stock.
                </p>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={submittingSale}
                id="btn-close-payment-modal"
                className="w-1/3 py-3 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-800 font-bold rounded-xl text-sm transition-colors"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={
                  submittingSale ||
                  (paymentMethod === 'EFECTIVO' &&
                    (isNaN(Number(cashReceived)) || Number(cashReceived) < totalAmount))
                }
                id="btn-confirm-sale"
                className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-black rounded-xl text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2"
              >
                {submittingSale ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>CONFIRMAR VENTA</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
