import { randomBytes } from 'node:crypto';

/** Gift card lifecycle statuses (Phase 4 C-01). */
export const GIFT_CARD_STATUSES = ['active', 'redeemed', 'disabled', 'expired'] as const;

export type GiftCardStatus = (typeof GIFT_CARD_STATUSES)[number];

export function isGiftCardStatus(value: string): value is GiftCardStatus {
  return (GIFT_CARD_STATUSES as readonly string[]).includes(value);
}

export const GIFT_CARD_TRANSACTION_TYPES = ['issue', 'purchase', 'redeem', 'adjust'] as const;

export type GiftCardTransactionType = (typeof GIFT_CARD_TRANSACTION_TYPES)[number];

/**
 * Allowed status transitions. `redeemed`, `disabled`, `expired` are terminal —
 * balance adjustments happen via ledger rows, not status re-entry.
 */
export const GIFT_CARD_STATUS_TRANSITIONS: Readonly<
  Record<GiftCardStatus, readonly GiftCardStatus[]>
> = {
  active: ['redeemed', 'disabled', 'expired'],
  redeemed: [],
  disabled: [],
  expired: [],
};

export function canTransitionGiftCardStatus(from: GiftCardStatus, to: GiftCardStatus): boolean {
  return GIFT_CARD_STATUS_TRANSITIONS[from].includes(to);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate a human-shareable gift card code, e.g. `GC-XXXX-XXXX-XXXX`. */
export function generateGiftCardCode(): string {
  const bytes = randomBytes(12);
  let raw = '';
  for (const byte of bytes) {
    raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `GC-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
