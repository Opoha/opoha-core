import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** OWNER: files module — metadata only; blob I/O lives in storage plugins. */
@Entity({ name: 'files' })
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Opaque key in the storage backend (e.g. relative path or object key). */
  @Column({ name: 'storage_key', type: 'text', unique: true })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: string;

  @Column({ type: 'text', nullable: true })
  checksum!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  /** Plugin id that owns/registered the storage adapter (optional). */
  @Column({ name: 'plugin_id', type: 'text', nullable: true })
  pluginId!: string | null;

  /** Storage adapter code (e.g. localfs, s3). */
  @Column({ name: 'storage_provider', type: 'text', nullable: true })
  storageProvider!: string | null;
}
