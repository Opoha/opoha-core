/**
 * Public notifications surface for other core modules and plugin registration.
 */
export { NotificationsModule } from '../notifications.module';
export { NotificationsService } from '../notifications.service';
export { NotificationProviderRegistry } from '../notification-provider.registry';
export type {
  NotificationChannel,
  NotificationRecipient,
  NotificationSendInput,
  NotificationSendStatus,
  NotificationSendResult,
  NotificationProvider,
  RegisteredNotificationProvider,
} from '../notification-provider';
