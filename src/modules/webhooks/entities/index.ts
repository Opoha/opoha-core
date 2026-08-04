import { WebhookDeliveryAttemptEntity } from './webhook-delivery-attempt.entity';
import { WebhookEndpointEntity } from './webhook-endpoint.entity';

export const webhookEntities = [WebhookEndpointEntity, WebhookDeliveryAttemptEntity] as const;

export { WebhookEndpointEntity, WebhookDeliveryAttemptEntity };
