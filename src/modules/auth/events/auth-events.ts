import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const userRegisteredDataSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    isActive: z.boolean(),
  })
  .strict();

export type UserRegisteredData = z.infer<typeof userRegisteredDataSchema>;

export const userUpdatedDataSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    isActive: z.boolean(),
    changedFields: z.array(z.string()),
  })
  .strict();

export type UserUpdatedData = z.infer<typeof userUpdatedDataSchema>;

export const userDeletedDataSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
  })
  .strict();

export type UserDeletedData = z.infer<typeof userDeletedDataSchema>;

export type UserRegisteredEvent = DomainEvent<UserRegisteredData>;
export type UserUpdatedEvent = DomainEvent<UserUpdatedData>;
export type UserDeletedEvent = DomainEvent<UserDeletedData>;

/** Register auth event payload schemas on the bus (call once at module init). */
export function authEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.UserRegistered,
      schema: userRegisteredDataSchema,
    },
    { eventName: CoreEventName.UserUpdated, schema: userUpdatedDataSchema },
    { eventName: CoreEventName.UserDeleted, schema: userDeletedDataSchema },
  ];
}
