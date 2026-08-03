import type { WebhookDeliveryStatus } from './webhook-status';

export type WebhookEndpointType = {
  id: string;
  code: string;
  name: string;
  url: string;
  /** Present on create/update responses; masked as `***` on list/read by default. */
  secret: string;
  eventNames: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateWebhookEndpointInput = {
  code: string;
  name: string;
  url: string;
  secret: string;
  eventNames: string[];
  enabled?: boolean;
};

export type UpdateWebhookEndpointInput = {
  id: string;
  code?: string;
  name?: string;
  url?: string;
  secret?: string;
  eventNames?: string[];
  enabled?: boolean;
};

export type WebhookDeliveryAttemptType = {
  id: string;
  endpointId: string;
  eventName: string;
  eventId: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempt: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  signature: string | null;
  finishedAt: Date | null;
  createdAt: Date;
};
