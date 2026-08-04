import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { CompanyService } from './company.service';
import {
  B2B_QUOTE_STATUSES,
  B2bQuoteEntity,
  B2bQuoteLineEntity,
  type B2bQuoteStatus,
} from './entities';
import type { B2bQuoteLineType, B2bQuoteType, CreateB2bQuoteInput } from './b2b-quote.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function assertNonNegativeIntegerString(value: string, field: string): string {
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException(`${field} must be a non-negative integer string`);
  }
  return raw;
}

function toLineType(row: B2bQuoteLineEntity): B2bQuoteLineType {
  return {
    id: row.id,
    quoteId: row.quoteId,
    variantId: row.variantId,
    quantity: row.quantity,
    unitPriceMinor: String(row.unitPriceMinor),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toQuoteType(row: B2bQuoteEntity): B2bQuoteType {
  return {
    id: row.id,
    companyId: row.companyId,
    storeId: row.storeId,
    customerId: row.customerId,
    poNumber: row.poNumber,
    status: row.status,
    currencyCode: row.currencyCode,
    notes: row.notes,
    orderId: row.orderId,
    lines: (row.lines ?? []).map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function quoteSubtotalMinor(lines: B2bQuoteLineEntity[]): string {
  let total = 0n;
  for (const line of lines) {
    total += BigInt(String(line.unitPriceMinor)) * BigInt(line.quantity);
  }
  return total.toString();
}

@Injectable()
export class B2bQuoteService {
  constructor(
    @InjectRepository(B2bQuoteEntity)
    private readonly quotes: Repository<B2bQuoteEntity>,
    @InjectRepository(B2bQuoteLineEntity)
    private readonly quoteLines: Repository<B2bQuoteLineEntity>,
    private readonly companies: CompanyService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(companyId?: string): Promise<B2bQuoteType[]> {
    const rows = await this.quotes.find({
      where: companyId ? { companyId } : undefined,
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toQuoteType);
  }

  async findById(id: string): Promise<B2bQuoteType> {
    return toQuoteType(await this.requireQuote(id));
  }

  /**
 * Create a draft B2B quote with lines (foundation).
   * Optional `poNumber` holds the buyer's external purchase-order reference.
   */
  async create(input: CreateB2bQuoteInput): Promise<B2bQuoteType> {
    if (!input.lines?.length) {
      throw new BadRequestException('At least one quote line is required');
    }

    const company = await this.companies.findById(input.companyId);
    await this.companies.assertCanBuy(input.companyId, input.customerId);

    const variantIds = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException('Each line quantity must be a positive integer');
      }
      assertNonNegativeIntegerString(line.unitPriceMinor, 'unitPriceMinor');
      if (variantIds.has(line.variantId)) {
        throw new BadRequestException(`Duplicate variantId ${line.variantId} in quote lines`);
      }
      variantIds.add(line.variantId);
    }

    const currencyCode = (input.currencyCode ?? 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new BadRequestException('currencyCode must be a 3-letter ISO 4217 code');
    }

    let saved: B2bQuoteEntity;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const quote = await manager.save(
          manager.create(B2bQuoteEntity, {
            companyId: input.companyId,
            storeId: company.storeId,
            customerId: input.customerId,
            poNumber: input.poNumber?.trim() || null,
            status: 'draft',
            currencyCode,
            notes: input.notes?.trim() || null,
            orderId: null,
          }),
        );
        const lines = input.lines.map((line) =>
          manager.create(B2bQuoteLineEntity, {
            quoteId: quote.id,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPriceMinor: String(line.unitPriceMinor).trim(),
          }),
        );
        await manager.save(lines);
        return quote;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException('Invalid company, customer, or product variant reference');
      }
      throw error;
    }

    const result = await this.findById(saved.id);
    await this.eventBus.publish({
      eventName: CoreEventName.B2bQuoteCreated,
      aggregateType: 'b2b_quote',
      aggregateId: result.id,
      data: {
        quoteId: result.id,
        companyId: result.companyId,
        storeId: result.storeId,
        customerId: result.customerId,
        status: result.status,
        poNumber: result.poNumber,
        lineCount: result.lines.length,
      },
    });
    return result;
  }

  async submit(id: string): Promise<B2bQuoteType> {
    return this.transition(id, 'draft', 'submitted');
  }

  async accept(id: string): Promise<B2bQuoteType> {
    return this.transition(id, 'submitted', 'accepted');
  }

  async cancel(id: string): Promise<B2bQuoteType> {
    const row = await this.requireQuote(id);
    if (row.status === 'converted' || row.status === 'cancelled') {
      throw new BadRequestException(`Quote ${id} cannot be cancelled (status=${row.status})`);
    }
    return this.transition(id, row.status, 'cancelled');
  }

  /**
   * Mark an accepted quote as converted after a draft order is created.
   * Called by OrdersService.convertB2bQuote (avoids b2b→order import cycle).
   */
  async markConverted(quoteId: string, orderId: string): Promise<B2bQuoteType> {
    const row = await this.requireQuote(quoteId);
    if (row.status !== 'accepted') {
      throw new BadRequestException(
        `Quote ${quoteId} must be accepted to convert (status=${row.status})`,
      );
    }
    if (row.orderId) {
      throw new BadRequestException(`Quote ${quoteId} is already linked to order ${row.orderId}`);
    }
    row.status = 'converted';
    row.orderId = orderId;
    await this.quotes.save(row);

    const result = await this.findById(quoteId);
    await this.eventBus.publish({
      eventName: CoreEventName.B2bQuoteConverted,
      aggregateType: 'b2b_quote',
      aggregateId: result.id,
      data: {
        quoteId: result.id,
        companyId: result.companyId,
        orderId,
        status: result.status,
      },
    });
    return result;
  }

  /** Entity + lines for convert path (OrdersService). */
  async requireAcceptedForConvert(id: string): Promise<{
    quote: B2bQuoteEntity;
    lines: B2bQuoteLineEntity[];
    subtotalMinor: string;
  }> {
    const quote = await this.requireQuote(id);
    if (quote.status !== 'accepted') {
      throw new BadRequestException(
        `Quote ${id} must be accepted to convert (status=${quote.status})`,
      );
    }
    const lines = quote.lines ?? [];
    if (lines.length === 0) {
      throw new BadRequestException(`Quote ${id} has no lines`);
    }
    return {
      quote,
      lines,
      subtotalMinor: quoteSubtotalMinor(lines),
    };
  }

  private async transition(
    id: string,
    from: B2bQuoteStatus,
    to: B2bQuoteStatus,
  ): Promise<B2bQuoteType> {
    const row = await this.requireQuote(id);
    if (row.status !== from) {
      throw new BadRequestException(
        `Quote ${id} must be ${from} to become ${to} (status=${row.status})`,
      );
    }
    if (!(B2B_QUOTE_STATUSES as readonly string[]).includes(to)) {
      throw new BadRequestException(`Invalid quote status "${to}"`);
    }
    row.status = to;
    await this.quotes.save(row);

    const result = await this.findById(id);
    await this.eventBus.publish({
      eventName: CoreEventName.B2bQuoteStatusChanged,
      aggregateType: 'b2b_quote',
      aggregateId: result.id,
      data: {
        quoteId: result.id,
        companyId: result.companyId,
        fromStatus: from,
        toStatus: to,
      },
    });
    return result;
  }

  private async requireQuote(id: string): Promise<B2bQuoteEntity> {
    const row = await this.quotes.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) {
      throw new NotFoundException(`B2B quote ${id} not found`);
    }
    return row;
  }
}
