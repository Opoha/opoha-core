import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum AttributeValueTypeEnum {
  text = 'text',
  number = 'number',
  boolean = 'boolean',
}

export enum AttributeAppliesToEnum {
  product = 'product',
  variant = 'variant',
  both = 'both',
}

registerEnumType(AttributeValueTypeEnum, {
  name: 'AttributeValueKind',
  description: 'How attribute values are interpreted',
});

registerEnumType(AttributeAppliesToEnum, {
  name: 'AttributeAppliesTo',
  description: 'Whether the attribute applies to products, variants, or both',
});

@ObjectType({ description: 'Catalog attribute definition' })
export class AttributeDefinitionType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => AttributeValueTypeEnum)
  valueType!: AttributeValueTypeEnum;

  @Field(() => AttributeAppliesToEnum)
  appliesTo!: AttributeAppliesToEnum;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('AttributeValue', {
  description: 'Attribute value on a product or variant',
})
export class AttributeValueType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  attributeDefinitionId!: string;

  @Field(() => ID, { nullable: true })
  productId!: string | null;

  @Field(() => ID, { nullable: true })
  variantId!: string | null;

  @Field(() => String)
  value!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateAttributeDefinitionInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => AttributeValueTypeEnum, {
    nullable: true,
    defaultValue: AttributeValueTypeEnum.text,
  })
  valueType?: AttributeValueTypeEnum;

  @Field(() => AttributeAppliesToEnum, {
    nullable: true,
    defaultValue: AttributeAppliesToEnum.both,
  })
  appliesTo?: AttributeAppliesToEnum;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType()
export class UpdateAttributeDefinitionInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => AttributeValueTypeEnum, { nullable: true })
  valueType?: AttributeValueTypeEnum;

  @Field(() => AttributeAppliesToEnum, { nullable: true })
  appliesTo?: AttributeAppliesToEnum;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class SetProductAttributeInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID)
  attributeDefinitionId!: string;

  @Field(() => String)
  value!: string;
}

@InputType()
export class SetVariantAttributeInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID)
  attributeDefinitionId!: string;

  @Field(() => String)
  value!: string;
}
