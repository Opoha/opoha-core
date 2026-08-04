import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const giftCardRedeemedDataSchema = z
.object({
    giftCardId: z.string().uuid(),
    code: z.string().min(1),
    amountMinor: z.string().min(1),
    balanceAfterMinor: z.string().min(1),
    orderId: z.string().uuid().nullable(),
    redeemedAt: z.string().min(1),
  })
.strict();

export type GiftCardRedeemedData = z.infer<typeof giftCardRedeemedDataSchema>;
export type GiftCardRedeemedEvent = DomainEvent<GiftCardRedeemedData>;

/** Register gift-card event payload schemas on the bus (call once at module init). */
export function giftCardEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.GiftCardRedeemed,
      schema: giftCardRedeemedDataSchema,
    },
  ];
}
