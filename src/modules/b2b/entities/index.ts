import { CompanyEntity } from './company.entity';
import {
  COMPANY_BUYER_ROLES,
  CompanyMembershipEntity,
  isCompanyBuyerRole,
} from './company-membership.entity';

export const b2bEntities = [CompanyEntity, CompanyMembershipEntity] as const;

export {
  CompanyEntity,
  CompanyMembershipEntity,
  COMPANY_BUYER_ROLES,
  isCompanyBuyerRole,
};
export type { CompanyBuyerRole } from './company-membership.entity';
