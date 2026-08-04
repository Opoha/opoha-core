import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const exchangeRateUpdatedDataSchema = z
.object({
    id: z.string().uuid(),
    fromCurrencyCode: z.string().min(1),
    toCurrencyCode: z.string().min(1),
    rate: z.number().positive().nullable(),
    source: z.string().min(1),
    /** True when the row was removed (delete path). */
    deleted: z.boolean().optional(),
  })
.strict();

export type ExchangeRateUpdatedData = z.infer<typeof exchangeRateUpdatedDataSchema>;

export type ExchangeRateUpdatedEvent = DomainEvent<ExchangeRateUpdatedData>;

/** Register exchange-rate event payload schemas on the bus. */
export function exchangeRateEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.ExchangeRateUpdated,
      schema: exchangeRateUpdatedDataSchema,
    },
  ];
}
