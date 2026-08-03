/**
 * Public digital fulfillment module surface (Phase 7 D-01/D-02/D-03).
 */
export { DigitalModule } from '../digital.module';
export { DigitalFulfillmentService, isNonPhysicalFulfillment } from '../digital-fulfillment.service';
export type { IssueDigitalLineInput } from '../digital-fulfillment.service';
export { DigitalResolver } from '../digital.resolver';
export {
  DigitalDownloadTokenEntity,
  DigitalLicenseKeyEntity,
  digitalEntities,
} from '../entities';
export {
  DIGITAL_DOWNLOAD_TOKEN_STATUSES,
  DIGITAL_LICENSE_KEY_STATUSES,
  isDigitalDownloadTokenStatus,
  isDigitalLicenseKeyStatus,
  generateDownloadToken,
  generateLicenseKey,
  defaultDigitalAssetUrl,
} from '../digital-status';
export type {
  DigitalDownloadTokenStatus,
  DigitalLicenseKeyStatus,
} from '../digital-status';
export {
  DigitalDownloadTokenType,
  DigitalLicenseKeyType,
  DigitalFulfillmentResultType,
} from '../digital.types';
export {
  digitalEventSchemas,
  digitalFulfillmentIssuedDataSchema,
} from '../events/digital-events';
export type {
  DigitalFulfillmentIssuedData,
  DigitalFulfillmentIssuedEvent,
} from '../events/digital-events';
