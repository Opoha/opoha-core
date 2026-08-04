import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { ruleEntities } from './entities';
import { RuleActionRegistry } from './rule-action.registry';
import { RulesEvaluatorService } from './rules-evaluator.service';
import { RulesResolver } from './rules.resolver';
import { RulesService } from './rules.service';

/**
 * Core `rules` module (Phase 8 C-01–C-03).
 * Declarative conditions → registered actions on cataloged domain events.
 */
@Module({
  imports: [AuthModule, EventBusModule, TypeOrmModule.forFeature([...ruleEntities])],
  providers: [RulesService, RuleActionRegistry, RulesEvaluatorService, RulesResolver],
  exports: [RulesService, RuleActionRegistry, RulesEvaluatorService, TypeOrmModule],
})
export class RulesModule {}
