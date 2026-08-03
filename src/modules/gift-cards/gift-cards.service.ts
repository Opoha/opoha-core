import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  Repository,
} from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { GiftCardTransactionEntity } from './entities/gift-card-transaction.entity';
import { GiftCardEntity } from './entities/gift-card.entity';
import {
  generateGiftCardCode,
  type GiftCardStatus,
} from './gift-card-status';
import type {
  GiftCardLedgerEntryType,
  GiftCardType,
  IssueGiftCardInput,
  PurchaseGiftCardInput,
  QuoteGiftCardRedeemInput,
  QuoteGiftCardRedeemResult,
  RedeemGiftCardInput,
} from './gift-cards.types';

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parsePositiveMinor(raw: string, field: string): bigint {
  let value: bigint;
  try {
    value = BigInt(String(raw));
  } catch {
    throw new BadRequestException(`${field} must be an integer minor amount`);
  }
  if (value <= 0n) {
    throw new BadRequestException(`${field} must be > 0`);
  }
  return value;
}

function parseNonNegMinor(raw: string, field: string): bigint {
  let value: bigint;
  try {
    value = BigInt(String(raw));
  } catch {
    throw new BadRequestException(`${field} must be an integer minor amount`);
  }
  if (value < 0n) {
    throw new BadRequestException(`${field} must be >= 0`);
  }
  return value;
}

function toCardType(row: GiftCardEntity): GiftCardType {
  return {
    id: row.id,
    code: row.code,
    currencyCode: row.currencyCode,
    initialBalanceMinor: String(row.initialBalanceMinor),
    balanceMinor: String(row.balanceMinor),
    status: row.status,
    issuedToCustomerId: row.issuedToCustomerId,
    purchasedByCustomerId: row.purchasedByCustomerId,
    purchaseOrderId: row.purchaseOrderId,
    expiresAt: row.expiresAt,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTxType(row: GiftCardTransactionEntity): GiftCardLedgerEntryType {
  return {
    id: row.id,
    giftCardId: row.giftCardId,
    type: row.type,
    amountMinor: String(row.amountMinor),
    balanceAfterMinor: String(row.balanceAfterMinor),
    orderId: row.orderId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

function statusForBalance(
  balance: bigint,
  current: GiftCardStatus,
): GiftCardStatus {
  if (current === 'disabled' || current === 'expired') {
    return current;
  }
  return balance === 0n ? 'redeemed' : 'active';
}

/**
 * Gift card issue / purchase / redeem with TypeORM-owned balance ledger (C-01/C-02).
 */
@Injectable()
export class GiftCardService {
  constructor(
    @InjectRepository(GiftCardEntity)
    private readonly cards: Repository<GiftCardEntity>,
    @InjectRepository(GiftCardTransactionEntity)
    private readonly transactions: Repository<GiftCardTransactionEntity>,
    private readonly dataSource: DataSource,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async findById(id: string): Promise<GiftCardType> {
    const row = await this.cards.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Gift card ${id} not found`);
    }
    return toCardType(row);
  }

  async findByCode(code: string): Promise<GiftCardType> {
    const row = await this.cards.findOne({
      where: { code: normalizeCode(code) },
    });
    if (!row) {
      throw new NotFoundException(`Gift card code not found`);
    }
    return toCardType(row);
  }

  async listTransactions(
    giftCardId: string,
  ): Promise<GiftCardLedgerEntryType[]> {
    const rows = await this.transactions.find({
      where: { giftCardId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toTxType);
  }

  /** Staff/admin issue: create active card with initial balance. */
  async issue(input: IssueGiftCardInput): Promise<GiftCardType> {
    const amount = parsePositiveMinor(input.amountMinor, 'amountMinor');
    const currency = input.currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('currencyCode must be a 3-letter ISO code');
    }
    const code = normalizeCode(input.code?.trim() || generateGiftCardCode());

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(GiftCardEntity, {
        where: { code },
      });
      if (existing) {
        throw new BadRequestException(`Gift card code ${code} already exists`);
      }

      const card = manager.create(GiftCardEntity, {
        code,
        currencyCode: currency,
        initialBalanceMinor: amount.toString(),
        balanceMinor: amount.toString(),
        status: 'active',
        issuedToCustomerId: input.customerId ?? null,
        purchasedByCustomerId: null,
        purchaseOrderId: null,
        expiresAt: input.expiresAt ?? null,
        note: input.note ?? null,
      });
      const saved = await manager.save(card);
      await manager.save(
        manager.create(GiftCardTransactionEntity, {
          giftCardId: saved.id,
          type: 'issue',
          amountMinor: amount.toString(),
          balanceAfterMinor: amount.toString(),
          orderId: null,
          note: input.note ?? 'Issued',
        }),
      );
      return toCardType(saved);
    });
  }

  /** Purchase path: issue a card linked to a paid order. */
  async purchase(input: PurchaseGiftCardInput): Promise<GiftCardType> {
    const orderId = input.orderId?.trim();
    if (!orderId) {
      throw new BadRequestException('orderId is required');
    }
    const issued = await this.issue({
      currencyCode: input.currencyCode,
      amountMinor: input.amountMinor,
      code: input.code,
      customerId: input.customerId,
      expiresAt: input.expiresAt,
      note: input.note ?? `Purchased on order ${orderId}`,
    });

    await this.cards.update(
      { id: issued.id },
      {
        purchaseOrderId: orderId,
        purchasedByCustomerId: input.customerId ?? null,
      },
    );
    await this.transactions.update(
      { giftCardId: issued.id, type: 'issue' },
      {
        type: 'purchase',
        orderId,
        note: input.note ?? `Purchased on order ${orderId}`,
      },
    );

    return this.findById(issued.id);
  }

  /**
   * Quote how much of a gift card can apply toward a checkout total.
   * Does not mutate balances.
   */
  async quoteRedeem(
    input: QuoteGiftCardRedeemInput,
  ): Promise<QuoteGiftCardRedeemResult> {
    const code = normalizeCode(input.code);
    const maxAmount = parseNonNegMinor(input.maxAmountMinor, 'maxAmountMinor');
    const currency = input.currencyCode.trim().toUpperCase();

    if (!code) {
      return {
        giftCardId: '',
        code: '',
        currencyCode: currency,
        availableMinor: '0',
        appliedMinor: '0',
      };
    }

    const card = await this.cards.findOne({ where: { code } });
    if (!card) {
      throw new BadRequestException(`Gift card code ${code} is invalid`);
    }
    this.assertRedeemable(card, currency);

    const available = BigInt(String(card.balanceMinor));
    const applied = available < maxAmount ? available : maxAmount;
    return {
      giftCardId: card.id,
      code: card.code,
      currencyCode: card.currencyCode,
      availableMinor: available.toString(),
      appliedMinor: applied.toString(),
    };
  }

  /** Debit balance (checkout redeem). Uses row lock inside a transaction. */
  async redeem(input: RedeemGiftCardInput): Promise<GiftCardType> {
    const code = normalizeCode(input.code);
    const amount = parsePositiveMinor(input.amountMinor, 'amountMinor');

    const saved = await this.dataSource.transaction(async (manager) => {
      const card = await this.lockByCode(manager, code);
      if (!card) {
        throw new BadRequestException(`Gift card code ${code} is invalid`);
      }
      this.assertRedeemable(card);

      const balance = BigInt(String(card.balanceMinor));
      if (amount > balance) {
        throw new BadRequestException(
          `Gift card balance ${balance.toString()} is less than redeem amount ${amount.toString()}`,
        );
      }

      const next = balance - amount;
      card.balanceMinor = next.toString();
      card.status = statusForBalance(next, card.status);
      const updated = await manager.save(card);

      await manager.save(
        manager.create(GiftCardTransactionEntity, {
          giftCardId: updated.id,
          type: 'redeem',
          amountMinor: (-amount).toString(),
          balanceAfterMinor: next.toString(),
          orderId: input.orderId ?? null,
          note: input.note ?? 'Redeemed at checkout',
        }),
      );

      return updated;
    });

    if (this.eventBus) {
      await this.eventBus.publish({
        eventName: CoreEventName.GiftCardRedeemed,
        aggregateType: 'gift_card',
        aggregateId: saved.id,
        data: {
          giftCardId: saved.id,
          code: saved.code,
          amountMinor: amount.toString(),
          balanceAfterMinor: String(saved.balanceMinor),
          orderId: input.orderId ?? null,
          redeemedAt: new Date().toISOString(),
        },
      });
    }

    return toCardType(saved);
  }

  private async lockByCode(
    manager: EntityManager,
    code: string,
  ): Promise<GiftCardEntity | null> {
    return manager
      .getRepository(GiftCardEntity)
      .createQueryBuilder('gc')
      .setLock('pessimistic_write')
      .where('gc.code = :code', { code })
      .getOne();
  }

  private assertRedeemable(
    card: GiftCardEntity,
    expectedCurrency?: string,
  ): void {
    if (card.status === 'disabled') {
      throw new BadRequestException(`Gift card ${card.code} is disabled`);
    }
    if (card.status === 'expired') {
      throw new BadRequestException(`Gift card ${card.code} is expired`);
    }
    if (card.expiresAt && card.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(`Gift card ${card.code} is expired`);
    }
    if (card.status === 'redeemed' || BigInt(String(card.balanceMinor)) <= 0n) {
      throw new BadRequestException(`Gift card ${card.code} has no balance`);
    }
    if (
      expectedCurrency &&
      card.currencyCode.toUpperCase() !== expectedCurrency.toUpperCase()
    ) {
      throw new BadRequestException(
        `Gift card currency ${card.currencyCode} does not match cart ${expectedCurrency}`,
      );
    }
  }
}
