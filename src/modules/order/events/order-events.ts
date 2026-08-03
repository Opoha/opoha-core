import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';
import { ORDER_SOURCES } from '../entities/order-source';
import { ORDER_STATUSES } from '../entities/order-status';

export const cartCreatedDataSchema = z
  .object({
    cartId: z.string().uuid(),
    storeId: z.string().uuid().optional(),
    customerId: z.string().uuid().nullable(),
    currencyCode: z.string().min(1),
  })
  .strict();

export type CartCreatedData = z.infer<typeof cartCreatedDataSchema>;
export type CartCreatedEvent = DomainEvent<CartCreatedData>;

const cartLineBaseSchema = z
  .object({
    cartId: z.string().uuid(),
    lineId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.string().min(1),
    currencyCode: z.string().min(1),
  })
  .strict();

export const cartLineAddedDataSchema = cartLineBaseSchema;
export type CartLineAddedData = z.infer<typeof cartLineAddedDataSchema>;
export type CartLineAddedEvent = DomainEvent<CartLineAddedData>;

export const cartLineUpdatedDataSchema = cartLineBaseSchema;
export type CartLineUpdatedData = z.infer<typeof cartLineUpdatedDataSchema>;
export type CartLineUpdatedEvent = DomainEvent<CartLineUpdatedData>;

export const cartLineRemovedDataSchema = z
  .object({
    cartId: z.string().uuid(),
    lineId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.string().min(1),
    currencyCode: z.string().min(1),
  })
  .strict();

export type CartLineRemovedData = z.infer<typeof cartLineRemovedDataSchema>;
export type CartLineRemovedEvent = DomainEvent<CartLineRemovedData>;

export const checkoutPreparedDataSchema = z
  .object({
    cartId: z.string().uuid(),
    storeId: z.string().uuid().optional(),
    customerId: z.string().uuid().nullable(),
    currencyCode: z.string().min(1),
    subtotalMinor: z.string().min(1),
    shippingMinor: z.string().min(1),
    taxMinor: z.string().min(1),
    discountMinor: z.string().min(1),
    totalMinor: z.string().min(1),
    lineCount: z.number().int().nonnegative(),
  })
  .strict();

export type CheckoutPreparedData = z.infer<typeof checkoutPreparedDataSchema>;
export type CheckoutPreparedEvent = DomainEvent<CheckoutPreparedData>;

const orderStatusSchema = z.enum(ORDER_STATUSES);

const orderSourceSchema = z.enum(ORDER_SOURCES);

export const orderCreatedDataSchema = z
  .object({
    orderId: z.string().uuid(),
    cartId: z.string().uuid().nullable(),
    storeId: z.string().uuid().optional(),
    customerId: z.string().uuid().nullable(),
    /** Phase 7 omnichannel channel — additive field retained in v1.0 freeze. */
    orderSource: orderSourceSchema.optional().default('web'),
    status: orderStatusSchema,
    currencyCode: z.string().min(1),
    totalMinor: z.string().min(1),
    paymentMethod: z.string().min(1),
  })
  .strict();

export type OrderCreatedData = z.infer<typeof orderCreatedDataSchema>;
export type OrderCreatedEvent = DomainEvent<OrderCreatedData>;

export const orderPaidDataSchema = z
  .object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    currencyCode: z.string().min(1),
    totalMinor: z.string().min(1),
    paymentId: z.string().min(1),
    providerCode: z.string().min(1),
    amountMinor: z.string().min(1),
  })
  .strict();

export type OrderPaidData = z.infer<typeof orderPaidDataSchema>;
export type OrderPaidEvent = DomainEvent<OrderPaidData>;

export const orderStatusChangedDataSchema = z
  .object({
    orderId: z.string().uuid(),
    fromStatus: orderStatusSchema.nullable(),
    toStatus: orderStatusSchema,
  })
  .strict();

export type OrderStatusChangedData = z.infer<
  typeof orderStatusChangedDataSchema
>;
export type OrderStatusChangedEvent = DomainEvent<OrderStatusChangedData>;

export const orderTimelineDataSchema = z
  .object({
    orderId: z.string().uuid(),
    type: z.enum(['created', 'status_changed', 'payment_recorded']),
    fromStatus: orderStatusSchema.nullable(),
    toStatus: orderStatusSchema,
    paymentMethod: z.string().min(1).nullable(),
    note: z.string().nullable(),
  })
  .strict();

export type OrderTimelineData = z.infer<typeof orderTimelineDataSchema>;
export type OrderTimelineEvent = DomainEvent<OrderTimelineData>;

export const orderCancelledDataSchema = z
  .object({
    orderId: z.string().uuid(),
    fromStatus: orderStatusSchema,
  })
  .strict();

export type OrderCancelledData = z.infer<typeof orderCancelledDataSchema>;
export type OrderCancelledEvent = DomainEvent<OrderCancelledData>;

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
    {
      eventName: CoreEventName.CartLineAdded,
      schema: cartLineAddedDataSchema,
    },
    {
      eventName: CoreEventName.CartLineUpdated,
      schema: cartLineUpdatedDataSchema,
    },
    {
      eventName: CoreEventName.CartLineRemoved,
      schema: cartLineRemovedDataSchema,
    },
    {
      eventName: CoreEventName.CheckoutPrepared,
      schema: checkoutPreparedDataSchema,
    },
    {
      eventName: CoreEventName.OrderCreated,
      schema: orderCreatedDataSchema,
    },
    {
      eventName: CoreEventName.OrderPaid,
      schema: orderPaidDataSchema,
    },
    {
      eventName: CoreEventName.OrderStatusChanged,
      schema: orderStatusChangedDataSchema,
    },
    {
      eventName: CoreEventName.OrderTimeline,
      schema: orderTimelineDataSchema,
    },
    {
      eventName: CoreEventName.OrderCancelled,
      schema: orderCancelledDataSchema,
    },
  ];
}
