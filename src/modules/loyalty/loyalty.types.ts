export type LoyaltyAccountType = {
  id: string;
  customerId: string;
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LoyaltyLedgerEntryType = {
  id: string;
  accountId: string;
  customerId: string;
  type: string;
  points: number;
  balanceAfter: number;
  orderId: string | null;
  note: string | null;
  createdAt: Date;
};

export type AccrueLoyaltyInput = {
  customerId: string;
  points: number;
  orderId?: string;
  note?: string;
};

export type RedeemLoyaltyInput = {
  customerId: string;
  points: number;
  orderId?: string;
  note?: string;
};

export type QuoteLoyaltyRedeemInput = {
  customerId: string;
  /** Requested points to redeem; capped by balance and maxAmountMinor. */
  points: number;
  /** Remaining payable total in minor units (post gift-card). */
  maxAmountMinor: string;
};

export type QuoteLoyaltyRedeemResult = {
  customerId: string;
  availablePoints: number;
  pointsToRedeem: number;
  appliedMinor: string;
};
