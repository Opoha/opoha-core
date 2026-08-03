/**
 * Payment provider port — plugins implement; core never imports provider SDKs.
 * Phase 2: authorize / capture / refund / optional webhook.
 */

/** Minor-unit money amount (bigint as decimal string). */
export type MoneyAmount = {
  amountMinor: string;
  currencyCode: string;
};

export type PaymentAuthorizeInput = {
  paymentId: string;
  orderId: string;
  amount: MoneyAmount;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentAuthorizeResult = {
  status: 'authorized' | 'captured' | 'pending' | 'failed';
  externalId?: string;
  raw?: unknown;
  errorMessage?: string;
};

export type PaymentCaptureInput = {
  paymentId: string;
  orderId: string;
  amount: MoneyAmount;
  externalId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentCaptureResult = {
  status: 'captured' | 'pending' | 'failed';
  externalId?: string;
  raw?: unknown;
  errorMessage?: string;
};

export type PaymentRefundInput = {
  paymentId: string;
  orderId: string;
  amount: MoneyAmount;
  externalId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentRefundResult = {
  status: 'refunded' | 'pending' | 'failed';
  externalId?: string;
  raw?: unknown;
  errorMessage?: string;
};

export type PaymentWebhookInput = {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

export type PaymentWebhookResult = {
  handled: boolean;
  externalEventId?: string;
  paymentExternalId?: string;
  action?: 'authorize' | 'capture' | 'refund' | 'fail' | 'ignore';
};

export type PaymentProvider = {
  readonly code: string;
  readonly displayName: string;
  readonly configSchema?: unknown;
  authorize(input: PaymentAuthorizeInput): Promise<PaymentAuthorizeResult>;
  capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult>;
  refund(input: PaymentRefundInput): Promise<PaymentRefundResult>;
  handleWebhook?(input: PaymentWebhookInput): Promise<PaymentWebhookResult>;
};

export type RegisteredPaymentProvider = {
  pluginId: string;
  provider: PaymentProvider;
  active: boolean;
};
