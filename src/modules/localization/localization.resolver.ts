import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { LocalizationService } from './localization.service';
import { LocalizationSettingsType, UpdateLocalizationSettingsInput } from './localization.types';

@Resolver(() => LocalizationSettingsType)
export class LocalizationResolver {
  constructor(private readonly localizationService: LocalizationService) {}

  @Query(() => LocalizationSettingsType, {
    name: 'localizationSettings',
    description: 'Read deployment localization settings (country, currency, timezone, locale)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('localization:read')
  localizationSettings(): Promise<LocalizationSettingsType> {
    return this.localizationService.get();
  }

  @Mutation(() => LocalizationSettingsType, {
    name: 'updateLocalizationSettings',
    description: 'Update deployment localization settings (single-country)',
  })
  @UseGuards(GqlAuthGuard, PermissionsGuard)
  @RequirePermission('localization:update')
  updateLocalizationSettings(
    @Args('input', { type: () => UpdateLocalizationSettingsInput })
    input: UpdateLocalizationSettingsInput,
  ): Promise<LocalizationSettingsType> {
    return this.localizationService.update(input);
  }
}
