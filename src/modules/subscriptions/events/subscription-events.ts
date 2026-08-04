import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const subscriptionRenewedDataSchema = z
.object({
    subscriptionId: z.string().uuid(),
    planId: z.string().uuid(),
    customerId: z.string().uuid(),
    paymentId: z.string().uuid(),
    amountMinor: z.string().min(1),
    currencyCode: z.string().min(1),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    renewedAt: z.string().min(1),
  })
.strict();

export type SubscriptionRenewedData = z.infer<typeof subscriptionRenewedDataSchema>;
export type SubscriptionRenewedEvent = DomainEvent<SubscriptionRenewedData>;

/** Register subscription event payload schemas on the bus (call once at module init). */
export function subscriptionEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.SubscriptionRenewed,
      schema: subscriptionRenewedDataSchema,
    },
  ];
}
