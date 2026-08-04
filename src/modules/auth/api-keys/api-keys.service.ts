import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CoreEventName } from '../../event-bus/event-catalog';
import { EventBusService } from '../../event-bus/event-bus.service';
import { AuditAction } from '../audit/audit-actions';
import { AuditLogsService } from '../audit/audit-logs.service';
import { generateOpaqueToken, hashOpaqueToken } from '../crypto/token-hash';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { ApiKeyPermissionEntity } from '../entities/api-key-permission.entity';
import { PermissionEntity } from '../entities/permission.entity';
import type { AuthUser } from '../jwt/auth-user';
import { PermissionsService } from '../permissions/permissions.service';
import type { ApiKeyCreatedPayload, ApiKeyType, CreateApiKeyInput } from './api-key.types';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeys: Repository<ApiKeyEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(ApiKeyPermissionEntity)
    private readonly apiKeyPermissions: Repository<ApiKeyPermissionEntity>,
    private readonly permissionsService: PermissionsService,
    private readonly auditLogs: AuditLogsService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(ownerUserId: string, input: CreateApiKeyInput): Promise<ApiKeyCreatedPayload> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('API key name is required');
    }
    const permissionKeys = [...new Set(input.permissionKeys.map((k) => k.trim()))];
    if (permissionKeys.length === 0) {
      throw new BadRequestException('At least one permission key is required');
    }

    const ownerPerms = await this.permissionsService.listKeysForUser(ownerUserId);
    const unauthorized = permissionKeys.filter((key) => !ownerPerms.includes(key));
    if (unauthorized.length > 0) {
      throw new BadRequestException(
        `Cannot scope API key beyond owner permissions: ${unauthorized.join(', ')}`,
      );
    }

    const permissionRows = await this.permissions.find({
      where: { key: In(permissionKeys) },
      select: ['id', 'key'],
    });
    if (permissionRows.length !== permissionKeys.length) {
      const found = new Set(permissionRows.map((p) => p.key));
      const missing = permissionKeys.filter((k) => !found.has(k));
      throw new BadRequestException(`Unknown permission key(s): ${missing.join(', ')}`);
    }

    const raw = generateOpaqueToken('opk_');
    const keyPrefix = raw.slice(0, 12);
    const saved = await this.apiKeys.save(
      this.apiKeys.create({
        userId: ownerUserId,
        name,
        keyPrefix,
        keyHash: hashOpaqueToken(raw),
      }),
    );

    await this.apiKeyPermissions.save(
      permissionRows.map((p) =>
        this.apiKeyPermissions.create({
          apiKeyId: saved.id,
          permissionId: p.id,
        }),
      ),
    );

    const row = await this.apiKeys.findOne({
      where: { id: saved.id },
      relations: { apiKeyPermissions: { permission: true } },
    });
    if (!row) {
      throw new NotFoundException('API key not found after create');
    }

    const apiKey = this.toType(row);
    await this.auditLogs.append({
      action: AuditAction.API_KEY_CREATE,
      actorUserId: ownerUserId,
      resourceType: 'api_key',
      resourceId: apiKey.id,
      metadata: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissionKeys: apiKey.permissionKeys,
      },
    });
    await this.eventBus.publish({
      eventName: CoreEventName.ApiKeyCreated,
      aggregateType: 'api_key',
      aggregateId: apiKey.id,
      data: {
        apiKeyId: apiKey.id,
        ownerUserId,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissionKeys: apiKey.permissionKeys,
      },
      metadata: { actorId: ownerUserId },
    });
    return {
      apiKey,
      secret: raw,
    };
  }

  async listForUser(userId: string): Promise<ApiKeyType[]> {
    const rows = await this.apiKeys.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: { apiKeyPermissions: { permission: true } },
    });
    return rows.map((row) => this.toType(row));
  }

  async revoke(userId: string, apiKeyId: string): Promise<ApiKeyType> {
    const existing = await this.apiKeys.findOne({
      where: { id: apiKeyId, userId },
      relations: { apiKeyPermissions: { permission: true } },
    });
    if (!existing) {
      throw new NotFoundException(`API key ${apiKeyId} not found`);
    }
    if (existing.revokedAt) {
      return this.toType(existing);
    }
    existing.revokedAt = new Date();
    const row = await this.apiKeys.save(existing);
    const reloaded = await this.apiKeys.findOne({
      where: { id: row.id },
      relations: { apiKeyPermissions: { permission: true } },
    });
    const apiKey = this.toType(reloaded ?? row);
    await this.auditLogs.append({
      action: AuditAction.API_KEY_REVOKE,
      actorUserId: userId,
      resourceType: 'api_key',
      resourceId: apiKey.id,
      metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix },
    });
    await this.eventBus.publish({
      eventName: CoreEventName.ApiKeyRevoked,
      aggregateType: 'api_key',
      aggregateId: apiKey.id,
      data: {
        apiKeyId: apiKey.id,
        ownerUserId: userId,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
      },
      metadata: { actorId: userId },
    });
    return apiKey;
  }

  async authenticate(rawKey: string): Promise<AuthUser> {
    const keyHash = hashOpaqueToken(rawKey.trim());
    const row = await this.apiKeys.findOne({
      where: { keyHash },
      relations: { user: true, apiKeyPermissions: { permission: true } },
    });
    if (!row || row.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (!row.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    await this.apiKeys.update(row.id, { lastUsedAt: new Date() });

    return {
      userId: row.user.id,
      email: row.user.email,
      apiKeyId: row.id,
      permissions: row.apiKeyPermissions.map((p) => p.permission.key).sort(),
    };
  }

  private toType(row: ApiKeyEntity): ApiKeyType {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      permissionKeys: (row.apiKeyPermissions ?? []).map((p) => p.permission.key).sort(),
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }
}
