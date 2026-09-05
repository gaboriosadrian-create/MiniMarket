/**
 * Types and interfaces for Mercado Pago Argentina QR Orders integration in MiniMarket.
 */

export interface MercadoPagoConfig {
  enabled: boolean;
  autoConfirm: boolean;
  accessToken: string;
  userId?: string;
  siteId?: string;
  externalStoreId?: string;
  externalPosId?: string;
  storeId?: string;
  posId?: string;
  pointTerminalId?: string;
  pointModel?: string;
  apiBaseUrl?: string;
}

export interface MercadoPagoWebhookPayload {
  action?: string;
  api_version?: string;
  data?: {
    id?: string | number;
    [key: string]: any;
  };
  date_created?: string;
  id?: string | number;
  live_mode?: boolean;
  type?: string;
  user_id?: string | number;
  resource?: string;
  topic?: string;
  [key: string]: any;
}

export interface MercadoPagoPayment {
  id: string | number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' | string;
  status_detail?: string;
  transaction_amount?: number;
  total_paid_amount?: number;
  payment_method_id?: string;
  date_approved?: string;
  date_created?: string;
  date_last_updated?: string;
}

export interface MercadoPagoOrderItem {
  title?: string;
  unit_price?: number;
  quantity?: number;
  total_amount?: number;
  description?: string;
  category_id?: string;
}

export interface MercadoPagoOrder {
  id: string | number;
  status: 'opened' | 'closed' | 'processed' | 'created' | 'failed' | 'expired' | 'cancelled' | string;
  type?: string; // e.g. 'qr' or 'point'
  external_reference?: string;
  total_amount?: number;
  currency_id?: string;
  user_id?: string | number;
  site_id?: string;
  config?: {
    qr?: {
      external_pos_id?: string;
      pos_id?: string | number;
      store_id?: string | number;
      external_store_id?: string;
    };
    point?: {
      terminal_id?: string;
      print_on_terminal?: string;
    };
  };
  point?: {
    terminal_id?: string;
    print_on_terminal?: string;
    [key: string]: any;
  };
  payments?: MercadoPagoPayment[];
  items?: MercadoPagoOrderItem[];
  date_created?: string;
  last_updated?: string;
  closed_at?: string;
  [key: string]: any;
}

export type MappedOrderStatus = 'CONFIRMED' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'UNKNOWN';

export type MercadoPagoSource = 'STATIC_POS_QR' | 'POINT_GENERATED_QR' | 'POINT_SMART';

export type PointModel = 'POINT_SMART_1' | 'POINT_SMART_2';

export type WebhookProcessStatus =
  | 'DISABLED'
  | 'NO_AUTO_CONFIRM'
  | 'CONFIRMED'
  | 'CONNECTED'
  | 'DUPLICATE'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_PENDING'
  | 'ORDER_FAILED'
  | 'ORDER_EXPIRED'
  | 'VALIDATION_FAILED'
  | 'UNMATCHED_REFERENCE'
  | 'INVALID_PAYLOAD'
  | 'API_ERROR'
  | 'ERROR';

export type MercadoPagoMode = 'TEST' | 'PRODUCTION';
export type MercadoPagoConnectionStatus = 'NOT_VERIFIED' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export type PaymentProviderStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface BusinessPaymentProvider {
  id: string;
  businessId: string;
  provider: 'mercadopago';
  status: PaymentProviderStatus;
  userId?: string;
  siteId?: string;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  tokenExpiresAt?: string;
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

export interface PosCredentials {
  userId?: string;
  siteId?: string;
  externalStoreId?: string;
  externalPosId?: string;
  storeId?: string;
  posId?: string;
  pointTerminalId?: string;
  pointModel?: string;
  pointOperatingMode?: string;
  accessToken?: string;
}

export interface TenantMercadoPagoConfig {
  businessId: string;
  enabled: boolean;
  explicitEnabled?: boolean;
  mode: MercadoPagoMode;
  autoConfirm: boolean;
  explicitAutoConfirm?: boolean;
  connectionStatus: MercadoPagoConnectionStatus;
  lastVerification?: string;
  lastVerificationMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
  testConfig: PosCredentials;
  productionConfig: PosCredentials;
}

export interface SanitizedPosCredentials {
  userId?: string;
  siteId?: string;
  externalStoreId?: string;
  externalPosId?: string;
  storeId?: string;
  posId?: string;
  pointTerminalId?: string;
  pointModel?: string;
  pointOperatingMode?: string;
  hasAccessToken: boolean;
}

export interface SanitizedTenantMercadoPagoConfig {
  businessId: string;
  enabled: boolean;
  mode: MercadoPagoMode;
  autoConfirm: boolean;
  connectionStatus: MercadoPagoConnectionStatus;
  lastVerification?: string;
  lastVerificationMessage?: string;
  updatedAt?: string;
  updatedBy?: string;
  testConfig: SanitizedPosCredentials;
  productionConfig: SanitizedPosCredentials;
  activeConfigSummary: {
    mode: MercadoPagoMode;
    userId: string;
    siteId: string;
    externalStoreId: string;
    externalPosId: string;
    storeId: string;
    posId: string;
    pointTerminalId?: string;
    pointModel?: string;
    pointStatus?: string;
    hasAccessToken: boolean;
    qrStatus: string;
    connectionStatus: MercadoPagoConnectionStatus;
  };
}

export interface ConnectionVerificationResult {
  success: boolean;
  status: MercadoPagoConnectionStatus;
  message: string;
  mode: MercadoPagoMode;
  userId?: string;
  posId?: string;
  storeId?: string;
  externalPosId?: string;
  pointTerminalId?: string;
  pointModel?: string;
  testedAt: string;
  details?: string;
}

export interface MercadoPagoAuditLog {
  id: string;
  timestamp: string;
  orderId?: string;
  paymentId?: string;
  external_reference?: string;
  action?: string;
  topicOrType?: string;
  mpOrderStatus?: string;
  mappedStatus?: MappedOrderStatus;
  minimarketPreviousState?: string;
  minimarketNewState?: string;
  pos?: string;
  store?: string;
  userId?: string;
  amount?: number;
  currency?: string;
  mercadoPagoSource?: MercadoPagoSource;
  result: WebhookProcessStatus;
  isDuplicate: boolean;
  autoConfirmed: boolean;
  errorDetails?: string;
  attempts: number;
  rawOrderSummary?: {
    id: string | number;
    status: string;
    paymentsCount: number;
    approvedPaymentsCount: number;
  };
}

export interface WebhookProcessResult {
  statusCode: number;
  body: {
    success: boolean;
    status: WebhookProcessStatus;
    message: string;
    orderId?: string;
    paymentId?: string;
    external_reference?: string;
    isDuplicate?: boolean;
    confirmed?: boolean;
    auditId?: string;
    details?: string;
  };
}
