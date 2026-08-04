import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const b2bQuoteCreatedDataSchema = z
.object({
    quoteId: z.string().uuid(),
    companyId: z.string().uuid(),
    storeId: z.string().uuid(),
    customerId: z.string().uuid(),
    status: z.string().min(1),
    poNumber: z.string().nullable(),
    lineCount: z.number().int().nonnegative(),
  })
.strict();

export type B2bQuoteCreatedData = z.infer<typeof b2bQuoteCreatedDataSchema>;
export type B2bQuoteCreatedEvent = DomainEvent<B2bQuoteCreatedData>;

export const b2bQuoteStatusChangedDataSchema = z
.object({
    quoteId: z.string().uuid(),
    companyId: z.string().uuid(),
    fromStatus: z.string().min(1),
    toStatus: z.string().min(1),
  })
.strict();

export type B2bQuoteStatusChangedData = z.infer<typeof b2bQuoteStatusChangedDataSchema>;
export type B2bQuoteStatusChangedEvent = DomainEvent<B2bQuoteStatusChangedData>;

export const b2bQuoteConvertedDataSchema = z
.object({
    quoteId: z.string().uuid(),
    companyId: z.string().uuid(),
    orderId: z.string().uuid(),
    status: z.string().min(1),
  })
.strict();

export type B2bQuoteConvertedData = z.infer<typeof b2bQuoteConvertedDataSchema>;
export type B2bQuoteConvertedEvent = DomainEvent<B2bQuoteConvertedData>;

export function b2bQuoteEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.B2bQuoteCreated,
      schema: b2bQuoteCreatedDataSchema,
    },
    {
      eventName: CoreEventName.B2bQuoteStatusChanged,
      schema: b2bQuoteStatusChangedDataSchema,
    },
    {
      eventName: CoreEventName.B2bQuoteConverted,
      schema: b2bQuoteConvertedDataSchema,
    },
  ];
}
