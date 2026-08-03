import { Global, Module } from '@nestjs/common';

import { EventBusModule } from '../event-bus/event-bus.module';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [EventBusModule],
  providers: [NotificationProviderRegistry, NotificationsService],
  exports: [NotificationProviderRegistry, NotificationsService],
})
export class NotificationsModule {}
