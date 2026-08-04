import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { ExchangeRateService } from './exchange-rate.service';
import {
  CreateExchangeRateInput,
  ExchangeRateType,
  SyncExchangeRatesInput,
  UpdateExchangeRateInput,
} from './exchange-rate.types';

@Resolver(() => ExchangeRateType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ExchangeRateResolver {
  constructor(private readonly rates: ExchangeRateService) {}

  @Query(() => [ExchangeRateType], {
    name: 'exchangeRates',
    description: 'List exchange rates (optional from/to filters)',
  })
  @RequirePermission('currency:read')
  exchangeRates(
    @Args('fromCurrencyCode', { type: () => String, nullable: true })
    fromCurrencyCode?: string,
    @Args('toCurrencyCode', { type: () => String, nullable: true })
    toCurrencyCode?: string,
  ): Promise<ExchangeRateType[]> {
    return this.rates.findAll({ fromCurrencyCode, toCurrencyCode });
  }

  @Query(() => ExchangeRateType, {
    name: 'exchangeRate',
    description: 'Get an exchange rate by id',
  })
  @RequirePermission('currency:read')
  exchangeRate(@Args('id', { type: () => ID }) id: string): Promise<ExchangeRateType> {
    return this.rates.findById(id);
  }

  @Mutation(() => ExchangeRateType, {
    name: 'createExchangeRate',
    description: 'Create a manual exchange rate for a currency pair',
  })
  @RequirePermission('currency:update')
  createExchangeRate(
    @Args('input', { type: () => CreateExchangeRateInput })
    input: CreateExchangeRateInput,
  ): Promise<ExchangeRateType> {
    return this.rates.create(input);
  }

  @Mutation(() => ExchangeRateType, {
    name: 'updateExchangeRate',
    description: 'Update rate and/or source for an existing exchange rate',
  })
  @RequirePermission('currency:update')
  updateExchangeRate(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateExchangeRateInput })
    input: UpdateExchangeRateInput,
  ): Promise<ExchangeRateType> {
    return this.rates.update(id, input);
  }

  @Mutation(() => ExchangeRateType, {
    name: 'upsertExchangeRate',
    description: 'Create or update an exchange rate by currency pair (manual / provider)',
  })
  @RequirePermission('currency:update')
  upsertExchangeRate(
    @Args('input', { type: () => CreateExchangeRateInput })
    input: CreateExchangeRateInput,
  ): Promise<ExchangeRateType> {
    return this.rates.upsert(input);
  }

  @Mutation(() => ExchangeRateType, {
    name: 'deleteExchangeRate',
    description: 'Delete an exchange rate; publishes ExchangeRateUpdated(deleted)',
  })
  @RequirePermission('currency:update')
  deleteExchangeRate(@Args('id', { type: () => ID }) id: string): Promise<ExchangeRateType> {
    return this.rates.remove(id);
  }

  @Mutation(() => [ExchangeRateType], {
    name: 'syncExchangeRatesFromProvider',
    description:
 'Fetch live quotes from a registered FX provider ' +
      'and upsert them with source=providerCode; core never calls a provider SDK directly.',
  })
  @RequirePermission('currency:update')
  syncExchangeRatesFromProvider(
    @Args('input', { type: () => SyncExchangeRatesInput })
    input: SyncExchangeRatesInput,
  ): Promise<ExchangeRateType[]> {
    return this.rates.syncFromProvider(input.providerCode, input.pairs);
  }
}
