import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Product media link to a files abstraction record' })
export class ProductMediaType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => ID)
  fileId!: string;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => String, { nullable: true })
  altText!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class AttachProductMediaInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID)
  fileId!: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  sortOrder?: number;

  @Field(() => String, { nullable: true })
  altText?: string;
}

@InputType()
export class UpdateProductMediaInput {
  @Field(() => Int, { nullable: true })
  sortOrder?: number;

  @Field(() => String, { nullable: true })
  altText?: string;
}
