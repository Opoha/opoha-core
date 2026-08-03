/**
 * @opoha/core public surface — prefer NestJS modules over deep imports.
 */
export { AppModule } from './app.module';
export { HealthService } from './modules/health/health.service';
export type {
  LivenessResult,
  ReadinessCheckStatus,
  ReadinessResult,
} from './modules/health/health.service';
export {
  API_VERSION_HEADER,
  DEFAULT_API_VERSION,
  MVP_API_VERSION_DATE,
  SUPPORTED_API_VERSIONS,
  resolveApiVersion,
} from './modules/api-versioning/api-version';
export { getTracer, trace } from './modules/otel/tracing';
export { CORE_PACKAGE_NAME, getCorePackageName } from './package-meta';
export {
  AuthModule,
  AuthService,
  GqlAuthGuard,
  hashPassword,
  verifyPassword,
} from './modules/auth/public';
export type { AuthUser, JwtPayload } from './modules/auth/public';
export {
  EventBusModule,
  EventBusService,
  CoreEventName,
  createDomainEvent,
} from './modules/event-bus/public';
export type { DomainEvent, EventListener } from './modules/event-bus/public';
export {
  PluginLoaderModule,
  PluginLoaderService,
  ContributionRegistry,
  AdminExtensionRegistry,
  PLUGIN_CONTRACT_VERSION,
  parsePluginManifest,
  orderPluginsByDependency,
  discoverPlugins,
  transitionPluginState,
  canBootPlugin,
} from './modules/plugin-loader/public';
export type {
  DiscoveredPlugin,
  PluginManifest,
  PluginLoadResult,
  PluginDefinition,
  PluginRegistrationContext,
  PluginLifecycleState,
  AdminContribution,
  AdminExtensionManifest,
} from './modules/plugin-loader/public';
export {
  PaymentEngineModule,
  PaymentEngine,
  PaymentProviderRegistry,
  PaymentEntity,
} from './modules/payment-engine/public';
export type {
  PaymentProvider,
  MoneyAmount,
  PaymentStatus,
  AuthorizePaymentInput,
  CapturePaymentInput,
  RefundPaymentInput,
} from './modules/payment-engine/public';
export {
  ShippingEngineModule,
  ShippingEngine,
  ShippingMethodRegistry,
} from './modules/shipping-engine/public';
export type {
  MoneyAmount as ShippingMoneyAmount,
  ShippingAddress,
  ShippingQuoteLineItem,
  ShippingQuoteInput,
  ShippingRateQuote,
  QuotedShippingRate,
  ShippingQuoteResult,
  ShippingLabelInput,
  ShippingLabelResult,
  ShippingVoidLabelInput,
  ShippingVoidLabelResult,
  ShippingMethodProvider,
} from './modules/shipping-engine/public';
export {
  TaxEngineModule,
  TaxEngine,
  TaxProviderRegistry,
} from './modules/tax-engine/public';
export type {
  MoneyAmount as TaxMoneyAmount,
  TaxPricingMode,
  TaxAddress,
  TaxCalculateLineItem,
  TaxCalculateInput,
  TaxLineResult,
  TaxCalculateResult,
  TaxProvider,
  RegisteredTaxProvider,
} from './modules/tax-engine/public';
export {
  PromotionsEngineModule,
  PromotionsEngine,
  PromotionRuleRegistry,
} from './modules/promotions-engine/public';
export type {
  PromotionApplyLineItem,
  PromotionApplyInput,
  PromotionApplicationKind,
  PromotionApplication,
  PromotionApplyResult,
  PromotionRuleProvider,
  RegisteredPromotionRuleProvider,
} from './modules/promotions-engine/public';
export {
  FilesModule,
  FilesService,
  StorageAdapterRegistry,
  FileEntity,
} from './modules/files/public';
export type {
  CreateFileMetadataInput,
  StorageAdapter,
} from './modules/files/public';
export {
  ReturnsModule,
  ReturnsService,
  ReturnsResolver,
  ReturnEntity,
  ReturnLineEntity,
  returnEntities,
  RETURN_STATUSES,
  RETURN_RESOLUTIONS,
  canTransitionReturnStatus,
  CreateReturnInput,
  CreateReturnLineInput,
  CompleteRefundInput,
  ReturnType,
  ReturnLineType,
} from './modules/returns/public';
export type {
  ReturnStatus,
  ReturnResolution,
} from './modules/returns/public';
export {
  GiftCardsModule,
  GiftCardService,
  GiftCardsResolver,
  GiftCardEntity,
  GiftCardTransactionEntity,
  giftCardEntities,
  GIFT_CARD_STATUSES,
  GIFT_CARD_TRANSACTION_TYPES,
  isGiftCardStatus,
  canTransitionGiftCardStatus,
  generateGiftCardCode,
  GiftCardType,
  GiftCardLedgerEntryType,
  QuoteGiftCardRedeemResult,
  IssueGiftCardInput,
  PurchaseGiftCardInput,
  RedeemGiftCardInput,
  QuoteGiftCardRedeemInput,
} from './modules/gift-cards/public';
export type {
  GiftCardStatus,
  GiftCardTransactionType,
} from './modules/gift-cards/public';
export {
  LoyaltyModule,
  LoyaltyService,
  LoyaltyResolver,
  LoyaltyAccountEntity,
  LoyaltyTransactionEntity,
  loyaltyEntities,
  LOYALTY_TRANSACTION_TYPES,
  LOYALTY_ACCRUAL_MINOR_UNITS_PER_POINT,
  LOYALTY_REDEMPTION_MINOR_UNITS_PER_POINT,
  isLoyaltyTransactionType,
  computeAccrualPoints,
  computeRedemptionValueMinor,
  LoyaltyAccountType,
  LoyaltyLedgerEntryType,
  QuoteLoyaltyRedeemResult,
  AccrueLoyaltyInput,
  RedeemLoyaltyInput,
  QuoteLoyaltyRedeemInput,
} from './modules/loyalty/public';
export type { LoyaltyTransactionType } from './modules/loyalty/public';
export {
  AdminOpsModule,
  ReportsService,
  BulkOpsService,
} from './modules/admin-ops/public';
export {
  NotificationsModule,
  NotificationsService,
  NotificationProviderRegistry,
  NotificationTemplateRegistry,
  NotificationTemplateCode,
  formatMinorAmount,
} from './modules/notifications/public';
export type {
  NotificationChannel,
  NotificationRecipient,
  NotificationSendInput,
  NotificationSendStatus,
  NotificationSendResult,
  NotificationProvider,
  RegisteredNotificationProvider,
  NotificationTemplate,
  NotificationTemplateRendered,
} from './modules/notifications/public';
export {
  SearchEngineModule,
  SearchEngine,
  SearchProviderRegistry,
} from './modules/search-engine/public';
export type {
  SearchDocumentType,
  SearchDocument,
  SearchDeleteInput,
  SearchQueryInput,
  SearchHit,
  SearchQueryResult,
  SearchProvider,
  RegisteredSearchProvider,
} from './modules/search-engine/public';
