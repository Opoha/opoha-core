import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const vendorUpdatedDataSchema = z
.object({
    vendorId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
    action: z.enum(['created', 'updated', 'deleted']),
  })
.strict();

export type VendorUpdatedData = z.infer<typeof vendorUpdatedDataSchema>;
export type VendorUpdatedEvent = DomainEvent<VendorUpdatedData>;

export const vendorOrderRoutedDataSchema = z
.object({
    orderId: z.string().uuid(),
    vendorId: z.string().uuid(),
    storeId: z.string().uuid().optional(),
    orderSource: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
    lineIds: z.array(z.string().uuid()),
  })
.strict();

export type VendorOrderRoutedData = z.infer<typeof vendorOrderRoutedDataSchema>;
export type VendorOrderRoutedEvent = DomainEvent<VendorOrderRoutedData>;

/** Register vendor event payload schemas on the bus (call once at module init). */
export function vendorEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.VendorUpdated,
      schema: vendorUpdatedDataSchema,
    },
    {
      eventName: CoreEventName.VendorOrderRouted,
      schema: vendorOrderRoutedDataSchema,
    },
  ];
}
