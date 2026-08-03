import type { RuleActionRef, RuleConditions } from './rule-conditions';

export type RuleDefinitionType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  eventName: string;
  conditions: RuleConditions | null;
  actionRefs: RuleActionRef[];
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateRuleDefinitionInput = {
  code: string;
  name: string;
  description?: string | null;
  eventName: string;
  conditions?: RuleConditions | null;
  actionRefs?: RuleActionRef[];
  enabled?: boolean;
  priority?: number;
};

export type UpdateRuleDefinitionInput = {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  eventName?: string;
  conditions?: RuleConditions | null;
  actionRefs?: RuleActionRef[];
  enabled?: boolean;
  priority?: number;
};
