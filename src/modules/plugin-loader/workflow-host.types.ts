import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('WorkflowDefinition', {
  description:
    'Multi-step workflow definition (plugin-owned via workflow.engine)',
})
export class WorkflowDefinitionGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    description: 'Domain event that starts this workflow',
  })
  triggerEvent!: string;

  @Field(() => String, {
    description: 'JSON-encoded WorkflowStep[]',
  })
  stepsJson!: string;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('WorkflowRun', {
  description: 'Workflow execution run (plugin-owned via workflow.engine)',
})
export class WorkflowRunGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  workflowCode!: string;

  @Field(() => String)
  triggerEvent!: string;

  @Field(() => String)
  aggregateId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, {
    description: 'JSON-encoded step results',
  })
  stepResultsJson!: string;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => Date)
  startedAt!: Date;

  @Field(() => Date, { nullable: true })
  finishedAt!: Date | null;
}

@InputType({
  description: 'Upsert a workflow definition via workflow.engine provider',
})
export class UpsertWorkflowDefinitionGqlInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  triggerEvent?: string;

  @Field(() => String, {
    description: 'JSON-encoded WorkflowStep[] (at least one step)',
  })
  stepsJson!: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => ID, { nullable: true })
  id?: string;
}
