import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';
import { ORDER_STATUSES } from '../entities/order-status';

export const cartCreatedDataSchema = z
  .object({
    cartId: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    currencyCode: z.string().min(1),
  })
  .strict();

export type CartCreatedData = z.infer<typeof cartCreatedDataSchema>;
export type CartCreatedEvent = DomainEvent<CartCreatedData>;

const orderStatusSchema = z.enum(ORDER_STATUSES);

export const orderCreatedDataSchema = z
  .object({
    orderId: z.string().uuid(),
    cartId: z.string().uuid().nullable(),
    customerId: z.string().uuid().nullable(),
    status: orderStatusSchema,
    currencyCode: z.string().min(1),
    totalMinor: z.string().min(1),
    paymentMethod: z.string().min(1),
  })
  .strict();

export type OrderCreatedData = z.infer<typeof orderCreatedDataSchema>;
export type OrderCreatedEvent = DomainEvent<OrderCreatedData>;

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
      eventName: CoreEventName.OrderCreated,
      schema: orderCreatedDataSchema,
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
