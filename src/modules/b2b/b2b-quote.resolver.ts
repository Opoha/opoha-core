import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { B2bQuoteService } from './b2b-quote.service';
import { B2bQuoteType, CreateB2bQuoteInput } from './b2b-quote.types';

@Resolver(() => B2bQuoteType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class B2bQuoteResolver {
  constructor(private readonly quotes: B2bQuoteService) {}

  @Query(() => [B2bQuoteType], {
    name: 'b2bQuotes',
    description: 'List B2B buyer quotes. Optional companyId filter.',
  })
  @RequirePermission('b2b:read')
  b2bQuotes(
    @Args('companyId', { type: () => ID, nullable: true }) companyId?: string,
  ): Promise<B2bQuoteType[]> {
    return this.quotes.findAll(companyId);
  }

  @Query(() => B2bQuoteType, {
    name: 'b2bQuote',
    description: 'Get a B2B buyer quote by id',
  })
  @RequirePermission('b2b:read')
  b2bQuote(@Args('id', { type: () => ID }) id: string): Promise<B2bQuoteType> {
    return this.quotes.findById(id);
  }

  @Mutation(() => B2bQuoteType, {
    name: 'createB2bQuote',
    description:
      'Create a draft B2B quote / buyer PO foundation document (F-05)',
  })
  @RequirePermission('b2b:create')
  createB2bQuote(
    @Args('input', { type: () => CreateB2bQuoteInput })
    input: CreateB2bQuoteInput,
  ): Promise<B2bQuoteType> {
    return this.quotes.create(input);
  }

  @Mutation(() => B2bQuoteType, {
    name: 'submitB2bQuote',
    description: 'Submit a draft quote for acceptance (draft → submitted)',
  })
  @RequirePermission('b2b:update')
  submitB2bQuote(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<B2bQuoteType> {
    return this.quotes.submit(id);
  }

  @Mutation(() => B2bQuoteType, {
    name: 'acceptB2bQuote',
    description: 'Accept a submitted quote (submitted → accepted)',
  })
  @RequirePermission('b2b:update')
  acceptB2bQuote(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<B2bQuoteType> {
    return this.quotes.accept(id);
  }

  @Mutation(() => B2bQuoteType, {
    name: 'cancelB2bQuote',
    description: 'Cancel a non-terminal quote',
  })
  @RequirePermission('b2b:update')
  cancelB2bQuote(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<B2bQuoteType> {
    return this.quotes.cancel(id);
  }
}
