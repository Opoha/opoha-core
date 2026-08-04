/**
 * Public gift-cards module surface.
 */
export { GiftCardsModule } from '../gift-cards.module';
export { GiftCardService } from '../gift-cards.service';
export { GiftCardsResolver } from '../gift-cards.resolver';
export { GiftCardEntity, GiftCardTransactionEntity, giftCardEntities } from '../entities';
export {
  GIFT_CARD_STATUSES,
  GIFT_CARD_TRANSACTION_TYPES,
  GIFT_CARD_STATUS_TRANSITIONS,
  isGiftCardStatus,
  canTransitionGiftCardStatus,
  generateGiftCardCode,
} from '../gift-card-status';
export type { GiftCardStatus, GiftCardTransactionType } from '../gift-card-status';
export {
  GiftCardType,
  GiftCardLedgerEntryType,
  QuoteGiftCardRedeemResult,
  IssueGiftCardInput,
  PurchaseGiftCardInput,
  RedeemGiftCardInput,
  QuoteGiftCardRedeemInput,
} from '../gift-cards.types';
export { giftCardEventSchemas, giftCardRedeemedDataSchema } from '../events/gift-card-events';
export type { GiftCardRedeemedData, GiftCardRedeemedEvent } from '../events/gift-card-events';
