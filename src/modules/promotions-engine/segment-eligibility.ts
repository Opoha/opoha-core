import type { SegmentMembershipContext } from '../segments/public';
import type { PromotionApplyInput } from './promotion-rule';

/**
 * Segment restriction stored on coupon.metadata or discount_rules.conditions.
 * Empty / absent = no restriction (eligible for everyone).
 * When present, the customer must match **any** listed segment (id or code).
 */
export type SegmentRestriction = {
  segmentIds: string[];
  segmentCodes: string[];
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
.filter((v): v is string => typeof v === 'string')
.map((v) => v.trim())
.filter(Boolean);
}

/**
 * Parse segment restriction from a jsonb bag (metadata / conditions).
 * Returns null when no segment keys are present or both lists are empty.
 */
export function extractSegmentRestriction(
  bag: Record<string, unknown> | null | undefined,
): SegmentRestriction | null {
  if (!bag || typeof bag !== 'object') {
    return null;
  }
  const segmentIds = asStringArray(bag.segmentIds);
  const segmentCodes = asStringArray(bag.segmentCodes).map((c) => c.toLowerCase());
  if (segmentIds.length === 0 && segmentCodes.length === 0) {
    return null;
  }
  return { segmentIds, segmentCodes };
}

/**
 * Build membership evaluation context from promotion apply input.
 * Tags / orderCount / spendMinor may be supplied via `metadata` stubs (v0.5).
 */
export function membershipContextFromApplyInput(
  input: Pick<PromotionApplyInput, 'customerId' | 'metadata'>,
): SegmentMembershipContext | null {
  const customerId = input.customerId?.trim();
  if (!customerId) {
    return null;
  }

  const meta = input.metadata ?? {};
  const tags = asStringArray(meta.tags);
  const orderCount =
    typeof meta.orderCount === 'number' && Number.isFinite(meta.orderCount)
      ? meta.orderCount
      : typeof meta.orderCount === 'string' && /^-?\d+$/.test(meta.orderCount)
        ? Number(meta.orderCount)
        : undefined;
  const spendMinor =
    typeof meta.spendMinor === 'string'
      ? meta.spendMinor
      : typeof meta.spendMinor === 'number' && Number.isFinite(meta.spendMinor)
        ? String(Math.trunc(meta.spendMinor))
        : undefined;

  return {
    customerId,
    tags: tags.length > 0 ? tags : undefined,
    orderCount,
    spendMinor,
  };
}

export function hasSegmentRestriction(restriction: SegmentRestriction | null): boolean {
  return restriction != null;
}
