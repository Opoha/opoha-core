import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const storeCurrencyConfigUpdatedDataSchema = z
.object({
    storeId: z.string().uuid(),
    settlementCurrencyCode: z.string().min(1),
    displayCurrencyCode: z.string().min(1),
    enabledDisplayCurrencies: z.array(z.string().min(1)),
  })
.strict();

export type StoreCurrencyConfigUpdatedData = z.infer<typeof storeCurrencyConfigUpdatedDataSchema>;

export type StoreCurrencyConfigUpdatedEvent = DomainEvent<StoreCurrencyConfigUpdatedData>;

/** Register currency-config event payload schemas on the bus. */
export function storeCurrencyConfigEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.StoreCurrencyConfigUpdated,
      schema: storeCurrencyConfigUpdatedDataSchema,
    },
  ];
}
