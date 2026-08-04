import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

const paymentEventBaseSchema = z
.object({
    paymentId: z.string().min(1),
    orderId: z.string().min(1),
    providerCode: z.string().min(1),
    amountMinor: z.string().min(1),
    currencyCode: z.string().min(1),
    externalId: z.string().nullable(),
  })
.strict();

export const paymentAuthorizedDataSchema = paymentEventBaseSchema;
export type PaymentAuthorizedData = z.infer<typeof paymentAuthorizedDataSchema>;
export type PaymentAuthorizedEvent = DomainEvent<PaymentAuthorizedData>;

export const paymentCapturedDataSchema = paymentEventBaseSchema;
export type PaymentCapturedData = z.infer<typeof paymentCapturedDataSchema>;
export type PaymentCapturedEvent = DomainEvent<PaymentCapturedData>;

export const paymentRefundedDataSchema = paymentEventBaseSchema;
export type PaymentRefundedData = z.infer<typeof paymentRefundedDataSchema>;
export type PaymentRefundedEvent = DomainEvent<PaymentRefundedData>;

export const paymentFailedDataSchema = paymentEventBaseSchema
.extend({
    errorMessage: z.string().nullable(),
  })
.strict();

export type PaymentFailedData = z.infer<typeof paymentFailedDataSchema>;
export type PaymentFailedEvent = DomainEvent<PaymentFailedData>;

/** Register payment event payload schemas on the bus (call once at module init). */
export function paymentEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.PaymentAuthorized,
      schema: paymentAuthorizedDataSchema,
    },
    {
      eventName: CoreEventName.PaymentCaptured,
      schema: paymentCapturedDataSchema,
    },
    {
      eventName: CoreEventName.PaymentRefunded,
      schema: paymentRefundedDataSchema,
    },
    {
      eventName: CoreEventName.PaymentFailed,
      schema: paymentFailedDataSchema,
    },
  ];
}
