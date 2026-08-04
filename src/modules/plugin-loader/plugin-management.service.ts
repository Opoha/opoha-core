import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditAction, AuditLogsService } from '../auth/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { PluginStateEntity } from './entities/plugin-state.entity';
import { PluginGraphQLBridgeService } from './plugin-graphql-bridge.service';
import { PluginLoaderService } from './plugin-loader.service';
import type { PluginType } from './plugins.types';

/**
 * Admin-facing plugin list / enable / disable / configure.
 */
@Injectable()
export class PluginManagementService {
  constructor(
    private readonly loader: PluginLoaderService,
    private readonly adminExtensions: AdminExtensionRegistry,
    private readonly graphqlBridge: PluginGraphQLBridgeService,
    @InjectRepository(PluginStateEntity)
    private readonly states: Repository<PluginStateEntity>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(): Promise<PluginType[]> {
    const rows = await this.states.find();
    const byId = new Map(rows.map((row) => [row.pluginId, row]));
    return this.loader
.listRecords()
.map((record) =>
        this.toType(record.discovered.manifest.id, byId.get(record.discovered.manifest.id)),
      );
  }

  async get(pluginId: string): Promise<PluginType> {
    const record = this.loader.getRecord(pluginId);
    if (!record) {
      throw new NotFoundException(`Unknown plugin "${pluginId}"`);
    }
    const row = await this.states.findOne({ where: { pluginId } });
    return this.toType(pluginId, row ?? undefined);
  }

  async enable(pluginId: string, actorUserId?: string | null): Promise<PluginType> {
    this.requireRuntime(pluginId);
    const current = this.loader.getState(pluginId);
    if (current === 'discovered' || current === 'uninstalled') {
      await this.loader.install(pluginId);
    }
    if (this.loader.getState(pluginId) !== 'enabled') {
      await this.loader.enable(pluginId);
    }
    await this.upsertState(pluginId, { enabled: true });
    this.graphqlBridge.sync();
    await this.auditLogs.append({
      action: AuditAction.PLUGIN_ENABLE,
      actorUserId: actorUserId ?? null,
      resourceType: 'plugin',
      resourceId: pluginId,
      metadata: { state: 'enabled' },
    });
    return this.get(pluginId);
  }

  async disable(pluginId: string, actorUserId?: string | null): Promise<PluginType> {
    this.requireRuntime(pluginId);
    if (this.loader.getState(pluginId) === 'enabled') {
      await this.loader.disable(pluginId);
    }
    await this.upsertState(pluginId, { enabled: false });
    this.graphqlBridge.sync();
    await this.auditLogs.append({
      action: AuditAction.PLUGIN_DISABLE,
      actorUserId: actorUserId ?? null,
      resourceType: 'plugin',
      resourceId: pluginId,
      metadata: { state: 'disabled' },
    });
    return this.get(pluginId);
  }

  async updateConfig(
    pluginId: string,
    configJson: string,
    actorUserId?: string | null,
  ): Promise<PluginType> {
    this.requireRuntime(pluginId);
    const normalized = normalizeConfigJson(configJson);
    await this.upsertState(pluginId, { configJson: normalized });
    await this.auditLogs.append({
      action: AuditAction.PLUGIN_CONFIGURE,
      actorUserId: actorUserId ?? null,
      resourceType: 'plugin',
      resourceId: pluginId,
      metadata: { configured: true },
    });
    return this.get(pluginId);
  }

  private requireRuntime(pluginId: string): void {
    if (!this.loader.getRecord(pluginId)) {
      throw new NotFoundException(`Unknown plugin "${pluginId}"`);
    }
  }

  private async upsertState(
    pluginId: string,
    patch: { enabled?: boolean; configJson?: string | null },
  ): Promise<PluginStateEntity> {
    let row = await this.states.findOne({ where: { pluginId } });
    if (!row) {
      row = this.states.create({
        pluginId,
        enabled: false,
        configJson: null,
      });
    }
    if (patch.enabled !== undefined) {
      row.enabled = patch.enabled;
    }
    if (patch.configJson !== undefined) {
      row.configJson = patch.configJson;
    }
    return this.states.save(row);
  }

  private toType(pluginId: string, row?: PluginStateEntity): PluginType {
    const record = this.loader.getRecord(pluginId);
    if (!record) {
      throw new NotFoundException(`Unknown plugin "${pluginId}"`);
    }
    const manifest = record.discovered.manifest;
    const contribution = this.adminExtensions.getContribution(pluginId);
    const settingsPaths = (contribution?.settings ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      path: s.path,
      permission: s.permission ?? null,
    }));
    const state = record.state;
    return {
      id: manifest.id,
      version: manifest.version,
      displayName: manifest.displayName ?? null,
      description: manifest.description ?? null,
      state,
      booted: record.booted,
      enabled: row?.enabled ?? state === 'enabled',
      configJson: row?.configJson ?? null,
      dependsOn: [...manifest.dependsOn],
      settingsPaths,
    };
  }
}

/**
 * Ensure config is a JSON object (not array/primitive) and re-serialize stably.
 */
export function normalizeConfigJson(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestException('configJson must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException('configJson must be a JSON object');
  }
  return JSON.stringify(parsed);
}
