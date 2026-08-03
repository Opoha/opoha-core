import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { generateOpaqueToken, hashOpaqueToken } from '../crypto/token-hash';
import type { AuthUser } from '../jwt/auth-user';
import { PermissionsService } from '../permissions/permissions.service';
import type {
  ApiKeyCreatedPayload,
  ApiKeyType,
  CreateApiKeyInput,
} from './api-key.types';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(
    ownerUserId: string,
    input: CreateApiKeyInput,
  ): Promise<ApiKeyCreatedPayload> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('API key name is required');
    }
    const permissionKeys = [
      ...new Set(input.permissionKeys.map((k) => k.trim())),
    ];
    if (permissionKeys.length === 0) {
      throw new BadRequestException('At least one permission key is required');
    }

    const ownerPerms =
      await this.permissionsService.listKeysForUser(ownerUserId);
    const unauthorized = permissionKeys.filter(
      (key) => !ownerPerms.includes(key),
    );
    if (unauthorized.length > 0) {
      throw new BadRequestException(
        `Cannot scope API key beyond owner permissions: ${unauthorized.join(', ')}`,
      );
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionKeys.length) {
      const found = new Set(permissions.map((p) => p.key));
      const missing = permissionKeys.filter((k) => !found.has(k));
      throw new BadRequestException(
        `Unknown permission key(s): ${missing.join(', ')}`,
      );
    }

    const raw = generateOpaqueToken('opk_');
    const keyPrefix = raw.slice(0, 12);
    const row = await this.prisma.apiKey.create({
      data: {
        userId: ownerUserId,
        name,
        keyPrefix,
        keyHash: hashOpaqueToken(raw),
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return {
      apiKey: this.toType(row),
      secret: raw,
    };
  }

  async listForUser(userId: string): Promise<ApiKeyType[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    return rows.map((row) => this.toType(row));
  }

  async revoke(userId: string, apiKeyId: string): Promise<ApiKeyType> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`API key ${apiKeyId} not found`);
    }
    if (existing.revokedAt) {
      return this.toType(existing);
    }
    const row = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    return this.toType(row);
  }

  async authenticate(rawKey: string): Promise<AuthUser> {
    const keyHash = hashOpaqueToken(rawKey.trim());
    const row = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: true,
        permissions: { include: { permission: true } },
      },
    });
    if (!row || row.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (!row.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: row.user.id,
      email: row.user.email,
      apiKeyId: row.id,
      permissions: row.permissions.map((p) => p.permission.key).sort(),
    };
  }

  private toType(row: {
    id: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    permissions: { permission: { key: string } }[];
  }): ApiKeyType {
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      permissionKeys: row.permissions.map((p) => p.permission.key).sort(),
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }
}
