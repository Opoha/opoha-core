/**
 * Public gift-cards module surface (Phase 4 C-01/C-02).
 */
export { GiftCardsModule } from '../gift-cards.module';
export { GiftCardService } from '../gift-cards.service';
export {
  GiftCardEntity,
  GiftCardTransactionEntity,
  giftCardEntities,
} from '../entities';
export {
  GIFT_CARD_STATUSES,
  GIFT_CARD_TRANSACTION_TYPES,
  GIFT_CARD_STATUS_TRANSITIONS,
  isGiftCardStatus,
  canTransitionGiftCardStatus,
  generateGiftCardCode,
} from '../gift-card-status';
export type {
  GiftCardStatus,
  GiftCardTransactionType,
} from '../gift-card-status';
export type {
  GiftCardType,
  GiftCardLedgerEntryType,
  IssueGiftCardInput,
  PurchaseGiftCardInput,
  RedeemGiftCardInput,
  QuoteGiftCardRedeemInput,
  QuoteGiftCardRedeemResult,
} from '../gift-cards.types';
