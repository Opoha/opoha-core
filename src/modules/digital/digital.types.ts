import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('DigitalDownloadToken', {
  description: 'Secure download entitlement for a digital order line',
})
export class DigitalDownloadTokenType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, {
    description: 'Opaque bearer token embedded in download URLs',
  })
  token!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  orderLineId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, { nullable: true })
  customerId!: string | null;

  @Field(() => String, {
    description: 'Authorized asset URL (stub path until storage wiring)',
  })
  assetUrl!: string;

  @Field(() => String, {
    description: 'active | exhausted | revoked | expired',
  })
  status!: string;

  @Field(() => Int)
  maxDownloads!: number;

  @Field(() => Int)
  downloadCount!: number;

  @Field(() => Date, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('DigitalLicenseKey', {
  description: 'License key issued with digital fulfillment',
})
export class DigitalLicenseKeyType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  licenseKey!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  orderLineId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, { nullable: true })
  customerId!: string | null;

  @Field(() => String, {
    description: 'active | revoked | expired',
  })
  status!: string;

  @Field(() => Date, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('DigitalFulfillmentResult', {
  description: 'Download tokens + license keys issued for an order',
})
export class DigitalFulfillmentResultType {
  @Field(() => ID)
  orderId!: string;

  @Field(() => [DigitalDownloadTokenType])
  downloadTokens!: DigitalDownloadTokenType[];

  @Field(() => [DigitalLicenseKeyType])
  licenseKeys!: DigitalLicenseKeyType[];
}
