import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GiftCardTransactionEntity } from './entities/gift-card-transaction.entity';
import { GiftCardEntity } from './entities/gift-card.entity';
import { GiftCardService } from './gift-cards.service';
import type { GiftCardStatus } from './gift-card-status';

type CardRow = {
  id: string;
  code: string;
  currencyCode: string;
  initialBalanceMinor: string;
  balanceMinor: string;
  status: GiftCardStatus;
  issuedToCustomerId: string | null;
  purchasedByCustomerId: string | null;
  purchaseOrderId: string | null;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TxRow = {
  id: string;
  giftCardId: string;
  type: string;
  amountMinor: string;
  balanceAfterMinor: string;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
};

describe('GiftCardService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  let cardStore: CardRow[];
  let txStore: TxRow[];
  let service: GiftCardService;
  let cardsRepo: {
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let txRepo: {
    find: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    cardStore = [];
    txStore = [];

    cardsRepo = {
      findOne: vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
        const row = cardStore.find(
          (c) =>
            (where.id && c.id === where.id) ||
            (where.code && c.code === where.code),
        );
        return row ? Object.assign(new GiftCardEntity(), row) : null;
      }),
      update: vi.fn(async (where: { id: string }, patch: Partial<CardRow>) => {
        const row = cardStore.find((c) => c.id === where.id);
        if (row) Object.assign(row, patch);
      }),
    };

    txRepo = {
      find: vi.fn(async ({ where }: { where: { giftCardId: string } }) =>
        txStore
          .filter((t) => t.giftCardId === where.giftCardId)
          .map((t) => Object.assign(new GiftCardTransactionEntity(), t)),
      ),
      update: vi.fn(
        async (
          where: { giftCardId: string; type: string },
          patch: Partial<TxRow>,
        ) => {
          for (const t of txStore) {
            if (t.giftCardId === where.giftCardId && t.type === where.type) {
              Object.assign(t, patch);
            }
          }
        },
      ),
    };

    const dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          findOne: async (
            _entity: unknown,
            opts: { where: { code: string } },
          ) => {
            const row = cardStore.find((c) => c.code === opts.where.code);
            return row ? Object.assign(new GiftCardEntity(), row) : null;
          },
          create: (_entity: unknown, data: Record<string, unknown>) => data,
          save: async (row: Record<string, unknown>) => {
            if ('code' in row && 'balanceMinor' in row) {
              const existing = cardStore.find((c) => c.id === row.id);
              if (existing) {
                Object.assign(existing, row);
                return Object.assign(new GiftCardEntity(), existing);
              }
              const created: CardRow = {
                id: (row.id as string) ?? `gc-${cardStore.length + 1}`,
                code: String(row.code),
                currencyCode: String(row.currencyCode),
                initialBalanceMinor: String(row.initialBalanceMinor),
                balanceMinor: String(row.balanceMinor),
                status: (row.status as GiftCardStatus) ?? 'active',
                issuedToCustomerId:
                  (row.issuedToCustomerId as string | null) ?? null,
                purchasedByCustomerId:
                  (row.purchasedByCustomerId as string | null) ?? null,
                purchaseOrderId:
                  (row.purchaseOrderId as string | null) ?? null,
                expiresAt: (row.expiresAt as Date | null) ?? null,
                note: (row.note as string | null) ?? null,
                createdAt: now,
                updatedAt: now,
              };
              cardStore.push(created);
              return Object.assign(new GiftCardEntity(), created);
            }
            const tx: TxRow = {
              id: `tx-${txStore.length + 1}`,
              giftCardId: String(row.giftCardId),
              type: String(row.type),
              amountMinor: String(row.amountMinor),
              balanceAfterMinor: String(row.balanceAfterMinor),
              orderId: (row.orderId as string | null) ?? null,
              note: (row.note as string | null) ?? null,
              createdAt: now,
            };
            txStore.push(tx);
            return Object.assign(new GiftCardTransactionEntity(), tx);
          },
          getRepository: () => ({
            createQueryBuilder: () => {
              const qb = {
                setLock: () => qb,
                where: (_sql: string, params: { code: string }) => {
                  (qb as { _code?: string })._code = params.code;
                  return qb;
                },
                getOne: async () => {
                  const code = (qb as { _code?: string })._code;
                  const row = cardStore.find((c) => c.code === code);
                  return row ? Object.assign(new GiftCardEntity(), row) : null;
                },
              };
              return qb;
            },
          }),
        };
        return fn(manager);
      }),
    };

    service = new GiftCardService(
      cardsRepo as never,
      txRepo as never,
      dataSource as never,
    );
  });

  it('issues a gift card with ledger credit', async () => {
    const card = await service.issue({
      currencyCode: 'usd',
      amountMinor: '5000',
      code: 'gift-abc',
    });

    expect(card.code).toBe('GIFT-ABC');
    expect(card.balanceMinor).toBe('5000');
    expect(card.status).toBe('active');
    expect(txStore).toHaveLength(1);
    expect(txStore[0]?.type).toBe('issue');
    expect(txStore[0]?.amountMinor).toBe('5000');
  });

  it('purchases a card linked to an order', async () => {
    const card = await service.purchase({
      orderId: 'order-1',
      currencyCode: 'USD',
      amountMinor: '2500',
      code: 'BUY-1',
      customerId: 'cust-1',
    });

    expect(card.purchaseOrderId).toBe('order-1');
    expect(card.purchasedByCustomerId).toBe('cust-1');
    expect(txStore[0]?.type).toBe('purchase');
    expect(txStore[0]?.orderId).toBe('order-1');
  });

  it('quotes redeem capped by max and balance', async () => {
    cardStore.push({
      id: 'gc-1',
      code: 'GC-1',
      currencyCode: 'USD',
      initialBalanceMinor: '1000',
      balanceMinor: '1000',
      status: 'active',
      issuedToCustomerId: null,
      purchasedByCustomerId: null,
      purchaseOrderId: null,
      expiresAt: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    });

    const quote = await service.quoteRedeem({
      code: 'gc-1',
      currencyCode: 'USD',
      maxAmountMinor: '400',
    });
    expect(quote.appliedMinor).toBe('400');
    expect(quote.availableMinor).toBe('1000');

    const quote2 = await service.quoteRedeem({
      code: 'gc-1',
      currencyCode: 'USD',
      maxAmountMinor: '5000',
    });
    expect(quote2.appliedMinor).toBe('1000');
  });

  it('redeems and marks card redeemed when balance hits zero', async () => {
    cardStore.push({
      id: 'gc-1',
      code: 'GC-1',
      currencyCode: 'USD',
      initialBalanceMinor: '1000',
      balanceMinor: '1000',
      status: 'active',
      issuedToCustomerId: null,
      purchasedByCustomerId: null,
      purchaseOrderId: null,
      expiresAt: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    });

    const card = await service.redeem({
      code: 'gc-1',
      amountMinor: '1000',
      orderId: 'order-9',
    });
    expect(card.balanceMinor).toBe('0');
    expect(card.status).toBe('redeemed');
    expect(txStore[0]?.type).toBe('redeem');
    expect(txStore[0]?.amountMinor).toBe('-1000');
    expect(txStore[0]?.orderId).toBe('order-9');
  });

  it('rejects over-redeem and missing cards', async () => {
    cardStore.push({
      id: 'gc-1',
      code: 'GC-1',
      currencyCode: 'USD',
      initialBalanceMinor: '100',
      balanceMinor: '100',
      status: 'active',
      issuedToCustomerId: null,
      purchasedByCustomerId: null,
      purchaseOrderId: null,
      expiresAt: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.redeem({ code: 'gc-1', amountMinor: '200' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.findByCode('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects currency mismatch on quote', async () => {
    cardStore.push({
      id: 'gc-1',
      code: 'GC-1',
      currencyCode: 'THB',
      initialBalanceMinor: '100',
      balanceMinor: '100',
      status: 'active',
      issuedToCustomerId: null,
      purchasedByCustomerId: null,
      purchaseOrderId: null,
      expiresAt: null,
      note: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.quoteRedeem({
        code: 'GC-1',
        currencyCode: 'USD',
        maxAmountMinor: '50',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
