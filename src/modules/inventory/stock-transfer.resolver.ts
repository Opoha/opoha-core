import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferInput, StockTransferType } from './stock-transfer.types';

@Resolver(() => StockTransferType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class StockTransferResolver {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Query(() => [StockTransferType], {
    name: 'stockTransfers',
    description: 'List stock transfers (optionally filtered by status)',
  })
  @RequirePermission('inventory:read')
  stockTransfers(
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<StockTransferType[]> {
    return this.stockTransferService.findAll(
      status as 'draft' | 'in_transit' | 'received' | 'cancelled' | undefined,
    );
  }

  @Query(() => StockTransferType, {
    name: 'stockTransfer',
    description: 'Get a stock transfer by id',
  })
  @RequirePermission('inventory:read')
  stockTransfer(@Args('id', { type: () => ID }) id: string): Promise<StockTransferType> {
    return this.stockTransferService.findById(id);
  }

  @Mutation(() => StockTransferType, {
    name: 'createStockTransfer',
    description: 'Create a draft stock transfer between warehouses',
  })
  @RequirePermission('inventory:transfer')
  createStockTransfer(
    @Args('input', { type: () => CreateStockTransferInput })
    input: CreateStockTransferInput,
  ): Promise<StockTransferType> {
    return this.stockTransferService.create(input);
  }

  @Mutation(() => StockTransferType, {
    name: 'shipStockTransfer',
    description: 'Ship a draft transfer — deducts stock at the source warehouse',
  })
  @RequirePermission('inventory:transfer')
  shipStockTransfer(@Args('id', { type: () => ID }) id: string): Promise<StockTransferType> {
    return this.stockTransferService.ship(id);
  }

  @Mutation(() => StockTransferType, {
    name: 'receiveStockTransfer',
    description: 'Receive an in-transit transfer — adds stock at the destination warehouse',
  })
  @RequirePermission('inventory:transfer')
  receiveStockTransfer(@Args('id', { type: () => ID }) id: string): Promise<StockTransferType> {
    return this.stockTransferService.receive(id);
  }

  @Mutation(() => StockTransferType, {
    name: 'cancelStockTransfer',
    description: 'Cancel a draft stock transfer (no stock movement)',
  })
  @RequirePermission('inventory:transfer')
  cancelStockTransfer(@Args('id', { type: () => ID }) id: string): Promise<StockTransferType> {
    return this.stockTransferService.cancel(id);
  }
}
