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
  InventoryUpdated: 'InventoryUpdated',
  CartCreated: 'CartCreated',
  OrderCreated: 'OrderCreated',
  OrderPaid: 'OrderPaid',
  OrderCancelled: 'OrderCancelled',
  PaymentSucceeded: 'PaymentSucceeded',
  PaymentFailed: 'PaymentFailed',
  ShipmentCreated: 'ShipmentCreated',
  ShipmentDelivered: 'ShipmentDelivered',
  ReturnRequested: 'ReturnRequested',
  RefundCompleted: 'RefundCompleted',
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
