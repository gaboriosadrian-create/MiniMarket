import { localDataStore } from './localDataStore';
import { syncSaleOperationToFirestore, forceSyncSaleOperationWithStockAdjustment } from './saleService';
import { syncExpenseOperationToFirestore } from './expenseService';
import { syncStockAdjustmentOperationToFirestore } from './stockAdjustmentService';
import { syncReceivingOperationToFirestore } from './receivingService';
import { getProductsByBusiness } from './productService';
import { OutboxOperation, OutboxStatus } from '../types';
import { repairAndMigrateAllOfflineOperations, repairOfflineOperation } from './offlineRepairUtils';

export interface SyncStats {
  isSyncing: boolean;
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  errorCount: number;
  stockConflictCount: number;
  cancelledCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

type SyncListener = (stats: SyncStats) => void;

class SyncEngine {
  private isSyncing = false;
  private currentBusinessId: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private timer: any = null;
  private isInitialized = false;

  private stats: SyncStats = {
    isSyncing: false,
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    errorCount: 0,
    stockConflictCount: 0,
    cancelledCount: 0,
    lastSyncAt: null,
    lastError: null
  };

  /**
   * Dispatches the sync operation to the appropriate handler based on operationType
   */
  private async dispatchOperationSync(op: OutboxOperation): Promise<{
    success: boolean;
    status: 'SYNCED' | 'STOCK_CONFLICT' | 'ERROR';
    error?: string;
  }> {
    // Ensure operation is sanitized and repaired before dispatch
    const repairResult = repairOfflineOperation(op);
    const opToSync = repairResult.op;

    if (repairResult.isUnrepairable) {
      return {
        success: false,
        status: 'ERROR',
        error: repairResult.diagnosticError || 'Operación inválida no recuperable.'
      };
    }

    const opType = opToSync.operationType || 'SALE';
    switch (opType) {
      case 'SALE':
        return syncSaleOperationToFirestore(opToSync);
      case 'EXPENSE':
        return syncExpenseOperationToFirestore(opToSync);
      case 'STOCK_ADJUSTMENT':
        return syncStockAdjustmentOperationToFirestore(opToSync);
      case 'RECEIVING':
        return syncReceivingOperationToFirestore(opToSync);
      default:
        console.warn(`[SyncEngine] Tipo de operación desconocido: ${opType}`);
        return { success: false, status: 'ERROR', error: `Tipo de operación '${opType}' no soportado.` };
    }
  }

  /**
   * Initialize browser event listeners (reconnection, visibility change, periodic interval)
   */
  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Trigger sync on reconnection
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Conexión a Internet restablecida. Iniciando sincronización...');
      if (this.currentBusinessId) {
        this.recoverAndSync(this.currentBusinessId);
      }
    });

    // Trigger sync when tab gains visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.currentBusinessId && navigator.onLine) {
        this.recoverAndSync(this.currentBusinessId);
      }
    });

    // Periodic check every 30 seconds
    this.timer = setInterval(() => {
      if (this.currentBusinessId && navigator.onLine && !this.isSyncing) {
        this.refreshStats(this.currentBusinessId).then(() => {
          if (this.stats.pendingCount > 0) {
            this.syncBusiness(this.currentBusinessId!);
          }
        });
      }
    }, 30000);
  }

  /**
   * Recovers any stuck SYNCING operations, migrates legacy operations, and then triggers sync
   */
  public async recoverAndSync(businessId: string): Promise<void> {
    if (!businessId) return;
    try {
      await repairAndMigrateAllOfflineOperations(businessId);
      await localDataStore.recoverStuckSyncingOperations(businessId, 25000);
      await this.refreshStats(businessId);
      if (this.stats.pendingCount > 0 && navigator.onLine) {
        await this.syncBusiness(businessId);
      }
    } catch (err) {
      console.warn('[SyncEngine] Error durante recovery and sync:', err);
    }
  }

  /**
   * Set active business for syncing
   */
  public setActiveBusiness(businessId: string | null): void {
    this.currentBusinessId = businessId;
    if (businessId) {
      this.init();
      this.recoverAndSync(businessId);
    }
  }

  /**
   * Subscribe to sync stats updates
   */
  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Send current stats immediately
    listener(this.stats);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.stats });
      } catch (err) {
        console.error('[SyncEngine] Error in sync listener:', err);
      }
    });
  }

  /**
   * Refresh pending/error/synced counts from IndexedDB
   */
  public async refreshStats(businessId: string): Promise<SyncStats> {
    if (!businessId) return this.stats;

    try {
      const ops = await localDataStore.getOutboxOperations(businessId);

      let pending = 0;
      let syncing = 0;
      let synced = 0;
      let error = 0;
      let conflict = 0;
      let cancelled = 0;

      for (const op of ops) {
        const isCancelled = 
          op.status === 'CANCELLED' || 
          op.saleSnapshot?.status === 'CANCELLED' || 
          op.saleSnapshot?.syncStatus === 'CANCELLED' ||
          String(op.lastError || '').toLowerCase().includes('anulada') ||
          String(op.lastError || '').toLowerCase().includes('cancelada');

        if (isCancelled) {
          cancelled++;
        } else if (op.status === 'PENDING') {
          pending++;
        } else if (op.status === 'SYNCING') {
          syncing++;
        } else if (op.status === 'SYNCED') {
          synced++;
        } else if (op.status === 'ERROR') {
          error++;
        } else if (op.status === 'STOCK_CONFLICT') {
          conflict++;
        }
      }

      this.stats = {
        ...this.stats,
        pendingCount: pending,
        syncingCount: syncing,
        syncedCount: synced,
        errorCount: error,
        stockConflictCount: conflict,
        cancelledCount: cancelled
      };

      this.notifyListeners();
      return this.stats;
    } catch (err) {
      console.warn('[SyncEngine] Error recalculando estadísticas:', err);
      return this.stats;
    }
  }

  /**
   * Executes synchronization of all pending outbox operations for a business.
   * Ensures independent processing per operation so failures do not block the queue.
   */
  public async syncBusiness(businessId: string): Promise<{
    processed: number;
    synced: number;
    conflicts: number;
    errors: number;
  }> {
    if (!businessId) return { processed: 0, synced: 0, conflicts: 0, errors: 0 };
    if (this.isSyncing) {
      console.log('[SyncEngine] Sincronización ya en curso. Omitiendo.');
      return { processed: 0, synced: 0, conflicts: 0, errors: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncEngine] Sin conexión. No se puede sincronizar.');
      return { processed: 0, synced: 0, conflicts: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.stats.isSyncing = true;
    this.notifyListeners();

    let processed = 0;
    let synced = 0;
    let conflicts = 0;
    let errors = 0;

    try {
      // 0. Auto-repair legacy operations and recover stuck ones
      await repairAndMigrateAllOfflineOperations(businessId);
      await localDataStore.recoverStuckSyncingOperations(businessId, 25000);

      // Get all pending and error operations for this business
      const pendingOps = await localDataStore.getPendingOutboxOperations(businessId);

      if (pendingOps.length === 0) {
        await this.refreshStats(businessId);
        return { processed: 0, synced: 0, conflicts: 0, errors: 0 };
      }

      console.log(`[SyncEngine] Iniciando sincronización de ${pendingOps.length} operaciones pendientes...`);

      for (const op of pendingOps) {
        // Skip cancelled or already synced operations
        if (op.status === 'CANCELLED' || op.status === 'SYNCED') continue;

        processed++;

        try {
          // 1. Mark as SYNCING in IndexedDB
          await localDataStore.updateOutboxOperationStatus(
            businessId,
            op.operationId,
            'SYNCING',
            null,
            null
          );
          await this.refreshStats(businessId);

          // 2. Perform idempotent Firestore Sync
          const result = await this.dispatchOperationSync(op);

          if (result.success && result.status === 'SYNCED') {
            synced++;
            const now = new Date().toISOString();
            await localDataStore.updateOutboxOperationStatus(
              businessId,
              op.operationId,
              'SYNCED',
              null,
              now
            );
          } else if (result.status === 'STOCK_CONFLICT') {
            conflicts++;
            await localDataStore.updateOutboxOperationStatus(
              businessId,
              op.operationId,
              'STOCK_CONFLICT',
              result.error || 'Conflicto de stock en el servidor',
              null
            );
          } else {
            errors++;
            await localDataStore.updateOutboxOperationStatus(
              businessId,
              op.operationId,
              'ERROR',
              result.error || 'Error al sincronizar con el servidor',
              null
            );
          }
        } catch (opError: any) {
          console.error(`[SyncEngine] Error aislado procesando operación #${op.operationId}:`, opError);
          errors++;
          await localDataStore.updateOutboxOperationStatus(
            businessId,
            op.operationId,
            'ERROR',
            opError?.message || 'Error inesperado durante sincronización de la operación',
            null
          );
        }
      }

      // 3. Post-sync: Re-align local catalog products with Firestore to ensure fresh stock levels
      try {
        await getProductsByBusiness(businessId);
      } catch (catErr) {
        console.warn('[SyncEngine] No se pudo refrescar catálogo post-sync:', catErr);
      }

      this.stats.lastSyncAt = new Date().toISOString();
      this.stats.lastError = null;

    } catch (err: any) {
      console.error('[SyncEngine] Error crítico durante sincronización:', err);
      this.stats.lastError = err?.message || 'Error durante la sincronización';
    } finally {
      this.isSyncing = false;
      this.stats.isSyncing = false;
      await this.refreshStats(businessId);
      this.notifyListeners();
    }

    return { processed, synced, conflicts, errors };
  }

  /**
   * Manually retry a specific single operation (e.g. from the Conflict resolution UI)
   */
  public async retrySingleOperation(
    businessId: string,
    operationId: string,
    saleId?: string
  ): Promise<{ success: boolean; status: OutboxStatus; error?: string }> {
    if (!businessId || (!operationId && !saleId)) {
      return { success: false, status: 'ERROR', error: 'Parámetros inválidos' };
    }

    console.log(`[OFFLINE RETRY] click saleId: ${saleId || 'N/A'} operationId: ${operationId || 'N/A'} businessId: ${businessId}`);

    try {
      const resolution = await localDataStore.resolveOfflineOperation({ businessId, operationId, saleId });
      let targetOp = resolution.operation;

      console.log(`[OFFLINE RETRY] operation found: ${Boolean(targetOp)} (matchedBy: ${resolution.matchedBy})`);
      console.log(`[OFFLINE RETRY] current status: ${targetOp?.status || resolution.sale?.syncStatus || 'NOT_FOUND'}`);

      if (!targetOp) {
        // If operation not in outbox but sale exists in offline_sales, reconstruct outbox operation
        if (resolution.sale) {
          const s = resolution.sale;
          targetOp = {
            operationId: s.outboxOperationId || operationId || `op_${s.id}`,
            businessId: s.businessId,
            userId: s.sellerId || 'offline_user',
            userName: s.sellerName || 'Vendedor',
            operationType: 'SALE',
            saleId: s.id,
            saleSnapshot: s,
            payload: s,
            createdAt: s.createdAt,
            status: 'PENDING',
            attempts: 0,
            lastAttemptAt: null,
            lastError: null,
            syncedAt: null,
            version: 1,
            deviceId: s.deviceId || 'offline_device'
          };
          await localDataStore.saveOutboxOperation(targetOp);
        } else {
          console.error('[OFFLINE RETRY] No se encontró la operación en almacenamiento local.');
          console.log('[OFFLINE RETRY] action result: ERROR - Operación no encontrada');
          return { success: false, status: 'ERROR', error: 'Operación no encontrada en almacenamiento local' };
        }
      }

      // Ensure target operation is repaired
      const repairResult = repairOfflineOperation(targetOp);
      const effectiveOp = repairResult.op;
      if (repairResult.wasRepaired) {
        await localDataStore.saveOutboxOperation(effectiveOp);
      }

      const cleanOpId = effectiveOp.operationId;
      const cleanSaleId = effectiveOp.saleId || saleId;

      await localDataStore.updateOutboxOperationStatus(businessId, cleanOpId, 'SYNCING', null, null, cleanSaleId);
      await this.refreshStats(businessId);
      this.notifyListeners();

      const result = await this.dispatchOperationSync(effectiveOp);

      if (result.success && result.status === 'SYNCED') {
        const now = new Date().toISOString();
        await localDataStore.updateOutboxOperationStatus(businessId, cleanOpId, 'SYNCED', null, now, cleanSaleId);
        try {
          await getProductsByBusiness(businessId);
        } catch (e) {}
        console.log('[OFFLINE RETRY] action result: SYNCED');
        await this.refreshStats(businessId);
        this.notifyListeners();
        return { success: true, status: 'SYNCED' };
      } else if (result.status === 'STOCK_CONFLICT') {
        const errMsg = result.error || 'Conflicto de stock en el servidor';
        await localDataStore.updateOutboxOperationStatus(
          businessId,
          cleanOpId,
          'STOCK_CONFLICT',
          errMsg,
          null,
          cleanSaleId
        );
        console.log(`[OFFLINE RETRY] action result: STOCK_CONFLICT - ${errMsg}`);
        await this.refreshStats(businessId);
        this.notifyListeners();
        return { success: false, status: 'STOCK_CONFLICT', error: errMsg };
      } else {
        const errMsg = result.error || 'Error de sincronización';
        await localDataStore.updateOutboxOperationStatus(
          businessId,
          cleanOpId,
          'ERROR',
          errMsg,
          null,
          cleanSaleId
        );
        console.log(`[OFFLINE RETRY] action result: ERROR - ${errMsg}`);
        await this.refreshStats(businessId);
        this.notifyListeners();
        return { success: false, status: 'ERROR', error: errMsg };
      }
    } catch (err: any) {
      console.error('[OFFLINE RETRY] Error durante reintento:', err);
      const errMsg = err?.message || 'Error inesperado al reintentar operación';
      await localDataStore.updateOutboxOperationStatus(
        businessId,
        operationId,
        'ERROR',
        errMsg,
        null,
        saleId
      );
      console.log(`[OFFLINE RETRY] action result: ERROR - ${errMsg}`);
      await this.refreshStats(businessId);
      this.notifyListeners();
      return { success: false, status: 'ERROR', error: errMsg };
    }
  }

  /**
   * Force sync a single operation with server stock adjustment
   */
  public async forceSyncSingleOperation(
    businessId: string,
    operationId: string,
    saleId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!businessId || (!operationId && !saleId)) {
      return { success: false, error: 'Parámetros inválidos' };
    }

    try {
      const resolution = await localDataStore.resolveOfflineOperation({ businessId, operationId, saleId });
      let targetOp = resolution.operation;

      if (!targetOp && resolution.sale) {
        const s = resolution.sale;
        targetOp = {
          operationId: s.outboxOperationId || operationId || `op_${s.id}`,
          businessId: s.businessId,
          userId: s.sellerId || 'offline_user',
          userName: s.sellerName || 'Vendedor',
          operationType: 'SALE',
          saleId: s.id,
          saleSnapshot: s,
          payload: s,
          createdAt: s.createdAt,
          status: 'PENDING',
          attempts: 0,
          lastAttemptAt: null,
          lastError: null,
          syncedAt: null,
          version: 1,
          deviceId: s.deviceId || 'offline_device'
        };
        await localDataStore.saveOutboxOperation(targetOp);
      }

      if (!targetOp) {
        return { success: false, error: 'Operación no encontrada en almacenamiento local' };
      }

      const repairResult = repairOfflineOperation(targetOp);
      const effectiveOp = repairResult.op;
      if (repairResult.wasRepaired) {
        await localDataStore.saveOutboxOperation(effectiveOp);
      }

      const cleanOpId = effectiveOp.operationId;
      const cleanSaleId = effectiveOp.saleId || saleId;

      await localDataStore.updateOutboxOperationStatus(businessId, cleanOpId, 'SYNCING', null, null, cleanSaleId);
      await this.refreshStats(businessId);
      this.notifyListeners();

      const result = await forceSyncSaleOperationWithStockAdjustment(effectiveOp);

      if (result.success) {
        const now = new Date().toISOString();
        await localDataStore.updateOutboxOperationStatus(businessId, cleanOpId, 'SYNCED', null, now, cleanSaleId);
        try {
          await getProductsByBusiness(businessId);
        } catch (e) {}
        await this.refreshStats(businessId);
        this.notifyListeners();
        return { success: true };
      } else {
        const errMsg = result.error || 'Error al forzar sincronización';
        await localDataStore.updateOutboxOperationStatus(
          businessId,
          cleanOpId,
          'STOCK_CONFLICT',
          errMsg,
          null,
          cleanSaleId
        );
        await this.refreshStats(businessId);
        this.notifyListeners();
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      console.error('[SyncEngine] Error al forzar sincronización individual:', err);
      const errMsg = err?.message || 'Error al forzar sincronización';
      await localDataStore.updateOutboxOperationStatus(
        businessId,
        operationId,
        'ERROR',
        errMsg,
        null,
        saleId
      );
      await this.refreshStats(businessId);
      this.notifyListeners();
      return { success: false, error: errMsg };
    }
  }

  /**
   * Cancel a single offline operation and revert local product deductions
   */
  public async cancelSingleOperation(
    businessId: string,
    saleId: string,
    operationId: string,
    reason?: string
  ): Promise<{ success: boolean; reverted: boolean; items: string[]; message?: string }> {
    if (!businessId || (!operationId && !saleId)) {
      return { success: false, reverted: false, items: [], message: 'Parámetros inválidos' };
    }

    try {
      const result = await localDataStore.cancelOfflineSaleAndRevertStock(
        businessId,
        saleId,
        operationId,
        reason || 'Anulada por usuario'
      );
      await this.refreshStats(businessId);
      this.notifyListeners();
      return result;
    } catch (err: any) {
      console.error('[SyncEngine] Error al cancelar operación individual:', err);
      return {
        success: false,
        reverted: false,
        items: [],
        message: err?.message || 'Error inesperado al cancelar operación'
      };
    }
  }
}

export const syncEngine = new SyncEngine();

