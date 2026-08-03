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
] as const;

export {
  CompanyEntity,
  CompanyMembershipEntity,
  CompanyPriceEntity,
  COMPANY_BUYER_ROLES,
  isCompanyBuyerRole,
};
export type { CompanyBuyerRole } from './company-membership.entity';
