import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import {
  PaymentEntity,
  type PaymentStatus,
} from './entities/payment.entity';
import { PaymentWebhookEventEntity } from './entities/payment-webhook-event.entity';
import { PaymentProviderRegistry } from './payment-provider.registry';
import type {
  MoneyAmount,
  PaymentProvider,
  PaymentWebhookInput,
  PaymentWebhookResult,
} from './payment-provider';

export type ProcessWebhookResult = {
  ok: boolean;
  duplicate: boolean;
  result: PaymentWebhookResult;
};

export type AuthorizePaymentInput = {
  providerCode: string;
  orderId: string;
  amount: MoneyAmount;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type CapturePaymentInput = {
  paymentId: string;
  amount?: MoneyAmount;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type RefundPaymentInput = {
  paymentId: string;
  amount?: MoneyAmount;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Payment engine — provider registry + authorize/capture/refund orchestration.
 * Persists core `payments` rows; never imports concrete PSP SDKs.
 */
@Injectable()
export class PaymentEngine {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    @InjectRepository(PaymentEntity)
    private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(PaymentWebhookEventEntity)
    private readonly webhookEvents: Repository<PaymentWebhookEventEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  /** Register a provider (pluginId defaults to `core` for in-process stubs). */
  register(provider: PaymentProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): PaymentProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly PaymentProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }

  async findById(id: string): Promise<PaymentEntity> {
    const row = await this.payments.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    return row;
  }

  async findByOrderId(orderId: string): Promise<PaymentEntity[]> {
    return this.payments.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Create a payment row and call the provider authorize hook.
   * Idempotent when `idempotencyKey` matches an existing row.
   */
  async authorize(input: AuthorizePaymentInput): Promise<PaymentEntity> {
    const provider = this.requireProvider(input.providerCode);

    if (input.idempotencyKey) {
      const existing = await this.payments.findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const amountMinor = this.requireNonNegativeMinor(input.amount.amountMinor);
    let row = this.payments.create({
      orderId: input.orderId,
      providerCode: input.providerCode,
      status: 'pending',
      amountMinor,
      currencyCode: input.amount.currencyCode,
      externalId: null,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: input.metadata ?? null,
      errorMessage: null,
      authorizedAt: null,
      capturedAt: null,
      refundedAt: null,
      failedAt: null,
    });
    row = await this.payments.save(row);

    const result = await provider.authorize({
      paymentId: row.id,
      orderId: input.orderId,
      amount: {
        amountMinor,
        currencyCode: input.amount.currencyCode,
      },
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    return this.applyAuthorizeResult(row, result.status, result);
  }

  /** Capture a previously authorized (or pending) payment via the provider. */
  async capture(input: CapturePaymentInput): Promise<PaymentEntity> {
    const row = await this.findById(input.paymentId);
    if (row.status === 'captured') {
      return row;
    }
    if (row.status !== 'authorized' && row.status !== 'pending') {
      throw new BadRequestException(
        `Cannot capture payment in status "${row.status}"`,
      );
    }

    const provider = this.requireProvider(row.providerCode);
    const amount: MoneyAmount = input.amount ?? {
      amountMinor: String(row.amountMinor),
      currencyCode: row.currencyCode,
    };
    this.requireNonNegativeMinor(amount.amountMinor);

    const result = await provider.capture({
      paymentId: row.id,
      orderId: row.orderId,
      amount,
      externalId: row.externalId ?? undefined,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    if (result.status === 'failed') {
      row.status = 'failed';
      row.errorMessage = result.errorMessage ?? 'Capture failed';
      row.failedAt = new Date();
      if (result.externalId) {
        row.externalId = result.externalId;
      }
      const saved = await this.payments.save(row);
      await this.publishFailed(saved);
      return saved;
    }

    if (result.status === 'pending') {
      if (result.externalId) {
        row.externalId = result.externalId;
      }
      return this.payments.save(row);
    }

    row.status = 'captured';
    row.capturedAt = new Date();
    if (!row.authorizedAt) {
      row.authorizedAt = row.capturedAt;
    }
    if (result.externalId) {
      row.externalId = result.externalId;
    }
    row.errorMessage = null;
    const saved = await this.payments.save(row);
    await this.publishCaptured(saved);
    return saved;
  }

  /** Refund a captured payment (full or partial amount). */
  async refund(input: RefundPaymentInput): Promise<PaymentEntity> {
    const row = await this.findById(input.paymentId);
    if (row.status === 'refunded') {
      return row;
    }
    if (row.status !== 'captured') {
      throw new BadRequestException(
        `Cannot refund payment in status "${row.status}"`,
      );
    }

    const provider = this.requireProvider(row.providerCode);
    const amount: MoneyAmount = input.amount ?? {
      amountMinor: String(row.amountMinor),
      currencyCode: row.currencyCode,
    };
    this.requireNonNegativeMinor(amount.amountMinor);

    const result = await provider.refund({
      paymentId: row.id,
      orderId: row.orderId,
      amount,
      externalId: row.externalId ?? undefined,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    if (result.status === 'failed') {
      row.errorMessage = result.errorMessage ?? 'Refund failed';
      return this.payments.save(row);
    }

    if (result.status === 'pending') {
      if (result.externalId) {
        row.externalId = result.externalId;
      }
      return this.payments.save(row);
    }

    row.status = 'refunded';
    row.refundedAt = new Date();
    if (result.externalId) {
      row.externalId = result.externalId;
    }
    row.errorMessage = null;
    const saved = await this.payments.save(row);
    await this.publishRefunded(saved);
    return saved;
  }

  /** Delegate webhook payload to the named provider (no persistence). */
  async handleWebhook(
    providerCode: string,
    input: PaymentWebhookInput,
  ): Promise<PaymentWebhookResult> {
    const provider = this.requireProvider(providerCode);
    if (!provider.handleWebhook) {
      return { handled: false, action: 'ignore' };
    }
    return provider.handleWebhook(input);
  }

  /**
   * Ingress entrypoint: provider parse + idempotent apply by external event id.
   * Duplicate (providerCode, externalEventId) returns prior result without re-applying.
   */
  async processWebhook(
    providerCode: string,
    input: PaymentWebhookInput,
  ): Promise<ProcessWebhookResult> {
    const provider = this.requireProvider(providerCode);
    if (!provider.handleWebhook) {
      return {
        ok: true,
        duplicate: false,
        result: { handled: false, action: 'ignore' },
      };
    }

    const result = await provider.handleWebhook(input);
    const externalEventId = result.externalEventId?.trim();

    if (!externalEventId) {
      await this.applyWebhookAction(providerCode, result);
      return { ok: true, duplicate: false, result };
    }

    const existing = await this.webhookEvents.findOne({
      where: { providerCode, externalEventId },
    });
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        result: {
          handled: existing.status === 'processed' || existing.status === 'ignored',
          externalEventId,
          paymentExternalId: result.paymentExternalId,
          action: (existing.action as PaymentWebhookResult['action']) ?? 'ignore',
        },
      };
    }

    let paymentId: string | null = null;
    let status: PaymentWebhookEventEntity['status'] = 'processed';
    let errorMessage: string | null = null;

    try {
      paymentId = await this.applyWebhookAction(providerCode, result);
      if (!result.handled || result.action === 'ignore') {
        status = 'ignored';
      }
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Webhook apply failed';
    }

    try {
      await this.webhookEvents.save(
        this.webhookEvents.create({
          providerCode,
          externalEventId,
          paymentId,
          status,
          action: result.action ?? null,
          payload: input.body ?? null,
          errorMessage,
          processedAt: new Date(),
        }),
      );
    } catch {
      // Concurrent insert raced on unique (provider, event) — treat as duplicate.
      const raced = await this.webhookEvents.findOne({
        where: { providerCode, externalEventId },
      });
      if (raced) {
        return {
          ok: true,
          duplicate: true,
          result: {
            handled:
              raced.status === 'processed' || raced.status === 'ignored',
            externalEventId,
            paymentExternalId: result.paymentExternalId,
            action:
              (raced.action as PaymentWebhookResult['action']) ?? 'ignore',
          },
        };
      }
      throw new BadRequestException('Failed to persist webhook event');
    }

    return {
      ok: status !== 'failed',
      duplicate: false,
      result,
    };
  }

  /** Apply provider-reported webhook action onto a matching payment row. */
  private async applyWebhookAction(
    providerCode: string,
    result: PaymentWebhookResult,
  ): Promise<string | null> {
    if (!result.handled || !result.action || result.action === 'ignore') {
      return null;
    }

    const externalId = result.paymentExternalId;
    if (!externalId) {
      return null;
    }

    const payment = await this.payments.findOne({
      where: { providerCode, externalId },
    });
    if (!payment) {
      return null;
    }

    if (result.action === 'capture' && payment.status !== 'captured') {
      await this.capture({ paymentId: payment.id });
    } else if (result.action === 'refund' && payment.status === 'captured') {
      await this.refund({ paymentId: payment.id });
    } else if (result.action === 'fail' && payment.status !== 'failed') {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.errorMessage = 'Failed via provider webhook';
      const saved = await this.payments.save(payment);
      await this.publishFailed(saved);
    } else if (
      result.action === 'authorize' &&
      payment.status === 'pending'
    ) {
      payment.status = 'authorized';
      payment.authorizedAt = new Date();
      const saved = await this.payments.save(payment);
      await this.publishAuthorized(saved);
    }

    return payment.id;
  }

  private requireProvider(code: string): PaymentProvider {
    const provider = this.registry.get(code);
    if (!provider) {
      throw new BadRequestException(
        `Payment provider "${code}" is not registered or inactive`,
      );
    }
    return provider;
  }

  private requireNonNegativeMinor(amountMinor: string): string {
    let value: bigint;
    try {
      value = BigInt(amountMinor);
    } catch {
      throw new BadRequestException('amountMinor must be an integer string');
    }
    if (value < 0n) {
      throw new BadRequestException('amountMinor must be >= 0');
    }
    return value.toString();
  }

  private async applyAuthorizeResult(
    row: PaymentEntity,
    status: PaymentAuthorizeResultStatus,
    result: {
      externalId?: string;
      errorMessage?: string;
    },
  ): Promise<PaymentEntity> {
    const now = new Date();
    if (result.externalId) {
      row.externalId = result.externalId;
    }

    if (status === 'failed') {
      row.status = 'failed';
      row.errorMessage = result.errorMessage ?? 'Authorization failed';
      row.failedAt = now;
      const saved = await this.payments.save(row);
      await this.publishFailed(saved);
      return saved;
    }

    if (status === 'pending') {
      row.status = 'pending';
      return this.payments.save(row);
    }

    if (status === 'captured') {
      row.status = 'captured';
      row.authorizedAt = now;
      row.capturedAt = now;
      row.errorMessage = null;
      const saved = await this.payments.save(row);
      await this.publishAuthorized(saved);
      await this.publishCaptured(saved);
      return saved;
    }

    row.status = 'authorized';
    row.authorizedAt = now;
    row.errorMessage = null;
    const saved = await this.payments.save(row);
    await this.publishAuthorized(saved);
    return saved;
  }

  private paymentEventData(payment: PaymentEntity) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      providerCode: payment.providerCode,
      amountMinor: String(payment.amountMinor),
      currencyCode: payment.currencyCode,
      externalId: payment.externalId,
    };
  }

  private async publishAuthorized(payment: PaymentEntity): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.PaymentAuthorized,
      aggregateType: 'payment',
      aggregateId: payment.id,
      data: this.paymentEventData(payment),
    });
  }

  private async publishCaptured(payment: PaymentEntity): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: payment.id,
      data: this.paymentEventData(payment),
    });
  }

  private async publishRefunded(payment: PaymentEntity): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.PaymentRefunded,
      aggregateType: 'payment',
      aggregateId: payment.id,
      data: this.paymentEventData(payment),
    });
  }

  private async publishFailed(payment: PaymentEntity): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.PaymentFailed,
      aggregateType: 'payment',
      aggregateId: payment.id,
      data: {
        ...this.paymentEventData(payment),
        errorMessage: payment.errorMessage,
      },
    });
  }
}

type PaymentAuthorizeResultStatus =
  | 'authorized'
  | 'captured'
  | 'pending'
  | 'failed';

/** Map entity to a plain DTO if needed by callers. */
export type PaymentRecord = {
  id: string;
  orderId: string;
  providerCode: string;
  status: PaymentStatus;
  amountMinor: string;
  currencyCode: string;
  externalId: string | null;
};
