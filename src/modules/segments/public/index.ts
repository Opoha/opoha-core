/**
 * Public segments module surface (Phase 4 E-01 / E-02 / E-04).
 */
export { SegmentsModule } from '../segments.module';
export { SegmentsService } from '../segments.service';
export { SegmentsResolver } from '../segments.resolver';
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
  CustomerSegmentGqlType,
  CreateCustomerSegmentGqlInput,
  UpdateCustomerSegmentGqlInput,
  EvaluateSegmentMembershipInput,
  SegmentMembershipResultType,
} from '../segments.gql.types';
export {
  segmentEventSchemas,
  segmentUpdatedDataSchema,
} from '../events/segment-events';
export type {
  SegmentUpdatedData,
  SegmentUpdatedEvent,
} from '../events/segment-events';
