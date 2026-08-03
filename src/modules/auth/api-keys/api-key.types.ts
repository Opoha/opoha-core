import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Staff API key metadata (secret never returned after create)' })
export class ApiKeyType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { description: 'Non-secret prefix for identification' })
  keyPrefix!: string;

  @Field(() => [String])
  permissionKeys!: string[];

  @Field(() => Date, { nullable: true })
  lastUsedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType({ description: 'Create response — secret shown once' })
export class ApiKeyCreatedPayload {
  @Field(() => ApiKeyType)
  apiKey!: ApiKeyType;

  @Field(() => String, {
    description: 'Full API key secret — store immediately; not retrievable later',
  })
  secret!: string;
}

@InputType()
export class CreateApiKeyInput {
  @Field(() => String)
  name!: string;

  @Field(() => [String], {
    description: 'Permission keys scoped to this key (must be subset of creator grants)',
  })
  permissionKeys!: string[];
}
