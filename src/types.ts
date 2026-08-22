export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER';

export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'DISABLED';

export interface UserPermissions {
  sales: {
    create: boolean;
    view: boolean;
  };
  inventory: {
    view: boolean;
    receive: boolean;
    stockEntry: boolean;
  };
  receiving: {
    create: boolean;
    view: boolean;
    confirm: boolean;
  };
  purchases: {
    create: boolean;
    view: boolean;
  };
  cash: {
    view: boolean;
    purchasePayment: boolean;
  };
  replenishment?: {
    create: boolean;
    view: boolean;
    export: boolean;
  };
}

export type PermissionPath =
  | 'sales.create'
  | 'sales.view'
  | 'inventory.view'
  | 'inventory.receive'
  | 'inventory.stock_entry'
  | 'receiving.create'
  | 'receiving.view'
  | 'receiving.confirm'
  | 'purchases.create'
  | 'purchases.view'
  | 'cash.view'
  | 'cash.purchase_payment'
  | 'replenishment.create'
  | 'replenishment.view'
  | 'replenishment.export';

export type BusinessStatus = 'active' | 'inactive';

export interface Business {
  id: string;
  name: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  adminUserId: string;
  adminEmail?: string;
  adminName?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  businessId: string | null;
  active: boolean;
  status?: UserStatus;
  permissions?: UserPermissions;
  createdAt: string;
  updatedAt: string;
  lastActivity?: string;
}

export interface CreateBusinessInput {
  businessName: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
}

export interface CreateSellerInput {
  sellerName: string;
  sellerEmail: string;
  sellerPassword?: string;
  businessId: string;
}

export interface ComboItem {
  productId: string;
  productName?: string;
  quantity: number;
  unitCost?: number;
  tracksStock?: boolean;
  trackStock?: boolean;
}

export interface Product {
  id: string;
  businessId: string;
  barcode: string | null;
  name: string;
  category: string;
  icon?: string;
  imageUrl?: string;
  image?: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minimumStock: number;
  reorderPoint?: number;
  targetStock?: number;
  tracksStock?: boolean;
  isCombo?: boolean;
  comboItems?: ComboItem[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType = 
  | 'INITIAL' 
  | 'ADJUSTMENT_IN' 
  | 'ADJUSTMENT_OUT' 
  | 'SALE' 
  | 'RECEIPT' 
  | 'PURCHASE'
  | 'REPLENISHMENT'
  | 'CANCELLATION';

export interface InventoryMovement {
  id: string;
  businessId: string;
  productId: string;
  productName?: string;
  productBarcode?: string | null;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdAt: string;
  userId: string;
  userName?: string;
  supplierName?: string;
  saleId?: string;
  receivingId?: string;
  replenishmentId?: string;
  purchaseId?: string;
  adjustmentId?: string;
}

export type StockAdjustmentStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type StockAdjustmentType = 'IN' | 'OUT';

export interface StockAdjustmentItem {
  productId: string;
  productName: string;
  barcode?: string | null;
  category?: string;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  previousStock?: number;
  newStock?: number;
  reason: string;
  customReason?: string;
}

export interface StockAdjustment {
  id: string;
  businessId: string;
  items: StockAdjustmentItem[];
  totalItemsCount: number;
  totalUnitsCount: number;
  status: StockAdjustmentStatus;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  confirmedBy?: string;
  confirmerName?: string;
  confirmedAt?: string;
  updatedAt?: string;
  generalNotes?: string;
  // Offline & Outbox metadata
  syncStatus?: SyncStatus;
  syncMode?: SyncMode;
  syncedAt?: string | null;
  deviceId?: string;
  outboxOperationId?: string;
  syncError?: string;
}

export type ReceivingStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface ReceivingItem {
  productId: string;
  productName: string;
  barcode: string | null;
  category?: string;
  requestedQuantity?: number;
  confirmedQuantity?: number;
  quantity: number;
  currentStockAtScan?: number;
}

export interface Receiving {
  id: string;
  businessId: string;
  supplierName?: string;
  hasDeliveryNote: boolean;
  deliveryNoteNumber?: string;
  status: ReceivingStatus;
  items: ReceivingItem[];
  totalProductsCount: number;
  totalUnitsCount: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  confirmedBy?: string;
  confirmerName?: string;
  confirmedAt?: string;
  updatedAt?: string;
  replenishmentId?: string;
  replenishmentCode?: string;
  // Offline & Outbox metadata
  syncStatus?: SyncStatus;
  syncMode?: SyncMode;
  syncedAt?: string | null;
  deviceId?: string;
  outboxOperationId?: string;
  syncError?: string;
}

export interface CreateProductInput {
  barcode?: string | null;
  name: string;
  category: string;
  icon?: string;
  costPrice: number;
  salePrice: number;
  initialStock: number;
  minimumStock: number;
  reorderPoint?: number;
  targetStock?: number;
  tracksStock?: boolean;
  isCombo?: boolean;
  comboItems?: ComboItem[];
}

export interface UpdateProductInput {
  barcode?: string | null;
  name: string;
  category: string;
  icon?: string;
  costPrice: number;
  salePrice: number;
  minimumStock: number;
  reorderPoint?: number;
  targetStock?: number;
  tracksStock?: boolean;
  isCombo?: boolean;
  comboItems?: ComboItem[];
  active: boolean;
}

export type ReplenishmentStatus = 'DRAFT' | 'EXPORTED' | 'RECEIVED' | 'CANCELLED';

export interface ReplenishmentItem {
  productId: string;
  productName: string;
  barcode?: string | null;
  category?: string;
  currentStock: number;
  reorderPoint?: number;
  targetStock?: number;
  requestedQuantity: number;
}

export interface ProviderResponseItem {
  productId?: string;
  productName: string;
  requestedQuantity: number;
  confirmedQuantity: number;
  unitText?: string;
  category?: string;
  status: 'COMPLETE' | 'PARTIAL' | 'NO_STOCK' | 'SURPLUS';
}

export interface ProviderOrderResponse {
  id?: string;
  replenishmentId?: string;
  publicOrderCode: string;
  status: 'CONFIRMED';
  items: ProviderResponseItem[];
  providerNote?: string;
  confirmedAt: string;
  totalProductsCount: number;
  totalUnitsRequested: number;
  totalUnitsConfirmed: number;
  completeCount: number;
  partialCount: number;
  noStockCount: number;
}

export interface ReplenishmentList {
  id: string;
  businessId: string;
  supplierName?: string;
  notes?: string;
  status: ReplenishmentStatus;
  items: ReplenishmentItem[];
  totalProductsCount: number;
  totalUnitsRequested: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
  exportedAt?: string;
  exportedBy?: string;
  exporterName?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellerName?: string;
  cancelReason?: string;
  receivedAt?: string;
  receivedBy?: string;
  receiverName?: string;
  receivingId?: string;
  publicShareToken?: string;
  publicShareCode?: string;
  publicShareUrl?: string;
  publicShareCreatedAt?: string;
  publicOrderStatus?: PublicOrderStatus;
  providerResponse?: ProviderOrderResponse;
  providerStatus?: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';
  providerConfirmedAt?: string;
  providerNote?: string;
}

export type PublicOrderStatus = 'PENDING' | 'CONFIRMED_BY_PROVIDER' | 'RECEIVED' | 'CANCELLED';

export interface PublicOrderItem {
  productId?: string;
  productName: string;
  requestedQuantity: number;
  confirmedQuantity?: number;
  unitText?: string;
  category: string;
}

export interface PublicOrder {
  id: string;
  token: string;
  publicCode: string;
  businessName: string;
  requestCode: string;
  createdAt: string;
  supplierName?: string;
  requestedBy: string;
  status: PublicOrderStatus;
  statusLabel?: string;
  items: PublicOrderItem[];
  totalProductsCount: number;
  totalUnitsCount: number;
  notes?: string;
  receivedAt?: string;
  cancelledAt?: string;
  updatedAt: string;
  businessRefId?: string;
  orderRefId?: string;
  providerResponse?: ProviderOrderResponse;
  providerConfirmedAt?: string;
  providerNote?: string;
  totalUnitsConfirmed?: number;
}

export interface ExcelImportRow {
  rowNumber: number;
  barcode: string | null;
  name: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  category: string;
  status: 'NEW' | 'UPDATE' | 'ERROR';
  errorReason?: string;
  existingProductId?: string;
  stockIgnoredMessage?: string;
}

export interface ExcelImportSummary {
  newCount: number;
  updateCount: number;
  errorCount: number;
  rows: ExcelImportRow[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PosStatus = 'IDLE' | 'SHOPPING' | 'CANCELLED';

export type PaymentMethod = 'EFECTIVO' | 'MERCADO_PAGO' | 'COMBINADO';

export interface PaymentBreakdown {
  cashAmount: number;
  mpAmount: number;
  cashReceived?: number;
  change?: number;
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'SYNCING' | 'ERROR' | 'STOCK_CONFLICT' | 'CANCELLED';

export type SyncMode = 'ONLINE' | 'OFFLINE';

export interface SaleItem {
  productId: string;
  productName: string;
  barcode: string | null;
  category?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isCombo?: boolean;
  comboItems?: ComboItem[];
}

export interface Sale {
  id?: string;
  businessId: string;
  sellerId: string;
  sellerName: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  cashReceived?: number;
  change?: number;
  status: SaleStatus;
  createdAt?: string;
  // Offline & Outbox metadata
  syncStatus?: SyncStatus;
  syncMode?: SyncMode;
  syncedAt?: string | null;
  deviceId?: string;
  outboxOperationId?: string;
  syncError?: string;
}

export type OutboxOperationType = 'SALE' | 'EXPENSE' | 'PURCHASE' | 'STOCK_ADJUSTMENT' | 'RECEIVING';
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'STOCK_CONFLICT' | 'CANCELLED';

export interface ProcessSalePayload {
  businessId: string;
  sellerId: string;
  sellerName: string;
  items: {
    product: Product;
    quantity: number;
  }[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentBreakdown?: PaymentBreakdown;
  cashReceived?: number;
  change?: number;
  saleId?: string;
  deviceId?: string;
}

export interface ProcessExpensePayload {
  businessId: string;
  expenseId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  notes?: string;
  createdAt: string;
  userId: string;
  deviceId?: string;
}

export interface ProcessStockAdjustmentPayload {
  businessId: string;
  adjustmentId: string;
  userId: string;
  creatorName: string;
  items: StockAdjustmentItem[];
  generalNotes?: string;
  createdAt: string;
  deviceId?: string;
}

export interface ProcessReceivingPayload {
  businessId: string;
  receivingId: string;
  userId: string;
  creatorName: string;
  supplierName?: string;
  hasDeliveryNote: boolean;
  deliveryNoteNumber?: string;
  items: ReceivingItem[];
  replenishmentId?: string;
  replenishmentCode?: string;
  createdAt: string;
  deviceId?: string;
}

export interface OutboxOperation {
  operationId: string;
  operationType: OutboxOperationType;
  businessId: string;
  userId: string;
  userName: string;
  deviceId: string;
  saleId?: string;
  expenseId?: string;
  adjustmentId?: string;
  receivingId?: string;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  payload: any;
  saleSnapshot?: Sale;
  expenseSnapshot?: Expense;
  adjustmentSnapshot?: StockAdjustment;
  receivingSnapshot?: Receiving;
  version: number;
  syncedAt: string | null;
}

export type PurchasePaymentMethod = 'EFECTIVO' | 'MERCADO_PAGO' | 'OTRO';

export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface PurchaseItem {
  productId: string;
  productName: string;
  barcode?: string | null;
  category?: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierName?: string;
  hasReceipt: boolean;
  receiptNumber?: string;
  items: PurchaseItem[];
  total: number;
  paymentMethod: PurchasePaymentMethod;
  status: PurchaseStatus;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  confirmedBy?: string;
  confirmerName?: string;
  confirmedAt?: string;
  cashMovementId?: string;
  updatedAt?: string;
  // Legacy / fallbacks
  description?: string;
  supplier?: string;
  amount?: number;
  notes?: string;
  userId?: string;
}

export type CashMovementType = 'PURCHASE_PAYMENT' | 'SALE_INCOME' | 'EXPENSE_PAYMENT' | 'WITHDRAWAL' | 'ADJUSTMENT';

export interface CashMovement {
  id: string;
  businessId: string;
  type: CashMovementType;
  amount: number;
  referenceId?: string;
  purchaseId?: string;
  supplierName?: string;
  description: string;
  paymentMethod: PurchasePaymentMethod;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
}

export type ExpenseCategory = 'Servicios' | 'Limpieza' | 'Mantenimiento' | 'Transporte' | 'Otros';

export interface Expense {
  id?: string;
  businessId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  userId: string;
  // Offline & Outbox metadata
  syncStatus?: SyncStatus;
  syncMode?: SyncMode;
  syncedAt?: string | null;
  deviceId?: string;
  outboxOperationId?: string;
  syncError?: string;
}

export type DatePreset = 'HOY' | 'AYER' | 'ULTIMOS_7' | 'ESTE_MES' | 'CUSTOM';

export interface PosNote {
  id: string;
  businessId: string;
  userId?: string;
  userName?: string;
  personName: string;
  taskDescription: string;
  quantity: number;
  isPaid: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePosNoteInput {
  businessId: string;
  userId?: string;
  userName?: string;
  personName: string;
  taskDescription: string;
  quantity: number;
  isPaid: boolean;
}
