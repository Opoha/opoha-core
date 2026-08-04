import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const loyaltyPointsAccruedDataSchema = z
  .object({
    accountId: z.string().uuid(),
    customerId: z.string().uuid(),
    points: z.number().int().positive(),
    balanceAfter: z.number().int().nonnegative(),
    orderId: z.string().uuid().nullable(),
    accruedAt: z.string().min(1),
  })
  .strict();

export type LoyaltyPointsAccruedData = z.infer<typeof loyaltyPointsAccruedDataSchema>;
export type LoyaltyPointsAccruedEvent = DomainEvent<LoyaltyPointsAccruedData>;

export const loyaltyPointsRedeemedDataSchema = z
  .object({
    accountId: z.string().uuid(),
    customerId: z.string().uuid(),
    points: z.number().int().positive(),
    balanceAfter: z.number().int().nonnegative(),
    appliedMinor: z.string().min(1),
    orderId: z.string().uuid().nullable(),
    redeemedAt: z.string().min(1),
  })
  .strict();

export type LoyaltyPointsRedeemedData = z.infer<typeof loyaltyPointsRedeemedDataSchema>;
export type LoyaltyPointsRedeemedEvent = DomainEvent<LoyaltyPointsRedeemedData>;

/** Register loyalty event payload schemas on the bus (call once at module init). */
export function loyaltyEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.LoyaltyPointsAccrued,
      schema: loyaltyPointsAccruedDataSchema,
    },
    {
      eventName: CoreEventName.LoyaltyPointsRedeemed,
      schema: loyaltyPointsRedeemedDataSchema,
    },
  ];
}
