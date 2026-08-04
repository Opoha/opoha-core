import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditAction, AuditLogsService } from '../auth/public';
import { ProductsService } from '../catalog/public';
import { InventoryService } from '../inventory/public';
import type {
  BulkAdjustInventoryItemInput,
  BulkAdjustInventoryResult,
  BulkUpdateProductItemInput,
  BulkUpdateProductsResult,
} from './admin-ops.types';

const MAX_BULK_ITEMS = 100;

@Injectable()
export class BulkOpsService {
  constructor(
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Apply product field updates in sequence; continues on per-item failure.
   */
  async bulkUpdateProducts(
    items: BulkUpdateProductItemInput[],
    actorUserId?: string | null,
  ): Promise<BulkUpdateProductsResult> {
    this.assertBatchSize(items.length);

    const results: BulkUpdateProductsResult['results'] = [];
    for (const item of items) {
      try {
        const { id, ...patch } = item;
        if (
          patch.name === undefined &&
          patch.slug === undefined &&
          patch.description === undefined &&
          patch.isActive === undefined
        ) {
          throw new BadRequestException('At least one product field must be provided');
        }
        await this.products.update(id, patch);
        results.push({ id, ok: true, error: null });
      } catch (error) {
        results.push({
          id: item.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.length - successCount;

    await this.auditLogs.append({
      action: AuditAction.BULK_PRODUCT_UPDATE,
      actorUserId: actorUserId ?? null,
      resourceType: 'product',
      resourceId: null,
      metadata: {
        itemCount: items.length,
        successCount,
        failureCount,
      },
    });

    return { successCount, failureCount, results };
  }

  /**
   * Apply inventory adjustments in sequence; continues on per-item failure.
   */
  async bulkAdjustInventory(
    items: BulkAdjustInventoryItemInput[],
    actorUserId?: string | null,
  ): Promise<BulkAdjustInventoryResult> {
    this.assertBatchSize(items.length);

    const results: BulkAdjustInventoryResult['results'] = [];
    for (const item of items) {
      try {
        const updated = await this.inventory.adjust({
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          delta: item.delta,
          reason: item.reason ?? 'bulk_adjust',
        });
        results.push({
          variantId: item.variantId,
          warehouseId: updated.warehouseId,
          ok: true,
          inventoryItemId: updated.id,
          error: null,
        });
      } catch (error) {
        results.push({
          variantId: item.variantId,
          warehouseId: item.warehouseId ?? null,
          ok: false,
          inventoryItemId: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.length - successCount;

    await this.auditLogs.append({
      action: AuditAction.BULK_INVENTORY_ADJUST,
      actorUserId: actorUserId ?? null,
      resourceType: 'inventory',
      resourceId: null,
      metadata: {
        itemCount: items.length,
        successCount,
        failureCount,
      },
    });

    return { successCount, failureCount, results };
  }

  private assertBatchSize(count: number): void {
    if (!Number.isInteger(count) || count < 1) {
      throw new BadRequestException('items must be a non-empty array');
    }
    if (count > MAX_BULK_ITEMS) {
      throw new BadRequestException(`Bulk batch size ${count} exceeds max ${MAX_BULK_ITEMS}`);
    }
  }
}
