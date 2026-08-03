import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Hierarchical product taxonomy node' })
export class CategoryType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateCategoryInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  sortOrder?: number;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType()
export class UpdateCategoryInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  parentId?: string | null;

  @Field(() => Int, { nullable: true })
  sortOrder?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
