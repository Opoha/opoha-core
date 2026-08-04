import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';

import { AuditAction } from '../audit/audit-actions';
import { AuditLogsService } from '../audit/audit-logs.service';
import { PermissionEntity } from '../entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import { UserEntity } from '../entities/user.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import { DEFAULT_ADMIN_ROLE_NAME } from '../seed/seed-auth';
import type { CreateRoleInput, PermissionType, RoleType, UpdateRoleInput } from './role.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(): Promise<RoleType[]> {
    const rows = await this.roles.find({
      order: { name: 'ASC' },
      relations: { rolePermissions: { permission: true } },
    });
    return rows.map((row) => this.toRoleType(row));
  }

  async findById(id: string): Promise<RoleType> {
    const row = await this.roles.findOne({
      where: { id },
      relations: { rolePermissions: { permission: true } },
    });
    if (!row) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return this.toRoleType(row);
  }

  async create(input: CreateRoleInput, actorUserId?: string | null): Promise<RoleType> {
    const name = input.name.trim().toLowerCase();
    if (!name) {
      throw new BadRequestException('Role name is required');
    }
    try {
      const row = await this.roles.save(
        this.roles.create({
          name,
          description: input.description?.trim() || null,
        }),
      );
      if (input.permissionIds?.length) {
        await this.replacePermissions(row.id, input.permissionIds);
      }
      const created = await this.findById(row.id);
      await this.auditLogs.append({
        action: AuditAction.ROLE_CREATE,
        actorUserId: actorUserId ?? null,
        resourceType: 'role',
        resourceId: created.id,
        metadata: { name: created.name },
      });
      return created;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Role ${name} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateRoleInput, actorUserId?: string | null): Promise<RoleType> {
    const existing = await this.findById(id);
    const patch: Partial<RoleEntity> = {};
    if (input.name !== undefined) {
      const name = input.name.trim().toLowerCase();
      if (!name) {
        throw new BadRequestException('Role name is required');
      }
      if (existing.name === DEFAULT_ADMIN_ROLE_NAME && name !== DEFAULT_ADMIN_ROLE_NAME) {
        throw new BadRequestException('Cannot rename the default admin role');
      }
      patch.name = name;
    }
    if (input.description !== undefined) {
      patch.description = input.description?.trim() || null;
    }
    try {
      if (Object.keys(patch).length > 0) {
        await this.roles.update(id, patch);
      }
      if (input.permissionIds !== undefined) {
        await this.replacePermissions(id, input.permissionIds);
      }
      const updated = await this.findById(id);
      await this.auditLogs.append({
        action: AuditAction.ROLE_UPDATE,
        actorUserId: actorUserId ?? null,
        resourceType: 'role',
        resourceId: id,
        metadata: {
          name: updated.name,
          fields: Object.keys(input).filter((k) => input[k as keyof UpdateRoleInput] !== undefined),
        },
      });
      return updated;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Role name already in use');
      }
      throw error;
    }
  }

  async remove(id: string, actorUserId?: string | null): Promise<RoleType> {
    const role = await this.findById(id);
    if (role.name === DEFAULT_ADMIN_ROLE_NAME) {
      throw new BadRequestException('Cannot delete the default admin role');
    }
    await this.roles.delete(id);
    await this.auditLogs.append({
      action: AuditAction.ROLE_DELETE,
      actorUserId: actorUserId ?? null,
      resourceType: 'role',
      resourceId: id,
      metadata: { name: role.name },
    });
    return role;
  }

  async assignRole(userId: string, roleId: string, actorUserId?: string | null): Promise<RoleType> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const role = await this.findById(roleId);
    const existing = await this.userRoles.findOne({ where: { userId, roleId } });
    if (!existing) {
      await this.userRoles.save(this.userRoles.create({ userId, roleId }));
    }
    await this.auditLogs.append({
      action: AuditAction.ROLE_ASSIGN,
      actorUserId: actorUserId ?? null,
      resourceType: 'role',
      resourceId: roleId,
      metadata: { userId, roleName: role.name },
    });
    return role;
  }

  async removeRole(userId: string, roleId: string, actorUserId?: string | null): Promise<RoleType> {
    const role = await this.findById(roleId);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    await this.userRoles.delete({ userId, roleId });
    await this.auditLogs.append({
      action: AuditAction.ROLE_REMOVE,
      actorUserId: actorUserId ?? null,
      resourceType: 'role',
      resourceId: roleId,
      metadata: { userId, roleName: role.name },
    });
    return role;
  }

  private async replacePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(permissionIds)];
    if (uniqueIds.length > 0) {
      const found = await this.permissions.find({
        where: { id: In(uniqueIds) },
      });
      if (found.length !== uniqueIds.length) {
        throw new BadRequestException('One or more permission ids are invalid');
      }
    }
    await this.rolePermissions.delete({ roleId });
    if (uniqueIds.length === 0) {
      return;
    }
    await this.rolePermissions.save(
      uniqueIds.map((permissionId) => this.rolePermissions.create({ roleId, permissionId })),
    );
  }

  private toRoleType(row: RoleEntity): RoleType {
    const permissions: PermissionType[] = (row.rolePermissions ?? []).map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      description: rp.permission.description,
      createdAt: rp.permission.createdAt,
    }));
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      permissions,
    };
  }
}
