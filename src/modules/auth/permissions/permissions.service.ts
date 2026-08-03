import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PermissionEntity } from '../entities/permission.entity';
import type { PermissionType } from '../roles/role.types';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
  ) {}

  async findAll(): Promise<PermissionType[]> {
    const rows = await this.permissions.find({ order: { key: 'ASC' } });
    return rows.map((row) => this.toPermissionType(row));
  }

  async findById(id: string): Promise<PermissionType> {
    const row = await this.permissions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Permission ${id} not found`);
    }
    return this.toPermissionType(row);
  }

  async listKeysForUser(userId: string): Promise<string[]> {
    const rows = await this.permissions
      .createQueryBuilder('p')
      .innerJoin('p.rolePermissions', 'rp')
      .innerJoin('rp.role', 'r')
      .innerJoin('r.userRoles', 'ur')
      .where('ur.userId = :userId', { userId })
      .select('DISTINCT p.key', 'key')
      .orderBy('p.key', 'ASC')
      .getRawMany<{ key: string }>();
    return rows.map((row) => row.key);
  }

  private toPermissionType(row: PermissionEntity): PermissionType {
    return {
      id: row.id,
      key: row.key,
      description: row.description,
      createdAt: row.createdAt,
    };
  }
}
