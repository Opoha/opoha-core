import { Global, Module } from '@nestjs/common';

import { EventBusModule } from '../event-bus/event-bus.module';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationTemplateRegistry } from './notification-template.registry';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [EventBusModule],
  providers: [
    NotificationProviderRegistry,
    NotificationTemplateRegistry,
    NotificationsService,
  ],
  exports: [
    NotificationProviderRegistry,
    NotificationTemplateRegistry,
    NotificationsService,
  ],
})
export class NotificationsModule {}
