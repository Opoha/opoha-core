import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../../auth/public';
import {
  AttributeDefinitionType,
  AttributeValueType,
  CreateAttributeDefinitionInput,
  SetProductAttributeInput,
  SetVariantAttributeInput,
  UpdateAttributeDefinitionInput,
} from './attribute.types';
import { AttributesService } from './attributes.service';

@Resolver(() => AttributeDefinitionType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class AttributesResolver {
  constructor(private readonly attributesService: AttributesService) {}

  @Query(() => [AttributeDefinitionType], {
    name: 'attributeDefinitions',
    description: 'List catalog attribute definitions',
  })
  @RequirePermission('attribute:read')
  attributeDefinitions(): Promise<AttributeDefinitionType[]> {
    return this.attributesService.findAllDefinitions();
  }

  @Query(() => AttributeDefinitionType, {
    name: 'attributeDefinition',
    description: 'Get attribute definition by id',
  })
  @RequirePermission('attribute:read')
  attributeDefinition(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AttributeDefinitionType> {
    return this.attributesService.findDefinitionById(id);
  }

  @Query(() => [AttributeValueType], {
    name: 'productAttributes',
    description: 'List attribute values attached to a product',
  })
  @RequirePermission('attribute:read')
  productAttributes(
    @Args('productId', { type: () => ID }) productId: string,
  ): Promise<AttributeValueType[]> {
    return this.attributesService.listProductAttributes(productId);
  }

  @Query(() => [AttributeValueType], {
    name: 'variantAttributes',
    description: 'List attribute values attached to a variant',
  })
  @RequirePermission('attribute:read')
  variantAttributes(
    @Args('variantId', { type: () => ID }) variantId: string,
  ): Promise<AttributeValueType[]> {
    return this.attributesService.listVariantAttributes(variantId);
  }

  @Mutation(() => AttributeDefinitionType, {
    name: 'createAttributeDefinition',
    description: 'Create an attribute definition',
  })
  @RequirePermission('attribute:create')
  createAttributeDefinition(
    @Args('input', { type: () => CreateAttributeDefinitionInput })
    input: CreateAttributeDefinitionInput,
  ): Promise<AttributeDefinitionType> {
    return this.attributesService.createDefinition(input);
  }

  @Mutation(() => AttributeDefinitionType, {
    name: 'updateAttributeDefinition',
    description: 'Update an attribute definition',
  })
  @RequirePermission('attribute:update')
  updateAttributeDefinition(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateAttributeDefinitionInput })
    input: UpdateAttributeDefinitionInput,
  ): Promise<AttributeDefinitionType> {
    return this.attributesService.updateDefinition(id, input);
  }

  @Mutation(() => AttributeDefinitionType, {
    name: 'deleteAttributeDefinition',
    description: 'Delete an attribute definition and its values',
  })
  @RequirePermission('attribute:delete')
  deleteAttributeDefinition(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AttributeDefinitionType> {
    return this.attributesService.removeDefinition(id);
  }

  @Mutation(() => AttributeValueType, {
    name: 'setProductAttribute',
    description: 'Set (upsert) an attribute value on a product',
  })
  @RequirePermission('attribute:update')
  setProductAttribute(
    @Args('input', { type: () => SetProductAttributeInput })
    input: SetProductAttributeInput,
  ): Promise<AttributeValueType> {
    return this.attributesService.setProductAttribute(input);
  }

  @Mutation(() => AttributeValueType, {
    name: 'setVariantAttribute',
    description: 'Set (upsert) an attribute value on a variant',
  })
  @RequirePermission('attribute:update')
  setVariantAttribute(
    @Args('input', { type: () => SetVariantAttributeInput })
    input: SetVariantAttributeInput,
  ): Promise<AttributeValueType> {
    return this.attributesService.setVariantAttribute(input);
  }

  @Mutation(() => AttributeValueType, {
    name: 'removeAttributeValue',
    description: 'Remove an attribute value from a product or variant',
  })
  @RequirePermission('attribute:delete')
  removeAttributeValue(@Args('id', { type: () => ID }) id: string): Promise<AttributeValueType> {
    return this.attributesService.removeAttributeValue(id);
  }
}
