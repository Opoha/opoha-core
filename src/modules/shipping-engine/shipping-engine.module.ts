import { Global, Module } from '@nestjs/common';

import { ShippingEngine } from './shipping-engine.service';
import { ShippingMethodRegistry } from './shipping-method.registry';

@Global()
@Module({
  providers: [ShippingMethodRegistry, ShippingEngine],
  exports: [ShippingMethodRegistry, ShippingEngine],
})
export class ShippingEngineModule {}
