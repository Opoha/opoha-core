import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { LoyaltyAccountEntity } from './entities/loyalty-account.entity';
import { LoyaltyTransactionEntity } from './entities/loyalty-transaction.entity';
import { computeAccrualPoints, computeRedemptionValueMinor } from './loyalty-status';
import type {
  AccrueLoyaltyInput,
  LoyaltyAccountType,
  LoyaltyLedgerEntryType,
  QuoteLoyaltyRedeemInput,
  QuoteLoyaltyRedeemResult,
  RedeemLoyaltyInput,
} from './loyalty.types';

function toAccountType(row: LoyaltyAccountEntity): LoyaltyAccountType {
  return {
    id: row.id,
    customerId: row.customerId,
    pointsBalance: row.pointsBalance,
    lifetimePointsEarned: row.lifetimePointsEarned,
    lifetimePointsRedeemed: row.lifetimePointsRedeemed,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTxType(row: LoyaltyTransactionEntity): LoyaltyLedgerEntryType {
  return {
    id: row.id,
    accountId: row.accountId,
    customerId: row.customerId,
    type: row.type,
    points: row.points,
    balanceAfter: row.balanceAfter,
    orderId: row.orderId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function parsePositivePoints(raw: number, field: string): number {
  if (!Number.isInteger(raw) || raw <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return raw;
}

/**
 * Loyalty accounts + ledger: accrue on capture, redeem at checkout (C-03).
 */
@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyAccountEntity)
    private readonly accounts: Repository<LoyaltyAccountEntity>,
    @InjectRepository(LoyaltyTransactionEntity)
    private readonly transactions: Repository<LoyaltyTransactionEntity>,
    private readonly dataSource: DataSource,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findByCustomerId(customerId: string): Promise<LoyaltyAccountType | null> {
    const row = await this.accounts.findOne({ where: { customerId } });
    return row ? toAccountType(row) : null;
  }

  async getOrCreateAccount(customerId: string): Promise<LoyaltyAccountType> {
    const id = customerId?.trim();
    if (!id) {
      throw new BadRequestException('customerId is required');
    }
    const existing = await this.accounts.findOne({ where: { customerId: id } });
    if (existing) {
      return toAccountType(existing);
    }
    const created = await this.accounts.save(
      this.accounts.create({
        customerId: id,
        pointsBalance: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
      }),
    );
    return toAccountType(created);
  }

  async listTransactions(customerId: string): Promise<LoyaltyLedgerEntryType[]> {
    const rows = await this.transactions.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toTxType);
  }

  /**
   * Quote how many points can apply toward a checkout total.
   * Does not mutate balances.
   */
  async quoteRedeem(input: QuoteLoyaltyRedeemInput): Promise<QuoteLoyaltyRedeemResult> {
    const customerId = input.customerId?.trim();
    if (!customerId) {
      return {
        customerId: '',
        availablePoints: 0,
        pointsToRedeem: 0,
        appliedMinor: '0',
      };
    }

    let maxAmount: bigint;
    try {
      maxAmount = BigInt(String(input.maxAmountMinor));
    } catch {
      throw new BadRequestException('maxAmountMinor must be an integer minor amount');
    }
    if (maxAmount < 0n) {
      throw new BadRequestException('maxAmountMinor must be >= 0');
    }

    const requested = Math.max(0, Math.floor(Number(input.points) || 0));
    const account = await this.accounts.findOne({ where: { customerId } });
    const available = account?.pointsBalance ?? 0;

    if (requested <= 0 || available <= 0 || maxAmount === 0n) {
      return {
        customerId,
        availablePoints: available,
        pointsToRedeem: 0,
        appliedMinor: '0',
      };
    }

    // 1 point = 1 minor unit (LOYALTY_REDEMPTION_MINOR_UNITS_PER_POINT).
    const maxByTotal = Number(
      maxAmount > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : maxAmount,
    );
    const pointsToRedeem = Math.min(requested, available, maxByTotal);
    return {
      customerId,
      availablePoints: available,
      pointsToRedeem,
      appliedMinor: computeRedemptionValueMinor(pointsToRedeem),
    };
  }

  /** Credit points (order capture accrual). Idempotent per orderId. */
  async accrue(input: AccrueLoyaltyInput): Promise<LoyaltyAccountType> {
    const customerId = input.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException('customerId is required');
    }
    const points = parsePositivePoints(input.points, 'points');
    const orderId = input.orderId?.trim() || null;

    const result = await this.dataSource.transaction(async (manager) => {
      if (orderId) {
        const prior = await manager.findOne(LoyaltyTransactionEntity, {
          where: { orderId, type: 'accrue' },
        });
        if (prior) {
          const account = await manager.findOne(LoyaltyAccountEntity, {
            where: { id: prior.accountId },
          });
          if (!account) {
            throw new BadRequestException('Loyalty account missing for prior accrual');
          }
          return { account, emitted: false as const, points: 0 };
        }
      }

      const account = await this.lockOrCreateAccount(manager, customerId);
      const next = account.pointsBalance + points;
      account.pointsBalance = next;
      account.lifetimePointsEarned += points;
      const saved = await manager.save(account);

      await manager.save(
        manager.create(LoyaltyTransactionEntity, {
          accountId: saved.id,
          customerId,
          type: 'accrue',
          points,
          balanceAfter: next,
          orderId,
          note: input.note ?? (orderId ? `Accrued on order ${orderId}` : 'Accrued'),
        }),
      );

      return { account: saved, emitted: true as const, points };
    });

    if (result.emitted && this.eventBus) {
      await this.eventBus.publish({
        eventName: CoreEventName.LoyaltyPointsAccrued,
        aggregateType: 'loyalty_account',
        aggregateId: result.account.id,
        data: {
          accountId: result.account.id,
          customerId,
          points: result.points,
          balanceAfter: result.account.pointsBalance,
          orderId,
          accruedAt: new Date().toISOString(),
        },
      });
    }

    return toAccountType(result.account);
  }

  /**
   * Accrue from a captured order total (floor division by rate).
   * No-op when points would be 0 or customerId missing.
   */
  async accrueFromOrderCapture(input: {
    customerId: string | null | undefined;
    orderId: string;
    totalMinor: string;
  }): Promise<LoyaltyAccountType | null> {
    const customerId = input.customerId?.trim();
    if (!customerId) {
      return null;
    }
    const points = computeAccrualPoints(input.totalMinor);
    if (points <= 0) {
      return null;
    }
    return this.accrue({
      customerId,
      points,
      orderId: input.orderId,
      note: `Accrued on order capture ${input.orderId}`,
    });
  }

  /** Debit points (checkout redeem). Uses row lock inside a transaction. */
  async redeem(input: RedeemLoyaltyInput): Promise<LoyaltyAccountType> {
    const customerId = input.customerId?.trim();
    if (!customerId) {
      throw new BadRequestException('customerId is required');
    }
    const points = parsePositivePoints(input.points, 'points');
    const orderId = input.orderId?.trim() || null;

    const saved = await this.dataSource.transaction(async (manager) => {
      const account = await this.lockAccount(manager, customerId);
      if (!account) {
        throw new BadRequestException(`No loyalty account for customer ${customerId}`);
      }
      if (account.pointsBalance < points) {
        throw new BadRequestException(
          `Loyalty balance ${account.pointsBalance} is less than redeem points ${points}`,
        );
      }

      const next = account.pointsBalance - points;
      account.pointsBalance = next;
      account.lifetimePointsRedeemed += points;
      const updated = await manager.save(account);

      await manager.save(
        manager.create(LoyaltyTransactionEntity, {
          accountId: updated.id,
          customerId,
          type: 'redeem',
          points: -points,
          balanceAfter: next,
          orderId,
          note: input.note ?? (orderId ? `Redeemed on order ${orderId}` : 'Redeemed at checkout'),
        }),
      );

      return updated;
    });

    if (this.eventBus) {
      await this.eventBus.publish({
        eventName: CoreEventName.LoyaltyPointsRedeemed,
        aggregateType: 'loyalty_account',
        aggregateId: saved.id,
        data: {
          accountId: saved.id,
          customerId,
          points,
          balanceAfter: saved.pointsBalance,
          appliedMinor: computeRedemptionValueMinor(points),
          orderId,
          redeemedAt: new Date().toISOString(),
        },
      });
    }

    return toAccountType(saved);
  }

  private async lockOrCreateAccount(
    manager: EntityManager,
    customerId: string,
  ): Promise<LoyaltyAccountEntity> {
    const locked = await this.lockAccount(manager, customerId);
    if (locked) {
      return locked;
    }
    const created = await manager.save(
      manager.create(LoyaltyAccountEntity, {
        customerId,
        pointsBalance: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
      }),
    );
    // Re-lock after insert for consistent write path.
    const again = await this.lockAccount(manager, customerId);
    return again ?? created;
  }

  private async lockAccount(
    manager: EntityManager,
    customerId: string,
  ): Promise<LoyaltyAccountEntity | null> {
    return manager
      .getRepository(LoyaltyAccountEntity)
      .createQueryBuilder('la')
      .setLock('pessimistic_write')
      .where('la.customer_id = :customerId', { customerId })
      .getOne();
  }
}
