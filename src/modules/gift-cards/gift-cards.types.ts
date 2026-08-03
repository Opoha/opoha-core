export type GiftCardType = {
  id: string;
  code: string;
  currencyCode: string;
  initialBalanceMinor: string;
  balanceMinor: string;
  status: string;
  issuedToCustomerId: string | null;
  purchasedByCustomerId: string | null;
  purchaseOrderId: string | null;
  expiresAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GiftCardLedgerEntryType = {
  id: string;
  giftCardId: string;
  type: string;
  amountMinor: string;
  balanceAfterMinor: string;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
};

export type IssueGiftCardInput = {
  currencyCode: string;
  amountMinor: string;
  code?: string;
  customerId?: string | null;
  expiresAt?: Date | null;
  note?: string;
};

export type PurchaseGiftCardInput = {
  orderId: string;
  currencyCode: string;
  amountMinor: string;
  code?: string;
  customerId?: string | null;
  expiresAt?: Date | null;
  note?: string;
};

export type RedeemGiftCardInput = {
  code: string;
  amountMinor: string;
  orderId?: string | null;
  note?: string;
};

export type QuoteGiftCardRedeemInput = {
  code: string;
  currencyCode: string;
  /** Max amount that may be applied (usually remaining checkout total). */
  maxAmountMinor: string;
};

export type QuoteGiftCardRedeemResult = {
  giftCardId: string;
  code: string;
  currencyCode: string;
  availableMinor: string;
  appliedMinor: string;
};
