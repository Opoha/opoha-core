/**
 * Public segments module surface (Phase 4 E-01 / E-02).
 */
export { SegmentsModule } from '../segments.module';
export { SegmentsService } from '../segments.service';
export { CustomerSegmentEntity, segmentEntities } from '../entities';
export {
  evaluateSegmentRules,
  type SegmentRules,
  type SegmentTagRules,
  type SegmentOrderCountRules,
  type SegmentSpendRules,
  type SegmentMembershipContext,
} from '../segment-rules';
export type {
  CustomerSegmentType,
  CreateCustomerSegmentInput,
  UpdateCustomerSegmentInput,
} from '../segments.types';
export {
  segmentEventSchemas,
  segmentUpdatedDataSchema,
} from '../events/segment-events';
export type {
  SegmentUpdatedData,
  SegmentUpdatedEvent,
} from '../events/segment-events';
