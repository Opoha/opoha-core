import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Line on a B2B buyer quote' })
export class B2bQuoteLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  quoteId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, {
    description: 'Quoted unit price in minor units',
  })
  unitPriceMinor!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({
  description:
 'B2B buyer quote / purchase-order foundation. ' +
    'Distinct from supply-module purchase orders.',
})
export class B2bQuoteType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  storeId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional buyer PO number (external reference)',
  })
  poNumber!: string | null;

  @Field(() => String, {
    description: 'draft | submitted | accepted | converted | cancelled',
  })
  status!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Draft order id after convertQuoteToOrder',
  })
  orderId!: string | null;

  @Field(() => [B2bQuoteLineType])
  lines!: B2bQuoteLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateB2bQuoteLineInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, {
    description: 'Quoted unit price in minor units (non-negative integer)',
  })
  unitPriceMinor!: string;
}

@InputType()
export class CreateB2bQuoteInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID, {
    description: 'Buyer customer creating the quote (must be buyer/admin)',
  })
  customerId!: string;

  @Field(() => [CreateB2bQuoteLineInput])
  lines!: CreateB2bQuoteLineInput[];

  @Field(() => String, {
    nullable: true,
    description: 'Optional buyer purchase-order number',
  })
  poNumber?: string;

  @Field(() => String, { nullable: true })
  currencyCode?: string;

  @Field(() => String, { nullable: true })
  notes?: string;
}

@InputType()
export class ConvertB2bQuoteInput {
  @Field(() => ID)
  quoteId!: string;
}
