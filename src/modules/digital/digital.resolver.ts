import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { DigitalFulfillmentService } from './digital-fulfillment.service';
import { DigitalDownloadTokenType, DigitalLicenseKeyType } from './digital.types';

@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class DigitalResolver {
  constructor(private readonly digital: DigitalFulfillmentService) {}

  @Query(() => DigitalDownloadTokenType, {
    name: 'digitalDownloadToken',
    description: 'Get a digital download token by id (admin/customer read)',
  })
  @RequirePermission('digital:read')
  digitalDownloadToken(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DigitalDownloadTokenType> {
    return this.digital.findDownloadTokenById(id);
  }

  @Query(() => DigitalDownloadTokenType, {
    name: 'digitalDownloadTokenByToken',
    description: 'Resolve a download entitlement by opaque token string',
  })
  @RequirePermission('digital:read')
  digitalDownloadTokenByToken(
    @Args('token', { type: () => String }) token: string,
  ): Promise<DigitalDownloadTokenType> {
    return this.digital.findDownloadTokenByToken(token);
  }

  @Query(() => [DigitalDownloadTokenType], {
    name: 'digitalDownloadTokensForOrder',
    description: 'List download tokens issued for an order',
  })
  @RequirePermission('digital:read')
  digitalDownloadTokensForOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<DigitalDownloadTokenType[]> {
    return this.digital.listDownloadTokensForOrder(orderId);
  }

  @Query(() => [DigitalDownloadTokenType], {
    name: 'digitalDownloadTokensForCustomer',
    description: 'List download tokens for a customer',
  })
  @RequirePermission('digital:read')
  digitalDownloadTokensForCustomer(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<DigitalDownloadTokenType[]> {
    return this.digital.listDownloadTokensForCustomer(customerId);
  }

  @Query(() => DigitalLicenseKeyType, {
    name: 'digitalLicenseKey',
    description: 'Get a digital license key by id',
  })
  @RequirePermission('digital:read')
  digitalLicenseKey(@Args('id', { type: () => ID }) id: string): Promise<DigitalLicenseKeyType> {
    return this.digital.findLicenseKeyById(id);
  }

  @Query(() => [DigitalLicenseKeyType], {
    name: 'digitalLicenseKeysForOrder',
    description: 'List license keys issued for an order',
  })
  @RequirePermission('digital:read')
  digitalLicenseKeysForOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<DigitalLicenseKeyType[]> {
    return this.digital.listLicenseKeysForOrder(orderId);
  }

  @Query(() => [DigitalLicenseKeyType], {
    name: 'digitalLicenseKeysForCustomer',
    description: 'List license keys for a customer',
  })
  @RequirePermission('digital:read')
  digitalLicenseKeysForCustomer(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<DigitalLicenseKeyType[]> {
    return this.digital.listLicenseKeysForCustomer(customerId);
  }
}
