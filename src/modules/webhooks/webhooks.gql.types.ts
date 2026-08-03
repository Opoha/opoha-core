import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('WebhookEndpoint', {
  description: 'Outbound webhook endpoint subscription',
})
export class WebhookEndpointGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  url!: string;

  @Field(() => String, {
    description: 'Masked as *** on read; plaintext only on create / secret rotate',
  })
  secret!: string;

  @Field(() => [String])
  eventNames!: string[];

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('WebhookDeliveryAttempt', {
  description: 'Outbound webhook delivery attempt / log entry',
})
export class WebhookDeliveryAttemptGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  endpointId!: string;

  @Field(() => String)
  eventName!: string;

  @Field(() => String)
  eventId!: string;

  @Field(() => String, { description: 'JSON-encoded payload' })
  payloadJson!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Int)
  attempt!: number;

  @Field(() => Date, { nullable: true })
  nextAttemptAt!: Date | null;

  @Field(() => Int, { nullable: true })
  responseStatus!: number | null;

  @Field(() => String, { nullable: true })
  responseBody!: string | null;

  @Field(() => String, { nullable: true })
  errorMessage!: string | null;

  @Field(() => String, { nullable: true })
  signature!: string | null;

  @Field(() => Date, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}

@InputType({ description: 'Create an outbound webhook endpoint' })
export class CreateWebhookEndpointGqlInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  url!: string;

  @Field(() => String)
  secret!: string;

  @Field(() => [String])
  eventNames!: string[];

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  enabled?: boolean;
}

@InputType({ description: 'Update an outbound webhook endpoint' })
export class UpdateWebhookEndpointGqlInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  url?: string;

  @Field(() => String, { nullable: true })
  secret?: string;

  @Field(() => [String], { nullable: true })
  eventNames?: string[];

  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;
}
