import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const warehouseUpdatedDataSchema = z
  .object({
    warehouseId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
    isDefault: z.boolean(),
    action: z.enum(['created', 'updated', 'deleted']),
  })
  .strict();

export type WarehouseUpdatedData = z.infer<typeof warehouseUpdatedDataSchema>;

export type WarehouseUpdatedEvent = DomainEvent<WarehouseUpdatedData>;

export const storeWarehouseUpdatedDataSchema = z
  .object({
    storeId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    isPrimary: z.boolean(),
    action: z.enum(['linked', 'unlinked']),
  })
  .strict();

export type StoreWarehouseUpdatedData = z.infer<typeof storeWarehouseUpdatedDataSchema>;

export type StoreWarehouseUpdatedEvent = DomainEvent<StoreWarehouseUpdatedData>;

/** Register warehouse event payload schemas on the bus (call once at module init). */
export function warehouseEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.WarehouseUpdated,
      schema: warehouseUpdatedDataSchema,
    },
    {
      eventName: CoreEventName.StoreWarehouseUpdated,
      schema: storeWarehouseUpdatedDataSchema,
    },
  ];
}
