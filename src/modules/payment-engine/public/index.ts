/**
 * Public payment-engine surface for other core modules and plugin registration.
 */
export { PaymentEngineModule } from '../payment-engine.module';
export { PaymentEngine } from '../payment-engine.service';
export type {
  AuthorizePaymentInput,
  CapturePaymentInput,
  RefundPaymentInput,
  PaymentRecord,
  ProcessWebhookResult,
} from '../payment-engine.service';
export { PaymentProviderRegistry } from '../payment-provider.registry';
export { PaymentEntity } from '../entities/payment.entity';
export { PaymentWebhookEventEntity } from '../entities/payment-webhook-event.entity';
export { paymentEntities } from '../entities';
export type { PaymentStatus } from '../entities/payment.entity';
export type {
  PaymentProvider,
  RegisteredPaymentProvider,
  MoneyAmount,
  PaymentAuthorizeInput,
  PaymentAuthorizeResult,
  PaymentCaptureInput,
  PaymentCaptureResult,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentWebhookInput,
  PaymentWebhookResult,
} from '../payment-provider';
