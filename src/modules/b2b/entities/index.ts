import { B2bQuoteEntity } from './b2b-quote.entity';
import { B2bQuoteLineEntity } from './b2b-quote-line.entity';
import { CompanyEntity } from './company.entity';
import {
  COMPANY_BUYER_ROLES,
  CompanyMembershipEntity,
  isCompanyBuyerRole,
} from './company-membership.entity';
import { CompanyPriceEntity } from './company-price.entity';

export const b2bEntities = [
  CompanyEntity,
  CompanyMembershipEntity,
  CompanyPriceEntity,
  B2bQuoteEntity,
  B2bQuoteLineEntity,
] as const;

export {
  CompanyEntity,
  CompanyMembershipEntity,
  CompanyPriceEntity,
  B2bQuoteEntity,
  B2bQuoteLineEntity,
  COMPANY_BUYER_ROLES,
  isCompanyBuyerRole,
};
export type { CompanyBuyerRole } from './company-membership.entity';
export { B2B_QUOTE_STATUSES, isB2bQuoteStatus } from './b2b-quote.entity';
export type { B2bQuoteStatus } from './b2b-quote.entity';
