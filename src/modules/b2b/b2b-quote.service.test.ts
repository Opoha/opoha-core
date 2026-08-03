import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { B2bQuoteService } from './b2b-quote.service';
import type { B2bQuoteStatus } from './entities';

type QuoteRow = {
  id: string;
  companyId: string;
  storeId: string;
  customerId: string;
  poNumber: string | null;
  status: B2bQuoteStatus;
  currencyCode: string;
  notes: string | null;
  orderId: string | null;
  lines: LineRow[];
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  quoteId: string;
  variantId: string;
  quantity: number;
  unitPriceMinor: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('B2bQuoteService (F-05)', () => {
  const now = new Date('2026-08-04T01:00:00Z');
  const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const storeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const customerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const variantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  let quotes: QuoteRow[];
  let service: B2bQuoteService;
  let quotesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let companies: {
    findById: ReturnType<typeof vi.fn>;
    assertCanBuy: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let dataSource: {
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    quotes = [];
    quotesRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<QuoteRow> } = {}) => {
        if (where?.companyId) {
          return quotes.filter((q) => q.companyId === where.companyId);
        }
        return [...quotes];
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<QuoteRow> }) => {
        return quotes.find((q) => q.id === where.id) ?? null;
      }),
      save: vi.fn(async (row: QuoteRow) => {
        const idx = quotes.findIndex((q) => q.id === row.id);
        if (idx >= 0) {
          quotes[idx] = { ...quotes[idx], ...row, updatedAt: now };
          return quotes[idx];
        }
        quotes.push(row);
        return row;
      }),
    };

    companies = {
      findById: vi.fn(async () => ({
        id: companyId,
        storeId,
        name: 'Acme',
        creditLimitMinor: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
      assertCanBuy: vi.fn(async () => undefined),
    };

    eventBus = { publish: vi.fn(async () => ({ ok: true })) };

    dataSource = {
      transaction: vi.fn(async (fn: (m: unknown) => Promise<unknown>) => {
        const manager = {
          create: (_Entity: unknown, data: Record<string, unknown>) => ({
            ...data,
          }),
          save: async (entityOrRows: unknown) => {
            if (Array.isArray(entityOrRows)) {
              return entityOrRows.map((row, i) => ({
                id: `line-${i + 1}`,
                createdAt: now,
                updatedAt: now,
                ...(row as object),
              }));
            }
            const quote = {
              id: 'quote-1',
              orderId: null,
              createdAt: now,
              updatedAt: now,
              lines: [] as LineRow[],
              ...(entityOrRows as object),
            } as unknown as QuoteRow;
            quotes.push(quote);
            return quote;
          },
        };
        return fn(manager);
      }),
    };

    service = new B2bQuoteService(
      quotesRepo as never,
      {} as never,
      companies as never,
      dataSource as never,
      eventBus as never,
    );
  });

  it('create → submit → accept → markConverted status flow', async () => {
    const created = await service.create({
      companyId,
      customerId,
      poNumber: 'PO-42',
      lines: [{ variantId, quantity: 3, unitPriceMinor: '500' }],
    });
    expect(created.status).toBe('draft');
    expect(created.poNumber).toBe('PO-42');
    expect(created.storeId).toBe(storeId);
    expect(companies.assertCanBuy).toHaveBeenCalledWith(companyId, customerId);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.B2bQuoteCreated,
      }),
    );

    // Ensure lines relation present for later transitions
    quotes[0]!.lines = [
      {
        id: 'line-1',
        quoteId: 'quote-1',
        variantId,
        quantity: 3,
        unitPriceMinor: '500',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const submitted = await service.submit(created.id);
    expect(submitted.status).toBe('submitted');

    const accepted = await service.accept(created.id);
    expect(accepted.status).toBe('accepted');

    const converted = await service.markConverted(created.id, 'order-1');
    expect(converted.status).toBe('converted');
    expect(converted.orderId).toBe('order-1');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.B2bQuoteConverted,
      }),
    );
  });

  it('rejects convert when not accepted', async () => {
    quotes.push({
      id: 'quote-1',
      companyId,
      storeId,
      customerId,
      poNumber: null,
      status: 'draft',
      currencyCode: 'USD',
      notes: null,
      orderId: null,
      lines: [
        {
          id: 'line-1',
          quoteId: 'quote-1',
          variantId,
          quantity: 1,
          unitPriceMinor: '100',
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.requireAcceptedForConvert('quote-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancel rejects terminal converted quotes', async () => {
    quotes.push({
      id: 'quote-1',
      companyId,
      storeId,
      customerId,
      poNumber: null,
      status: 'converted',
      currencyCode: 'USD',
      notes: null,
      orderId: 'order-1',
      lines: [],
      createdAt: now,
      updatedAt: now,
    });

    await expect(service.cancel('quote-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('findById 404', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
