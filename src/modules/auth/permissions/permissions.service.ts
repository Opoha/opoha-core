import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { PermissionType } from '../roles/role.types';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PermissionType[]> {
    const rows = await this.prisma.permission.findMany({
      orderBy: { key: 'asc' },
    });
    return rows.map((row) => this.toPermissionType(row));
  }

  async findById(id: string): Promise<PermissionType> {
    const row = await this.prisma.permission.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Permission ${id} not found`);
    }
    return this.toPermissionType(row);
  }

  private toPermissionType(row: {
    id: string;
    key: string;
    description: string | null;
    createdAt: Date;
  }): PermissionType {
    return {
      id: row.id,
      key: row.key,
      description: row.description,
      createdAt: row.createdAt,
    };
  }
}
