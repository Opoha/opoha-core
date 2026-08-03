import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { B2bModule } from '../b2b/public';
import { ProductEntity, ProductVariantEntity } from '../catalog/public';
import { CurrencyModule } from '../currency/public';
import { CustomerModule } from '../customer/public';
import { InventoryModule } from '../inventory/public';
import { GiftCardsModule } from '../gift-cards/public';
import { LoyaltyModule } from '../loyalty/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { ShippingEngineModule } from '../shipping-engine/public';
import { StoresModule } from '../stores/public';
import { TaxEngineModule } from '../tax-engine/public';
import { PromotionsEngineModule } from '../promotions-engine/public';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';
import { CheckoutResolver } from './checkout.resolver';
import { CheckoutService } from './checkout.service';
import { orderEntities } from './entities';
import { LoyaltyAccrualListener } from './events/loyalty-accrual.listener';
import { OrderEventsRegistrar } from './events/order-events.registrar';
import { OrderNotificationsListener } from './events/order-notifications.listener';
import { OrderPaidAnalyticsListener } from './events/order-paid-analytics.listener';
import { OrdersResolver } from './orders.resolver';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    B2bModule,
    CustomerModule,
    InventoryModule,
    PaymentEngineModule,
    ShippingEngineModule,
    TaxEngineModule,
    PromotionsEngineModule,
    GiftCardsModule,
    LoyaltyModule,
    StoresModule,
    CurrencyModule,
    TypeOrmModule.forFeature([
      ...orderEntities,
      ProductVariantEntity,
      ProductEntity,
    ]),
  ],
  providers: [
    CartService,
    CartResolver,
    CheckoutService,
    CheckoutResolver,
    OrdersService,
    OrdersResolver,
    OrderEventsRegistrar,
    OrderNotificationsListener,
    LoyaltyAccrualListener,
    OrderPaidAnalyticsListener,
  ],
  exports: [CartService, CheckoutService, OrdersService, TypeOrmModule],
})
export class OrderModule {}
