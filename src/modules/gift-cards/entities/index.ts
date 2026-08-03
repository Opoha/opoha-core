import { GiftCardTransactionEntity } from './gift-card-transaction.entity';
import { GiftCardEntity } from './gift-card.entity';

export const giftCardEntities = [
  GiftCardEntity,
  GiftCardTransactionEntity,
] as const;

export { GiftCardEntity, GiftCardTransactionEntity };
export type {
  GiftCardStatus,
  GiftCardTransactionType,
} from '../gift-card-status';
