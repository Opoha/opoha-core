import type { SegmentRules } from './segment-rules';

export type CustomerSegmentType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rules: SegmentRules | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCustomerSegmentInput = {
  code: string;
  name: string;
  description?: string | null;
  rules?: SegmentRules | null;
  isActive?: boolean;
};

export type UpdateCustomerSegmentInput = {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  rules?: SegmentRules | null;
  isActive?: boolean;
};
