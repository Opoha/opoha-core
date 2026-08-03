import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

import { authEntities } from '../src/modules/auth/entities';
import { catalogEntities } from '../src/modules/catalog/entities';
import { customerEntities } from '../src/modules/customer/entities';
import { filesEntities } from '../src/modules/files/entities';
import { inventoryEntities } from '../src/modules/inventory/entities';
import { warehouseEntities } from '../src/modules/warehouses/entities';
import { localizationEntities } from '../src/modules/localization/entities';
import { orderEntities } from '../src/modules/order/entities';
import { paymentEntities } from '../src/modules/payment-engine/entities';
import { pluginLoaderEntities } from '../src/modules/plugin-loader/entities';
import { promotionsEntities } from '../src/modules/promotions-engine/entities';
import { taxEntities } from '../src/modules/tax-engine/entities';
import { AuthSpikeInit1722681855000 } from './migrations/1722681855000-AuthSpikeInit';
import { AuditLogsInit1722682800000 } from './migrations/1722682800000-AuditLogsInit';
import { FilesInit1722684000000 } from './migrations/1722684000000-FilesInit';
import { PluginStatesInit1722685100000 } from './migrations/1722685100000-PluginStatesInit';
import { CatalogProductsInit1722686200000 } from './migrations/1722686200000-CatalogProductsInit';
import { CatalogTaxonomyInit1722687300000 } from './migrations/1722687300000-CatalogTaxonomyInit';
import { CatalogAttributesMediaInit1722688400000 } from './migrations/1722688400000-CatalogAttributesMediaInit';
import { InventoryInit1722689500000 } from './migrations/1722689500000-InventoryInit';
import { CustomersInit1722690600000 } from './migrations/1722690600000-CustomersInit';
import { OrdersInit1722691700000 } from './migrations/1722691700000-OrdersInit';
import { LocalizationInit1722692800000 } from './migrations/1722692800000-LocalizationInit';
import { PaymentsInit1722693900000 } from './migrations/1722693900000-PaymentsInit';
import { PaymentWebhooksInit1722695000000 } from './migrations/1722695000000-PaymentWebhooksInit';
import { ShippingSelectionOnCheckout1722696100000 } from './migrations/1722696100000-ShippingSelectionOnCheckout';
import { TaxClassesRulesInit1722697200000 } from './migrations/1722697200000-TaxClassesRulesInit';
import { CartTaxContextOnCheckout1722698300000 } from './migrations/1722698300000-CartTaxContextOnCheckout';
import { CartPromotionsOnCheckout1722699400000 } from './migrations/1722699400000-CartPromotionsOnCheckout';
import { CouponsDiscountRulesInit1722700500000 } from './migrations/1722700500000-CouponsDiscountRulesInit';
import { WarehousesInit1722701600000 } from './migrations/1722701600000-WarehousesInit';
import { InventoryPerLocation1722702700000 } from './migrations/1722702700000-InventoryPerLocation';

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
    ...customerEntities,
    ...filesEntities,
    ...inventoryEntities,
    ...warehouseEntities,
    ...localizationEntities,
    ...orderEntities,
    ...paymentEntities,
    ...pluginLoaderEntities,
    ...promotionsEntities,
    ...taxEntities,
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
    CustomersInit1722690600000,
    OrdersInit1722691700000,
    LocalizationInit1722692800000,
    PaymentsInit1722693900000,
    PaymentWebhooksInit1722695000000,
    ShippingSelectionOnCheckout1722696100000,
    TaxClassesRulesInit1722697200000,
    CartTaxContextOnCheckout1722698300000,
    CartPromotionsOnCheckout1722699400000,
    CouponsDiscountRulesInit1722700500000,
    WarehousesInit1722701600000,
    InventoryPerLocation1722702700000,
  ],
  synchronize: false,
});
