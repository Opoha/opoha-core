import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/public';
import { ShippingEngine } from './shipping-engine.service';
import { ShippingMethodRegistry } from './shipping-method.registry';
import { ShippingResolver } from './shipping.resolver';

@Global()
@Module({
  imports: [AuthModule],
  providers: [ShippingMethodRegistry, ShippingEngine, ShippingResolver],
  exports: [ShippingMethodRegistry, ShippingEngine],
})
export class ShippingEngineModule {}
