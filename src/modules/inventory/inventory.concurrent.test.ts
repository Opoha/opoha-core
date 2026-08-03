import { config as loadDotenv } from 'dotenv';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';

import { ProductEntity } from '../catalog/entities/product.entity';
import { ProductVariantEntity } from '../catalog/entities/product-variant.entity';
import { EventBusService } from '../event-bus/event-bus.service';
import { InventoryAdjustmentEntity } from './entities/inventory-adjustment.entity';
import { InventoryItemEntity } from './entities/inventory-item.entity';
import { InventoryReservationEntity } from './entities/inventory-reservation.entity';
import { InventoryService } from './inventory.service';

loadDotenv();

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

/**
 * B-04 — real Postgres concurrent reservation (pessimistic locks).
 * Skips when DATABASE_URL is unset so unit-only environments still pass.
 */
describeDb('InventoryService concurrent reservations (no oversell)', () => {
  let dataSource: DataSource;
  let service: InventoryService;
  let variantId: string;
  let productId: string;

  const stockOnHand = 10;
  const concurrentAttempts = 40;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [
        ProductEntity,
        ProductVariantEntity,
        InventoryItemEntity,
        InventoryReservationEntity,
        InventoryAdjustmentEntity,
      ],
      synchronize: false,
    });
    await dataSource.initialize();

    const products = dataSource.getRepository(ProductEntity);
    const variants = dataSource.getRepository(ProductVariantEntity);
    const items = dataSource.getRepository(InventoryItemEntity);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await products.save(
      products.create({
        name: `Concurrent inventory fixture ${suffix}`,
        slug: `concurrent-inv-${suffix}`,
        description: null,
        isActive: true,
      }),
    );
    productId = product.id;

    const variant = await variants.save(
      variants.create({
        productId: product.id,
        sku: `SKU-CONC-${suffix}`,
        name: 'Default',
        priceMinor: '1000',
        currencyCode: 'USD',
        isActive: true,
      }),
    );
    variantId = variant.id;

    await items.save(
      items.create({
        variantId,
        quantityOnHand: stockOnHand,
        quantityReserved: 0,
      }),
    );

    service = new InventoryService(
      dataSource.getRepository(InventoryItemEntity),
      dataSource.getRepository(InventoryReservationEntity),
      dataSource.getRepository(InventoryAdjustmentEntity),
      dataSource,
      new EventBusService(),
    );
  }, 60_000);

  afterAll(async () => {
    if (!dataSource?.isInitialized) {
      return;
    }
    // Cascade: delete product removes variants; inventory FKs cascade from items/variants via migration.
    await dataSource.getRepository(ProductEntity).delete({ id: productId });
    await dataSource.destroy();
  });

  it('does not oversell when many carts reserve the last units concurrently', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: concurrentAttempts }, (_, i) =>
        service.reserve({
          variantId,
          quantity: 1,
          reference: `cart-${i}`,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(stockOnHand);
    expect(failed).toHaveLength(concurrentAttempts - stockOnHand);

    for (const result of failed) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(ConflictException);
      }
    }

    const item = await service.findByVariantId(variantId);
    expect(item.quantityOnHand).toBe(stockOnHand);
    expect(item.quantityReserved).toBe(stockOnHand);
    expect(item.quantityAvailable).toBe(0);

    const active = await dataSource
      .getRepository(InventoryReservationEntity)
      .find({ where: { inventoryItemId: item.id, status: 'active' } });
    const reservedSum = active.reduce((sum, row) => sum + row.quantity, 0);
    expect(active).toHaveLength(stockOnHand);
    expect(reservedSum).toBe(stockOnHand);
  }, 60_000);
});
