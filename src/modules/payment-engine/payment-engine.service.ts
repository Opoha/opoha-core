import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PaymentEntity,
  type PaymentStatus,
} from './entities/payment.entity';
import { PaymentProviderRegistry } from './payment-provider.registry';
import type {
  MoneyAmount,
  PaymentProvider,
  PaymentWebhookInput,
  PaymentWebhookResult,
} from './payment-provider';

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
      return this.payments.save(row);
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
    return this.payments.save(row);
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
    return this.payments.save(row);
  }

  /** Delegate webhook payload to the named provider (idempotency in A-05). */
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
      return this.payments.save(row);
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
      return this.payments.save(row);
    }

    row.status = 'authorized';
    row.authorizedAt = now;
    row.errorMessage = null;
    return this.payments.save(row);
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
