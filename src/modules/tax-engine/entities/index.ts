import { TaxClassEntity } from './tax-class.entity';
import { TaxRuleEntity } from './tax-rule.entity';

export const taxEntities = [TaxClassEntity, TaxRuleEntity] as const;

export { TaxClassEntity, TaxRuleEntity };
