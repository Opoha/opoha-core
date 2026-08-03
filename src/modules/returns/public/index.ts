/**
 * Phase 3 E-01–E-03 — core RMA (returns) public surface.
 */
export { ReturnsModule } from '../returns.module';
export { ReturnsService } from '../returns.service';
export { ReturnsResolver } from '../returns.resolver';
export {
  ReturnEntity,
  ReturnLineEntity,
  returnEntities,
} from '../entities';
export type { ReturnStatus, ReturnResolution } from '../entities';
export {
  RETURN_STATUSES,
  RETURN_RESOLUTIONS,
  RETURN_STATUS_TRANSITIONS,
  canTransitionReturnStatus,
  isReturnStatus,
  isReturnResolution,
} from '../return-status';
export {
  CreateReturnInput,
  CreateReturnLineInput,
  CompleteRefundInput,
  ReturnLineType,
  ReturnType,
} from '../returns.types';
export {
  returnRequestedDataSchema,
  refundCompletedDataSchema,
  returnEventSchemas,
} from '../events/return-events';
export type {
  ReturnRequestedData,
  ReturnRequestedEvent,
  RefundCompletedData,
  RefundCompletedEvent,
} from '../events/return-events';
