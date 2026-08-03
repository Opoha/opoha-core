import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('CustomerSegment', {
  description: 'Rule-based customer segment for promotions',
})
export class CustomerSegmentGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded SegmentRules (tags / orderCount / spendMinor)',
  })
  rulesJson!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType({ description: 'Create a customer segment' })
export class CreateCustomerSegmentGqlInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded SegmentRules object',
  })
  rulesJson?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType({ description: 'Update a customer segment' })
export class UpdateCustomerSegmentGqlInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded SegmentRules object; omit to leave unchanged',
  })
  rulesJson?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType({
  description:
    'Evaluate whether a customer context matches a segment (tags/orderCount/spend stubs)',
})
export class EvaluateSegmentMembershipInput {
  @Field(() => ID, {
    nullable: true,
    description: 'Segment id (prefer over code when both set)',
  })
  segmentId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Segment code when segmentId is omitted',
  })
  segmentCode?: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Customer tags stub for rule evaluation',
  })
  tags?: string[];

  @Field(() => Int, {
    nullable: true,
    description: 'Order count stub for rule evaluation',
  })
  orderCount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Lifetime spend stub in minor units',
  })
  spendMinor?: string;
}

@ObjectType('SegmentMembershipResult', {
  description: 'Result of evaluating segment membership for a customer context',
})
export class SegmentMembershipResultType {
  @Field(() => Boolean)
  matches!: boolean;

  @Field(() => ID)
  segmentId!: string;

  @Field(() => String)
  segmentCode!: string;
}
