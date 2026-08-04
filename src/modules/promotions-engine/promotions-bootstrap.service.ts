import { Injectable, OnModuleInit } from '@nestjs/common';

import { PromotionsEngine } from './promotions-engine.service';
import { TypeOrmPromotionProvider } from './typeorm-promotion.provider';

/**
 * Registers the core TypeORM promotion provider on boot.
 */
@Injectable()
export class PromotionsBootstrapService implements OnModuleInit {
  constructor(
    private readonly engine: PromotionsEngine,
    private readonly typeormProvider: TypeOrmPromotionProvider,
  ) {}

  onModuleInit(): void {
    this.engine.register(this.typeormProvider, 'core');
  }
}
