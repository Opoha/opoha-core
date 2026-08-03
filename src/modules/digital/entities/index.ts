import { DigitalDownloadTokenEntity } from './download-token.entity';
import { DigitalLicenseKeyEntity } from './license-key.entity';

export const digitalEntities = [
  DigitalDownloadTokenEntity,
  DigitalLicenseKeyEntity,
] as const;

export { DigitalDownloadTokenEntity, DigitalLicenseKeyEntity };
export type {
  DigitalDownloadTokenStatus,
  DigitalLicenseKeyStatus,
} from '../digital-status';
