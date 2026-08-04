import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ProductVariantEntity, type FulfillmentMode } from '../catalog/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { DigitalDownloadTokenEntity } from './entities/download-token.entity';
import { DigitalLicenseKeyEntity } from './entities/license-key.entity';
import {
  defaultDigitalAssetUrl,
  generateDownloadToken,
  generateLicenseKey,
} from './digital-status';
import type {
  DigitalDownloadTokenType,
  DigitalFulfillmentResultType,
  DigitalLicenseKeyType,
} from './digital.types';

export type IssueDigitalLineInput = {
  orderId: string;
  orderLineId: string;
  variantId: string;
  quantity: number;
  customerId?: string | null;
  /** When omitted, a stub asset URL is generated. */
  assetUrl?: string | null;
  /** Token / license TTL hours; omit for no expiry. */
  ttlHours?: number | null;
  maxDownloads?: number;
};

function toTokenType(row: DigitalDownloadTokenEntity): DigitalDownloadTokenType {
  return {
    id: row.id,
    token: row.token,
    orderId: row.orderId,
    orderLineId: row.orderLineId,
    variantId: row.variantId,
    customerId: row.customerId,
    assetUrl: row.assetUrl,
    status: row.status,
    maxDownloads: row.maxDownloads,
    downloadCount: row.downloadCount,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLicenseType(row: DigitalLicenseKeyEntity): DigitalLicenseKeyType {
  return {
    id: row.id,
    licenseKey: row.licenseKey,
    orderId: row.orderId,
    orderLineId: row.orderLineId,
    variantId: row.variantId,
    customerId: row.customerId,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function expiresAtFromTtl(ttlHours: number | null | undefined): Date | null {
  if (ttlHours === undefined || ttlHours === null) {
    return null;
  }
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new BadRequestException('ttlHours must be a positive number');
  }
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

/** True when the SKU does not require physical shipping / stock reservation. */
export function isNonPhysicalFulfillment(
  mode: FulfillmentMode | string | null | undefined,
): boolean {
  return mode === 'digital' || mode === 'service';
}

@Injectable()
export class DigitalFulfillmentService {
  constructor(
    @InjectRepository(DigitalDownloadTokenEntity)
    private readonly tokens: Repository<DigitalDownloadTokenEntity>,
    @InjectRepository(DigitalLicenseKeyEntity)
    private readonly licenses: Repository<DigitalLicenseKeyEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async findDownloadTokenById(id: string): Promise<DigitalDownloadTokenType> {
    const row = await this.tokens.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Download token ${id} not found`);
    }
    return toTokenType(row);
  }

  async findDownloadTokenByToken(token: string): Promise<DigitalDownloadTokenType> {
    const row = await this.tokens.findOne({
      where: { token: token.trim() },
    });
    if (!row) {
      throw new NotFoundException(`Download token not found`);
    }
    return toTokenType(row);
  }

  async findLicenseKeyById(id: string): Promise<DigitalLicenseKeyType> {
    const row = await this.licenses.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`License key ${id} not found`);
    }
    return toLicenseType(row);
  }

  async listDownloadTokensForOrder(orderId: string): Promise<DigitalDownloadTokenType[]> {
    const rows = await this.tokens.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toTokenType);
  }

  async listLicenseKeysForOrder(orderId: string): Promise<DigitalLicenseKeyType[]> {
    const rows = await this.licenses.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toLicenseType);
  }

  async listDownloadTokensForCustomer(customerId: string): Promise<DigitalDownloadTokenType[]> {
    const rows = await this.tokens.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toTokenType);
  }

  async listLicenseKeysForCustomer(customerId: string): Promise<DigitalLicenseKeyType[]> {
    const rows = await this.licenses.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toLicenseType);
  }

  /**
   * Issue download token(s) + license key(s) for a digital order line.
   * One pair per quantity unit. Idempotent when tokens already exist for the line.
   */
  async issueForLine(input: IssueDigitalLineInput): Promise<{
    downloadTokens: DigitalDownloadTokenType[];
    licenseKeys: DigitalLicenseKeyType[];
  }> {
    const quantity = input.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const existingTokens = await this.tokens.find({
      where: { orderLineId: input.orderLineId },
      order: { createdAt: 'ASC' },
    });
    const existingLicenses = await this.licenses.find({
      where: { orderLineId: input.orderLineId },
      order: { createdAt: 'ASC' },
    });
    if (existingTokens.length > 0 || existingLicenses.length > 0) {
      return {
        downloadTokens: existingTokens.map(toTokenType),
        licenseKeys: existingLicenses.map(toLicenseType),
      };
    }

    const expiresAt = expiresAtFromTtl(input.ttlHours);
    const maxDownloads = input.maxDownloads ?? 5;
    if (!Number.isInteger(maxDownloads) || maxDownloads < 1) {
      throw new BadRequestException('maxDownloads must be a positive integer');
    }

    const customerId = input.customerId?.trim() || null;
    const downloadTokens: DigitalDownloadTokenEntity[] = [];
    const licenseKeys: DigitalLicenseKeyEntity[] = [];

    for (let i = 0; i < quantity; i += 1) {
      const token = generateDownloadToken();
      const assetUrl = input.assetUrl?.trim() || defaultDigitalAssetUrl(input.variantId, token);

      downloadTokens.push(
        this.tokens.create({
          token,
          orderId: input.orderId,
          orderLineId: input.orderLineId,
          variantId: input.variantId,
          customerId,
          assetUrl,
          status: 'active',
          maxDownloads,
          downloadCount: 0,
          expiresAt,
        }),
      );
      licenseKeys.push(
        this.licenses.create({
          licenseKey: generateLicenseKey(),
          orderId: input.orderId,
          orderLineId: input.orderLineId,
          variantId: input.variantId,
          customerId,
          status: 'active',
          expiresAt,
        }),
      );
    }

    const savedTokens = await this.tokens.save(downloadTokens);
    const savedLicenses = await this.licenses.save(licenseKeys);

    return {
      downloadTokens: savedTokens.map(toTokenType),
      licenseKeys: savedLicenses.map(toLicenseType),
    };
  }

  /**
   * Issue digital fulfillment for all digital lines on a placed/paid order (D-02).
   * Non-digital lines are ignored. Shipping is never required for digital SKUs.
   */
  async issueForOrder(input: {
    orderId: string;
    customerId?: string | null;
    lines: Array<{
      id: string;
      variantId: string;
      quantity: number;
    }>;
  }): Promise<DigitalFulfillmentResultType> {
    const variantIds = [...new Set(input.lines.map((l) => l.variantId).filter(Boolean))];
    const variants =
      variantIds.length === 0 ? [] : await this.variants.find({ where: { id: In(variantIds) } });
    const modeByVariant = new Map(variants.map((v) => [v.id, v.fulfillmentMode] as const));

    const allTokens: DigitalDownloadTokenType[] = [];
    const allLicenses: DigitalLicenseKeyType[] = [];
    let digitalLineCount = 0;

    for (const line of input.lines) {
      const mode = modeByVariant.get(line.variantId);
      if (mode !== 'digital') {
        continue;
      }
      digitalLineCount += 1;
      const issued = await this.issueForLine({
        orderId: input.orderId,
        orderLineId: line.id,
        variantId: line.variantId,
        quantity: line.quantity,
        customerId: input.customerId ?? null,
      });
      allTokens.push(...issued.downloadTokens);
      allLicenses.push(...issued.licenseKeys);
    }

    if (digitalLineCount > 0) {
      await this.eventBus.publish({
        eventName: CoreEventName.DigitalFulfillmentIssued,
        aggregateType: 'order',
        aggregateId: input.orderId,
        data: {
          orderId: input.orderId,
          customerId: input.customerId ?? null,
          downloadTokenIds: allTokens.map((t) => t.id),
          licenseKeyIds: allLicenses.map((l) => l.id),
          lineCount: digitalLineCount,
          issuedAt: new Date().toISOString(),
        },
      });
    }

    return {
      orderId: input.orderId,
      downloadTokens: allTokens,
      licenseKeys: allLicenses,
    };
  }
}
