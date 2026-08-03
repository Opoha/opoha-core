import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const cartCreatedDataSchema = z
  .object({
    cartId: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    currencyCode: z.string().min(1),
  })
  .strict();

export type CartCreatedData = z.infer<typeof cartCreatedDataSchema>;
export type CartCreatedEvent = DomainEvent<CartCreatedData>;

/** Register order/cart event payload schemas on the bus (call once at module init). */
export function orderEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.CartCreated,
      schema: cartCreatedDataSchema,
    },
  ];
}
