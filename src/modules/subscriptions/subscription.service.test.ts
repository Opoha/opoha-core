import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { SubscriptionService } from './subscription.service';

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMinor: string;
  currencyCode: string;
  billingIntervalUnit: string;
  billingIntervalCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SubRow = {
  id: string;
  planId: string;
  customerId: string;
  storeId: string | null;
  status: string;
  paymentProviderCode: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingAt: Date;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('SubscriptionService (unit)', () => {
  const now = new Date('2026-08-04T03:30:00Z');
  const planId = '11111111-1111-4111-8111-111111111111';
  const customerId = '22222222-2222-4222-8222-222222222222';
  const subscriptionId = '33333333-3333-4333-8333-333333333333';
  const paymentId = '44444444-4444-4444-8444-444444444444';

  let planStore: PlanRow[];
  let subStore: SubRow[];
  let service: SubscriptionService;
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let paymentEngine: {
    authorize: ReturnType<typeof vi.fn>;
    capture: ReturnType<typeof vi.fn>;
  };
  let nextPlanSeq: number;
  let nextSubSeq: number;

  function buildPlansRepo() {
    return {
      find: vi.fn(async ({ where, order }: { where?: Partial<PlanRow>; order?: unknown }) => {
        let rows = planStore;
        if (where) {
          rows = rows.filter((row) =>
            Object.entries(where).every(([k, v]) => row[k as keyof PlanRow] === v),
          );
        }
        void order;
        return rows.map((row) => Object.assign(new SubscriptionPlanEntity(), row));
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<PlanRow> }) => {
        const row = planStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof PlanRow] === v),
        );
        return row ? Object.assign(new SubscriptionPlanEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<PlanRow>) => ({
        id: `plan-${++nextPlanSeq}`,
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: PlanRow) => {
        const idx = planStore.findIndex((p) => p.id === row.id);
        if (idx >= 0) {
          planStore[idx] = { ...row, updatedAt: now };
        } else {
          planStore.push({ ...row, createdAt: now, updatedAt: now });
        }
        return planStore[idx >= 0 ? idx : planStore.length - 1];
      }),
    };
  }

  function buildSubsRepo() {
    return {
      find: vi.fn(async ({ where }: { where?: unknown }) => {
        const conditions = Array.isArray(where) ? where : where ? [where] : [];
        if (conditions.length === 0) {
          return subStore.map((row) => Object.assign(new SubscriptionEntity(), row));
        }
        const matches = subStore.filter((row) =>
          conditions.some((cond) =>
            Object.entries(cond as Record<string, unknown>).every(([k, v]) => {
              if (k === 'nextBillingAt' && v && typeof v === 'object' && 'value' in (v as object)) {
                return row.nextBillingAt.getTime() <= (v as { value: Date }).value.getTime();
              }
              return row[k as keyof SubRow] === v;
            }),
          ),
        );
        return matches.map((row) => Object.assign(new SubscriptionEntity(), row));
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<SubRow> }) => {
        const row = subStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof SubRow] === v),
        );
        return row ? Object.assign(new SubscriptionEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<SubRow>) => ({
        id: `sub-${++nextSubSeq}`,
        canceledAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: SubRow) => {
        const idx = subStore.findIndex((s) => s.id === row.id);
        if (idx >= 0) {
          subStore[idx] = { ...row, updatedAt: now };
        } else {
          subStore.push({ ...row, createdAt: now, updatedAt: now });
        }
        return subStore[idx >= 0 ? idx : subStore.length - 1];
      }),
    };
  }

  beforeEach(() => {
    planStore = [];
    subStore = [];
    nextPlanSeq = 0;
    nextSubSeq = 0;
    eventBus = { publish: vi.fn(async () => undefined) };
    paymentEngine = {
      authorize: vi.fn(async () => ({
        id: paymentId,
        status: 'captured',
      })),
      capture: vi.fn(async () => ({
        id: paymentId,
        status: 'captured',
      })),
    };
    service = new SubscriptionService(
      buildPlansRepo() as never,
      buildSubsRepo() as never,
      paymentEngine as never,
      eventBus as never,
    );
  });

  it('creates a plan with defaults', async () => {
    const plan = await service.createPlan({
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      priceMinor: '1999',
    });
    expect(plan.currencyCode).toBe('USD');
    expect(plan.billingIntervalUnit).toBe('month');
    expect(plan.billingIntervalCount).toBe(1);
    expect(plan.isActive).toBe(true);
  });

  it('rejects duplicate plan codes', async () => {
    await service.createPlan({
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      priceMinor: '1999',
    });
    planStore[0]!.id = planId;

    const dupRepo = buildPlansRepo();
    dupRepo.save = vi.fn(async () => {
      const err = new Error('duplicate key');
      (err as unknown as { driverError: { code: string } }).driverError = {
        code: '23505',
      };
      Object.setPrototypeOf(err, (await import('typeorm')).QueryFailedError.prototype);
      throw err;
    });
    const dupService = new SubscriptionService(
      dupRepo as never,
      buildSubsRepo() as never,
      paymentEngine as never,
      eventBus as never,
    );
    await expect(
      dupService.createPlan({
        code: 'PRO-MONTHLY',
        name: 'Pro Monthly 2',
        priceMinor: '2999',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid billing interval unit', async () => {
    await expect(
      service.createPlan({
        code: 'X',
        name: 'X',
        priceMinor: '100',
        billingIntervalUnit: 'fortnight',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('subscribes a customer to an active plan and computes the period', async () => {
    const plan = await service.createPlan({
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      priceMinor: '1999',
      billingIntervalUnit: 'month',
      billingIntervalCount: 1,
    });

    const subscription = await service.subscribe({
      planId: plan.id,
      customerId,
    });

    expect(subscription.status).toBe('active');
    expect(subscription.paymentProviderCode).toBe('manual');
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(
      subscription.currentPeriodStart.getTime(),
    );
    expect(subscription.nextBillingAt).toEqual(subscription.currentPeriodEnd);
  });

  it('rejects subscribing to an inactive plan', async () => {
    const plan = await service.createPlan({
      code: 'INACTIVE',
      name: 'Inactive',
      priceMinor: '500',
      isActive: false,
    });

    await expect(service.subscribe({ planId: plan.id, customerId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancels a subscription', async () => {
    const plan = await service.createPlan({
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      priceMinor: '1999',
    });
    const subscription = await service.subscribe({
      planId: plan.id,
      customerId,
    });

    const canceled = await service.cancel(subscription.id);
    expect(canceled.status).toBe('canceled');
    expect(canceled.canceledAt).not.toBeNull();
  });

  it('throws NotFound for missing subscription', async () => {
    await expect(service.findById('99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('renews an active subscription via the payment engine and publishes SubscriptionRenewed', async () => {
    planStore.push({
      id: planId,
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      description: null,
      priceMinor: '1999',
      currencyCode: 'USD',
      billingIntervalUnit: 'month',
      billingIntervalCount: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const periodEnd = new Date('2026-09-04T03:30:00Z');
    subStore.push({
      id: subscriptionId,
      planId,
      customerId,
      storeId: null,
      status: 'active',
      paymentProviderCode: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const orderId = '44444444-4444-4444-8444-444444444444';
    const result = await service.renew(subscriptionId, { orderId });

    expect(paymentEngine.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: 'manual',
        orderId,
        amount: { amountMinor: '1999', currencyCode: 'USD' },
        metadata: expect.objectContaining({
          kind: 'subscription_renewal',
          subscriptionId,
        }),
      }),
    );
    expect(result.paymentStatus).toBe('captured');
    expect(result.subscription.status).toBe('active');
    expect(result.subscription.currentPeriodStart).toEqual(periodEnd);
    expect(result.subscription.nextBillingAt.getTime()).toBeGreaterThan(periodEnd.getTime());

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.SubscriptionRenewed,
        aggregateType: 'subscription',
        aggregateId: subscriptionId,
        data: expect.objectContaining({
          subscriptionId,
          planId,
          customerId,
          paymentId,
          amountMinor: '1999',
          currencyCode: 'USD',
        }),
      }),
    );
  });

  it('marks subscription past_due when the renewal charge is not captured', async () => {
    planStore.push({
      id: planId,
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      description: null,
      priceMinor: '1999',
      currencyCode: 'USD',
      billingIntervalUnit: 'month',
      billingIntervalCount: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const periodEnd = new Date('2026-09-04T03:30:00Z');
    subStore.push({
      id: subscriptionId,
      planId,
      customerId,
      storeId: null,
      status: 'active',
      paymentProviderCode: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    paymentEngine.authorize = vi.fn(async () => ({
      id: paymentId,
      status: 'failed',
    }));

    const result = await service.renew(subscriptionId);

    expect(result.paymentStatus).toBe('failed');
    expect(result.subscription.status).toBe('past_due');
    expect(eventBus.publish).not.toHaveBeenCalled();
    // Period must not advance on a failed charge.
    expect(result.subscription.currentPeriodEnd).toEqual(periodEnd);
  });

  it('rejects renewing a canceled subscription', async () => {
    planStore.push({
      id: planId,
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      description: null,
      priceMinor: '1999',
      currencyCode: 'USD',
      billingIntervalUnit: 'month',
      billingIntervalCount: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    subStore.push({
      id: subscriptionId,
      planId,
      customerId,
      storeId: null,
      status: 'canceled',
      paymentProviderCode: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: now,
      nextBillingAt: now,
      canceledAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await expect(service.renew(subscriptionId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('finds subscriptions due for renewal as of a given date', async () => {
    planStore.push({
      id: planId,
      code: 'PRO-MONTHLY',
      name: 'Pro Monthly',
      description: null,
      priceMinor: '1999',
      currencyCode: 'USD',
      billingIntervalUnit: 'month',
      billingIntervalCount: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    subStore.push({
      id: subscriptionId,
      planId,
      customerId,
      storeId: null,
      status: 'active',
      paymentProviderCode: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
      nextBillingAt: new Date('2026-08-01T00:00:00Z'),
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    subStore.push({
      id: 'sub-future',
      planId,
      customerId,
      storeId: null,
      status: 'active',
      paymentProviderCode: 'manual',
      currentPeriodStart: now,
      currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      nextBillingAt: new Date('2026-12-01T00:00:00Z'),
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const due = await service.findDueForRenewal(new Date('2026-08-04T00:00:00Z'));
    expect(due).toHaveLength(1);
    expect(due[0]!.id).toBe(subscriptionId);
  });
});
