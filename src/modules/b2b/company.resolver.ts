import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { CompanyService } from './company.service';
import {
  AddCompanyMemberInput,
  CompanyMembershipType,
  CompanyPriceListItemType,
  CompanyType,
  CreateCompanyInput,
  RemoveCompanyMemberInput,
  RemoveCompanyPriceListItemInput,
  SetCompanyPriceListItemInput,
  UpdateCompanyInput,
  UpdateCompanyMemberRoleInput,
} from './company.types';

@Resolver(() => CompanyType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CompanyResolver {
  constructor(private readonly companyService: CompanyService) {}

  @Query(() => [CompanyType], {
    name: 'companies',
    description: 'List B2B companies. Optional storeId filters to that store.',
  })
  @RequirePermission('b2b:read')
  companies(
    @Args('storeId', { type: () => ID, nullable: true }) storeId?: string,
  ): Promise<CompanyType[]> {
    return this.companyService.findAll(storeId);
  }

  @Query(() => CompanyType, {
    name: 'company',
    description: 'Get B2B company by id',
  })
  @RequirePermission('b2b:read')
  company(@Args('id', { type: () => ID }) id: string): Promise<CompanyType> {
    return this.companyService.findById(id);
  }

  @Query(() => [CompanyMembershipType], {
    name: 'companyMembers',
    description: 'List buyer memberships for a B2B company',
  })
  @RequirePermission('b2b:read')
  companyMembers(
    @Args('companyId', { type: () => ID }) companyId: string,
  ): Promise<CompanyMembershipType[]> {
    return this.companyService.listMembers(companyId);
  }

  @Query(() => [CompanyPriceListItemType], {
    name: 'companyPriceListItems',
 description: 'List customer-specific price list items for a company',
  })
  @RequirePermission('b2b:read')
  companyPriceListItems(
    @Args('companyId', { type: () => ID }) companyId: string,
  ): Promise<CompanyPriceListItemType[]> {
    return this.companyService.listPriceListItems(companyId);
  }

  @Mutation(() => CompanyType, {
    name: 'createCompany',
    description: 'Create a B2B company account',
  })
  @RequirePermission('b2b:create')
  createCompany(
    @Args('input', { type: () => CreateCompanyInput })
    input: CreateCompanyInput,
  ): Promise<CompanyType> {
    return this.companyService.create(input);
  }

  @Mutation(() => CompanyType, {
    name: 'updateCompany',
    description: 'Update a B2B company account',
  })
  @RequirePermission('b2b:update')
  updateCompany(
    @Args('input', { type: () => UpdateCompanyInput })
    input: UpdateCompanyInput,
  ): Promise<CompanyType> {
    return this.companyService.update(input);
  }

  @Mutation(() => CompanyMembershipType, {
    name: 'addCompanyMember',
    description: 'Add a buyer membership to a B2B company',
  })
  @RequirePermission('b2b:update')
  addCompanyMember(
    @Args('input', { type: () => AddCompanyMemberInput })
    input: AddCompanyMemberInput,
  ): Promise<CompanyMembershipType> {
    return this.companyService.addMember(input);
  }

  @Mutation(() => CompanyMembershipType, {
    name: 'updateCompanyMemberRole',
    description: "Update a company member's buyer role",
  })
  @RequirePermission('b2b:update')
  updateCompanyMemberRole(
    @Args('input', { type: () => UpdateCompanyMemberRoleInput })
    input: UpdateCompanyMemberRoleInput,
  ): Promise<CompanyMembershipType> {
    return this.companyService.updateMemberRole(input);
  }

  @Mutation(() => Boolean, {
    name: 'removeCompanyMember',
    description: 'Remove a buyer membership from a B2B company',
  })
  @RequirePermission('b2b:delete')
  removeCompanyMember(
    @Args('input', { type: () => RemoveCompanyMemberInput })
    input: RemoveCompanyMemberInput,
  ): Promise<boolean> {
    return this.companyService.removeMember(input);
  }

  @Mutation(() => CompanyPriceListItemType, {
    name: 'setCompanyPriceListItem',
 description: 'Create or update a customer-specific negotiated price for a variant',
  })
  @RequirePermission('b2b:update')
  setCompanyPriceListItem(
    @Args('input', { type: () => SetCompanyPriceListItemInput })
    input: SetCompanyPriceListItemInput,
  ): Promise<CompanyPriceListItemType> {
    return this.companyService.setPriceListItem(input);
  }

  @Mutation(() => Boolean, {
    name: 'removeCompanyPriceListItem',
 description: "Remove a company's negotiated price for a variant",
  })
  @RequirePermission('b2b:update')
  removeCompanyPriceListItem(
    @Args('input', { type: () => RemoveCompanyPriceListItemInput })
    input: RemoveCompanyPriceListItemInput,
  ): Promise<boolean> {
    return this.companyService.removePriceListItem(input);
  }
}
