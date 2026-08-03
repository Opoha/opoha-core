/**
 * Public loyalty module surface (Phase 4 C-03 / C-05).
 */
export { LoyaltyModule } from '../loyalty.module';
export { LoyaltyService } from '../loyalty.service';
export {
  LoyaltyAccountEntity,
  LoyaltyTransactionEntity,
  loyaltyEntities,
} from '../entities';
export type { LoyaltyTransactionType } from '../entities';
export {
  LOYALTY_TRANSACTION_TYPES,
  LOYALTY_ACCRUAL_MINOR_UNITS_PER_POINT,
  LOYALTY_REDEMPTION_MINOR_UNITS_PER_POINT,
  isLoyaltyTransactionType,
  computeAccrualPoints,
  computeRedemptionValueMinor,
} from '../loyalty-status';
export type {
  LoyaltyAccountType,
  LoyaltyLedgerEntryType,
  AccrueLoyaltyInput,
  RedeemLoyaltyInput,
  QuoteLoyaltyRedeemInput,
  QuoteLoyaltyRedeemResult,
} from '../loyalty.types';
export {
  loyaltyEventSchemas,
  loyaltyPointsAccruedDataSchema,
  loyaltyPointsRedeemedDataSchema,
} from '../events/loyalty-events';
export type {
  LoyaltyPointsAccruedData,
  LoyaltyPointsAccruedEvent,
  LoyaltyPointsRedeemedData,
  LoyaltyPointsRedeemedEvent,
} from '../events/loyalty-events';
