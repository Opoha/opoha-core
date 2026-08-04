import { LoyaltyAccountEntity } from './loyalty-account.entity';
import { LoyaltyTransactionEntity } from './loyalty-transaction.entity';

export const loyaltyEntities = [LoyaltyAccountEntity, LoyaltyTransactionEntity] as const;

export { LoyaltyAccountEntity, LoyaltyTransactionEntity };
export type { LoyaltyTransactionType } from '../loyalty-status';
