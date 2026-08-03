import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  AuditAction,
  AuditLogsService,
} from '../auth/public';
import type { DomainEvent } from '../event-bus/public';
import { CoreEventName, EventBusService } from '../event-bus/public';

type WarehouseUpdatedData = {
  warehouseId: string;
  code: string;
  name: string;
  action: 'created' | 'updated' | 'deleted';
};

type ShipmentCreatedData = {
  fulfillmentId: string;
  orderId: string;
  warehouseId: string;
  trackingNumber?: string | null;
};

type ReturnRequestedData = {
  returnId: string;
  orderId: string;
  warehouseId: string;
  resolution: string;
};

type RefundCompletedData = {
  returnId: string;
  orderId: string;
  paymentId: string;
  refundAmountMinor: string;
};

/**
 * Mirrors key warehouse / fulfillment / RMA domain events into `audit_logs`
 * for activity-log surfaces (Phase 3 F-03).
 */
@Injectable()
export class ActivityAuditListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(CoreEventName.WarehouseUpdated, (event) =>
      this.onWarehouseUpdated(event as DomainEvent<WarehouseUpdatedData>),
    );
    this.eventBus.subscribe(CoreEventName.ShipmentCreated, (event) =>
      this.onShipmentCreated(event as DomainEvent<ShipmentCreatedData>),
    );
    this.eventBus.subscribe(CoreEventName.ReturnRequested, (event) =>
      this.onReturnRequested(event as DomainEvent<ReturnRequestedData>),
    );
    this.eventBus.subscribe(CoreEventName.RefundCompleted, (event) =>
      this.onRefundCompleted(event as DomainEvent<RefundCompletedData>),
    );
  }

  private async onWarehouseUpdated(
    event: DomainEvent<WarehouseUpdatedData>,
  ): Promise<void> {
    const action =
      event.data.action === 'created'
        ? AuditAction.WAREHOUSE_CREATE
        : event.data.action === 'deleted'
          ? AuditAction.WAREHOUSE_DELETE
          : AuditAction.WAREHOUSE_UPDATE;

    await this.auditLogs.append({
      action,
      resourceType: 'warehouse',
      resourceId: event.data.warehouseId,
      metadata: {
        code: event.data.code,
        name: event.data.name,
        domainAction: event.data.action,
      },
    });
  }

  private async onShipmentCreated(
    event: DomainEvent<ShipmentCreatedData>,
  ): Promise<void> {
    await this.auditLogs.append({
      action: AuditAction.FULFILLMENT_SHIP,
      resourceType: 'fulfillment',
      resourceId: event.data.fulfillmentId,
      metadata: {
        orderId: event.data.orderId,
        warehouseId: event.data.warehouseId,
        trackingNumber: event.data.trackingNumber ?? null,
      },
    });
  }

  private async onReturnRequested(
    event: DomainEvent<ReturnRequestedData>,
  ): Promise<void> {
    await this.auditLogs.append({
      action: AuditAction.RETURN_CREATE,
      resourceType: 'return',
      resourceId: event.data.returnId,
      metadata: {
        orderId: event.data.orderId,
        warehouseId: event.data.warehouseId,
        resolution: event.data.resolution,
      },
    });
  }

  private async onRefundCompleted(
    event: DomainEvent<RefundCompletedData>,
  ): Promise<void> {
    await this.auditLogs.append({
      action: AuditAction.RETURN_REFUND,
      resourceType: 'return',
      resourceId: event.data.returnId,
      metadata: {
        orderId: event.data.orderId,
        paymentId: event.data.paymentId,
        refundAmountMinor: event.data.refundAmountMinor,
      },
    });
  }
}
