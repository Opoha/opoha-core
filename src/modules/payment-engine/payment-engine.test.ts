import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaymentStatus } from './entities/payment.entity';
import { PaymentEngine } from './payment-engine.service';
import type { PaymentProvider } from './payment-provider';
import { PaymentProviderRegistry } from './payment-provider.registry';

type PaymentRow = {
  id: string;
  orderId: string;
  providerCode: string;
  status: PaymentStatus;
  amountMinor: string;
  currencyCode: string;
  externalId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  errorMessage: string | null;
  authorizedAt: Date | null;
  capturedAt: Date | null;
  refundedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type WebhookEventRow = {
  id: string;
  providerCode: string;
  externalEventId: string;
  paymentId: string | null;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  action: string | null;
  payload: unknown | null;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
};

function stubManualProvider(
  overrides?: Partial<PaymentProvider>,
): PaymentProvider {
  return {
    code: 'manual',
    displayName: 'Manual',
    async authorize() {
      return { status: 'authorized', externalId: 'manual-auth-1' };
    },
    async capture() {
      return { status: 'captured', externalId: 'manual-cap-1' };
    },
    async refund() {
      return { status: 'refunded', externalId: 'manual-ref-1' };
    },
    ...overrides,
  };
}

describe('PaymentEngine', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let store: PaymentRow[];
  let webhookStore: WebhookEventRow[];
  let paymentsRepo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let webhookEventsRepo: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let engine: PaymentEngine;
  let registry: PaymentProviderRegistry;

  beforeEach(() => {
    store = [];
    webhookStore = [];
    let seq = 0;
    let whSeq = 0;
    paymentsRepo = {
      findOne: vi.fn(async ({ where }: { where: Partial<PaymentRow> }) => {
        if (where.id) {
          return store.find((r) => r.id === where.id) ?? null;
        }
        if (where.idempotencyKey) {
          return (
            store.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null
          );
        }
        if (where.providerCode && where.externalId) {
          return (
            store.find(
              (r) =>
                r.providerCode === where.providerCode &&
                r.externalId === where.externalId,
            ) ?? null
          );
        }
        return null;
      }),
      find: vi.fn(async ({ where }: { where: { orderId: string } }) =>
        store.filter((r) => r.orderId === where.orderId),
      ),
      create: vi.fn((data: Partial<PaymentRow>) => ({
        id: `pay-${++seq}`,
        status: 'pending' as const,
        externalId: null,
        idempotencyKey: null,
        metadata: null,
        errorMessage: null,
        authorizedAt: null,
        capturedAt: null,
        refundedAt: null,
        failedAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: PaymentRow) => {
        const idx = store.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          store[idx] = { ...row, updatedAt: now };
          return store[idx]!;
        }
        store.push({ ...row });
        return row;
      }),
    };

    webhookEventsRepo = {
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: { providerCode: string; externalEventId: string };
        }) =>
          webhookStore.find(
            (r) =>
              r.providerCode === where.providerCode &&
              r.externalEventId === where.externalEventId,
          ) ?? null,
      ),
      create: vi.fn((data: Partial<WebhookEventRow>) => ({
        id: `wh-${++whSeq}`,
        paymentId: null,
        status: 'received' as const,
        action: null,
        payload: null,
        errorMessage: null,
        createdAt: now,
        processedAt: null,
        ...data,
      })),
      save: vi.fn(async (row: WebhookEventRow) => {
        webhookStore.push({ ...row });
        return row;
      }),
    };

    registry = new PaymentProviderRegistry();
    registry.register('manual-payment', stubManualProvider());
    engine = new PaymentEngine(
      registry,
      paymentsRepo as never,
      webhookEventsRepo as never,
    );
  });

  it('register / get / list providers by code', () => {
    expect(engine.get('manual')?.displayName).toBe('Manual');
    expect(engine.list()).toHaveLength(1);
  });

  it('rejects duplicate codes from different plugins', () => {
    expect(() =>
      registry.register('other', stubManualProvider({ displayName: 'B' })),
    ).toThrow(/conflict/);
  });

  it('deactivates and removes by plugin', () => {
    registry.deactivatePlugin('manual-payment');
    expect(engine.get('manual')).toBeUndefined();
    registry.activatePlugin('manual-payment');
    expect(engine.get('manual')).toBeDefined();
    registry.removePlugin('manual-payment');
    expect(registry.list()).toHaveLength(0);
  });

  it('authorize persists payment and marks authorized', async () => {
    const payment = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-1',
      amount: { amountMinor: '1500', currencyCode: 'USD' },
      idempotencyKey: 'idem-1',
    });

    expect(payment.id).toBe('pay-1');
    expect(payment.status).toBe('authorized');
    expect(payment.externalId).toBe('manual-auth-1');
    expect(payment.amountMinor).toBe('1500');
    expect(store).toHaveLength(1);
  });

  it('authorize is idempotent on idempotencyKey', async () => {
    const first = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-1',
      amount: { amountMinor: '100', currencyCode: 'USD' },
      idempotencyKey: 'same-key',
    });
    const second = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-1',
      amount: { amountMinor: '100', currencyCode: 'USD' },
      idempotencyKey: 'same-key',
    });
    expect(second.id).toBe(first.id);
    expect(store).toHaveLength(1);
  });

  it('authorize → capture → refund happy path', async () => {
    const authorized = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-2',
      amount: { amountMinor: '2000', currencyCode: 'USD' },
    });
    expect(authorized.status).toBe('authorized');

    const captured = await engine.capture({ paymentId: authorized.id });
    expect(captured.status).toBe('captured');
    expect(captured.capturedAt).toBeTruthy();

    const refunded = await engine.refund({ paymentId: authorized.id });
    expect(refunded.status).toBe('refunded');
    expect(refunded.refundedAt).toBeTruthy();
  });

  it('authorize can go straight to captured (manual auto-capture style)', async () => {
    registry.removePlugin('manual-payment');
    registry.register(
      'manual-payment',
      stubManualProvider({
        async authorize() {
          return { status: 'captured', externalId: 'auto-cap' };
        },
      }),
    );

    const payment = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-3',
      amount: { amountMinor: '0', currencyCode: 'USD' },
    });
    expect(payment.status).toBe('captured');
    expect(payment.externalId).toBe('auto-cap');
  });

  it('rejects unknown provider', async () => {
    await expect(
      engine.authorize({
        providerCode: 'stripe',
        orderId: 'order-x',
        amount: { amountMinor: '1', currencyCode: 'USD' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects capture when status is failed', async () => {
    store.push({
      id: 'pay-fail',
      orderId: 'order-f',
      providerCode: 'manual',
      status: 'failed',
      amountMinor: '100',
      currencyCode: 'USD',
      externalId: null,
      idempotencyKey: null,
      metadata: null,
      errorMessage: 'nope',
      authorizedAt: null,
      capturedAt: null,
      refundedAt: null,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      engine.capture({ paymentId: 'pay-fail' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handleWebhook returns ignore when provider has no handler', async () => {
    const result = await engine.handleWebhook('manual', {
      headers: {},
      body: {},
    });
    expect(result).toEqual({ handled: false, action: 'ignore' });
  });

  it('processWebhook is idempotent by externalEventId', async () => {
    registry.removePlugin('manual-payment');
    registry.register(
      'manual-payment',
      stubManualProvider({
        async handleWebhook() {
          return {
            handled: true,
            externalEventId: 'evt-1',
            paymentExternalId: 'manual-auth-1',
            action: 'capture',
          };
        },
      }),
    );

    const authorized = await engine.authorize({
      providerCode: 'manual',
      orderId: 'order-wh',
      amount: { amountMinor: '500', currencyCode: 'USD' },
    });
    expect(authorized.externalId).toBe('manual-auth-1');

    const first = await engine.processWebhook('manual', {
      headers: {},
      body: { id: 'evt-1' },
    });
    expect(first.duplicate).toBe(false);
    expect(first.ok).toBe(true);
    expect(webhookStore).toHaveLength(1);

    const payment = await engine.findById(authorized.id);
    expect(payment.status).toBe('captured');

    const second = await engine.processWebhook('manual', {
      headers: {},
      body: { id: 'evt-1' },
    });
    expect(second.duplicate).toBe(true);
    expect(webhookStore).toHaveLength(1);
  });
});
