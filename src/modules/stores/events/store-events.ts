import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

const storeEventDataSchema = z
.object({
    storeId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    defaultCurrencyCode: z.string().min(1),
    defaultLocale: z.string().min(1),
  })
.strict();

export const storeCreatedDataSchema = storeEventDataSchema;
export const storeUpdatedDataSchema = storeEventDataSchema;

export type StoreCreatedData = z.infer<typeof storeCreatedDataSchema>;
export type StoreUpdatedData = z.infer<typeof storeUpdatedDataSchema>;

export type StoreCreatedEvent = DomainEvent<StoreCreatedData>;
export type StoreUpdatedEvent = DomainEvent<StoreUpdatedData>;

/** Register store event payload schemas on the bus (call once at module init). */
export function storeEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.StoreCreated,
      schema: storeCreatedDataSchema,
    },
    {
      eventName: CoreEventName.StoreUpdated,
      schema: storeUpdatedDataSchema,
    },
  ];
}
