import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { LoyaltyAccountEntity } from './entities/loyalty-account.entity';
import { LoyaltyTransactionEntity } from './entities/loyalty-transaction.entity';
import { LoyaltyService } from './loyalty.service';
import { loyaltyEventSchemas } from './events/loyalty-events';

type AccountRow = {
  id: string;
  customerId: string;
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  createdAt: Date;
  updatedAt: Date;
};

type TxRow = {
  id: string;
  accountId: string;
  customerId: string;
  type: string;
  points: number;
  balanceAfter: number;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
};

describe('LoyaltyService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  const customerId = '11111111-1111-4111-8111-111111111111';
  const orderId = '22222222-2222-4222-8222-222222222222';

  let accountStore: AccountRow[];
  let txStore: TxRow[];
  let service: LoyaltyService;
  let eventBus: EventBusService;
  let published: Array<{ eventName: string; data: Record<string, unknown> }>;

  beforeEach(() => {
    accountStore = [];
    txStore = [];
    published = [];

    eventBus = new EventBusService();
    for (const { eventName, schema } of loyaltyEventSchemas()) {
      eventBus.registerSchema(eventName, schema);
    }
    eventBus.subscribe(CoreEventName.LoyaltyPointsAccrued, (e) => {
      published.push({ eventName: e.eventName, data: e.data as never });
    });
    eventBus.subscribe(CoreEventName.LoyaltyPointsRedeemed, (e) => {
      published.push({ eventName: e.eventName, data: e.data as never });
    });

    const accountsRepo = {
      findOne: vi.fn(async ({ where }: { where: { customerId?: string; id?: string } }) => {
        const row = accountStore.find(
          (a) =>
            (where.customerId && a.customerId === where.customerId) ||
            (where.id && a.id === where.id),
        );
        return row ? Object.assign(new LoyaltyAccountEntity(), row) : null;
      }),
      create: vi.fn((_data: Partial<AccountRow>) => _data),
      save: vi.fn(async (row: Partial<AccountRow>) => {
        const existing = accountStore.find((a) => a.id === row.id);
        if (existing) {
          Object.assign(existing, row);
          return Object.assign(new LoyaltyAccountEntity(), existing);
        }
        const created: AccountRow = {
          id:
            (row.id as string) ??
            `aaaaaaaa-aaaa-4aaa-8aaa-${String(accountStore.length + 1).padStart(12, '0')}`,
          customerId: String(row.customerId),
          pointsBalance: row.pointsBalance ?? 0,
          lifetimePointsEarned: row.lifetimePointsEarned ?? 0,
          lifetimePointsRedeemed: row.lifetimePointsRedeemed ?? 0,
          createdAt: now,
          updatedAt: now,
        };
        accountStore.push(created);
        return Object.assign(new LoyaltyAccountEntity(), created);
      }),
    };

    const txRepo = {
      find: vi.fn(async ({ where }: { where: { customerId: string } }) =>
        txStore
          .filter((t) => t.customerId === where.customerId)
          .map((t) => Object.assign(new LoyaltyTransactionEntity(), t)),
      ),
    };

    const dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          findOne: async (
            entity: unknown,
            opts: { where: Record<string, unknown> },
          ) => {
            if (entity === LoyaltyTransactionEntity) {
              const row = txStore.find(
                (t) =>
                  t.orderId === opts.where.orderId &&
                  t.type === opts.where.type,
              );
              return row
                ? Object.assign(new LoyaltyTransactionEntity(), row)
                : null;
            }
            if (entity === LoyaltyAccountEntity) {
              const row = accountStore.find((a) => a.id === opts.where.id);
              return row
                ? Object.assign(new LoyaltyAccountEntity(), row)
                : null;
            }
            return null;
          },
          create: (_entity: unknown, data: Record<string, unknown>) => data,
          save: async (row: Record<string, unknown>) => {
            if ('pointsBalance' in row) {
              const existing = accountStore.find((a) => a.id === row.id);
              if (existing) {
                Object.assign(existing, row);
                return Object.assign(new LoyaltyAccountEntity(), existing);
              }
              const created: AccountRow = {
                id:
                  (row.id as string) ??
                  `aaaaaaaa-aaaa-4aaa-8aaa-${String(accountStore.length + 1).padStart(12, '0')}`,
                customerId: String(row.customerId),
                pointsBalance: Number(row.pointsBalance ?? 0),
                lifetimePointsEarned: Number(row.lifetimePointsEarned ?? 0),
                lifetimePointsRedeemed: Number(
                  row.lifetimePointsRedeemed ?? 0,
                ),
                createdAt: now,
                updatedAt: now,
              };
              accountStore.push(created);
              return Object.assign(new LoyaltyAccountEntity(), created);
            }
            const tx: TxRow = {
              id: `tx-${txStore.length + 1}`,
              accountId: String(row.accountId),
              customerId: String(row.customerId),
              type: String(row.type),
              points: Number(row.points),
              balanceAfter: Number(row.balanceAfter),
              orderId: (row.orderId as string | null) ?? null,
              note: (row.note as string | null) ?? null,
              createdAt: now,
            };
            txStore.push(tx);
            return Object.assign(new LoyaltyTransactionEntity(), tx);
          },
          getRepository: () => ({
            createQueryBuilder: () => {
              const qb = {
                setLock: () => qb,
                where: (_sql: string, params: { customerId: string }) => {
                  (qb as { _customerId?: string })._customerId =
                    params.customerId;
                  return qb;
                },
                getOne: async () => {
                  const id = (qb as { _customerId?: string })._customerId;
                  const row = accountStore.find((a) => a.customerId === id);
                  return row
                    ? Object.assign(new LoyaltyAccountEntity(), row)
                    : null;
                },
              };
              return qb;
            },
          }),
        };
        return fn(manager);
      }),
    };

    service = new LoyaltyService(
      accountsRepo as never,
      txRepo as never,
      dataSource as never,
      eventBus,
    );
  });

  it('accrues points and emits LoyaltyPointsAccrued', async () => {
    const account = await service.accrue({
      customerId,
      points: 50,
      orderId,
    });

    expect(account.pointsBalance).toBe(50);
    expect(account.lifetimePointsEarned).toBe(50);
    expect(txStore).toHaveLength(1);
    expect(txStore[0]?.type).toBe('accrue');
    expect(txStore[0]?.points).toBe(50);
    expect(published).toHaveLength(1);
    expect(published[0]?.eventName).toBe(CoreEventName.LoyaltyPointsAccrued);
  });

  it('is idempotent for accrue on the same orderId', async () => {
    await service.accrue({ customerId, points: 50, orderId });
    const second = await service.accrue({
      customerId,
      points: 99,
      orderId,
    });

    expect(second.pointsBalance).toBe(50);
    expect(txStore).toHaveLength(1);
    expect(published).toHaveLength(1);
  });

  it('redeems points and emits LoyaltyPointsRedeemed', async () => {
    await service.accrue({ customerId, points: 100, orderId });
    published.length = 0;

    const account = await service.redeem({
      customerId,
      points: 40,
      orderId: '33333333-3333-4333-8333-333333333333',
    });

    expect(account.pointsBalance).toBe(60);
    expect(account.lifetimePointsRedeemed).toBe(40);
    expect(published[0]?.eventName).toBe(CoreEventName.LoyaltyPointsRedeemed);
    expect(published[0]?.data.appliedMinor).toBe('40');
  });

  it('quoteRedeem caps by balance and maxAmountMinor', async () => {
    await service.accrue({ customerId, points: 100, orderId });

    const quote = await service.quoteRedeem({
      customerId,
      points: 80,
      maxAmountMinor: '25',
    });

    expect(quote.pointsToRedeem).toBe(25);
    expect(quote.appliedMinor).toBe('25');
    expect(quote.availablePoints).toBe(100);
  });

  it('accrueFromOrderCapture uses 100 minor units per point', async () => {
    const account = await service.accrueFromOrderCapture({
      customerId,
      orderId,
      totalMinor: '2599',
    });

    expect(account?.pointsBalance).toBe(25);
  });

  it('rejects redeem above balance', async () => {
    await service.accrue({ customerId, points: 10, orderId });
    await expect(
      service.redeem({ customerId, points: 11 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
