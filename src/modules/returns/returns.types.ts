import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import type { ReturnResolution, ReturnStatus } from './return-status';

@ObjectType('ReturnLine', {
  description: 'One order line quantity on an RMA',
})
export class ReturnLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  returnId!: string;

  @Field(() => ID)
  orderLineId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('Return', {
  description: 'Core RMA: requested → approved → received → refunded|exchanged',
})
export class ReturnType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => String)
  status!: ReturnStatus;

  @Field(() => String)
  resolution!: ReturnResolution;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => ID, { nullable: true })
  paymentId!: string | null;

  @Field(() => ID, { nullable: true })
  replacementOrderId!: string | null;

  @Field(() => String, { nullable: true })
  refundAmountMinor!: string | null;

  @Field(() => Date, { nullable: true })
  approvedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  receivedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field(() => [ReturnLineType])
  lines!: ReturnLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateReturnLineInput {
  @Field(() => ID)
  orderLineId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class CreateReturnInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => String, {
    description: 'Intended resolution: refund or exchange',
  })
  resolution!: ReturnResolution;

  @Field(() => String, { nullable: true })
  reason?: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => [CreateReturnLineInput])
  lines!: CreateReturnLineInput[];
}

@InputType()
export class CompleteRefundInput {
  @Field(() => ID)
  returnId!: string;

  /** Defaults to the first captured payment on the order. */
  @Field(() => ID, { nullable: true })
  paymentId?: string;

  /** Partial refund in minor units; defaults to sum of returned line totals. */
  @Field(() => String, { nullable: true })
  amountMinor?: string;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}
