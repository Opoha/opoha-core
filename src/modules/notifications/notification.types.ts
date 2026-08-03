import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('NotificationProvider', {
  description: 'Registered notification (email) provider available for delivery',
})
export class NotificationProviderType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => [String], {
    description: 'Channels this provider supports (email, sms, …)',
  })
  channels!: string[];
}

@ObjectType('NotificationTemplate', {
  description: 'Registered transactional notification template',
})
export class NotificationTemplateType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  description!: string;
}
