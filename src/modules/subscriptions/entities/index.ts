import { SubscriptionEntity } from './subscription.entity';
import { SubscriptionPlanEntity } from './subscription-plan.entity';

export const subscriptionEntities = [
  SubscriptionPlanEntity,
  SubscriptionEntity,
] as const;

export { SubscriptionPlanEntity, SubscriptionEntity };
