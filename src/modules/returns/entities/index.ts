import { ReturnLineEntity } from './return-line.entity';
import { ReturnEntity } from './return.entity';

export const returnEntities = [ReturnEntity, ReturnLineEntity] as const;

export { ReturnEntity, ReturnLineEntity };
export type { ReturnStatus } from '../return-status';
export type { ReturnResolution } from '../return-status';
