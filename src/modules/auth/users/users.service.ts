import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { AuditAction } from '../audit/audit-actions';
import { AuditLogsService } from '../audit/audit-logs.service';
import { UserEntity } from '../entities/user.entity';
import { hashPassword } from '../seed/password';
import type { CreateUserInput, UpdateUserInput, UserType } from './user.types';

type UserRow = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PUBLIC_FIELDS = ['id', 'email', 'isActive', 'createdAt', 'updatedAt'] as const;

function toUserType(row: UserRow): UserType {
  return {
    id: row.id,
    email: row.email,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(): Promise<UserType[]> {
    const rows = await this.users.find({
      order: { createdAt: 'ASC' },
      select: [...PUBLIC_FIELDS],
    });
    return rows.map(toUserType);
  }

  async findById(id: string): Promise<UserType> {
    const row = await this.users.findOne({
      where: { id },
      select: [...PUBLIC_FIELDS],
    });
    if (!row) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return toUserType(row);
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<(UserRow & { passwordHash: string }) | null> {
    return this.users.findOne({
      where: { email },
      select: [...PUBLIC_FIELDS, 'passwordHash'],
    });
  }

  async create(
    input: CreateUserInput,
    actorUserId?: string | null,
  ): Promise<UserType> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`User with email ${email} already exists`);
    }
    try {
      const row = await this.users.save(
        this.users.create({
          email,
          passwordHash: hashPassword(input.password),
          isActive: input.isActive ?? true,
        }),
      );
      const created = toUserType(row);
      await this.auditLogs.append({
        action: AuditAction.USER_CREATE,
        actorUserId: actorUserId ?? null,
        resourceType: 'user',
        resourceId: created.id,
        metadata: { email: created.email },
      });
      return created;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`User with email ${email} already exists`);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateUserInput,
    actorUserId?: string | null,
  ): Promise<UserType> {
    await this.findById(id);
    const patch: Partial<UserEntity> = {};
    if (input.email !== undefined) {
      patch.email = input.email.trim().toLowerCase();
    }
    if (input.password !== undefined) {
      patch.passwordHash = hashPassword(input.password);
    }
    if (input.isActive !== undefined) {
      patch.isActive = input.isActive;
    }
    try {
      await this.users.update(id, patch);
      const updated = await this.findById(id);
      await this.auditLogs.append({
        action: AuditAction.USER_UPDATE,
        actorUserId: actorUserId ?? null,
        resourceType: 'user',
        resourceId: id,
        metadata: {
          email: updated.email,
          fields: Object.keys(input).filter(
            (k) => input[k as keyof UpdateUserInput] !== undefined,
          ),
        },
      });
      return updated;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async remove(id: string, actorUserId?: string | null): Promise<UserType> {
    const row = await this.findById(id);
    await this.users.delete(id);
    await this.auditLogs.append({
      action: AuditAction.USER_DELETE,
      actorUserId: actorUserId ?? null,
      resourceType: 'user',
      resourceId: id,
      metadata: { email: row.email },
    });
    return row;
  }
}
