import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('RuleDefinition', {
  description: 'Declarative automation rule (conditions → actions)',
})
export class RuleDefinitionGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, {
    description: 'Domain event name that triggers evaluation',
  })
  eventName!: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded RuleConditions',
  })
  conditionsJson!: string | null;

  @Field(() => String, {
    description: 'JSON-encoded RuleActionRef[]',
  })
  actionRefsJson!: string;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => Int)
  priority!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType({ description: 'Create an automation rule' })
export class CreateRuleDefinitionGqlInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String)
  eventName!: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded RuleConditions object',
  })
  conditionsJson?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded RuleActionRef[]',
  })
  actionRefsJson?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  enabled?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  priority?: number;
}

@InputType({ description: 'Update an automation rule' })
export class UpdateRuleDefinitionGqlInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  eventName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded RuleConditions; omit to leave unchanged',
  })
  conditionsJson?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded RuleActionRef[]; omit to leave unchanged',
  })
  actionRefsJson?: string;

  @Field(() => Boolean, { nullable: true })
  enabled?: boolean;

  @Field(() => Int, { nullable: true })
  priority?: number;
}
