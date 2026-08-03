import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const shipmentCreatedDataSchema = z
  .object({
    fulfillmentId: z.string().uuid(),
    orderId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    trackingNumber: z.string().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    customerEmail: z.string().email().nullable().optional(),
    lineCount: z.number().int().nonnegative(),
    shippedAt: z.string().min(1),
  })
  .strict();

export type ShipmentCreatedData = z.infer<typeof shipmentCreatedDataSchema>;

export type ShipmentCreatedEvent = DomainEvent<ShipmentCreatedData>;

/** Register fulfillment event payload schemas on the bus (call once at module init). */
export function fulfillmentEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.ShipmentCreated,
      schema: shipmentCreatedDataSchema,
    },
  ];
}
