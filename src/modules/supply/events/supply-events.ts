import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const supplierUpdatedDataSchema = z
  .object({
    supplierId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
    action: z.enum(['created', 'updated', 'deleted']),
  })
  .strict();

export type SupplierUpdatedData = z.infer<typeof supplierUpdatedDataSchema>;

export const purchaseOrderCreatedDataSchema = z
  .object({
    purchaseOrderId: z.string().uuid(),
    supplierId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    status: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
  .strict();

export type PurchaseOrderCreatedData = z.infer<typeof purchaseOrderCreatedDataSchema>;

export const purchaseOrderReceivedDataSchema = z
  .object({
    purchaseOrderId: z.string().uuid(),
    supplierId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    status: z.string().min(1),
    receivedAt: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
  .strict();

export type PurchaseOrderReceivedData = z.infer<typeof purchaseOrderReceivedDataSchema>;

export const purchaseOrderCancelledDataSchema = z
  .object({
    purchaseOrderId: z.string().uuid(),
    supplierId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    status: z.string().min(1),
  })
  .strict();

export type PurchaseOrderCancelledData = z.infer<typeof purchaseOrderCancelledDataSchema>;

export type SupplierUpdatedEvent = DomainEvent<SupplierUpdatedData>;
export type PurchaseOrderCreatedEvent = DomainEvent<PurchaseOrderCreatedData>;
export type PurchaseOrderReceivedEvent = DomainEvent<PurchaseOrderReceivedData>;
export type PurchaseOrderCancelledEvent = DomainEvent<PurchaseOrderCancelledData>;

/** Register supply event payload schemas on the bus (call once at module init). */
export function supplyEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.SupplierUpdated,
      schema: supplierUpdatedDataSchema,
    },
    {
      eventName: CoreEventName.PurchaseOrderCreated,
      schema: purchaseOrderCreatedDataSchema,
    },
    {
      eventName: CoreEventName.PurchaseOrderReceived,
      schema: purchaseOrderReceivedDataSchema,
    },
    {
      eventName: CoreEventName.PurchaseOrderCancelled,
      schema: purchaseOrderCancelledDataSchema,
    },
  ];
}
