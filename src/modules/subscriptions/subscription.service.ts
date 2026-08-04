import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { PaymentEngine } from '../payment-engine/public';
import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import {
  addBillingInterval,
  isBillingIntervalUnit,
  type BillingIntervalUnit,
} from './subscription-status';
import type { CreateSubscriptionPlanInput, SubscribeToPlanInput } from './subscription.types';

export type RenewSubscriptionOptions = {
  /**
   * Order id for the payment-engine charge (FK to `orders.id`).
   * Unit tests may pass any UUID when PaymentEngine is mocked.
   * When omitted, a fresh UUID is used (stub path — real DB needs a real order).
   */
  orderId?: string;
};

export type SubscriptionPlanRecord = {
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

export type SubscriptionRecord = {
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

export type SubscriptionRenewalResult = {
  subscription: SubscriptionRecord;
  paymentId: string;
  paymentStatus: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toPlanRecord(row: SubscriptionPlanEntity): SubscriptionPlanRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    priceMinor: String(row.priceMinor),
    currencyCode: row.currencyCode,
    billingIntervalUnit: row.billingIntervalUnit,
    billingIntervalCount: row.billingIntervalCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSubscriptionRecord(row: SubscriptionEntity): SubscriptionRecord {
  return {
    id: row.id,
    planId: row.planId,
    customerId: row.customerId,
    storeId: row.storeId,
    status: row.status,
    paymentProviderCode: row.paymentProviderCode,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    nextBillingAt: row.nextBillingAt,
    canceledAt: row.canceledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function requirePositiveMinor(value: string): string {
  let amount: bigint;
  try {
    amount = BigInt(value);
  } catch {
    throw new BadRequestException('priceMinor must be an integer string');
  }
  if (amount < 0n) {
    throw new BadRequestException('priceMinor must be >= 0');
  }
  return amount.toString();
}

/**
 * Subscription plans + schedule state (Phase 7 E-01/E-03).
 * Renewal charges are placed via the core payment engine — never a provider
 * SDK import (ADR-0003).
 */
@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(SubscriptionPlanEntity)
    private readonly plans: Repository<SubscriptionPlanEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptions: Repository<SubscriptionEntity>,
    private readonly paymentEngine: PaymentEngine,
    private readonly eventBus: EventBusService,
  ) {}

  async createPlan(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlanRecord> {
    const code = input.code.trim();
    if (!code) {
      throw new BadRequestException('code is required');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const billingIntervalUnit = input.billingIntervalUnit ?? 'month';
    if (!isBillingIntervalUnit(billingIntervalUnit)) {
      throw new BadRequestException(`billingIntervalUnit must be one of day, week, month, year`);
    }
    const billingIntervalCount = input.billingIntervalCount ?? 1;
    if (!Number.isInteger(billingIntervalCount) || billingIntervalCount < 1) {
      throw new BadRequestException('billingIntervalCount must be a positive integer');
    }

    try {
      const saved = await this.plans.save(
        this.plans.create({
          code,
          name,
          description: input.description?.trim() || null,
          priceMinor: requirePositiveMinor(input.priceMinor),
          currencyCode: input.currencyCode ?? 'USD',
          billingIntervalUnit,
          billingIntervalCount,
          isActive: input.isActive ?? true,
        }),
      );
      return toPlanRecord(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Plan code "${code}" already exists`);
      }
      throw error;
    }
  }

  async findPlanById(id: string): Promise<SubscriptionPlanRecord> {
    const row = await this.plans.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Subscription plan ${id} not found`);
    }
    return toPlanRecord(row);
  }

  async findPlanByCode(code: string): Promise<SubscriptionPlanRecord> {
    const row = await this.plans.findOne({ where: { code: code.trim() } });
    if (!row) {
      throw new NotFoundException(`Subscription plan "${code}" not found`);
    }
    return toPlanRecord(row);
  }

  async listPlans(activeOnly?: boolean): Promise<SubscriptionPlanRecord[]> {
    const rows = await this.plans.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { code: 'ASC' },
    });
    return rows.map(toPlanRecord);
  }

  async findById(id: string): Promise<SubscriptionRecord> {
    const row = await this.subscriptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return toSubscriptionRecord(row);
  }

  async listForCustomer(customerId: string): Promise<SubscriptionRecord[]> {
    const rows = await this.subscriptions.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toSubscriptionRecord);
  }

  /** Create an active subscription for a customer against a plan (E-02). */
  async subscribe(input: SubscribeToPlanInput): Promise<SubscriptionRecord> {
    const customerId = input.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException('customerId is required');
    }

    const planRow = await this.plans.findOne({ where: { id: input.planId } });
    if (!planRow) {
      throw new NotFoundException(`Subscription plan ${input.planId} not found`);
    }
    if (!planRow.isActive) {
      throw new BadRequestException(`Plan ${input.planId} is not active`);
    }

    const now = new Date();
    const periodEnd = addBillingInterval(
      now,
      planRow.billingIntervalUnit,
      planRow.billingIntervalCount,
    );

    const saved = await this.subscriptions.save(
      this.subscriptions.create({
        planId: planRow.id,
        customerId,
        storeId: input.storeId?.trim() || null,
        status: 'active',
        paymentProviderCode: input.paymentProviderCode?.trim() || 'manual',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
        canceledAt: null,
      }),
    );

    return toSubscriptionRecord(saved);
  }

  async cancel(id: string): Promise<SubscriptionRecord> {
    const row = await this.subscriptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    if (row.status === 'canceled') {
      return toSubscriptionRecord(row);
    }
    row.status = 'canceled';
    row.canceledAt = new Date();
    const saved = await this.subscriptions.save(row);
    return toSubscriptionRecord(saved);
  }

  /** Subscriptions whose next billing date has arrived (renewal job path, E-03). */
  async findDueForRenewal(asOf: Date = new Date()): Promise<SubscriptionRecord[]> {
    const rows = await this.subscriptions.find({
      where: [
        { status: 'active', nextBillingAt: LessThanOrEqual(asOf) },
        { status: 'past_due', nextBillingAt: LessThanOrEqual(asOf) },
      ],
      order: { nextBillingAt: 'ASC' },
    });
    return rows.map(toSubscriptionRecord);
  }

  /**
   * Charge a subscription for its current billing period via the payment
   * engine and advance the schedule on success (E-03 renewal path).
   * Publishes `SubscriptionRenewed` only when the charge is captured.
   */
  async renew(
    id: string,
    options: RenewSubscriptionOptions = {},
  ): Promise<SubscriptionRenewalResult> {
    const row = await this.subscriptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    if (row.status === 'canceled' || row.status === 'expired') {
      throw new BadRequestException(`Cannot renew subscription in status "${row.status}"`);
    }

    const plan = await this.plans.findOne({ where: { id: row.planId } });
    if (!plan) {
      throw new NotFoundException(`Subscription plan ${row.planId} not found`);
    }

    const orderId = options.orderId?.trim() || randomUUID();
    const idempotencyKey = `subscription-renew:${row.id}:${row.nextBillingAt.toISOString()}`;
    const payment = await this.paymentEngine.authorize({
      providerCode: row.paymentProviderCode,
      orderId,
      amount: { amountMinor: plan.priceMinor, currencyCode: plan.currencyCode },
      idempotencyKey,
      metadata: {
        kind: 'subscription_renewal',
        subscriptionId: row.id,
        planId: plan.id,
      },
    });

    let charged = payment;
    if (payment.status === 'authorized' || payment.status === 'pending') {
      charged = await this.paymentEngine.capture({ paymentId: payment.id });
    }

    if (charged.status !== 'captured') {
      row.status = 'past_due';
      await this.subscriptions.save(row);
      return {
        subscription: toSubscriptionRecord(row),
        paymentId: charged.id,
        paymentStatus: charged.status,
      };
    }

    const periodStart = row.currentPeriodEnd;
    const periodEnd = addBillingInterval(
      periodStart,
      plan.billingIntervalUnit as BillingIntervalUnit,
      plan.billingIntervalCount,
    );
    row.currentPeriodStart = periodStart;
    row.currentPeriodEnd = periodEnd;
    row.nextBillingAt = periodEnd;
    row.status = 'active';
    const saved = await this.subscriptions.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.SubscriptionRenewed,
      aggregateType: 'subscription',
      aggregateId: saved.id,
      data: {
        subscriptionId: saved.id,
        planId: plan.id,
        customerId: saved.customerId,
        paymentId: charged.id,
        amountMinor: String(plan.priceMinor),
        currencyCode: plan.currencyCode,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        renewedAt: new Date().toISOString(),
      },
    });

    return {
      subscription: toSubscriptionRecord(saved),
      paymentId: charged.id,
      paymentStatus: charged.status,
    };
  }
}
