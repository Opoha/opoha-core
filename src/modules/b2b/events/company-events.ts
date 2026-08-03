import { z } from 'zod';

import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';

export const companyCreatedDataSchema = z
  .object({
    companyId: z.string().uuid(),
    storeId: z.string().uuid(),
    name: z.string().min(1),
  })
  .strict();

export type CompanyCreatedData = z.infer<typeof companyCreatedDataSchema>;
export type CompanyCreatedEvent = DomainEvent<CompanyCreatedData>;

export const companyMembershipUpdatedDataSchema = z
  .object({
    companyId: z.string().uuid(),
    customerId: z.string().uuid(),
    role: z.enum(['buyer', 'approver', 'admin']).nullable(),
    /** True when the membership was removed. */
    removed: z.boolean().optional(),
  })
  .strict();

export type CompanyMembershipUpdatedData = z.infer<
  typeof companyMembershipUpdatedDataSchema
>;
export type CompanyMembershipUpdatedEvent =
  DomainEvent<CompanyMembershipUpdatedData>;

/** Register b2b event payload schemas on the bus. */
export function companyEventSchemas(): Array<{
  eventName: string;
  schema: z.ZodType;
}> {
  return [
    {
      eventName: CoreEventName.CompanyCreated,
      schema: companyCreatedDataSchema,
    },
    {
      eventName: CoreEventName.CompanyMembershipUpdated,
      schema: companyMembershipUpdatedDataSchema,
    },
  ];
}
