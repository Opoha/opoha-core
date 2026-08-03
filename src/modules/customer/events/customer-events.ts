import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const customerCreatedDataSchema = z
  .object({
    customerId: z.string().uuid(),
    email: z.string().email(),
  })
  .strict();

export type CustomerCreatedData = z.infer<typeof customerCreatedDataSchema>;

export type CustomerCreatedEvent = DomainEvent<CustomerCreatedData>;

/** Register customer event payload schemas on the bus (call once at module init). */
export function customerEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.CustomerCreated,
      schema: customerCreatedDataSchema,
    },
  ];
}
