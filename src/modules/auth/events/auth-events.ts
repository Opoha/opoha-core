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

export const loginSucceededDataSchema = z
.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  })
.strict();

export type LoginSucceededData = z.infer<typeof loginSucceededDataSchema>;

export const loginFailedDataSchema = z
.object({
    /** Attempted identifier — may be non-email garbage from attackers. */
    email: z.string().min(1),
    reason: z.enum(['invalid_credentials', 'inactive']),
    userId: z.string().uuid().optional(),
  })
.strict();

export type LoginFailedData = z.infer<typeof loginFailedDataSchema>;

export const apiKeyCreatedDataSchema = z
.object({
    apiKeyId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    name: z.string().min(1),
    keyPrefix: z.string().min(1),
    permissionKeys: z.array(z.string()),
  })
.strict();

export type ApiKeyCreatedData = z.infer<typeof apiKeyCreatedDataSchema>;

export const apiKeyRevokedDataSchema = z
.object({
    apiKeyId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    name: z.string().min(1),
    keyPrefix: z.string().min(1),
  })
.strict();

export type ApiKeyRevokedData = z.infer<typeof apiKeyRevokedDataSchema>;

export type UserRegisteredEvent = DomainEvent<UserRegisteredData>;
export type UserUpdatedEvent = DomainEvent<UserUpdatedData>;
export type UserDeletedEvent = DomainEvent<UserDeletedData>;
export type LoginSucceededEvent = DomainEvent<LoginSucceededData>;
export type LoginFailedEvent = DomainEvent<LoginFailedData>;
export type ApiKeyCreatedEvent = DomainEvent<ApiKeyCreatedData>;
export type ApiKeyRevokedEvent = DomainEvent<ApiKeyRevokedData>;

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
    {
      eventName: CoreEventName.LoginSucceeded,
      schema: loginSucceededDataSchema,
    },
    { eventName: CoreEventName.LoginFailed, schema: loginFailedDataSchema },
    {
      eventName: CoreEventName.ApiKeyCreated,
      schema: apiKeyCreatedDataSchema,
    },
    {
      eventName: CoreEventName.ApiKeyRevoked,
      schema: apiKeyRevokedDataSchema,
    },
  ];
}
