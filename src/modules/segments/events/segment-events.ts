import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const segmentUpdatedDataSchema = z
  .object({
    segmentId: z.string().uuid(),
    code: z.string().min(1),
    name: z.string().min(1),
    isActive: z.boolean(),
    updatedAt: z.string().min(1),
  })
  .strict();

export type SegmentUpdatedData = z.infer<typeof segmentUpdatedDataSchema>;
export type SegmentUpdatedEvent = DomainEvent<SegmentUpdatedData>;

/** Register segment event payload schemas on the bus (call once at module init). */
export function segmentEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.SegmentUpdated,
      schema: segmentUpdatedDataSchema,
    },
  ];
}
