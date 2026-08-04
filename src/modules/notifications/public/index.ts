/**
 * Public notifications surface for other core modules and plugin registration.
 */
export { NotificationsModule } from '../notifications.module';
export { NotificationsService } from '../notifications.service';
export { NotificationsResolver } from '../notifications.resolver';
export { NotificationProviderRegistry } from '../notification-provider.registry';
export { NotificationTemplateRegistry } from '../notification-template.registry';
export { NotificationTemplateCode, formatMinorAmount } from '../notification-template';
export type { NotificationTemplate, NotificationTemplateRendered } from '../notification-template';
export type {
  NotificationChannel,
  NotificationRecipient,
  NotificationSendInput,
  NotificationSendStatus,
  NotificationSendResult,
  NotificationProvider,
  RegisteredNotificationProvider,
} from '../notification-provider';
export { NotificationProviderType, NotificationTemplateType } from '../notification.types';
