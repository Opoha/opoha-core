import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const storeChannelSettingsUpdatedDataSchema = z
  .object({
    storeId: z.string().uuid(),
    timezone: z.string().min(1),
    countryCode: z.string().min(1),
    catalogMode: z.enum(['shared', 'isolated']),
  })
  .strict();

export type StoreChannelSettingsUpdatedData = z.infer<typeof storeChannelSettingsUpdatedDataSchema>;

export type StoreChannelSettingsUpdatedEvent = DomainEvent<StoreChannelSettingsUpdatedData>;

/** Register channel-settings event payload schemas on the bus. */
export function storeChannelSettingsEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.StoreChannelSettingsUpdated,
      schema: storeChannelSettingsUpdatedDataSchema,
    },
  ];
}
