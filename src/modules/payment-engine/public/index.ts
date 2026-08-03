/**
 * Public payment-engine surface for other core modules and plugin registration.
 */
export { PaymentEngineModule } from '../payment-engine.module';
export { PaymentEngine } from '../payment-engine.service';
export { PaymentProviderRegistry } from '../payment-provider.registry';
export type {
  PaymentProvider,
  RegisteredPaymentProvider,
} from '../payment-provider';
