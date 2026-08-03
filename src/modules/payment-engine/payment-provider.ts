/**
 * Payment provider port — plugins implement; core never imports provider SDKs.
 */
export type PaymentProvider = {
  readonly code: string;
  readonly displayName: string;
  readonly configSchema?: unknown;
};

export type RegisteredPaymentProvider = {
  pluginId: string;
  provider: PaymentProvider;
  active: boolean;
};
