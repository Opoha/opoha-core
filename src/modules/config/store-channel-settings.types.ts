import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

import type { StoreCatalogMode } from './entities';

export enum StoreCatalogModeGql {
  shared = 'shared',
  isolated = 'isolated',
}

registerEnumType(StoreCatalogModeGql, {
  name: 'StoreCatalogMode',
  description:
    'Catalog visibility preference for a store channel (shared vs isolated)',
});

@ObjectType('StoreChannelSettings', {
  description: 'Store-scoped channel configuration (Phase 5 B-03)',
})
export class StoreChannelSettingsType {
  @Field(() => ID, { description: 'Store channel id' })
  storeId!: string;

  @Field(() => String, { description: 'IANA timezone identifier' })
  timezone!: string;

  @Field(() => String, { description: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string;

  @Field(() => StoreCatalogModeGql, {
    description: 'Catalog policy preference for this channel',
  })
  catalogMode!: StoreCatalogMode;

  @Field(() => String, {
    description: 'Extensible opaque settings bag (JSON string)',
  })
  settingsJson!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class UpdateStoreChannelSettingsInput {
  @Field(() => String, {
    nullable: true,
    description: 'IANA timezone identifier',
  })
  timezone?: string;

  @Field(() => String, {
    nullable: true,
    description: 'ISO 3166-1 alpha-2 country code',
  })
  countryCode?: string;

  @Field(() => StoreCatalogModeGql, {
    nullable: true,
    description: 'Catalog policy preference for this channel',
  })
  catalogMode?: StoreCatalogMode;

  @Field(() => String, {
    nullable: true,
    description: 'Replace extensible settings bag (JSON object string)',
  })
  settingsJson?: string;
}
