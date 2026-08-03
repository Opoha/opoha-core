import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const digitalFulfillmentIssuedDataSchema = z
  .object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    downloadTokenIds: z.array(z.string().uuid()),
    licenseKeyIds: z.array(z.string().uuid()),
    lineCount: z.number().int().nonnegative(),
    issuedAt: z.string().min(1),
  })
  .strict();

export type DigitalFulfillmentIssuedData = z.infer<
  typeof digitalFulfillmentIssuedDataSchema
>;
export type DigitalFulfillmentIssuedEvent =
  DomainEvent<DigitalFulfillmentIssuedData>;

/** Register digital event payload schemas on the bus (call once at module init). */
export function digitalEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.DigitalFulfillmentIssued,
      schema: digitalFulfillmentIssuedDataSchema,
    },
  ];
}
