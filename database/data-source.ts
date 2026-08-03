import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

import { authEntities } from '../src/modules/auth/entities';
import { catalogEntities } from '../src/modules/catalog/entities';
import { filesEntities } from '../src/modules/files/entities';
import { inventoryEntities } from '../src/modules/inventory/entities';
import { pluginLoaderEntities } from '../src/modules/plugin-loader/entities';
import { AuthSpikeInit1722681855000 } from './migrations/1722681855000-AuthSpikeInit';
import { AuditLogsInit1722682800000 } from './migrations/1722682800000-AuditLogsInit';
import { FilesInit1722684000000 } from './migrations/1722684000000-FilesInit';
import { PluginStatesInit1722685100000 } from './migrations/1722685100000-PluginStatesInit';
import { CatalogProductsInit1722686200000 } from './migrations/1722686200000-CatalogProductsInit';
import { CatalogTaxonomyInit1722687300000 } from './migrations/1722687300000-CatalogTaxonomyInit';
import { CatalogAttributesMediaInit1722688400000 } from './migrations/1722688400000-CatalogAttributesMediaInit';
import { InventoryInit1722689500000 } from './migrations/1722689500000-InventoryInit';

loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required for TypeORM DataSource');
}

export default new DataSource({
  type: 'postgres',
  url,
  entities: [
    ...authEntities,
    ...catalogEntities,
    ...filesEntities,
    ...inventoryEntities,
    ...pluginLoaderEntities,
  ],
  migrations: [
    AuthSpikeInit1722681855000,
    AuditLogsInit1722682800000,
    FilesInit1722684000000,
    PluginStatesInit1722685100000,
    CatalogProductsInit1722686200000,
    CatalogTaxonomyInit1722687300000,
    CatalogAttributesMediaInit1722688400000,
    InventoryInit1722689500000,
  ],
  synchronize: false,
});
