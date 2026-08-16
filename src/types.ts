export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER';

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
  createdAt: string;
  updatedAt: string;
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

export interface Product {
  id: string;
  businessId: string;
  barcode: string | null;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType = 'INITIAL' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'SALE';

export interface InventoryMovement {
  id: string;
  businessId: string;
  productId: string;
  productName?: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  createdAt: string;
  userId: string;
  saleId?: string;
}

export interface CreateProductInput {
  barcode?: string | null;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  initialStock: number;
  minimumStock: number;
}

export interface UpdateProductInput {
  barcode?: string | null;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  minimumStock: number;
  active: boolean;
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

export type PaymentMethod = 'EFECTIVO' | 'MERCADO_PAGO';

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItem {
  productId: string;
  productName: string;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id?: string;
  businessId: string;
  sellerId: string;
  sellerName: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  createdAt?: string;
}

export type PurchasePaymentMethod = 'EFECTIVO' | 'MERCADO_PAGO' | 'OTRO';

export interface Purchase {
  id?: string;
  businessId: string;
  description: string;
  supplier?: string;
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  userId: string;
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
}

export type DatePreset = 'HOY' | 'AYER' | 'ULTIMOS_7' | 'ESTE_MES' | 'CUSTOM';
