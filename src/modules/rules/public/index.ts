/**
 * Public rules module surface (Phase 8 C-01–C-03).
 */
export { RulesModule } from '../rules.module';
export { RulesService } from '../rules.service';
export { RulesEvaluatorService, RULE_TRIGGER_EVENTS } from '../rules-evaluator.service';
export { RuleActionRegistry } from '../rule-action.registry';
export { RuleDefinitionEntity, ruleEntities } from '../entities';
export {
  evaluateRuleConditions,
  normalizeActionRefs,
} from '../rule-conditions';
export type {
  RuleActionRef,
  RuleConditionEquals,
  RuleConditions,
} from '../rule-conditions';
export type {
  RegisterRuleActionInput,
  RegisteredRuleAction,
  RuleActionContext,
  RuleActionHandler,
} from '../rule-action';
export type {
  CreateRuleDefinitionInput,
  RuleDefinitionType,
  UpdateRuleDefinitionInput,
} from '../rules.types';
export {
  customerTagStore,
  notificationEmitStore,
} from '../action-stores';
export type { EmittedNotificationStub } from '../action-stores';
