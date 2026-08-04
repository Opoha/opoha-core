import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { DigitalFulfillmentService } from './digital-fulfillment.service';
import { DigitalDownloadTokenEntity } from './entities/download-token.entity';
import { DigitalLicenseKeyEntity } from './entities/license-key.entity';

type TokenRow = {
  id: string;
  token: string;
  orderId: string;
  orderLineId: string;
  variantId: string;
  customerId: string | null;
  assetUrl: string;
  status: string;
  maxDownloads: number;
  downloadCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LicenseRow = {
  id: string;
  licenseKey: string;
  orderId: string;
  orderLineId: string;
  variantId: string;
  customerId: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('DigitalFulfillmentService (unit)', () => {
  const now = new Date('2026-08-04T03:30:00Z');
  const orderId = '11111111-1111-4111-8111-111111111111';
  const lineId = '22222222-2222-4222-8222-222222222222';
  const variantId = '33333333-3333-4333-8333-333333333333';
  const customerId = '44444444-4444-4444-8444-444444444444';

  let tokenStore: TokenRow[];
  let licenseStore: LicenseRow[];
  let service: DigitalFulfillmentService;
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenStore = [];
    licenseStore = [];
    let tokenSeq = 0;
    let licenseSeq = 0;

    const tokensRepo = {
      find: vi.fn(async ({ where }: { where: Partial<TokenRow> }) =>
        tokenStore
          .filter((row) => Object.entries(where).every(([k, v]) => row[k as keyof TokenRow] === v))
          .map((row) => Object.assign(new DigitalDownloadTokenEntity(), row)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<TokenRow> }) => {
        const row = tokenStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof TokenRow] === v),
        );
        return row ? Object.assign(new DigitalDownloadTokenEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<TokenRow>) => ({
        id: `tok-${++tokenSeq}`,
        downloadCount: 0,
        status: 'active',
        maxDownloads: 5,
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (rows: TokenRow | TokenRow[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        for (const row of list) {
          const idx = tokenStore.findIndex((t) => t.id === row.id);
          if (idx >= 0) {
            tokenStore[idx] = { ...row, updatedAt: now };
          } else {
            tokenStore.push({ ...row, createdAt: now, updatedAt: now });
          }
        }
        return list;
      }),
    };

    const licensesRepo = {
      find: vi.fn(async ({ where }: { where: Partial<LicenseRow> }) =>
        licenseStore
          .filter((row) =>
            Object.entries(where).every(([k, v]) => row[k as keyof LicenseRow] === v),
          )
          .map((row) => Object.assign(new DigitalLicenseKeyEntity(), row)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<LicenseRow> }) => {
        const row = licenseStore.find((r) =>
          Object.entries(where).every(([k, v]) => r[k as keyof LicenseRow] === v),
        );
        return row ? Object.assign(new DigitalLicenseKeyEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<LicenseRow>) => ({
        id: `lic-${++licenseSeq}`,
        status: 'active',
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (rows: LicenseRow | LicenseRow[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        for (const row of list) {
          const idx = licenseStore.findIndex((t) => t.id === row.id);
          if (idx >= 0) {
            licenseStore[idx] = { ...row, updatedAt: now };
          } else {
            licenseStore.push({ ...row, createdAt: now, updatedAt: now });
          }
        }
        return list;
      }),
    };

    const variantsRepo = {
      find: vi.fn(async () => [{ id: variantId, fulfillmentMode: 'digital' }]),
    };

    eventBus = { publish: vi.fn(async () => undefined) };

    service = new DigitalFulfillmentService(
      tokensRepo as never,
      licensesRepo as never,
      variantsRepo as never,
      eventBus as never,
    );
  });

  it('issues download token + license key per quantity unit', async () => {
    const result = await service.issueForLine({
      orderId,
      orderLineId: lineId,
      variantId,
      quantity: 2,
      customerId,
    });

    expect(result.downloadTokens).toHaveLength(2);
    expect(result.licenseKeys).toHaveLength(2);
    expect(result.downloadTokens[0]!.token).toMatch(/^[a-f0-9]{32}$/);
    expect(result.licenseKeys[0]!.licenseKey).toMatch(
      /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/,
    );
    expect(result.downloadTokens[0]!.assetUrl).toContain(variantId);
    expect(result.downloadTokens[0]!.customerId).toBe(customerId);
  });

  it('issueForLine is idempotent per order line', async () => {
    const first = await service.issueForLine({
      orderId,
      orderLineId: lineId,
      variantId,
      quantity: 1,
      customerId,
    });
    const second = await service.issueForLine({
      orderId,
      orderLineId: lineId,
      variantId,
      quantity: 1,
      customerId,
    });
    expect(second.downloadTokens).toHaveLength(1);
    expect(second.downloadTokens[0]!.id).toBe(first.downloadTokens[0]!.id);
    expect(tokenStore).toHaveLength(1);
  });

  it('issueForOrder publishes DigitalFulfillmentIssued for digital lines', async () => {
    const result = await service.issueForOrder({
      orderId,
      customerId,
      lines: [{ id: lineId, variantId, quantity: 1 }],
    });

    expect(result.downloadTokens).toHaveLength(1);
    expect(result.licenseKeys).toHaveLength(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.DigitalFulfillmentIssued,
        aggregateType: 'order',
        aggregateId: orderId,
        data: expect.objectContaining({
          orderId,
          customerId,
          lineCount: 1,
        }),
      }),
    );
  });

  it('issueForOrder skips non-digital variants and does not publish', async () => {
    const variantsRepo = {
      find: vi.fn(async () => [{ id: variantId, fulfillmentMode: 'physical' }]),
    };
    service = new DigitalFulfillmentService(
      {
        find: vi.fn(async () => []),
        findOne: vi.fn(),
        create: vi.fn(),
        save: vi.fn(),
      } as never,
      {
        find: vi.fn(async () => []),
        findOne: vi.fn(),
        create: vi.fn(),
        save: vi.fn(),
      } as never,
      variantsRepo as never,
      eventBus as never,
    );

    const result = await service.issueForOrder({
      orderId,
      customerId,
      lines: [{ id: lineId, variantId, quantity: 1 }],
    });
    expect(result.downloadTokens).toHaveLength(0);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('lists tokens/licenses by order and customer', async () => {
    await service.issueForLine({
      orderId,
      orderLineId: lineId,
      variantId,
      quantity: 1,
      customerId,
    });

    const byOrder = await service.listDownloadTokensForOrder(orderId);
    const licenses = await service.listLicenseKeysForCustomer(customerId);
    expect(byOrder).toHaveLength(1);
    expect(licenses).toHaveLength(1);
    await expect(service.findDownloadTokenById(byOrder[0]!.id)).resolves.toMatchObject({ orderId });
  });

  it('rejects invalid quantity', async () => {
    await expect(
      service.issueForLine({
        orderId,
        orderLineId: lineId,
        variantId,
        quantity: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound for missing token', async () => {
    await expect(
      service.findDownloadTokenById('99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
