/** Loyalty ledger transaction kinds. */
export const LOYALTY_TRANSACTION_TYPES = ['accrue', 'redeem', 'adjust'] as const;

export type LoyaltyTransactionType = (typeof LOYALTY_TRANSACTION_TYPES)[number];

export function isLoyaltyTransactionType(value: string): value is LoyaltyTransactionType {
  return (LOYALTY_TRANSACTION_TYPES as readonly string[]).includes(value);
}

/**
 * MVP accrual/redemption rates (v0.5 simplification — not yet per-store
 * configurable; revisit alongside customer segments / promotions tuning).
 */
export const LOYALTY_ACCRUAL_MINOR_UNITS_PER_POINT = 100n;
export const LOYALTY_REDEMPTION_MINOR_UNITS_PER_POINT = 1n;

/** Points earned for a captured order total (floor division, minor units). */
export function computeAccrualPoints(totalMinor: string | bigint): number {
  const total = BigInt(totalMinor);
  if (total <= 0n) {
    return 0;
  }
  return Number(total / LOYALTY_ACCRUAL_MINOR_UNITS_PER_POINT);
}

/** Money value (minor units) redeemed for a given point count. */
export function computeRedemptionValueMinor(points: number): string {
  return (BigInt(points) * LOYALTY_REDEMPTION_MINOR_UNITS_PER_POINT).toString();
}
