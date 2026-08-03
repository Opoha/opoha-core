import { ApiKeyEntity } from './api-key.entity';
import { ApiKeyPermissionEntity } from './api-key-permission.entity';
import { PermissionEntity } from './permission.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { RoleEntity } from './role.entity';
import { UserRoleEntity } from './user-role.entity';
import { UserEntity } from './user.entity';

export const authEntities = [
  UserEntity,
  RoleEntity,
  PermissionEntity,
  UserRoleEntity,
  RolePermissionEntity,
  ApiKeyEntity,
  ApiKeyPermissionEntity,
  RefreshTokenEntity,
] as const;

export {
  ApiKeyEntity,
  ApiKeyPermissionEntity,
  PermissionEntity,
  RefreshTokenEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  UserRoleEntity,
};
