/**
 * Shipping method port — plugins implement; core never imports carrier SDKs.
 */
export type ShippingMethodProvider = {
  readonly code: string;
  readonly displayName: string;
  readonly configSchema?: unknown;
};

export type RegisteredShippingMethod = {
  pluginId: string;
  method: ShippingMethodProvider;
  active: boolean;
};
