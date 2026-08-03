import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { hashPassword } from '../seed/password';
import type { CreateUserInput, UpdateUserInput, UserType } from './user.types';

type UserRow = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toUserType(row: UserRow): UserType {
  return {
    id: row.id,
    email: row.email,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserType[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(toUserType);
  }

  async findById(id: string): Promise<UserType> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return toUserType(row);
  }

  async findByEmailWithHash(
    email: string,
  ): Promise<(UserRow & { passwordHash: string }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
  }

  async create(input: CreateUserInput): Promise<UserType> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`User with email ${email} already exists`);
    }
    const row = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(input.password),
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return toUserType(row);
  }

  async update(id: string, input: UpdateUserInput): Promise<UserType> {
    await this.findById(id);
    const data: {
      email?: string;
      passwordHash?: string;
      isActive?: boolean;
    } = {};
    if (input.email !== undefined) {
      data.email = input.email.trim().toLowerCase();
    }
    if (input.password !== undefined) {
      data.passwordHash = hashPassword(input.password);
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return toUserType(row);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<UserType> {
    await this.findById(id);
    const row = await this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return toUserType(row);
  }
}
