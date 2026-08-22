import { Product, Sale, Expense, StockAdjustment, Receiving, OutboxOperation, OutboxStatus } from '../types';

/**
 * Local Data Store (IndexedDB) for MiniMarket PWA
 * Provides structured, multi-tenant local persistence for:
 * 1. Catalog Products & Combos (products)
 * 2. Business Metadata (business_meta)
 * 3. Offline Outbox Operations (outbox)
 * 4. Offline Sales History & Snapshots (offline_sales)
 * 5. Offline Expenses History & Snapshots (offline_expenses)
 * 6. Offline Stock Adjustments & Snapshots (offline_stock_adjustments)
 * 7. Offline Receivings & Snapshots (offline_receivings)
 */

const DB_NAME = 'minimarket_offline_db';
const DB_VERSION = 3;

export interface BusinessMetadata {
  businessId: string;
  businessName?: string;
  lastSyncedAt: string;
  catalogVersion: string;
  productCount: number;
  updatedAt: string;
}

export interface OfflineDiagnosticsData {
  isSupported: boolean;
  dbName: string;
  dbVersion: number;
  businessId: string | null;
  businessName: string | null;
  lastSyncedAt: string | null;
  catalogVersion: string | null;
  productCount: number;
  tracksStockCount: number;
  nonTracksStockCount: number;
  combosCount: number;
  barcodesCount: number;
  pendingOutboxCount: number;
  syncingOutboxCount: number;
  syncedOutboxCount: number;
  errorOutboxCount: number;
  stockConflictCount: number;
  sampleProducts: Array<{
    id: string;
    name: string;
    barcode: string | null;
    salePrice: number;
    stock: number;
    tracksStock: boolean;
    isCombo: boolean;
    comboItemsCount: number;
  }>;
  sampleOutbox: Array<{
    operationId: string;
    saleId: string;
    status: OutboxStatus;
    total: number;
    createdAt: string;
    attempts: number;
    lastError: string | null;
  }>;
}

export interface LocalStockDeduction {
  productId: string;
  quantityToDeduct: number;
  productName?: string;
}

class LocalDataStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Check if IndexedDB is available in the current environment
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Open / initialize the IndexedDB instance
   */
  private async getDB(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      throw new Error('IndexedDB no está soportado en este navegador.');
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Products Store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('by_businessId', 'businessId', { unique: false });
          productStore.createIndex('by_business_barcode', ['businessId', 'barcode'], { unique: false });
          productStore.createIndex('by_business_active', ['businessId', 'active'], { unique: false });
        }

        // 2. Business Metadata Store (Last synced, catalog version, etc.)
        if (!db.objectStoreNames.contains('business_meta')) {
          db.createObjectStore('business_meta', { keyPath: 'businessId' });
        }

        // 3. Outbox Operations Store (Phase 3)
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'operationId' });
          outboxStore.createIndex('by_businessId', 'businessId', { unique: false });
          outboxStore.createIndex('by_status', 'status', { unique: false });
          outboxStore.createIndex('by_business_status', ['businessId', 'status'], { unique: false });
          outboxStore.createIndex('by_business_createdAt', ['businessId', 'createdAt'], { unique: false });
          outboxStore.createIndex('by_saleId', 'saleId', { unique: false });
        }

        // 4. Offline Sales History Store (Phase 3)
        if (!db.objectStoreNames.contains('offline_sales')) {
          const salesStore = db.createObjectStore('offline_sales', { keyPath: 'id' });
          salesStore.createIndex('by_businessId', 'businessId', { unique: false });
          salesStore.createIndex('by_business_createdAt', ['businessId', 'createdAt'], { unique: false });
          salesStore.createIndex('by_business_syncStatus', ['businessId', 'syncStatus'], { unique: false });
        }

        // 5. Offline Expenses Store (Phase 5)
        if (!db.objectStoreNames.contains('offline_expenses')) {
          const expenseStore = db.createObjectStore('offline_expenses', { keyPath: 'id' });
          expenseStore.createIndex('by_businessId', 'businessId', { unique: false });
          expenseStore.createIndex('by_business_createdAt', ['businessId', 'createdAt'], { unique: false });
          expenseStore.createIndex('by_business_syncStatus', ['businessId', 'syncStatus'], { unique: false });
        }

        // 6. Offline Stock Adjustments Store (Phase 5)
        if (!db.objectStoreNames.contains('offline_stock_adjustments')) {
          const adjStore = db.createObjectStore('offline_stock_adjustments', { keyPath: 'id' });
          adjStore.createIndex('by_businessId', 'businessId', { unique: false });
          adjStore.createIndex('by_business_createdAt', ['businessId', 'createdAt'], { unique: false });
          adjStore.createIndex('by_business_syncStatus', ['businessId', 'syncStatus'], { unique: false });
        }

        // 7. Offline Receivings Store (Phase 5)
        if (!db.objectStoreNames.contains('offline_receivings')) {
          const rcvStore = db.createObjectStore('offline_receivings', { keyPath: 'id' });
          rcvStore.createIndex('by_businessId', 'businessId', { unique: false });
          rcvStore.createIndex('by_business_createdAt', ['businessId', 'createdAt'], { unique: false });
          rcvStore.createIndex('by_business_syncStatus', ['businessId', 'syncStatus'], { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Error al abrir base de datos local IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  // ==========================================
  // 1. CATALOG PRODUCTS MANAGEMENT
  // ==========================================

  /**
   * Save / overwrite catalog products for a specific businessId in IndexedDB
   */
  public async saveProducts(
    businessId: string,
    products: Product[],
    businessName?: string
  ): Promise<void> {
    if (!this.isSupported() || !businessId) return;

    const db = await this.getDB();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['products', 'business_meta'], 'readwrite');
      const productStore = tx.objectStore('products');
      const metaStore = tx.objectStore('business_meta');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      // 1. Get existing products for this business to purge any deleted ones
      const index = productStore.index('by_businessId');
      const getRequest = index.getAll(IDBKeyRange.only(businessId));

      getRequest.onsuccess = () => {
        const existingList = (getRequest.result || []) as Product[];
        const newIds = new Set(products.map((p) => p.id));

        // Delete products that are no longer present for this business
        for (const existing of existingList) {
          if (!newIds.has(existing.id)) {
            productStore.delete(existing.id);
          }
        }

        // Put new/updated products
        for (const prod of products) {
          const cleanProduct: Product = {
            id: prod.id,
            businessId: prod.businessId || businessId,
            barcode: prod.barcode ? prod.barcode.trim() : null,
            name: prod.name || '',
            category: prod.category || 'General',
            costPrice: Number(prod.costPrice) || 0,
            salePrice: Number(prod.salePrice) || 0,
            stock: Number(prod.stock) || 0,
            minimumStock: Number(prod.minimumStock) || 0,
            reorderPoint: prod.reorderPoint !== undefined ? Number(prod.reorderPoint) : undefined,
            targetStock: prod.targetStock !== undefined ? Number(prod.targetStock) : undefined,
            tracksStock: prod.isCombo ? false : (prod.tracksStock !== false),
            isCombo: Boolean(prod.isCombo),
            comboItems: prod.isCombo && Array.isArray(prod.comboItems) ? prod.comboItems : [],
            active: prod.active !== false,
            createdAt: prod.createdAt || new Date().toISOString(),
            updatedAt: prod.updatedAt || new Date().toISOString()
          };
          productStore.put(cleanProduct);
        }

        // 2. Save Business Metadata
        const now = new Date().toISOString();
        const meta: BusinessMetadata = {
          businessId,
          businessName: businessName || undefined,
          lastSyncedAt: now,
          catalogVersion: `v2-${now.slice(0, 10)}`,
          productCount: products.length,
          updatedAt: now
        };
        metaStore.put(meta);
      };
    });
  }

  /**
   * Retrieve all products stored locally for a specific businessId
   */
  public async getProductsByBusiness(businessId: string): Promise<Product[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<Product[]>((resolve, reject) => {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          const items = (request.result || []) as Product[];
          resolve(items.sort((a, b) => a.name.localeCompare(b.name)));
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo productos locales:', err);
      return [];
    }
  }

  /**
   * Retrieve only active products stored locally for a specific businessId
   */
  public async getActiveProductsByBusiness(businessId: string): Promise<Product[]> {
    const all = await this.getProductsByBusiness(businessId);
    return all.filter((p) => p.active);
  }

  /**
   * Lookup a single product by barcode within a business
   */
  public async getProductByBarcode(businessId: string, barcode: string): Promise<Product | null> {
    if (!this.isSupported() || !businessId || !barcode) return null;

    try {
      const cleanBarcode = barcode.trim();
      const db = await this.getDB();
      return new Promise<Product | null>((resolve, reject) => {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('by_business_barcode');
        const request = index.get([businessId, cleanBarcode]);

        request.onsuccess = () => {
          resolve((request.result as Product) || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error buscando producto por código de barras:', err);
      return null;
    }
  }

  /**
   * Lookup a single product by id within a business
   */
  public async getProductById(businessId: string, productId: string): Promise<Product | null> {
    if (!this.isSupported() || !businessId || !productId) return null;

    try {
      const db = await this.getDB();
      return new Promise<Product | null>((resolve, reject) => {
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.get(productId);

        request.onsuccess = () => {
          const prod = request.result as Product | undefined;
          if (prod && prod.businessId === businessId) {
            resolve(prod);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error buscando producto por ID:', err);
      return null;
    }
  }

  /**
   * Update stock of a single product locally
   */
  public async updateLocalProductStock(businessId: string, productId: string, newStock: number): Promise<void> {
    if (!this.isSupported() || !businessId || !productId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const request = store.get(productId);

        request.onsuccess = () => {
          const prod = request.result as Product | undefined;
          if (prod && prod.businessId === businessId) {
            prod.stock = Math.max(0, newStock);
            prod.updatedAt = new Date().toISOString();
            store.put(prod);
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error actualizando stock local:', err);
    }
  }

  // ==========================================
  // 2. ATOMIC OFFLINE SALE TRANSACTION
  // ==========================================

  /**
   * Atomically records an offline sale in IndexedDB:
   * 1. Validates local stock for all items & combo components.
   * 2. Decrements local stock in `products` store.
   * 3. Saves `Sale` snapshot in `offline_sales` store.
   * 4. Saves `OutboxOperation` in `outbox` store.
   */
  public async createOfflineSaleTransaction(
    businessId: string,
    sale: Sale,
    operation: OutboxOperation
  ): Promise<Sale> {
    if (!this.isSupported()) {
      throw new Error('Almacenamiento local no soportado en este dispositivo.');
    }

    const db = await this.getDB();

    return new Promise<Sale>((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_sales', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const salesStore = tx.objectStore('offline_sales');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => {
        reject(tx.error || new Error('Error al registrar la venta offline en base local.'));
      };

      tx.oncomplete = () => {
        resolve(sale);
      };

      // 1. Fetch all products involved to check & deduct stock
      const getIndex = productStore.index('by_businessId');
      const getAllReq = getIndex.getAll(IDBKeyRange.only(businessId));

      getAllReq.onsuccess = () => {
        const localProducts = (getAllReq.result || []) as Product[];
        const productMap = new Map<string, Product>();
        for (const p of localProducts) {
          productMap.set(p.id, { ...p });
        }

        // Calculate needed deductions
        const accumulatedDeductions = new Map<string, number>();

        for (const cartItem of operation.payload.items) {
          const prod = productMap.get(cartItem.product.id);
          if (!prod) {
            tx.abort();
            return reject(new Error(`El producto "${cartItem.product.name}" no existe en la base de datos local.`));
          }
          if (!prod.active) {
            tx.abort();
            return reject(new Error(`El producto "${prod.name}" está desactivado.`));
          }

          const qty = cartItem.quantity;
          const isCombo = Boolean(prod.isCombo && prod.comboItems && prod.comboItems.length > 0);
          const tracksStock = prod.tracksStock !== false;

          if (isCombo) {
            for (const cItem of prod.comboItems || []) {
              const cTracksStock = cItem.tracksStock !== undefined 
                ? Boolean(cItem.tracksStock) 
                : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

              if (cTracksStock) {
                const comp = productMap.get(cItem.productId);
                if (!comp) {
                  tx.abort();
                  return reject(new Error(`El componente de combo "${cItem.productName || cItem.productId}" no existe localmente.`));
                }
                if (comp.tracksStock !== false) {
                  const needed = cItem.quantity * qty;
                  const prevDed = accumulatedDeductions.get(comp.id) || 0;
                  const currentStock = Number(comp.stock) || 0;
                  const available = currentStock - prevDed;

                  if (available < needed) {
                    tx.abort();
                    return reject(new Error(`Stock insuficiente del componente "${comp.name}" para combo "${prod.name}". Disponible: ${available} u.`));
                  }
                  accumulatedDeductions.set(comp.id, prevDed + needed);
                }
              }
            }
          } else if (tracksStock) {
            const prevDed = accumulatedDeductions.get(prod.id) || 0;
            const currentStock = Number(prod.stock) || 0;
            const available = currentStock - prevDed;

            if (available < qty) {
              tx.abort();
              return reject(new Error(`Stock insuficiente para "${prod.name}". Disponible: ${available} u.`));
            }
            accumulatedDeductions.set(prod.id, prevDed + qty);
          }
        }

        // 2. Apply stock deductions to productStore
        const now = new Date().toISOString();
        accumulatedDeductions.forEach((deductQty, prodId) => {
          const prod = productMap.get(prodId);
          if (prod) {
            prod.stock = Math.max(0, (Number(prod.stock) || 0) - deductQty);
            prod.updatedAt = now;
            productStore.put(prod);
          }
        });

        // 3. Save offline sale record
        salesStore.put(sale);

        // 4. Save outbox operation record
        outboxStore.put(operation);
      };
    });
  }

  // ==========================================
  // 3. OUTBOX OPERATIONS MANAGEMENT
  // ==========================================

  /**
   * Recovers any outbox operations stuck in 'SYNCING' state (e.g. after tab closure, crash, or power loss).
   * Resets them back to 'PENDING' so they can be processed cleanly.
   */
  public async recoverStuckSyncingOperations(
    businessId: string,
    timeoutMs: number = 30000
  ): Promise<number> {
    if (!this.isSupported() || !businessId) return 0;

    try {
      const db = await this.getDB();
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(
          ['outbox', 'offline_sales', 'offline_expenses', 'offline_stock_adjustments', 'offline_receivings'],
          'readwrite'
        );
        const outboxStore = tx.objectStore('outbox');
        const salesStore = tx.objectStore('offline_sales');
        const expenseStore = tx.objectStore('offline_expenses');
        const adjStore = tx.objectStore('offline_stock_adjustments');
        const rcvStore = tx.objectStore('offline_receivings');
        const index = outboxStore.index('by_businessId');
        const req = index.getAll(IDBKeyRange.only(businessId));

        let recoveredCount = 0;

        req.onsuccess = () => {
          const ops = (req.result || []) as OutboxOperation[];
          const now = Date.now();

          for (const op of ops) {
            if (op.status === 'SYNCING') {
              const lastAttempt = op.lastAttemptAt ? new Date(op.lastAttemptAt).getTime() : 0;
              const isStuck = !op.lastAttemptAt || (now - lastAttempt > timeoutMs);

              if (isStuck) {
                recoveredCount++;
                op.status = 'PENDING';
                op.lastError = 'Recuperado de interrupción / reinicio en estado SYNCING';
                outboxStore.put(op);

                if (op.saleId) {
                  const saleReq = salesStore.get(op.saleId);
                  saleReq.onsuccess = () => {
                    const s = saleReq.result as Sale | undefined;
                    if (s && s.businessId === businessId && s.syncStatus === 'SYNCING') {
                      s.syncStatus = 'PENDING';
                      s.syncError = 'Recuperado de interrupción en estado SYNCING';
                      salesStore.put(s);
                    }
                  };
                }

                if (op.expenseId) {
                  const expReq = expenseStore.get(op.expenseId);
                  expReq.onsuccess = () => {
                    const e = expReq.result as Expense | undefined;
                    if (e && e.businessId === businessId && e.syncStatus === 'SYNCING') {
                      e.syncStatus = 'PENDING';
                      e.syncError = 'Recuperado de interrupción en estado SYNCING';
                      expenseStore.put(e);
                    }
                  };
                }

                if (op.adjustmentId) {
                  const adjReq = adjStore.get(op.adjustmentId);
                  adjReq.onsuccess = () => {
                    const a = adjReq.result as StockAdjustment | undefined;
                    if (a && a.businessId === businessId && a.syncStatus === 'SYNCING') {
                      a.syncStatus = 'PENDING';
                      a.syncError = 'Recuperado de interrupción en estado SYNCING';
                      adjStore.put(a);
                    }
                  };
                }

                if (op.receivingId) {
                  const rcvReq = rcvStore.get(op.receivingId);
                  rcvReq.onsuccess = () => {
                    const r = rcvReq.result as Receiving | undefined;
                    if (r && r.businessId === businessId && r.syncStatus === 'SYNCING') {
                      r.syncStatus = 'PENDING';
                      r.syncError = 'Recuperado de interrupción en estado SYNCING';
                      rcvStore.put(r);
                    }
                  };
                }
              }
            }
          }
        };

        tx.oncomplete = () => {
          if (recoveredCount > 0) {
            console.log(`[LocalDataStore] ${recoveredCount} operaciones en SYNCING fueron recuperadas y restauradas a PENDING.`);
          }
          resolve(recoveredCount);
        };

        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error recuperando operaciones en SYNCING:', err);
      return 0;
    }
  }

  /**
   * Resolves an offline operation and its linked sale record using prioritized multi-index matching.
   * Priority:
   * 1. Exact operationId in outbox
   * 2. Exact saleId in offline_sales
   * 3. Index by_saleId in outbox
   * 4. Scanned search in outbox by businessId
   * 5. Scanned search in offline_sales by businessId
   */
  public async resolveOfflineOperation(params: {
    businessId: string;
    operationId?: string;
    saleId?: string;
  }): Promise<{
    operation?: OutboxOperation;
    sale?: Sale;
    matchedBy: 'EXACT_OPERATION_ID' | 'EXACT_SALE_ID' | 'INDEX_SALE_ID' | 'OUTBOX_LINK' | 'BUSINESS_SCAN' | 'NONE';
  }> {
    const { businessId, operationId, saleId } = params;
    if (!this.isSupported() || !businessId || (!operationId && !saleId)) {
      return { matchedBy: 'NONE' };
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['outbox', 'offline_sales'], 'readonly');
        const outboxStore = tx.objectStore('outbox');
        const salesStore = tx.objectStore('offline_sales');

        let matchedOp: OutboxOperation | undefined;
        let matchedSale: Sale | undefined;
        let matchedBy: 'EXACT_OPERATION_ID' | 'EXACT_SALE_ID' | 'INDEX_SALE_ID' | 'OUTBOX_LINK' | 'BUSINESS_SCAN' | 'NONE' = 'NONE';

        // 1. Try exact operationId in outbox
        if (operationId) {
          const opReq = outboxStore.get(operationId);
          opReq.onsuccess = () => {
            const op = opReq.result as OutboxOperation | undefined;
            if (op && op.businessId === businessId) {
              matchedOp = op;
              matchedBy = 'EXACT_OPERATION_ID';
              const targetSaleId = op.saleId || op.payload?.saleId || saleId || op.operationId;
              if (targetSaleId) {
                const sReq = salesStore.get(targetSaleId);
                sReq.onsuccess = () => {
                  const s = sReq.result as Sale | undefined;
                  if (s && s.businessId === businessId) {
                    matchedSale = s;
                  }
                  finishResolution();
                };
                return;
              }
            }
            trySaleIdLookup();
          };
          opReq.onerror = () => trySaleIdLookup();
        } else {
          trySaleIdLookup();
        }

        // 2. Try exact saleId in offline_sales
        function trySaleIdLookup() {
          if (saleId) {
            const saleReq = salesStore.get(saleId);
            saleReq.onsuccess = () => {
              const s = saleReq.result as Sale | undefined;
              if (s && s.businessId === businessId) {
                matchedSale = s;
                if (!matchedOp) {
                  matchedBy = 'EXACT_SALE_ID';
                  const linkedOpId = s.outboxOperationId;
                  if (linkedOpId) {
                    const opReq = outboxStore.get(linkedOpId);
                    opReq.onsuccess = () => {
                      const op = opReq.result as OutboxOperation | undefined;
                      if (op && op.businessId === businessId) {
                        matchedOp = op;
                      }
                      tryIndexSaleIdLookup();
                    };
                    return;
                  }
                }
              }
              tryIndexSaleIdLookup();
            };
            saleReq.onerror = () => tryIndexSaleIdLookup();
          } else {
            tryIndexSaleIdLookup();
          }
        }

        // 3. Try index by_saleId in outbox
        function tryIndexSaleIdLookup() {
          if (matchedOp) {
            finishResolution();
            return;
          }

          const targetSaleId = saleId || operationId;
          if (targetSaleId && outboxStore.indexNames.contains('by_saleId')) {
            const index = outboxStore.index('by_saleId');
            const req = index.getAll(IDBKeyRange.only(targetSaleId));
            req.onsuccess = () => {
              const ops = (req.result || []) as OutboxOperation[];
              const found = ops.find(o => o.businessId === businessId);
              if (found) {
                matchedOp = found;
                matchedBy = 'INDEX_SALE_ID';
                if (!matchedSale && found.saleId) {
                  const sReq = salesStore.get(found.saleId);
                  sReq.onsuccess = () => {
                    const s = sReq.result as Sale | undefined;
                    if (s && s.businessId === businessId) matchedSale = s;
                    finishResolution();
                  };
                  return;
                }
              }
              tryBusinessScan();
            };
            req.onerror = () => tryBusinessScan();
          } else {
            tryBusinessScan();
          }
        }

        // 4. Scanned search by businessId in outbox and salesStore
        function tryBusinessScan() {
          if (matchedOp && matchedSale) {
            finishResolution();
            return;
          }

          const outboxIndex = outboxStore.index('by_businessId');
          const outboxReq = outboxIndex.getAll(IDBKeyRange.only(businessId));

          outboxReq.onsuccess = () => {
            const allOps = (outboxReq.result || []) as OutboxOperation[];
            if (!matchedOp) {
              matchedOp = allOps.find(o => 
                (operationId && o.operationId === operationId) ||
                (saleId && o.saleId === saleId) ||
                (saleId && o.payload?.saleId === saleId) ||
                (saleId && o.saleSnapshot?.id === saleId) ||
                (saleId && o.operationId === saleId) ||
                (operationId && o.saleId === operationId)
              );
              if (matchedOp) matchedBy = 'BUSINESS_SCAN';
            }

            const salesIndex = salesStore.index('by_businessId');
            const salesReq = salesIndex.getAll(IDBKeyRange.only(businessId));
            salesReq.onsuccess = () => {
              const allSales = (salesReq.result || []) as Sale[];
              if (!matchedSale) {
                matchedSale = allSales.find(s => 
                  (saleId && s.id === saleId) ||
                  (operationId && s.id === operationId) ||
                  (operationId && s.outboxOperationId === operationId) ||
                  (matchedOp && s.outboxOperationId === matchedOp.operationId) ||
                  (matchedOp && matchedOp.saleId && s.id === matchedOp.saleId)
                );
              }
              finishResolution();
            };
          };
        }

        function finishResolution() {
          resolve({
            operation: matchedOp,
            sale: matchedSale,
            matchedBy
          });
        }

        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error en resolveOfflineOperation:', err);
      return { matchedBy: 'NONE' };
    }
  }

  /**
   * Cancels an offline sale and restores deducted stock to local products
   */
  public async cancelOfflineSaleAndRevertStock(
    businessId: string,
    saleId: string,
    operationId: string,
    reason: string = 'Anulada por administrador / conflicto de stock'
  ): Promise<{ success: boolean; reverted: boolean; items: string[]; message?: string }> {
    if (!this.isSupported() || !businessId) {
      return { success: false, reverted: false, items: [], message: 'IndexedDB no soportada o businessId faltante' };
    }

    console.log(`[OFFLINE CANCEL] click saleId: ${saleId || 'N/A'} operationId: ${operationId || 'N/A'} businessId: ${businessId}`);

    const resolution = await this.resolveOfflineOperation({ businessId, operationId, saleId });
    const targetOp = resolution.operation;
    const linkedSale = resolution.sale;

    console.log(`[OFFLINE CANCEL] operation found: ${Boolean(targetOp)} (matchedBy: ${resolution.matchedBy})`);
    console.log(`[OFFLINE CANCEL] current status: ${targetOp?.status || linkedSale?.syncStatus || 'NOT_FOUND'}`);

    if (!targetOp && !linkedSale) {
      console.error('[OFFLINE CANCEL] No se encontró ninguna operación ni venta offline para cancelar.');
      return { success: false, reverted: false, items: [], message: 'Operación no encontrada en almacenamiento local' };
    }

    const isAlreadyCancelled = 
      targetOp?.status === 'CANCELLED' && 
      (!linkedSale || linkedSale.status === 'CANCELLED' || linkedSale.syncStatus === 'CANCELLED');

    if (isAlreadyCancelled) {
      console.log('[OFFLINE CANCEL] La operación ya se encontraba anulada. Omitiendo reposición de stock.');
      console.log('[OFFLINE CANCEL] stock reverted: false (already cancelled)');
      console.log('[OFFLINE CANCEL] action result: SUCCESS (idempotent)');
      return { success: true, reverted: false, items: [], message: 'La operación ya estaba anulada' };
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_sales', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const salesStore = tx.objectStore('offline_sales');
      const outboxStore = tx.objectStore('outbox');

      const revertedItemsList: string[] = [];

      tx.onerror = () => {
        console.error('[OFFLINE CANCEL] Error en transacción IndexedDB:', tx.error);
        reject(tx.error);
      };

      // 1. Revert product stock locally if not previously cancelled
      const pIndex = productStore.index('by_businessId');
      const pReq = pIndex.getAll(IDBKeyRange.only(businessId));

      pReq.onsuccess = () => {
        const prods = (pReq.result || []) as Product[];
        const pMap = new Map<string, Product>();
        prods.forEach(p => pMap.set(p.id, { ...p }));

        const now = new Date().toISOString();

        // Safely extract items from saleSnapshot, payload, or linkedSale
        const rawItems: any[] = 
          (targetOp?.saleSnapshot && Array.isArray(targetOp.saleSnapshot.items) && targetOp.saleSnapshot.items.length > 0)
            ? targetOp.saleSnapshot.items
            : (targetOp?.payload && Array.isArray(targetOp.payload.items) && targetOp.payload.items.length > 0)
            ? targetOp.payload.items
            : (linkedSale && Array.isArray(linkedSale.items) && linkedSale.items.length > 0)
            ? linkedSale.items
            : [];

        // Restore stock based on items
        for (const item of rawItems) {
          if (!item) continue;
          const productId = item.productId || item.product?.id || item.id;
          const qty = Math.max(1, Number(item.quantity) || 1);
          const pName = item.productName || item.product?.name || item.name || 'Producto';
          if (!productId) continue;

          const prod = pMap.get(productId);
          if (prod) {
            if (prod.isCombo && prod.comboItems && prod.comboItems.length > 0) {
              for (const cItem of prod.comboItems) {
                const cTracksStock = cItem.tracksStock !== undefined 
                  ? Boolean(cItem.tracksStock) 
                  : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

                if (cTracksStock) {
                  const compId = cItem.productId || (cItem as any).id;
                  const comp = compId ? pMap.get(compId) : undefined;
                  if (comp && comp.tracksStock !== false) {
                    const cQty = Math.max(1, Number(cItem.quantity) || 1);
                    comp.stock = (Number(comp.stock) || 0) + (cQty * qty);
                    comp.updatedAt = now;
                    productStore.put(comp);
                    revertedItemsList.push(`${cQty * qty}x ${comp.name} (Combo: ${prod.name})`);
                  }
                }
              }
            } else if (prod.tracksStock !== false) {
              prod.stock = (Number(prod.stock) || 0) + qty;
              prod.updatedAt = now;
              productStore.put(prod);
              revertedItemsList.push(`${qty}x ${prod.name}`);
            }
          }
        }

        // 2. Mark operation as CANCELLED in outboxStore
        if (targetOp) {
          targetOp.status = 'CANCELLED';
          targetOp.lastError = `Venta anulada: ${reason}`;
          if (targetOp.saleSnapshot) {
            targetOp.saleSnapshot.status = 'CANCELLED';
            targetOp.saleSnapshot.syncStatus = 'CANCELLED';
            targetOp.saleSnapshot.syncError = `Venta anulada: ${reason}`;
          }
          outboxStore.put(targetOp);
        }

        // 3. Mark sale as CANCELLED in salesStore
        if (linkedSale) {
          linkedSale.status = 'CANCELLED';
          linkedSale.syncStatus = 'CANCELLED';
          linkedSale.syncError = `Venta anulada: ${reason}`;
          salesStore.put(linkedSale);
        } else {
          // If no linkedSale was directly loaded, query by keys and mark
          const sKey = saleId || targetOp?.saleId || operationId;
          if (sKey) {
            const sReq = salesStore.get(sKey);
            sReq.onsuccess = () => {
              const s = sReq.result as Sale | undefined;
              if (s && s.businessId === businessId) {
                s.status = 'CANCELLED';
                s.syncStatus = 'CANCELLED';
                s.syncError = `Venta anulada: ${reason}`;
                salesStore.put(s);
              }
            };
          }
        }
      };

      tx.oncomplete = () => {
        console.log(`[OFFLINE CANCEL] stock reverted: true (items: ${revertedItemsList.join(', ') || 'N/A'})`);
        console.log(`[OFFLINE CANCEL] action result: SUCCESS`);
        resolve({
          success: true,
          reverted: true,
          items: revertedItemsList,
          message: 'Venta anulada y stock repuesto correctamente'
        });
      };
    });
  }

  /**
   * Save or update an outbox operation
   */
  public async saveOutboxOperation(operation: OutboxOperation): Promise<void> {
    if (!this.isSupported() || !operation.operationId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('outbox', 'readwrite');
        const store = tx.objectStore('outbox');
        store.put(operation);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando operación outbox:', err);
    }
  }

  /**
   * Get all outbox operations for a specific business
   */
  public async getOutboxOperations(businessId: string): Promise<OutboxOperation[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<OutboxOperation[]>((resolve, reject) => {
        const tx = db.transaction('outbox', 'readonly');
        const store = tx.objectStore('outbox');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          const list = (request.result || []) as OutboxOperation[];
          // Sort ascending by createdAt (FIFO)
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo operaciones outbox:', err);
      return [];
    }
  }

  /**
   * Get pending or error operations ready for sync
   */
  public async getPendingOutboxOperations(businessId: string): Promise<OutboxOperation[]> {
    const all = await this.getOutboxOperations(businessId);
    return all.filter((op) => op.status === 'PENDING' || op.status === 'ERROR');
  }

  /**
   * Update the status and error details of an outbox operation and update the linked entity
   */
  public async updateOutboxOperationStatus(
    businessId: string,
    operationId: string,
    status: OutboxStatus,
    lastError: string | null = null,
    syncedAt: string | null = null,
    saleId?: string
  ): Promise<void> {
    if (!this.isSupported() || !businessId || (!operationId && !saleId)) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ['outbox', 'offline_sales', 'offline_expenses', 'offline_stock_adjustments', 'offline_receivings'],
          'readwrite'
        );
        const outboxStore = tx.objectStore('outbox');
        const salesStore = tx.objectStore('offline_sales');
        const expenseStore = tx.objectStore('offline_expenses');
        const adjStore = tx.objectStore('offline_stock_adjustments');
        const rcvStore = tx.objectStore('offline_receivings');

        const applyUpdates = (op: OutboxOperation) => {
          op.status = status;
          op.lastAttemptAt = new Date().toISOString();
          if (lastError !== null) op.lastError = lastError;
          if (syncedAt !== null) op.syncedAt = syncedAt;
          if (status === 'SYNCED') {
            op.lastError = null;
          }
          outboxStore.put(op);

          // Update corresponding sale record
          const sKey = op.saleId || op.payload?.saleId || saleId || op.operationId;
          if (sKey) {
            const saleReq = salesStore.get(sKey);
            saleReq.onsuccess = () => {
              const s = saleReq.result as Sale | undefined;
              if (s && s.businessId === businessId) {
                s.syncStatus = status;
                if (syncedAt) s.syncedAt = syncedAt;
                if (lastError !== null) s.syncError = lastError;
                salesStore.put(s);
              }
            };
          }

          // Update corresponding expense record
          if (op.expenseId) {
            const expReq = expenseStore.get(op.expenseId);
            expReq.onsuccess = () => {
              const e = expReq.result as Expense | undefined;
              if (e && e.businessId === businessId) {
                e.syncStatus = status;
                if (syncedAt) e.syncedAt = syncedAt;
                if (lastError !== null) e.syncError = lastError;
                expenseStore.put(e);
              }
            };
          }

          // Update corresponding stock adjustment record
          if (op.adjustmentId) {
            const adjReq = adjStore.get(op.adjustmentId);
            adjReq.onsuccess = () => {
              const a = adjReq.result as StockAdjustment | undefined;
              if (a && a.businessId === businessId) {
                a.syncStatus = status;
                if (syncedAt) a.syncedAt = syncedAt;
                if (lastError !== null) a.syncError = lastError;
                adjStore.put(a);
              }
            };
          }

          // Update corresponding receiving record
          if (op.receivingId) {
            const rcvReq = rcvStore.get(op.receivingId);
            rcvReq.onsuccess = () => {
              const r = rcvReq.result as Receiving | undefined;
              if (r && r.businessId === businessId) {
                r.syncStatus = status;
                if (syncedAt) r.syncedAt = syncedAt;
                if (lastError !== null) r.syncError = lastError;
                rcvStore.put(r);
              }
            };
          }
        };

        const opReq = operationId ? outboxStore.get(operationId) : null;

        if (opReq) {
          opReq.onsuccess = () => {
            const op = opReq.result as OutboxOperation | undefined;
            if (op && op.businessId === businessId) {
              applyUpdates(op);
            } else {
              fallbackScan();
            }
          };
          opReq.onerror = () => fallbackScan();
        } else {
          fallbackScan();
        }

        function fallbackScan() {
          const outboxIndex = outboxStore.index('by_businessId');
          const scanReq = outboxIndex.getAll(IDBKeyRange.only(businessId));
          scanReq.onsuccess = () => {
            const ops = (scanReq.result || []) as OutboxOperation[];
            const found = ops.find(o => 
              (operationId && o.operationId === operationId) ||
              (saleId && o.saleId === saleId) ||
              (saleId && o.payload?.saleId === saleId) ||
              (saleId && o.operationId === saleId) ||
              (operationId && o.saleId === operationId)
            );
            if (found) {
              applyUpdates(found);
            } else if (saleId || operationId) {
              const sKey = saleId || operationId;
              const saleReq = salesStore.get(sKey);
              saleReq.onsuccess = () => {
                const s = saleReq.result as Sale | undefined;
                if (s && s.businessId === businessId) {
                  s.syncStatus = status;
                  if (syncedAt) s.syncedAt = syncedAt;
                  if (lastError !== null) s.syncError = lastError;
                  salesStore.put(s);
                }
              };
            }
          };
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error actualizando estado de outbox:', err);
    }
  }

  // ==========================================
  // 4. OFFLINE SALES HISTORY MANAGEMENT
  // ==========================================

  /**
   * Save a sale snapshot locally
   */
  public async saveOfflineSale(sale: Sale): Promise<void> {
    if (!this.isSupported() || !sale.id || !sale.businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('offline_sales', 'readwrite');
        const store = tx.objectStore('offline_sales');
        store.put(sale);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando venta local:', err);
    }
  }

  /**
   * Get all offline sales for a business within an optional date range
   */
  public async getOfflineSalesByBusiness(
    businessId: string,
    startDateIso?: string,
    endDateIso?: string
  ): Promise<Sale[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<Sale[]>((resolve, reject) => {
        const tx = db.transaction('offline_sales', 'readonly');
        const store = tx.objectStore('offline_sales');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          let list = (request.result || []) as Sale[];

          if (startDateIso) {
            const startTime = new Date(startDateIso).getTime();
            list = list.filter((s) => s.createdAt && new Date(s.createdAt).getTime() >= startTime);
          }

          if (endDateIso) {
            const endTime = new Date(endDateIso).getTime();
            list = list.filter((s) => s.createdAt && new Date(s.createdAt).getTime() <= endTime);
          }

          // Sort descending by createdAt
          list.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });

          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo ventas locales:', err);
      return [];
    }
  }

  // ==========================================
  // 5. OFFLINE EXPENSES MANAGEMENT (FASE 5)
  // ==========================================

  /**
   * Creates an offline expense and stores the outbox operation atomically
   */
  public async createOfflineExpenseTransaction(
    businessId: string,
    expense: Expense,
    operation: OutboxOperation
  ): Promise<Expense> {
    if (!this.isSupported() || !businessId) return expense;

    const db = await this.getDB();
    return new Promise<Expense>((resolve, reject) => {
      const tx = db.transaction(['offline_expenses', 'outbox'], 'readwrite');
      const expenseStore = tx.objectStore('offline_expenses');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve(expense);

      expenseStore.put(expense);
      outboxStore.put(operation);
    });
  }

  /**
   * Save an expense snapshot locally
   */
  public async saveOfflineExpense(expense: Expense): Promise<void> {
    if (!this.isSupported() || !expense.id || !expense.businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('offline_expenses', 'readwrite');
        const store = tx.objectStore('offline_expenses');
        store.put(expense);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando gasto local:', err);
    }
  }

  /**
   * Get all offline expenses for a business within an optional date range
   */
  public async getOfflineExpensesByBusiness(
    businessId: string,
    startDateIso?: string,
    endDateIso?: string
  ): Promise<Expense[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<Expense[]>((resolve, reject) => {
        const tx = db.transaction('offline_expenses', 'readonly');
        const store = tx.objectStore('offline_expenses');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          let list = (request.result || []) as Expense[];

          if (startDateIso) {
            const startTime = new Date(startDateIso).getTime();
            list = list.filter((e) => e.createdAt && new Date(e.createdAt).getTime() >= startTime);
          }

          if (endDateIso) {
            const endTime = new Date(endDateIso).getTime();
            list = list.filter((e) => e.createdAt && new Date(e.createdAt).getTime() <= endTime);
          }

          // Sort descending by createdAt
          list.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });

          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo gastos locales:', err);
      return [];
    }
  }

  /**
   * Delete an offline expense locally
   */
  public async deleteOfflineExpense(businessId: string, expenseId: string): Promise<void> {
    if (!this.isSupported() || !businessId || !expenseId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['offline_expenses', 'outbox'], 'readwrite');
        const expenseStore = tx.objectStore('offline_expenses');
        const outboxStore = tx.objectStore('outbox');

        expenseStore.delete(expenseId);

        // Also clean associated pending outbox op if any
        const index = outboxStore.index('by_businessId');
        const req = index.getAll(IDBKeyRange.only(businessId));
        req.onsuccess = () => {
          const ops = (req.result || []) as OutboxOperation[];
          for (const op of ops) {
            if (op.expenseId === expenseId) {
              outboxStore.delete(op.operationId);
            }
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error eliminando gasto local:', err);
    }
  }

  // ==========================================
  // 6. OFFLINE STOCK ADJUSTMENTS MANAGEMENT (FASE 5)
  // ==========================================

  /**
   * Creates an offline confirmed stock adjustment, immediately updates local product stock,
   * and registers the outbox operation atomically.
   */
  public async createOfflineStockAdjustmentTransaction(
    businessId: string,
    adjustment: StockAdjustment,
    operation: OutboxOperation
  ): Promise<StockAdjustment> {
    if (!this.isSupported() || !businessId) return adjustment;

    const db = await this.getDB();
    return new Promise<StockAdjustment>((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_stock_adjustments', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const adjStore = tx.objectStore('offline_stock_adjustments');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve(adjustment);

      const pIndex = productStore.index('by_businessId');
      const pReq = pIndex.getAll(IDBKeyRange.only(businessId));

      pReq.onsuccess = () => {
        const prods = (pReq.result || []) as Product[];
        const pMap = new Map<string, Product>();
        prods.forEach(p => pMap.set(p.id, { ...p }));

        const now = new Date().toISOString();

        // 1. Verify and update local stocks (+ for IN, - for OUT)
        for (const item of adjustment.items) {
          const prod = pMap.get(item.productId);
          if (!prod) {
            throw new Error(`El producto "${item.productName}" no existe en el catálogo local.`);
          }

          if (prod.tracksStock !== false) {
            const currentStock = Number(prod.stock) || 0;
            const qty = Math.floor(Number(item.quantity)) || 0;

            if (item.adjustmentType === 'OUT' && currentStock < qty) {
              throw new Error(`Stock insuficiente para "${item.productName}". Disponible: ${currentStock}, solicitado: ${qty}`);
            }

            const newStock = item.adjustmentType === 'IN' ? (currentStock + qty) : (currentStock - qty);
            prod.stock = newStock;
            prod.updatedAt = now;
            productStore.put(prod);

            item.previousStock = currentStock;
            item.newStock = newStock;
          }
        }

        // 2. Put adjustment snapshot
        adjStore.put(adjustment);

        // 3. Put outbox operation
        outboxStore.put(operation);
      };
    });
  }

  /**
   * Save a stock adjustment snapshot locally
   */
  public async saveOfflineStockAdjustment(adjustment: StockAdjustment): Promise<void> {
    if (!this.isSupported() || !adjustment.id || !adjustment.businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('offline_stock_adjustments', 'readwrite');
        const store = tx.objectStore('offline_stock_adjustments');
        store.put(adjustment);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando ajuste de stock local:', err);
    }
  }

  /**
   * Get all offline stock adjustments for a business
   */
  public async getOfflineStockAdjustmentsByBusiness(businessId: string): Promise<StockAdjustment[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<StockAdjustment[]>((resolve, reject) => {
        const tx = db.transaction('offline_stock_adjustments', 'readonly');
        const store = tx.objectStore('offline_stock_adjustments');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          const list = (request.result || []) as StockAdjustment[];
          // Sort descending by createdAt
          list.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });
          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo ajustes de stock locales:', err);
      return [];
    }
  }

  /**
   * Cancels an offline stock adjustment and reverts local stock changes
   */
  public async cancelOfflineStockAdjustmentAndRevertStock(
    businessId: string,
    adjustmentId: string,
    operationId: string,
    reason: string = 'Anulado por administrador'
  ): Promise<void> {
    if (!this.isSupported() || !businessId) return;

    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_stock_adjustments', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const adjStore = tx.objectStore('offline_stock_adjustments');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      const adjReq = adjStore.get(adjustmentId);
      adjReq.onsuccess = () => {
        const adj = adjReq.result as StockAdjustment | undefined;
        if (!adj || adj.businessId !== businessId) return;

        const pIndex = productStore.index('by_businessId');
        const pReq = pIndex.getAll(IDBKeyRange.only(businessId));

        pReq.onsuccess = () => {
          const prods = (pReq.result || []) as Product[];
          const pMap = new Map<string, Product>();
          prods.forEach(p => pMap.set(p.id, { ...p }));

          const now = new Date().toISOString();

          // Revert stock changes (if it was IN -> deduct, if it was OUT -> add back)
          for (const item of adj.items) {
            const prod = pMap.get(item.productId);
            if (prod && prod.tracksStock !== false) {
              const currentStock = Number(prod.stock) || 0;
              const qty = Math.floor(Number(item.quantity)) || 0;
              const revertedStock = item.adjustmentType === 'IN' ? (currentStock - qty) : (currentStock + qty);
              prod.stock = Math.max(0, revertedStock);
              prod.updatedAt = now;
              productStore.put(prod);
            }
          }

          // Mark adjustment as CANCELLED
          adj.status = 'CANCELLED';
          adj.syncStatus = 'CANCELLED';
          adj.syncError = `Ajuste cancelado: ${reason}`;
          adjStore.put(adj);

          // Mark outbox operation as CANCELLED
          const opReq = outboxStore.get(operationId);
          opReq.onsuccess = () => {
            const op = opReq.result as OutboxOperation | undefined;
            if (op && op.businessId === businessId) {
              op.status = 'CANCELLED';
              op.lastError = `Ajuste de stock cancelado localmente: ${reason}`;
              if (op.adjustmentSnapshot) {
                op.adjustmentSnapshot.status = 'CANCELLED';
                op.adjustmentSnapshot.syncStatus = 'CANCELLED';
              }
              outboxStore.put(op);
            }
          };
        };
      };
    });
  }

  // ==========================================
  // 7. OFFLINE RECEIVINGS MANAGEMENT (FASE 5)
  // ==========================================

  /**
   * Confirms a receiving offline, increments local product stocks,
   * and registers the outbox operation atomically.
   */
  public async createOfflineReceivingTransaction(
    businessId: string,
    receiving: Receiving,
    operation: OutboxOperation
  ): Promise<Receiving> {
    if (!this.isSupported() || !businessId) return receiving;

    const db = await this.getDB();
    return new Promise<Receiving>((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_receivings', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const rcvStore = tx.objectStore('offline_receivings');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve(receiving);

      const pIndex = productStore.index('by_businessId');
      const pReq = pIndex.getAll(IDBKeyRange.only(businessId));

      pReq.onsuccess = () => {
        const prods = (pReq.result || []) as Product[];
        const pMap = new Map<string, Product>();
        prods.forEach(p => pMap.set(p.id, { ...p }));

        const now = new Date().toISOString();

        // 1. Verify and increment local stock for each confirmed item
        for (const item of receiving.items) {
          const prod = pMap.get(item.productId);
          if (!prod) {
            throw new Error(`El producto recibido "${item.productName}" no existe en el catálogo local.`);
          }

          if (prod.tracksStock !== false) {
            const currentStock = Number(prod.stock) || 0;
            const qty = Math.floor(Number(item.quantity)) || 0;
            const newStock = currentStock + qty;

            prod.stock = newStock;
            prod.updatedAt = now;
            productStore.put(prod);

            item.currentStockAtScan = currentStock;
          }
        }

        // 2. Put receiving snapshot
        rcvStore.put(receiving);

        // 3. Put outbox operation
        outboxStore.put(operation);
      };
    });
  }

  /**
   * Save a receiving snapshot locally
   */
  public async saveOfflineReceiving(receiving: Receiving): Promise<void> {
    if (!this.isSupported() || !receiving.id || !receiving.businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('offline_receivings', 'readwrite');
        const store = tx.objectStore('offline_receivings');
        store.put(receiving);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando recepción local:', err);
    }
  }

  /**
   * Get all offline receivings for a business
   */
  public async getOfflineReceivingsByBusiness(businessId: string): Promise<Receiving[]> {
    if (!this.isSupported() || !businessId) return [];

    try {
      const db = await this.getDB();
      return new Promise<Receiving[]>((resolve, reject) => {
        const tx = db.transaction('offline_receivings', 'readonly');
        const store = tx.objectStore('offline_receivings');
        const index = store.index('by_businessId');
        const request = index.getAll(IDBKeyRange.only(businessId));

        request.onsuccess = () => {
          const list = (request.result || []) as Receiving[];
          // Sort descending by createdAt
          list.sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tB - tA;
          });
          resolve(list);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo recepciones locales:', err);
      return [];
    }
  }

  /**
   * Cancels an offline receiving and reverts incremented stock
   */
  public async cancelOfflineReceivingAndRevertStock(
    businessId: string,
    receivingId: string,
    operationId: string,
    reason: string = 'Anulada por administrador'
  ): Promise<void> {
    if (!this.isSupported() || !businessId) return;

    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['products', 'offline_receivings', 'outbox'], 'readwrite');
      const productStore = tx.objectStore('products');
      const rcvStore = tx.objectStore('offline_receivings');
      const outboxStore = tx.objectStore('outbox');

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      const rcvReq = rcvStore.get(receivingId);
      rcvReq.onsuccess = () => {
        const rcv = rcvReq.result as Receiving | undefined;
        if (!rcv || rcv.businessId !== businessId) return;

        const pIndex = productStore.index('by_businessId');
        const pReq = pIndex.getAll(IDBKeyRange.only(businessId));

        pReq.onsuccess = () => {
          const prods = (pReq.result || []) as Product[];
          const pMap = new Map<string, Product>();
          prods.forEach(p => pMap.set(p.id, { ...p }));

          const now = new Date().toISOString();

          // Deduct the quantities that were added during receiving
          for (const item of rcv.items) {
            const prod = pMap.get(item.productId);
            if (prod && prod.tracksStock !== false) {
              const currentStock = Number(prod.stock) || 0;
              const qty = Math.floor(Number(item.quantity)) || 0;
              prod.stock = Math.max(0, currentStock - qty);
              prod.updatedAt = now;
              productStore.put(prod);
            }
          }

          // Mark receiving as CANCELLED
          rcv.status = 'CANCELLED';
          rcv.syncStatus = 'CANCELLED';
          rcv.syncError = `Recepción cancelada: ${reason}`;
          rcvStore.put(rcv);

          // Mark outbox operation as CANCELLED
          const opReq = outboxStore.get(operationId);
          opReq.onsuccess = () => {
            const op = opReq.result as OutboxOperation | undefined;
            if (op && op.businessId === businessId) {
              op.status = 'CANCELLED';
              op.lastError = `Recepción cancelada localmente: ${reason}`;
              if (op.receivingSnapshot) {
                op.receivingSnapshot.status = 'CANCELLED';
                op.receivingSnapshot.syncStatus = 'CANCELLED';
              }
              outboxStore.put(op);
            }
          };
        };
      };
    });
  }

  // ==========================================
  // 5. METADATA & CLEANUP
  // ==========================================

  /**
   * Save / update metadata for a business
   */
  public async saveBusinessMetadata(meta: BusinessMetadata): Promise<void> {
    if (!this.isSupported() || !meta.businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('business_meta', 'readwrite');
        const store = tx.objectStore('business_meta');
        store.put(meta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error guardando metadatos:', err);
    }
  }

  /**
   * Get metadata for a business
   */
  public async getBusinessMetadata(businessId: string): Promise<BusinessMetadata | null> {
    if (!this.isSupported() || !businessId) return null;

    try {
      const db = await this.getDB();
      return new Promise<BusinessMetadata | null>((resolve, reject) => {
        const tx = db.transaction('business_meta', 'readonly');
        const store = tx.objectStore('business_meta');
        const request = store.get(businessId);

        request.onsuccess = () => {
          resolve((request.result as BusinessMetadata) || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error obteniendo metadatos:', err);
      return null;
    }
  }

  /**
   * Clear all local products and metadata for a specific business (Multi-tenant safe cleanup)
   * Note: Outbox operations and offline sales are intentionally PRESERVED unless explicitly cleaned!
   */
  public async clearBusinessCatalog(businessId: string): Promise<void> {
    if (!this.isSupported() || !businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['products', 'business_meta'], 'readwrite');
        const productStore = tx.objectStore('products');
        const metaStore = tx.objectStore('business_meta');

        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();

        const index = productStore.index('by_businessId');
        const getRequest = index.getAllKeys(IDBKeyRange.only(businessId));

        getRequest.onsuccess = () => {
          const keys = getRequest.result || [];
          for (const key of keys) {
            productStore.delete(key);
          }
        };

        metaStore.delete(businessId);
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error limpiando catálogo del negocio:', err);
    }
  }

  /**
   * Clear all local data for a business (including outbox, sales, expenses, adjustments, receivings)
   */
  public async clearBusinessData(businessId: string): Promise<void> {
    if (!this.isSupported() || !businessId) return;

    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ['products', 'business_meta', 'outbox', 'offline_sales', 'offline_expenses', 'offline_stock_adjustments', 'offline_receivings'],
          'readwrite'
        );
        const productStore = tx.objectStore('products');
        const metaStore = tx.objectStore('business_meta');
        const outboxStore = tx.objectStore('outbox');
        const salesStore = tx.objectStore('offline_sales');
        const expenseStore = tx.objectStore('offline_expenses');
        const adjStore = tx.objectStore('offline_stock_adjustments');
        const rcvStore = tx.objectStore('offline_receivings');

        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();

        // 1. Products
        const pIndex = productStore.index('by_businessId');
        const pReq = pIndex.getAllKeys(IDBKeyRange.only(businessId));
        pReq.onsuccess = () => {
          (pReq.result || []).forEach((k) => productStore.delete(k));
        };

        // 2. Metadata
        metaStore.delete(businessId);

        // 3. Outbox
        const oIndex = outboxStore.index('by_businessId');
        const oReq = oIndex.getAllKeys(IDBKeyRange.only(businessId));
        oReq.onsuccess = () => {
          (oReq.result || []).forEach((k) => outboxStore.delete(k));
        };

        // 4. Offline Sales
        const sIndex = salesStore.index('by_businessId');
        const sReq = sIndex.getAllKeys(IDBKeyRange.only(businessId));
        sReq.onsuccess = () => {
          (sReq.result || []).forEach((k) => salesStore.delete(k));
        };

        // 5. Offline Expenses
        const eIndex = expenseStore.index('by_businessId');
        const eReq = eIndex.getAllKeys(IDBKeyRange.only(businessId));
        eReq.onsuccess = () => {
          (eReq.result || []).forEach((k) => expenseStore.delete(k));
        };

        // 6. Offline Stock Adjustments
        const aIndex = adjStore.index('by_businessId');
        const aReq = aIndex.getAllKeys(IDBKeyRange.only(businessId));
        aReq.onsuccess = () => {
          (aReq.result || []).forEach((k) => adjStore.delete(k));
        };

        // 7. Offline Receivings
        const rIndex = rcvStore.index('by_businessId');
        const rReq = rIndex.getAllKeys(IDBKeyRange.only(businessId));
        rReq.onsuccess = () => {
          (rReq.result || []).forEach((k) => rcvStore.delete(k));
        };
      });
    } catch (err) {
      console.warn('[LocalDataStore] Error limpiando todos los datos del negocio:', err);
    }
  }

  /**
   * Retrieve diagnostic statistics for development verification
   */
  public async getDatabaseDiagnostics(businessId?: string | null): Promise<OfflineDiagnosticsData> {
    const isSupported = this.isSupported();
    if (!isSupported || !businessId) {
      return {
        isSupported,
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        businessId: businessId || null,
        businessName: null,
        lastSyncedAt: null,
        catalogVersion: null,
        productCount: 0,
        tracksStockCount: 0,
        nonTracksStockCount: 0,
        combosCount: 0,
        barcodesCount: 0,
        pendingOutboxCount: 0,
        syncingOutboxCount: 0,
        syncedOutboxCount: 0,
        errorOutboxCount: 0,
        stockConflictCount: 0,
        sampleProducts: [],
        sampleOutbox: []
      };
    }

    try {
      const [products, meta, outboxOps] = await Promise.all([
        this.getProductsByBusiness(businessId),
        this.getBusinessMetadata(businessId),
        this.getOutboxOperations(businessId)
      ]);

      let tracksStockCount = 0;
      let nonTracksStockCount = 0;
      let combosCount = 0;
      let barcodesCount = 0;

      for (const p of products) {
        if (p.isCombo) {
          combosCount++;
        } else if (p.tracksStock !== false) {
          tracksStockCount++;
        } else {
          nonTracksStockCount++;
        }

        if (p.barcode && p.barcode.trim().length > 0) {
          barcodesCount++;
        }
      }

      let pendingOutboxCount = 0;
      let syncingOutboxCount = 0;
      let syncedOutboxCount = 0;
      let errorOutboxCount = 0;
      let stockConflictCount = 0;

      for (const op of outboxOps) {
        if (op.status === 'PENDING') pendingOutboxCount++;
        else if (op.status === 'SYNCING') syncingOutboxCount++;
        else if (op.status === 'SYNCED') syncedOutboxCount++;
        else if (op.status === 'ERROR') errorOutboxCount++;
        else if (op.status === 'STOCK_CONFLICT') stockConflictCount++;
      }

      const sampleProducts = products.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        salePrice: p.salePrice,
        stock: p.stock,
        tracksStock: Boolean(p.tracksStock),
        isCombo: Boolean(p.isCombo),
        comboItemsCount: Array.isArray(p.comboItems) ? p.comboItems.length : 0
      }));

      const sampleOutbox = outboxOps.slice(-5).reverse().map((op) => ({
        operationId: op.operationId,
        saleId: op.saleId || op.expenseId || op.adjustmentId || op.receivingId || op.operationId,
        status: op.status,
        total: op.saleSnapshot?.total || op.expenseSnapshot?.amount || 0,
        createdAt: op.createdAt,
        attempts: op.attempts,
        lastError: op.lastError
      }));

      return {
        isSupported: true,
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        businessId,
        businessName: meta?.businessName || null,
        lastSyncedAt: meta?.lastSyncedAt || null,
        catalogVersion: meta?.catalogVersion || null,
        productCount: products.length,
        tracksStockCount,
        nonTracksStockCount,
        combosCount,
        barcodesCount,
        pendingOutboxCount,
        syncingOutboxCount,
        syncedOutboxCount,
        errorOutboxCount,
        stockConflictCount,
        sampleProducts,
        sampleOutbox
      };
    } catch (err) {
      console.warn('[LocalDataStore] Error en diagnóstico:', err);
      return {
        isSupported: true,
        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        businessId,
        businessName: null,
        lastSyncedAt: null,
        catalogVersion: null,
        productCount: 0,
        tracksStockCount: 0,
        nonTracksStockCount: 0,
        combosCount: 0,
        barcodesCount: 0,
        pendingOutboxCount: 0,
        syncingOutboxCount: 0,
        syncedOutboxCount: 0,
        errorOutboxCount: 0,
        stockConflictCount: 0,
        sampleProducts: [],
        sampleOutbox: []
      };
    }
  }
}

export const localDataStore = new LocalDataStore();
