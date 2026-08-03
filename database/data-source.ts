import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';

import { authEntities } from '../src/modules/auth/entities';
import { b2bEntities } from '../src/modules/b2b/entities';
import { catalogEntities } from '../src/modules/catalog/entities';
import { customerEntities } from '../src/modules/customer/entities';
import { filesEntities } from '../src/modules/files/entities';
import { fulfillmentEntities } from '../src/modules/fulfillment/entities';
import { digitalEntities } from '../src/modules/digital/entities';
import { giftCardEntities } from '../src/modules/gift-cards/entities';
import { inventoryEntities } from '../src/modules/inventory/entities';
import { loyaltyEntities } from '../src/modules/loyalty/entities';
import { returnEntities } from '../src/modules/returns/entities';
import { segmentEntities } from '../src/modules/segments/entities';
import { storeEntities } from '../src/modules/stores/entities';
import { supplyEntities } from '../src/modules/supply/entities';
import { vendorEntities } from '../src/modules/vendors/entities';
import { warehouseEntities } from '../src/modules/warehouses/entities';
import { localizationEntities } from '../src/modules/localization/entities';
import { configurationEntities } from '../src/modules/config/entities';
import { currencyEntities } from '../src/modules/currency/entities';
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
import { StockTransfersInit1722703800000 } from './migrations/1722703800000-StockTransfersInit';
import { SuppliersPurchaseOrdersInit1722704900000 } from './migrations/1722704900000-SuppliersPurchaseOrdersInit';
import { FulfillmentsInit1722706000000 } from './migrations/1722706000000-FulfillmentsInit';
import { ReturnsInit1722707100000 } from './migrations/1722707100000-ReturnsInit';
import { GiftCardsInit1722708200000 } from './migrations/1722708200000-GiftCardsInit';
import { CartGiftCardOnCheckout1722708300000 } from './migrations/1722708300000-CartGiftCardOnCheckout';
import { LoyaltyInit1722709300000 } from './migrations/1722709300000-LoyaltyInit';
import { CartLoyaltyOnCheckout1722710400000 } from './migrations/1722710400000-CartLoyaltyOnCheckout';
import { SegmentsInit1722711500000 } from './migrations/1722711500000-SegmentsInit';
import { StoresInit1722712600000 } from './migrations/1722712600000-StoresInit';
import { CatalogStoreScope1722713700000 } from './migrations/1722713700000-CatalogStoreScope';
import { OrderCartStoreScope1722714800000 } from './migrations/1722714800000-OrderCartStoreScope';
import { StoreChannelSettingsInit1722715900000 } from './migrations/1722715900000-StoreChannelSettingsInit';
import { CatalogTranslationsInit1722717000000 } from './migrations/1722717000000-CatalogTranslationsInit';
import { StoreCurrencyConfigInit1722718100000 } from './migrations/1722718100000-StoreCurrencyConfigInit';
import { ExchangeRatesInit1722719200000 } from './migrations/1722719200000-ExchangeRatesInit';
import { StoreWarehousesInit1722720300000 } from './migrations/1722720300000-StoreWarehousesInit';
import { B2bCompaniesInit1722721400000 } from './migrations/1722721400000-B2bCompaniesInit';
import { B2bOrderApproval1722722500000 } from './migrations/1722722500000-B2bOrderApproval';
import { B2bPriceLists1722723600000 } from './migrations/1722723600000-B2bPriceLists';
import { B2bQuotesInit1722724700000 } from './migrations/1722724700000-B2bQuotesInit';
import { OrdersStatusB2bStatuses1722725800000 } from './migrations/1722725800000-OrdersStatusB2bStatuses';
import { CatalogFulfillmentMode1722726900000 } from './migrations/1722726900000-CatalogFulfillmentMode';
import { OrdersOrderSource1722728000000 } from './migrations/1722728000000-OrdersOrderSource';
import { MarketplaceVendorsInit1722729100000 } from './migrations/1722729100000-MarketplaceVendorsInit';
import { DigitalFulfillmentInit1722730200000 } from './migrations/1722730200000-DigitalFulfillmentInit';

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
    ...b2bEntities,
    ...catalogEntities,
    ...customerEntities,
    ...filesEntities,
    ...inventoryEntities,
    ...fulfillmentEntities,
    ...giftCardEntities,
    ...digitalEntities,
    ...loyaltyEntities,
    ...segmentEntities,
    ...storeEntities,
    ...configurationEntities,
    ...currencyEntities,
    ...returnEntities,
    ...supplyEntities,
    ...vendorEntities,
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
    StockTransfersInit1722703800000,
    SuppliersPurchaseOrdersInit1722704900000,
    FulfillmentsInit1722706000000,
    ReturnsInit1722707100000,
    GiftCardsInit1722708200000,
    CartGiftCardOnCheckout1722708300000,
    LoyaltyInit1722709300000,
    CartLoyaltyOnCheckout1722710400000,
    SegmentsInit1722711500000,
    StoresInit1722712600000,
    CatalogStoreScope1722713700000,
    OrderCartStoreScope1722714800000,
    StoreChannelSettingsInit1722715900000,
    CatalogTranslationsInit1722717000000,
    StoreCurrencyConfigInit1722718100000,
    ExchangeRatesInit1722719200000,
    StoreWarehousesInit1722720300000,
    B2bCompaniesInit1722721400000,
    B2bOrderApproval1722722500000,
    B2bPriceLists1722723600000,
    B2bQuotesInit1722724700000,
    OrdersStatusB2bStatuses1722725800000,
    CatalogFulfillmentMode1722726900000,
    OrdersOrderSource1722728000000,
    MarketplaceVendorsInit1722729100000,
    DigitalFulfillmentInit1722730200000,
  ],
  synchronize: false,
});
