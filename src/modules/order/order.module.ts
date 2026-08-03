import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { ProductVariantEntity } from '../catalog/public';
import { InventoryModule } from '../inventory/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { ShippingEngineModule } from '../shipping-engine/public';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';
import { CheckoutResolver } from './checkout.resolver';
import { CheckoutService } from './checkout.service';
import { orderEntities } from './entities';
import { OrderEventsRegistrar } from './events/order-events.registrar';
import { OrdersResolver } from './orders.resolver';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
    PaymentEngineModule,
    ShippingEngineModule,
    TypeOrmModule.forFeature([...orderEntities, ProductVariantEntity]),
  ],
  providers: [
    CartService,
    CartResolver,
    CheckoutService,
    CheckoutResolver,
    OrdersService,
    OrdersResolver,
    OrderEventsRegistrar,
  ],
  exports: [CartService, CheckoutService, OrdersService, TypeOrmModule],
})
export class OrderModule {}
