import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ApiKeyPermissionEntity } from './api-key-permission.entity';
import { RolePermissionEntity } from './role-permission.entity';

/** OWNER: auth module — plugins must not alter this table. */
@Entity({ name: 'permissions' })
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  key!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => RolePermissionEntity, (rp) => rp.permission)
  rolePermissions!: RolePermissionEntity[];

  @OneToMany(() => ApiKeyPermissionEntity, (ap) => ap.permission)
  apiKeyPermissions!: ApiKeyPermissionEntity[];
}
