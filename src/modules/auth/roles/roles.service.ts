import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { PermissionType, RoleType } from '../roles/role.types';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoleType[]> {
    const rows = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    return rows.map((row) => this.toRoleType(row));
  }

  async findById(id: string): Promise<RoleType> {
    const row = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    return this.toRoleType(row);
  }

  async assignRole(userId: string, roleId: string): Promise<RoleType> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const role = await this.findById(roleId);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
    return role;
  }

  async removeRole(userId: string, roleId: string): Promise<RoleType> {
    const role = await this.findById(roleId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });
    return role;
  }

  private toRoleType(row: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{
      permission: {
        id: string;
        key: string;
        description: string | null;
        createdAt: Date;
      };
    }>;
  }): RoleType {
    const permissions: PermissionType[] = row.permissions.map((rp) => ({
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
