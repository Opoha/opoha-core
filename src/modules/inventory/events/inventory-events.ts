import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const inventoryUpdatedDataSchema = z
.object({
    inventoryItemId: z.string().uuid(),
    variantId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    delta: z.number().int(),
    quantityOnHand: z.number().int().nonnegative(),
    quantityReserved: z.number().int().nonnegative(),
    reason: z.string().nullable(),
  })
.strict();

export type InventoryUpdatedData = z.infer<typeof inventoryUpdatedDataSchema>;

export const inventoryReservationCreatedDataSchema = z
.object({
    reservationId: z.string().uuid(),
    inventoryItemId: z.string().uuid(),
    variantId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    quantity: z.number().int().positive(),
    reference: z.string().nullable(),
    quantityReserved: z.number().int().nonnegative(),
    quantityAvailable: z.number().int().nonnegative(),
  })
.strict();

export type InventoryReservationCreatedData = z.infer<typeof inventoryReservationCreatedDataSchema>;

export const inventoryReservationReleasedDataSchema = z
.object({
    reservationId: z.string().uuid(),
    inventoryItemId: z.string().uuid(),
    variantId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    quantity: z.number().int().positive(),
    quantityReserved: z.number().int().nonnegative(),
    quantityAvailable: z.number().int().nonnegative(),
  })
.strict();

export type InventoryReservationReleasedData = z.infer<
  typeof inventoryReservationReleasedDataSchema
>;

export const stockTransferCreatedDataSchema = z
.object({
    transferId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    status: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
.strict();

export type StockTransferCreatedData = z.infer<typeof stockTransferCreatedDataSchema>;

export const stockTransferShippedDataSchema = z
.object({
    transferId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    status: z.string().min(1),
    shippedAt: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
.strict();

export type StockTransferShippedData = z.infer<typeof stockTransferShippedDataSchema>;

export const stockTransferReceivedDataSchema = z
.object({
    transferId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    status: z.string().min(1),
    receivedAt: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
.strict();

export type StockTransferReceivedData = z.infer<typeof stockTransferReceivedDataSchema>;

export const stockTransferCancelledDataSchema = z
.object({
    transferId: z.string().uuid(),
    fromWarehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid(),
    status: z.string().min(1),
  })
.strict();

export type StockTransferCancelledData = z.infer<typeof stockTransferCancelledDataSchema>;

export type InventoryUpdatedEvent = DomainEvent<InventoryUpdatedData>;
export type InventoryReservationCreatedEvent = DomainEvent<InventoryReservationCreatedData>;
export type InventoryReservationReleasedEvent = DomainEvent<InventoryReservationReleasedData>;
export type StockTransferCreatedEvent = DomainEvent<StockTransferCreatedData>;
export type StockTransferShippedEvent = DomainEvent<StockTransferShippedData>;
export type StockTransferReceivedEvent = DomainEvent<StockTransferReceivedData>;
export type StockTransferCancelledEvent = DomainEvent<StockTransferCancelledData>;

/** Register inventory event payload schemas on the bus (call once at module init). */
export function inventoryEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.InventoryUpdated,
      schema: inventoryUpdatedDataSchema,
    },
    {
      eventName: CoreEventName.InventoryReservationCreated,
      schema: inventoryReservationCreatedDataSchema,
    },
    {
      eventName: CoreEventName.InventoryReservationReleased,
      schema: inventoryReservationReleasedDataSchema,
    },
    {
      eventName: CoreEventName.StockTransferCreated,
      schema: stockTransferCreatedDataSchema,
    },
    {
      eventName: CoreEventName.StockTransferShipped,
      schema: stockTransferShippedDataSchema,
    },
    {
      eventName: CoreEventName.StockTransferReceived,
      schema: stockTransferReceivedDataSchema,
    },
    {
      eventName: CoreEventName.StockTransferCancelled,
      schema: stockTransferCancelledDataSchema,
    },
  ];
}
