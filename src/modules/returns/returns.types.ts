import type { ReturnResolution, ReturnStatus } from './return-status';

export type ReturnLineType = {
  id: string;
  returnId: string;
  orderLineId: string;
  variantId: string;
  quantity: number;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReturnType = {
  id: string;
  orderId: string;
  warehouseId: string;
  status: ReturnStatus;
  resolution: ReturnResolution;
  reason: string | null;
  notes: string | null;
  paymentId: string | null;
  replacementOrderId: string | null;
  refundAmountMinor: string | null;
  approvedAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  lines: ReturnLineType[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateReturnLineInput = {
  orderLineId: string;
  quantity: number;
  reason?: string;
};

export type CreateReturnInput = {
  orderId: string;
  warehouseId: string;
  resolution: ReturnResolution;
  reason?: string;
  notes?: string;
  lines: CreateReturnLineInput[];
};

export type CompleteRefundInput = {
  returnId: string;
  /** Defaults to the first captured payment on the order. */
  paymentId?: string;
  /** Partial refund in minor units; defaults to sum of returned line totals. */
  amountMinor?: string;
  idempotencyKey?: string;
};
