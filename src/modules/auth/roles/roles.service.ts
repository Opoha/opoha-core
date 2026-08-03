import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditAction } from '../audit/audit-actions';
import { AuditLogsService } from '../audit/audit-logs.service';
import { RoleEntity } from '../entities/role.entity';
import { UserEntity } from '../entities/user.entity';
import { UserRoleEntity } from '../entities/user-role.entity';
import type { PermissionType, RoleType } from './role.types';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
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

  async assignRole(
    userId: string,
    roleId: string,
    actorUserId?: string | null,
  ): Promise<RoleType> {
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

  async removeRole(
    userId: string,
    roleId: string,
    actorUserId?: string | null,
  ): Promise<RoleType> {
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
