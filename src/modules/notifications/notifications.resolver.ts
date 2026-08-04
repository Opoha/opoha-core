import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { NotificationProviderType, NotificationTemplateType } from './notification.types';
import { NotificationsService } from './notifications.service';

@Resolver(() => NotificationProviderType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class NotificationsResolver {
  constructor(private readonly notifications: NotificationsService) {}

  @Query(() => [NotificationProviderType], {
    name: 'notificationProviders',
    description: 'List active registered notification (email) providers',
  })
  @RequirePermission('notification:read')
  notificationProviders(): NotificationProviderType[] {
    return this.notifications.list().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
      channels: provider.channels?.length ? [...provider.channels] : ['email'],
    }));
  }

  @Query(() => [NotificationTemplateType], {
    name: 'notificationTemplates',
    description: 'List registered transactional notification templates',
  })
  @RequirePermission('notification:read')
  notificationTemplates(): NotificationTemplateType[] {
    return this.notifications.listTemplates().map((template) => ({
      code: template.code,
      description: template.description,
    }));
  }
}
