import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('JobDefinition', {
  description: 'Scheduled job definition (cron + observability)',
})
export class JobDefinitionGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  cronExpression!: string;

  @Field(() => String)
  timezone!: string;

  @Field(() => String)
  handlerKey!: string;

  @Field(() => String, { nullable: true })
  ownerPluginId!: string | null;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('JobRun', {
  description: 'Scheduled job run history row',
})
export class JobRunGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  jobDefinitionId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Int)
  attempt!: number;

  @Field(() => String, { nullable: true })
  queueJobId!: string | null;

  @Field(() => Date, { nullable: true })
  startedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  finishedAt!: Date | null;

  @Field(() => String, { nullable: true })
  errorMessage!: string | null;

  @Field(() => Date)
  createdAt!: Date;
}
