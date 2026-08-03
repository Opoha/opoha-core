import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('AuditLog')
export class AuditLogType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  actorUserId!: string | null;

  @Field(() => String)
  action!: string;

  @Field(() => String, { nullable: true })
  resourceType!: string | null;

  @Field(() => String, { nullable: true })
  resourceId!: string | null;

  /** JSON-encoded metadata (no secrets). */
  @Field(() => String, { nullable: true })
  metadataJson!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
