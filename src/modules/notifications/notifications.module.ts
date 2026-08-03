import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationTemplateRegistry } from './notification-template.registry';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [AuthModule, EventBusModule],
  providers: [
    NotificationProviderRegistry,
    NotificationTemplateRegistry,
    NotificationsService,
    NotificationsResolver,
  ],
  exports: [
    NotificationProviderRegistry,
    NotificationTemplateRegistry,
    NotificationsService,
  ],
})
export class NotificationsModule {}
