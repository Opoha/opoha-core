/**
 * Pure currency conversion helpers.
 *
 * ## Rounding (documented contract)
 *
 * - Intermediate: `amountMinor × rate` in IEEE-754 float (safe for typical cart
 *   magnitudes well below Number.MAX_SAFE_INTEGER).
 * - Final minor units: **half-up** toward +∞ for positive amounts
 *   (`Math.round` on non-negative values) → nearest integer minor unit.
 * - Same-currency: rate `1`, identity (no rounding drift).
 * - Opoha stores all money as **2-decimal minor units** (same as
 *   `formatMinorAmount`); with a shared exponent, a major-unit FX rate
 *   multiplies minor amounts directly.
 */

export const CURRENCY_ROUNDING_MODE = 'half_up' as const;

export type CurrencyRoundingMode = typeof CURRENCY_ROUNDING_MODE;

/**
 * Round a non-negative float to the nearest integer minor unit (half-up).
 */
export function roundHalfUpToMinor(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new Error('converted amount must be finite');
  }
  if (value < 0) {
    // Mirror half-up toward −∞ for negatives (rare for cart display).
    return -BigInt(Math.round(-value));
  }
  return BigInt(Math.round(value));
}

/**
 * Convert a minor-unit amount using an FX rate
 * (`1 fromCurrency = rate × toCurrency` in major units).
 *
 * Rate is quantized to 12 decimal places before multiply so half-up
 * boundaries are stable under IEEE-754 (e.g. 100 × 1.005 → 101).
 */
export function convertMinorWithRate(amountMinor: string | number | bigint, rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('rate must be a finite number greater than 0');
  }
  const minor = BigInt(String(amountMinor));
  if (rate === 1) {
    return minor.toString();
  }
  const RATE_SCALE = 1_000_000_000_000; // 12 decimal places
  const scaledRate = Math.round(rate * RATE_SCALE);
  const converted = (Number(minor) * scaledRate) / RATE_SCALE;
  return roundHalfUpToMinor(converted).toString();
}
