import type { DataSource } from 'typeorm';

import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  UserRoleEntity,
} from '../entities';
import type { SeedAuthStore } from './seed-auth';

export function createTypeOrmSeedStore(dataSource: DataSource): SeedAuthStore {
  const roles = dataSource.getRepository(RoleEntity);
  const permissions = dataSource.getRepository(PermissionEntity);
  const rolePermissions = dataSource.getRepository(RolePermissionEntity);
  const users = dataSource.getRepository(UserEntity);
  const userRoles = dataSource.getRepository(UserRoleEntity);

  return {
    role: {
      async upsert({ where, create, update }) {
        let row = await roles.findOne({ where: { name: where.name } });
        if (row) {
          row.description = update.description;
          row = await roles.save(row);
        } else {
          row = await roles.save(
            roles.create({ name: create.name, description: create.description }),
          );
        }
        return { id: row.id, name: row.name };
      },
    },
    permission: {
      async upsert({ where, create, update }) {
        let row = await permissions.findOne({ where: { key: where.key } });
        if (row) {
          row.description = update.description;
          row = await permissions.save(row);
        } else {
          row = await permissions.save(
            permissions.create({
              key: create.key,
              description: create.description,
            }),
          );
        }
        return { id: row.id, key: row.key };
      },
    },
    rolePermission: {
      async upsert({ where, create }) {
        const { roleId, permissionId } = where.roleId_permissionId;
        const existing = await rolePermissions.findOne({
          where: { roleId, permissionId },
        });
        if (!existing) {
          await rolePermissions.save(
            rolePermissions.create({ roleId: create.roleId, permissionId: create.permissionId }),
          );
        }
        return {};
      },
    },
    user: {
      async findUnique({ where }) {
        const row = await users.findOne({ where: { email: where.email } });
        return row ? { id: row.id, email: row.email } : null;
      },
      async create({ data }) {
        const row = await users.save(
          users.create({
            email: data.email,
            passwordHash: data.passwordHash,
          }),
        );
        return { id: row.id, email: row.email };
      },
    },
    userRole: {
      async upsert({ where, create }) {
        const { userId, roleId } = where.userId_roleId;
        const existing = await userRoles.findOne({ where: { userId, roleId } });
        if (!existing) {
          await userRoles.save(userRoles.create({ userId: create.userId, roleId: create.roleId }));
        }
        return {};
      },
    },
  };
}
