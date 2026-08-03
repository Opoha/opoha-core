import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { ApiKeyEntity } from './api-key.entity';
import { PermissionEntity } from './permission.entity';

/** OWNER: auth module — plugins must not alter this table. */
@Entity({ name: 'api_key_permissions' })
export class ApiKeyPermissionEntity {
  @PrimaryColumn({ name: 'api_key_id', type: 'uuid' })
  apiKeyId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @ManyToOne(() => ApiKeyEntity, (key) => key.apiKeyPermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'api_key_id' })
  apiKey!: ApiKeyEntity;

  @ManyToOne(() => PermissionEntity, (permission) => permission.apiKeyPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: PermissionEntity;
}
