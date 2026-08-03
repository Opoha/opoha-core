/**
 * Public shipping-engine surface for other core modules and plugin registration.
 */
export { ShippingEngineModule } from '../shipping-engine.module';
export { ShippingEngine } from '../shipping-engine.service';
export { ShippingMethodRegistry } from '../shipping-method.registry';
export type {
  ShippingMethodProvider,
  RegisteredShippingMethod,
} from '../shipping-method';
