import type { FulfillmentStatus } from './entities';

export type FulfillmentLineInput = {
  orderLineId: string;
  quantity: number;
};

export type FulfillmentPackageInput = {
  trackingNumber?: string | null;
  carrierCode?: string | null;
  labelUrl?: string | null;
  weightGrams?: number | null;
};

export type CreateFulfillmentInput = {
  orderId: string;
  warehouseId: string;
  lines: FulfillmentLineInput[];
  notes?: string | null;
};

export type PackFulfillmentInput = {
  packages?: FulfillmentPackageInput[];
};

export type ShipFulfillmentInput = {
  trackingNumber?: string | null;
};

export type FulfillmentLineType = {
  id: string;
  fulfillmentId: string;
  orderLineId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FulfillmentPackageType = {
  id: string;
  fulfillmentId: string;
  trackingNumber: string | null;
  carrierCode: string | null;
  labelUrl: string | null;
  weightGrams: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FulfillmentType = {
  id: string;
  orderId: string;
  warehouseId: string;
  status: FulfillmentStatus;
  notes: string | null;
  trackingNumber: string | null;
  pickedAt: Date | null;
  packedAt: Date | null;
  shippedAt: Date | null;
  lines: FulfillmentLineType[];
  packages: FulfillmentPackageType[];
  createdAt: Date;
  updatedAt: Date;
};
