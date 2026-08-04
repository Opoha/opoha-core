import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PluginStateEntity } from './entities/plugin-state.entity';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginManagementService } from './plugin-management.service';

/**
 * Runtime plugin host bootstrap.
 * Discovers OPOHA_PLUGINS paths on module init; here we dynamically import
 * definitions and restore durable enable state so Payment/Shipping/Tax
 * registries are populated before GraphQL serves traffic.
 */
@Injectable()
export class PluginBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginBootstrapService.name);

  constructor(
    private readonly loader: PluginLoaderService,
    private readonly management: PluginManagementService,
    @InjectRepository(PluginStateEntity)
    private readonly states: Repository<PluginStateEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.loader.loadDefinitions();
    if (result.loaded.length === 0) {
      return;
    }

    this.logger.log(`Loaded plugin definitions: ${result.loaded.map((p) => p.id).join(',')}`);

    const rows = await this.states.find();
    const byId = new Map(rows.map((row) => [row.pluginId, row]));

    for (const { id } of result.loaded) {
      const row = byId.get(id);
      if (row?.enabled === false) {
        continue;
      }
      // Restore previously-enabled plugins. Fresh discovers stay inactive until
      // enablePlugin / walking-skeleton enables them (explicit opt-in).
      if (row?.enabled === true) {
        try {
          await this.management.enable(id, null);
        } catch (err) {
          this.logger.warn(
            `Failed to restore enabled plugin "${id}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    await this.loader.bootAll();
  }
}
