/**
 * Public B2B module surface.
 */
export { B2bModule } from '../b2b.module';
export { CompanyService } from '../company.service';
export { B2bQuoteService } from '../b2b-quote.service';
export {
  CompanyEntity,
  CompanyMembershipEntity,
  CompanyPriceEntity,
  B2bQuoteEntity,
  B2bQuoteLineEntity,
  COMPANY_BUYER_ROLES,
  B2B_QUOTE_STATUSES,
  isCompanyBuyerRole,
  isB2bQuoteStatus,
  b2bEntities,
} from '../entities';
export type { CompanyBuyerRole, B2bQuoteStatus } from '../entities';
export {
  CompanyType,
  CompanyMembershipType,
  CompanyPriceListItemType,
  CreateCompanyInput,
  UpdateCompanyInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberRoleInput,
  RemoveCompanyMemberInput,
  SetCompanyPriceListItemInput,
  RemoveCompanyPriceListItemInput,
  ApproveB2bOrderInput,
  ConfirmB2bOrderInput,
} from '../company.types';
export {
  B2bQuoteType,
  B2bQuoteLineType,
  CreateB2bQuoteInput,
  CreateB2bQuoteLineInput,
  ConvertB2bQuoteInput,
} from '../b2b-quote.types';
export type {
  CompanyCreatedData,
  CompanyCreatedEvent,
  CompanyMembershipUpdatedData,
  CompanyMembershipUpdatedEvent,
} from '../events/company-events';
export type {
  B2bQuoteCreatedData,
  B2bQuoteCreatedEvent,
  B2bQuoteStatusChangedData,
  B2bQuoteStatusChangedEvent,
  B2bQuoteConvertedData,
  B2bQuoteConvertedEvent,
} from '../events/b2b-quote-events';
