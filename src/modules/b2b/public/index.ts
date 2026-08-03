/**
 * Public B2B module surface (Phase 5 F).
 */
export { B2bModule } from '../b2b.module';
export { CompanyService } from '../company.service';
export {
  CompanyEntity,
  CompanyMembershipEntity,
  COMPANY_BUYER_ROLES,
  isCompanyBuyerRole,
  b2bEntities,
} from '../entities';
export type { CompanyBuyerRole } from '../entities';
export {
  CompanyType,
  CompanyMembershipType,
  CreateCompanyInput,
  UpdateCompanyInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberRoleInput,
  RemoveCompanyMemberInput,
  ApproveB2bOrderInput,
  ConfirmB2bOrderInput,
} from '../company.types';
export type {
  CompanyCreatedData,
  CompanyCreatedEvent,
  CompanyMembershipUpdatedData,
  CompanyMembershipUpdatedEvent,
} from '../events/company-events';
