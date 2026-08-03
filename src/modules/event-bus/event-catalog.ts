/**
 * Reserved core domain event names (MVP subset + future catalog placeholders).
 * Past-tense domain facts only (coding-conventions / event-bus-design).
 */
export const CoreEventName = {
  UserRegistered: 'UserRegistered',
  UserUpdated: 'UserUpdated',
  UserDeleted: 'UserDeleted',
  LoginSucceeded: 'LoginSucceeded',
  LoginFailed: 'LoginFailed',
  ApiKeyCreated: 'ApiKeyCreated',
  ApiKeyRevoked: 'ApiKeyRevoked',
  CustomerCreated: 'CustomerCreated',
  ProductCreated: 'ProductCreated',
  ProductUpdated: 'ProductUpdated',
  ProductDeleted: 'ProductDeleted',
  IndexUpdated: 'IndexUpdated',
  InventoryUpdated: 'InventoryUpdated',
  InventoryReservationCreated: 'InventoryReservationCreated',
  InventoryReservationReleased: 'InventoryReservationReleased',
  StockTransferCreated: 'StockTransferCreated',
  StockTransferShipped: 'StockTransferShipped',
  StockTransferReceived: 'StockTransferReceived',
  StockTransferCancelled: 'StockTransferCancelled',
  WarehouseUpdated: 'WarehouseUpdated',
  StoreWarehouseUpdated: 'StoreWarehouseUpdated',
  SupplierUpdated: 'SupplierUpdated',
  PurchaseOrderCreated: 'PurchaseOrderCreated',
  PurchaseOrderReceived: 'PurchaseOrderReceived',
  PurchaseOrderCancelled: 'PurchaseOrderCancelled',
  CartCreated: 'CartCreated',
  CartLineAdded: 'CartLineAdded',
  CartLineUpdated: 'CartLineUpdated',
  CartLineRemoved: 'CartLineRemoved',
  CheckoutPrepared: 'CheckoutPrepared',
  OrderCreated: 'OrderCreated',
  OrderStatusChanged: 'OrderStatusChanged',
  OrderTimeline: 'OrderTimeline',
  OrderPaid: 'OrderPaid',
  OrderCancelled: 'OrderCancelled',
  PaymentAuthorized: 'PaymentAuthorized',
  PaymentCaptured: 'PaymentCaptured',
  PaymentRefunded: 'PaymentRefunded',
  /** Prefer PaymentCaptured for capture facts; kept for catalog compatibility. */
  PaymentSucceeded: 'PaymentSucceeded',
  PaymentFailed: 'PaymentFailed',
  ShipmentCreated: 'ShipmentCreated',
  ShipmentDelivered: 'ShipmentDelivered',
  FileCreated: 'FileCreated',
  NotificationQueued: 'NotificationQueued',
  ReturnRequested: 'ReturnRequested',
  RefundCompleted: 'RefundCompleted',
  GiftCardRedeemed: 'GiftCardRedeemed',
  LoyaltyPointsAccrued: 'LoyaltyPointsAccrued',
  LoyaltyPointsRedeemed: 'LoyaltyPointsRedeemed',
  SegmentUpdated: 'SegmentUpdated',
  StoreCreated: 'StoreCreated',
  StoreUpdated: 'StoreUpdated',
  StoreChannelSettingsUpdated: 'StoreChannelSettingsUpdated',
  StoreCurrencyConfigUpdated: 'StoreCurrencyConfigUpdated',
  ExchangeRateUpdated: 'ExchangeRateUpdated',
  CompanyCreated: 'CompanyCreated',
  CompanyMembershipUpdated: 'CompanyMembershipUpdated',
  B2bQuoteCreated: 'B2bQuoteCreated',
  B2bQuoteStatusChanged: 'B2bQuoteStatusChanged',
  B2bQuoteConverted: 'B2bQuoteConverted',
  /** Phase 7 omnichannel — PosSaleCompleted published on placeOrder(orderSource=pos). */
  PosSaleCompleted: 'PosSaleCompleted',
  /** Phase 7 C-01 — marketplace vendor CRUD. */
  VendorUpdated: 'VendorUpdated',
  /** Phase 7 C-02 — order lines routed to marketplace vendor(s). */
  VendorOrderRouted: 'VendorOrderRouted',
  DigitalFulfillmentIssued: 'DigitalFulfillmentIssued',
  SubscriptionRenewed: 'SubscriptionRenewed',
} as const;

export type CoreEventName =
  (typeof CoreEventName)[keyof typeof CoreEventName];

/**
 * Auth module events implemented in MVP Phase D.
 * Aligns with audit actions (auth.login.*, user.*, api-key.*) where sensible.
 */
export const AUTH_EVENT_NAMES = [
  CoreEventName.UserRegistered,
  CoreEventName.UserUpdated,
  CoreEventName.UserDeleted,
  CoreEventName.LoginSucceeded,
  CoreEventName.LoginFailed,
  CoreEventName.ApiKeyCreated,
  CoreEventName.ApiKeyRevoked,
] as const;

export type AuthEventName = (typeof AUTH_EVENT_NAMES)[number];
