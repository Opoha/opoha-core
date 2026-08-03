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
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_STOREFRONT_MAP,
  isAnalyticsEventName,
  createDomainEvent,
  AnalyticsSinkRegistry,
  AnalyticsSinkDispatcher,
} from './modules/event-bus/public';
export type {
  DomainEvent,
  EventListener,
  AnalyticsEventName,
  AnalyticsStorefrontMapping,
  AnalyticsSink,
  RegisteredAnalyticsSink,
} from './modules/event-bus/public';
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
  SegmentsModule,
  SegmentsService,
  CustomerSegmentEntity,
  segmentEntities,
  evaluateSegmentRules,
  SegmentsResolver,
  CustomerSegmentGqlType,
  CreateCustomerSegmentGqlInput,
  UpdateCustomerSegmentGqlInput,
  EvaluateSegmentMembershipInput,
  SegmentMembershipResultType,
} from './modules/segments/public';
export type {
  SegmentRules,
  SegmentTagRules,
  SegmentOrderCountRules,
  SegmentSpendRules,
  SegmentMembershipContext,
  CustomerSegmentType,
  CreateCustomerSegmentInput,
  UpdateCustomerSegmentInput,
  SegmentUpdatedData,
  SegmentUpdatedEvent,
} from './modules/segments/public';
export {
  StoresModule,
  StoreService,
  StoreEntity,
  storeEntities,
  STORE_ID_HEADER,
  STORE_CODE_HEADER,
  extractStoreContextFromHeaders,
  extractStoreContextFromJwt,
  resolveStoreContext,
} from './modules/stores/public';
export type {
  StoreContextRef,
  StoreJwtClaim,
  CreateStoreInput,
  UpdateStoreInput,
  StoreType,
  StoreCreatedData,
  StoreCreatedEvent,
  StoreUpdatedData,
  StoreUpdatedEvent,
} from './modules/stores/public';
export {
  ConfigurationSettingsModule,
  StoreChannelSettingsService,
  StoreChannelSettingsEntity,
  configurationEntities,
  DEFAULT_STORE_CHANNEL_SETTINGS,
  StoreCatalogModeGql,
  StoreChannelSettingsType,
  UpdateStoreChannelSettingsInput,
} from './modules/config/public';
export type {
  StoreCatalogMode,
  StoreChannelSettingsUpdatedData,
  StoreChannelSettingsUpdatedEvent,
} from './modules/config/public';
export {
  CurrencyModule,
  StoreCurrencyConfigService,
  ExchangeRateService,
  CurrencyConversionService,
  CURRENCY_ROUNDING_MODE,
  convertMinorWithRate,
  roundHalfUpToMinor,
  StoreCurrencyConfigEntity,
  ExchangeRateEntity,
  currencyEntities,
  DEFAULT_STORE_CURRENCY,
  defaultStoreCurrencyConfig,
  StoreCurrencyConfigType,
  UpdateStoreCurrencyConfigInput,
  ExchangeRateType,
  CreateExchangeRateInput,
  UpdateExchangeRateInput,
  FXRateProviderRegistry,
} from './modules/currency/public';
export type {
  StoreCurrencyConfigUpdatedData,
  StoreCurrencyConfigUpdatedEvent,
  ExchangeRateUpdatedData,
  ExchangeRateUpdatedEvent,
  ConvertedAmount,
  DisplayTotalsInput,
  DisplayTotalsResult,
  CurrencyRoundingMode,
  FXRateQuoteInput,
  FXRateQuoteResult,
  FXRateProvider,
  RegisteredFXRateProvider,
} from './modules/currency/public';
export {
  B2bModule,
  CompanyService,
  CompanyEntity,
  CompanyMembershipEntity,
  CompanyPriceEntity,
  COMPANY_BUYER_ROLES,
  isCompanyBuyerRole,
  b2bEntities,
  CompanyType,
  CompanyMembershipType,
  CompanyPriceListItemType,
  CreateCompanyInput,
  UpdateCompanyInput,
  AddCompanyMemberInput,
  UpdateCompanyMemberRoleInput,
  RemoveCompanyMemberInput,
  SetCompanyPriceListItemInput,
  RemoveCompanyPriceListItemInput,
  ApproveB2bOrderInput,
  ConfirmB2bOrderInput,
} from './modules/b2b/public';
export type {
  CompanyBuyerRole,
  CompanyCreatedData,
  CompanyCreatedEvent,
  CompanyMembershipUpdatedData,
  CompanyMembershipUpdatedEvent,
} from './modules/b2b/public';
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
