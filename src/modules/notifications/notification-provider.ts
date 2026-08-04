/**
 * Notification provider port — plugins implement; core never imports SMTP/Resend/SendGrid.
 * Phase 2 E-01: send abstraction for transactional email (and future channels).
 */

/** Delivery channel; email is the Phase 2 primary. */
export type NotificationChannel = 'email' | 'sms' | 'push' | string;

/** Recipient address fragment — providers use the fields they need. */
export type NotificationRecipient = {
  email?: string;
  phone?: string;
  name?: string;
  userId?: string;
  customerId?: string;
};

/**
 * Payload handed to a notification provider.
 * Templates (E-02) may pre-render subject/body; raw providers may render from templateCode + data.
 */
export type NotificationSendInput = {
  /** Template code (order.confirmation, payment.captured, shipment.created, …). */
  templateCode?: string;
  channel?: NotificationChannel;
  to: NotificationRecipient | NotificationRecipient[];
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  /** Template / personalization variables. */
  data?: Record<string, unknown>;
  /** Caller-supplied idempotency key for safe retries. */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type NotificationSendStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export type NotificationSendResult = {
  /** Provider-assigned message id when available. */
  messageId?: string;
  status: NotificationSendStatus;
  providerCode: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Notification provider registered with the notifications module.
 * Plugins (SMTP, Resend, SendGrid) must implement send.
 */
export type NotificationProvider = {
  readonly code: string;
  readonly displayName: string;
  /** Opaque config schema (typically a Zod schema) for admin settings. */
  readonly configSchema?: unknown;
  /** Channels this provider supports; defaults to email when omitted. */
  readonly channels?: NotificationChannel[];
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
};

export type RegisteredNotificationProvider = {
  pluginId: string;
  provider: NotificationProvider;
  active: boolean;
};
