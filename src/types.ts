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
    editBarcode?: boolean;
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
    controlCaja?: boolean;
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
  | 'inventory.edit_barcode'
  | 'receiving.create'
  | 'receiving.view'
  | 'receiving.confirm'
  | 'purchases.create'
  | 'purchases.view'
  | 'cash.view'
  | 'cash.purchase_payment'
  | 'cash.control_caja'
  | 'replenishment.create'
  | 'replenishment.view'
  | 'replenishment.export';

export type BusinessStatus = 'active' | 'inactive';

export type PaymentProviderStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface BusinessPaymentProvider {
  id: string;
  businessId: string;
  provider: 'mercadopago';
  status: PaymentProviderStatus;
  userId?: string;
  siteId?: string;
  externalStoreId?: string;
  storeId?: string;
  externalPosId?: string;
  posId?: string;
  connectedAt?: string;
  updatedAt?: string;
  lastError?: string;
  accountEmail?: string;
  accountNickname?: string;
}

export interface BusinessCommercialData {
  name: string;
  legalName?: string;
  taxId?: string;
  businessType?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export interface BusinessSettings {
  replenishmentApprovalRequired?: boolean;
}

export interface Business {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  businessType?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  adminUserId: string;
  adminEmail?: string;
  adminName?: string;
  settings?: BusinessSettings;
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
  sku?: string;
  name: string;
  category: string;
  brand?: string;
  unit?: string;
  supplier?: string;
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
export type ReceivingOriginType = 'PURCHASE' | 'ADMIN_DELIVERY' | 'MANUAL';
export type ReceivingProgressStatus = 'RECIBIDO' | 'PENDIENTE' | 'PARCIAL' | 'CANCELLED';
export type PaymentStatus = 'PAGADO' | 'A_CANCELAR';
export type FundSource = 'CASH' | 'BANK' | 'MERCADO_PAGO' | 'PERSONAL' | 'OTHER';

export type ShortageReasonCode = 
  | 'PROVEEDOR_SIN_STOCK' 
  | 'MERCADERIA_DANADA' 
  | 'NO_ENVIADO_PROVEEDOR' 
  | 'ACUERDO_COMERCIAL' 
  | 'OTRO';

export type SurplusTreatment = 'CHARGE' | 'FREE' | 'REJECT';

export interface ReceivingItem {
  productId: string;
  productName: string;
  barcode: string | null;
  category?: string;
  requestedQuantity?: number;
  confirmedQuantity?: number;
  purchasedQuantity?: number;
  receivedQuantity?: number;
  shortageQuantity?: number;
  surplusQuantity?: number;
  shortageClosed?: boolean;
  shortageReason?: string;
  surplusTreatment?: SurplusTreatment;
  quantity: number;
  currentStockAtScan?: number;
  unitCost?: number;
}

export interface Receiving {
  id: string;
  businessId: string;
  supplierName?: string;
  hasDeliveryNote: boolean;
  deliveryNoteNumber?: string;
  status: ReceivingStatus;
  originType?: ReceivingOriginType;
  purchaseId?: string;
  purchaseCode?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PurchasePaymentMethod;
  fundSource?: FundSource;
  totalAmount?: number;
  hasDifference?: boolean;
  hasDiscrepancies?: boolean;
  totalShortageUnits?: number;
  totalSurplusUnits?: number;
  shortageClosed?: boolean;
  shortageReason?: string;
  surplusTreatment?: SurplusTreatment;
  differenceNotes?: string;
  differenceResolutionNotes?: string;
  originalCommittedAmount?: number;
  adjustedDueAmount?: number;
  manualReason?: string;
  obligationId?: string;
  cashMovementId?: string;
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

export type ReplenishmentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPORTED' | 'RECEIVED' | 'CANCELLED';

export interface ReplenishmentItem {
  productId: string;
  productName: string;
  barcode?: string | null;
  category?: string;
  currentStock: number;
  costPrice?: number;
  reorderPoint?: number;
  targetStock?: number;
  requestedQuantity: number;
  approvedQuantity?: number;
  approvalStatus?: 'APPROVED' | 'MODIFIED' | 'REJECTED';
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
  // Approval Workflow fields
  submittedForApprovalAt?: string;
  submittedAt?: string;
  submittedBy?: string;
  submitterName?: string;
  approvedAt?: string;
  approvedBy?: string;
  approverName?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejecterName?: string;
  rejectReason?: string;
  totalEstimatedCost?: number;
  originalItemsSnapshot?: ReplenishmentItem[];
  // Export & Logistics
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

export type NotificationType = 
  | 'SOLICITUD_CREADA'
  | 'SOLICITUD_PENDIENTE_APROBACION'
  | 'SOLICITUD_APROBADA'
  | 'SOLICITUD_RECHAZADA'
  | 'SOLICITUD_MODIFICADA'
  | 'SOLICITUD_ENVIADA_PROVEEDOR'
  | 'PROVEEDOR_CONFIRMO_SOLICITUD'
  | 'RECEPCION_CONTROL_INICIADO'
  | 'RECEPCION_PARCIAL'
  | 'RECEPCION_COMPLETADA'
  | 'RECEPCION_CERRADA'
  | 'REPLENISHMENT_PENDING_APPROVAL' 
  | 'REPLENISHMENT_APPROVED' 
  | 'REPLENISHMENT_REJECTED' 
  | 'REPLENISHMENT_MODIFIED' 
  | 'PROVIDER_CONFIRMED' 
  | 'PROVIDER_CONFIRMED_ORDER'
  | 'COMPRA_PENDIENTE'
  | 'RECEPCION_PENDIENTE_PAGO'
  | 'PROVEEDOR_VENCIDO'
  | 'PROXIMO_VENCIMIENTO'
  | 'OBLIGACION_VENCIDA'
  | 'OBLIGACION_PROXIMO_VENCIMIENTO'
  | 'DIFERENCIA_RECEPCION'
  | 'GASTO_RECURRENTE_GENERADO'
  | 'PAGO_REALIZADO'
  | 'STOCK_ALERT' 
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  businessId: string;
  userId?: string;
  targetRole?: UserRole | 'ALL';
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  read: boolean;
  createdAt: string;
  linkTab?: string;
  metadata?: Record<string, any>;
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

export type PaymentVerification = 'MANUAL' | 'AUTOMATIC' | 'MERCADOPAGO_VERIFIED' | 'NONE';

export type MercadoPagoSource = 'STATIC_POS_QR' | 'POINT_GENERATED_QR' | 'POINT_SMART';

export type PointModel = 'POINT_SMART_1' | 'POINT_SMART_2';

export interface PaymentDetails {
  mode?: 'ONLINE' | 'OFFLINE' | 'INTEGRATION_DISABLED';
  verification?: PaymentVerification;
  notes?: string;
  orderId?: string;
  paymentId?: string;
  operationId?: string;
  externalReference?: string;
  verifiedAt?: string;
  mercadoPagoSource?: MercadoPagoSource;
  amount?: number;
  currency?: string;
  paymentStatus?: string;
}

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
  unitCost: number;
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
  paymentVerification?: PaymentVerification;
  paymentDetails?: PaymentDetails;
  offline?: boolean;
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

export type OutboxOperationType = 'SALE' | 'EXPENSE' | 'PURCHASE' | 'STOCK_ADJUSTMENT' | 'RECEIVING' | 'CANCEL_PURCHASE' | 'PAY_EXPENSE' | 'CANCEL_EXPENSE';
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
  paymentVerification?: PaymentVerification;
  paymentDetails?: PaymentDetails;
  requiresOnlinePaymentVerification?: boolean;
  offline?: boolean;
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

export interface ProcessPurchasePayload {
  businessId: string;
  purchaseId: string;
  userId: string;
  creatorName: string;
  supplierName?: string;
  hasReceipt: boolean;
  receiptNumber?: string;
  items: PurchaseItem[];
  total: number;
  paymentMethod: PurchasePaymentMethod;
  paymentStatus?: PaymentStatus;
  fundSource?: FundSource;
  isImmediateDelivery?: boolean;
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
  purchaseId?: string;
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
  purchaseSnapshot?: Purchase;
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
  updateCostPrice?: boolean;
  receivedQuantity?: number;
  shortageQuantity?: number;
  surplusQuantity?: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierName?: string;
  hasReceipt: boolean;
  receiptNumber?: string;
  items: PurchaseItem[];
  total: number;
  adjustedTotal?: number;
  paymentMethod: PurchasePaymentMethod;
  status: PurchaseStatus;
  paymentStatus?: PaymentStatus;
  fundSource?: FundSource;
  receivingStatus?: ReceivingProgressStatus;
  receivedQuantity?: number;
  shortageUnits?: number;
  surplusUnits?: number;
  shortageClosed?: boolean;
  shortageReason?: string;
  surplusTreatment?: SurplusTreatment;
  isImmediateDelivery?: boolean;
  obligationId?: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  confirmedBy?: string;
  confirmerName?: string;
  confirmedAt?: string;
  cancelledBy?: string;
  cancellerName?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledReceivedQuantity?: number;
  cashMovementId?: string;
  updatedAt?: string;
  // Offline & Outbox metadata
  syncStatus?: SyncStatus;
  syncMode?: SyncMode;
  syncedAt?: string | null;
  deviceId?: string;
  outboxOperationId?: string;
  syncError?: string;
  // Legacy / fallbacks
  description?: string;
  supplier?: string;
  amount?: number;
  notes?: string;
  userId?: string;
}

export type PaymentObligationSourceType = 
  | 'PURCHASE' 
  | 'RECEIVING' 
  | 'OPERATING_EXPENSE' 
  | 'RECURRING_EXPENSE' 
  | 'SALARY'
  | 'EXPENSE';

export type PaymentObligationStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface PaymentObligation {
  id: string;
  businessId: string;
  sourceType: PaymentObligationSourceType;
  sourceId?: string;
  sourceCode?: string;
  recurringTemplateId?: string;
  period?: string; // e.g. "2026-08"
  supplierName: string;
  beneficiary?: string;
  category?: string;
  description: string;
  amount: number;
  pendingAmount: number;
  status: PaymentObligationStatus;
  dueDate?: string;
  paymentMethod?: PurchasePaymentMethod;
  fundSource?: FundSource;
  receiptNumber?: string;
  notes?: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
  settledAt?: string;
  settledBy?: string;
  settlerName?: string;
}

export interface PaymentSettlement {
  id: string;
  obligationId: string;
  businessId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PurchasePaymentMethod;
  fundSource: FundSource;
  registeredBy: string;
  registrarName: string;
  notes?: string;
  cashMovementId?: string;
  createdAt: string;
}

export type RecurringExpenseFrequency = 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'YEARLY';
export type RecurringExpenseAmountType = 'FIXED' | 'VARIABLE';
export type RecurringExpenseStatus = 'ACTIVE' | 'INACTIVE';

export interface RecurringExpenseTemplate {
  id: string;
  businessId: string;
  name?: string;
  concept: string;
  description?: string;
  category: ExpenseCategory | string;
  supplierName?: string;
  beneficiary: string;
  amount: number;
  amountType: RecurringExpenseAmountType;
  type?: RecurringExpenseAmountType;
  frequency: RecurringExpenseFrequency;
  dueDay: number; // Day of the month (1-31)
  startDate?: string;
  endDate?: string;
  usualPaymentMethod?: PurchasePaymentMethod;
  fundSource?: FundSource;
  status: RecurringExpenseStatus;
  lastGeneratedPeriod?: string; // e.g. "2026-08"
  notes?: string;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CashMovementType = 'PURCHASE_PAYMENT' | 'PURCHASE_CANCELLATION' | 'SALE_INCOME' | 'EXPENSE_PAYMENT' | 'WITHDRAWAL' | 'ADJUSTMENT';

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

export type ExpenseStatus = 'PAGADO' | 'PENDIENTE' | 'ANULADO';

export interface Expense {
  id?: string;
  businessId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  fundSource?: FundSource;
  status?: ExpenseStatus; // default 'PAGADO' for backwards compatibility
  paidAmount?: number;
  pendingAmount?: number;
  paidAt?: string;
  paidBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  obligationId?: string;
  cashMovementId?: string;
  supplierName?: string;
  beneficiary?: string;
  dueDate?: string;
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

export interface PayExpenseInput {
  expenseId: string;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  fundSource: FundSource;
  notes?: string;
  userId: string;
  userName?: string;
}

export interface CancelExpenseInput {
  expenseId: string;
  reason: string;
  userId: string;
  userName?: string;
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

// ----------------------------------------------------
// CENTRO DE EVENTOS (BUSINESS EVENTS & TRACEABILITY)
// ----------------------------------------------------
export type BusinessEventType =
  | 'SALE_CREATED'
  | 'SALE_CANCELLED'
  | 'PURCHASE_CREATED'
  | 'PURCHASE_CONFIRMED'
  | 'PURCHASE_CANCELLED'
  | 'RECEIVING_CONFIRMED'
  | 'RECEIVING_PARTIAL'
  | 'SHORTAGE_DETECTED'
  | 'SHORTAGE_CLOSED'
  | 'SURPLUS_FREE'
  | 'SURPLUS_CHARGED'
  | 'SURPLUS_REJECTED'
  | 'OBLIGATION_CREATED'
  | 'OBLIGATION_PAYMENT'
  | 'OBLIGATION_PAID'
  | 'OBLIGATION_CANCELLED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_PAID'
  | 'EXPENSE_CANCELLED'
  | 'INVENTORY_ADJUSTMENT'
  | 'REQUEST_CREATED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'CASH_DEPOSIT'
  | 'CASH_WITHDRAWAL'
  | 'CASH_AUDIT';

export type BusinessEntityType =
  | 'SALE'
  | 'PURCHASE'
  | 'RECEIVING'
  | 'EXPENSE'
  | 'OBLIGATION'
  | 'INVENTORY'
  | 'REQUEST'
  | 'CASH';

export interface BusinessEvent {
  id: string;
  businessId: string;
  type: BusinessEventType;
  entityType: BusinessEntityType;
  entityId: string;
  title: string;
  description?: string;
  actorUserId?: string;
  actorName?: string;
  createdAt: string;
  metadata?: {
    amount?: number;
    status?: string;
    supplierName?: string;
    productName?: string;
    itemsCount?: number;
    paymentMethod?: string;
    fundSource?: string;
    referenceCode?: string;
    receiptNumber?: string;
    destinationTab?: string;
    [key: string]: unknown;
  };
}

export interface EventFilterOptions {
  entityType?: 'ALL' | BusinessEntityType | 'CANCELLATIONS';
  eventType?: BusinessEventType;
  subFilter?: 'ALL' | 'SHORTAGES' | 'SURPLUSES' | 'CANCELLATIONS';
  preset?: 'HOY' | 'AYER' | 'ULTIMOS_7' | 'ULTIMOS_30' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  limitCount?: number;
}

