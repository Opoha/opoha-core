import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { hashPassword } from '../auth/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { CustomerEntity } from './entities/customer.entity';
import type {
  CreateCustomerInput,
  CustomerType,
  RegisterCustomerInput,
  UpdateCustomerInput,
} from './customer.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException(`Invalid email: "${email}"`);
  }
  return normalized;
}

function assertPassword(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }
}

function toCustomerType(row: CustomerEntity): CustomerType {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(): Promise<CustomerType[]> {
    const rows = await this.customers.find({ order: { createdAt: 'ASC' } });
    return rows.map(toCustomerType);
  }

  async findById(id: string): Promise<CustomerType> {
    const row = await this.customers.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return toCustomerType(row);
  }

  async findByEmail(email: string): Promise<CustomerType | null> {
    const row = await this.customers.findOne({
      where: { email: normalizeEmail(email) },
    });
    return row ? toCustomerType(row) : null;
  }

  /** Storefront self-registration (public). */
  async register(input: RegisterCustomerInput): Promise<CustomerType> {
    return this.createInternal({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      isActive: true,
    });
  }

  /** Staff-created customer account. */
  async create(input: CreateCustomerInput): Promise<CustomerType> {
    return this.createInternal(input);
  }

  async update(input: UpdateCustomerInput): Promise<CustomerType> {
    const row = await this.customers.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Customer ${input.id} not found`);
    }
    if (input.firstName !== undefined) {
      row.firstName = input.firstName.trim() || null;
    }
    if (input.lastName !== undefined) {
      row.lastName = input.lastName.trim() || null;
    }
    if (input.phone !== undefined) {
      row.phone = input.phone.trim() || null;
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    const saved = await this.customers.save(row);
    return toCustomerType(saved);
  }

  private async createInternal(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isActive?: boolean;
  }): Promise<CustomerType> {
    const email = assertEmail(input.email);
    assertPassword(input.password);

    const entity = this.customers.create({
      email,
      passwordHash: hashPassword(input.password),
      firstName: input.firstName?.trim() || null,
      lastName: input.lastName?.trim() || null,
      phone: input.phone?.trim() || null,
      isActive: input.isActive ?? true,
    });

    let saved: CustomerEntity;
    try {
      saved = await this.customers.save(entity);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Customer email already registered: ${email}`);
      }
      throw error;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.CustomerCreated,
      aggregateType: 'customer',
      aggregateId: saved.id,
      data: {
        customerId: saved.id,
        email: saved.email,
      },
    });

    return toCustomerType(saved);
  }
}
