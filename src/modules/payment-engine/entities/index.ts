import { PaymentEntity } from './payment.entity';
import { PaymentWebhookEventEntity } from './payment-webhook-event.entity';

export const paymentEntities = [
  PaymentEntity,
  PaymentWebhookEventEntity,
] as const;

export { PaymentEntity, PaymentWebhookEventEntity };
export type { PaymentStatus } from './payment.entity';
