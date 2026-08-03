import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { authEntities } from '../../modules/auth/entities';
import { catalogEntities } from '../../modules/catalog/entities';
import { customerEntities } from '../../modules/customer/entities';
import { filesEntities } from '../../modules/files/entities';
import { fulfillmentEntities } from '../../modules/fulfillment/entities';
import { inventoryEntities } from '../../modules/inventory/entities';
import { returnEntities } from '../../modules/returns/entities';
import { supplyEntities } from '../../modules/supply/entities';
import { warehouseEntities } from '../../modules/warehouses/entities';
import { localizationEntities } from '../../modules/localization/entities';
import { orderEntities } from '../../modules/order/entities';
import { paymentEntities } from '../../modules/payment-engine/entities';
import { pluginLoaderEntities } from '../../modules/plugin-loader/entities';
import { promotionsEntities } from '../../modules/promotions-engine/entities';
import { taxEntities } from '../../modules/tax-engine/entities';
import { ConfigModule } from '../../modules/config/config.module';
import { ConfigService } from '../../modules/config/config.service';
import { DatabaseHealthService } from './database-health.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL'),
        entities: [
          ...authEntities,
          ...catalogEntities,
          ...customerEntities,
          ...filesEntities,
          ...inventoryEntities,
          ...fulfillmentEntities,
          ...returnEntities,
          ...supplyEntities,
          ...warehouseEntities,
          ...localizationEntities,
          ...orderEntities,
          ...paymentEntities,
          ...pluginLoaderEntities,
          ...promotionsEntities,
          ...taxEntities,
        ],
        synchronize: false,
        autoLoadEntities: false,
      }),
    }),
  ],
  providers: [DatabaseHealthService],
  exports: [TypeOrmModule, DatabaseHealthService],
})
export class DatabaseModule {}
