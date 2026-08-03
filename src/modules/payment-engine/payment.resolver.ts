import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentEngine } from './payment-engine.service';
import {
  AuthorizePaymentInput,
  CapturePaymentInput,
  PaymentProviderType,
  PaymentType,
  RefundPaymentInput,
} from './payment.types';

function toPaymentType(row: PaymentEntity): PaymentType {
  return {
    id: row.id,
    orderId: row.orderId,
    providerCode: row.providerCode,
    status: row.status,
    amountMinor: String(row.amountMinor),
    currencyCode: row.currencyCode,
    externalId: row.externalId,
    idempotencyKey: row.idempotencyKey,
    metadataJson: row.metadata ? JSON.stringify(row.metadata) : null,
    errorMessage: row.errorMessage,
    authorizedAt: row.authorizedAt,
    capturedAt: row.capturedAt,
    refundedAt: row.refundedAt,
    failedAt: row.failedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseMetadataJson(
  metadataJson: string | undefined,
): Record<string, unknown> | undefined {
  if (!metadataJson) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadataJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('metadataJson must encode a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException('metadataJson must be a valid JSON object string');
  }
}

@Resolver(() => PaymentType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class PaymentResolver {
  constructor(private readonly payments: PaymentEngine) {}

  @Query(() => PaymentType, {
    name: 'payment',
    description: 'Get payment by id',
  })
  @RequirePermission('payment:read')
  async payment(@Args('id', { type: () => ID }) id: string): Promise<PaymentType> {
    const row = await this.payments.findById(id);
    return toPaymentType(row);
  }

  @Query(() => [PaymentType], {
    name: 'paymentsByOrder',
    description: 'List payments for an order (oldest first)',
  })
  @RequirePermission('payment:read')
  async paymentsByOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<PaymentType[]> {
    const rows = await this.payments.findByOrderId(orderId);
    return rows.map(toPaymentType);
  }

  @Query(() => [PaymentProviderType], {
    name: 'paymentProviders',
    description: 'List active registered payment providers',
  })
  @RequirePermission('payment:read')
  paymentProviders(): PaymentProviderType[] {
    return this.payments.list().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
    }));
  }

  @Mutation(() => PaymentType, {
    name: 'authorizePayment',
    description: 'Authorize a new payment against an order via the payment engine',
  })
  @RequirePermission('payment:authorize')
  async authorizePayment(
    @Args('input') input: AuthorizePaymentInput,
  ): Promise<PaymentType> {
    const row = await this.payments.authorize({
      providerCode: input.providerCode,
      orderId: input.orderId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      metadata: parseMetadataJson(input.metadataJson),
    });
    return toPaymentType(row);
  }

  @Mutation(() => PaymentType, {
    name: 'capturePayment',
    description: 'Capture a previously authorized (or pending) payment',
  })
  @RequirePermission('payment:capture')
  async capturePayment(
    @Args('input') input: CapturePaymentInput,
  ): Promise<PaymentType> {
    const row = await this.payments.capture({
      paymentId: input.paymentId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    });
    return toPaymentType(row);
  }

  @Mutation(() => PaymentType, {
    name: 'refundPayment',
    description: 'Refund a captured payment (full or partial amount)',
  })
  @RequirePermission('payment:refund')
  async refundPayment(
    @Args('input') input: RefundPaymentInput,
  ): Promise<PaymentType> {
    const row = await this.payments.refund({
      paymentId: input.paymentId,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    });
    return toPaymentType(row);
  }
}
