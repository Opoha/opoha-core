import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const returnRequestedDataSchema = z
  .object({
    returnId: z.string().uuid(),
    orderId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    resolution: z.enum(['refund', 'exchange']),
    lineCount: z.number().int().nonnegative(),
    requestedAt: z.string().min(1),
  })
  .strict();

export type ReturnRequestedData = z.infer<typeof returnRequestedDataSchema>;
export type ReturnRequestedEvent = DomainEvent<ReturnRequestedData>;

export const refundCompletedDataSchema = z
  .object({
    returnId: z.string().uuid(),
    orderId: z.string().uuid(),
    paymentId: z.string().uuid(),
    refundAmountMinor: z.string().min(1),
    completedAt: z.string().min(1),
  })
  .strict();

export type RefundCompletedData = z.infer<typeof refundCompletedDataSchema>;
export type RefundCompletedEvent = DomainEvent<RefundCompletedData>;

/** Register returns event payload schemas on the bus (call once at module init). */
export function returnEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.ReturnRequested,
      schema: returnRequestedDataSchema,
    },
    {
      eventName: CoreEventName.RefundCompleted,
      schema: refundCompletedDataSchema,
    },
  ];
}
