import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CustomerGroupMembershipEntity } from './entities/customer-group-membership.entity';
import { CustomerGroupEntity } from './entities/customer-group.entity';
import { CustomerEntity } from './entities/customer.entity';
import type {
  AddCustomerToGroupInput,
  CreateCustomerGroupInput,
  CustomerGroupMembershipType,
  CustomerGroupType,
  UpdateCustomerGroupInput,
} from './customer-group.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toGroupType(row: CustomerGroupEntity): CustomerGroupType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMembershipType(row: CustomerGroupMembershipEntity): CustomerGroupMembershipType {
  return {
    id: row.id,
    customerId: row.customerId,
    groupId: row.groupId,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class CustomerGroupsService {
  constructor(
    @InjectRepository(CustomerGroupEntity)
    private readonly groups: Repository<CustomerGroupEntity>,
    @InjectRepository(CustomerGroupMembershipEntity)
    private readonly memberships: Repository<CustomerGroupMembershipEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
  ) {}

  async findAll(): Promise<CustomerGroupType[]> {
    const rows = await this.groups.find({ order: { name: 'ASC' } });
    return rows.map(toGroupType);
  }

  async findById(id: string): Promise<CustomerGroupType> {
    const row = await this.groups.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Customer group ${id} not found`);
    }
    return toGroupType(row);
  }

  async create(input: CreateCustomerGroupInput): Promise<CustomerGroupType> {
    const entity = this.groups.create({
      name: input.name.trim(),
      description: input.description?.trim() || null,
    });
    try {
      const saved = await this.groups.save(entity);
      return toGroupType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Customer group name already exists: ${input.name.trim()}`);
      }
      throw error;
    }
  }

  async update(input: UpdateCustomerGroupInput): Promise<CustomerGroupType> {
    const row = await this.groups.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Customer group ${input.id} not found`);
    }
    if (input.name !== undefined) {
      row.name = input.name.trim();
    }
    if (input.description !== undefined) {
      row.description = input.description.trim() || null;
    }
    try {
      const saved = await this.groups.save(row);
      return toGroupType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Customer group name already exists: ${row.name}`);
      }
      throw error;
    }
  }

  async addMember(input: AddCustomerToGroupInput): Promise<CustomerGroupMembershipType> {
    const customer = await this.customers.findOne({
      where: { id: input.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${input.customerId} not found`);
    }
    const group = await this.groups.findOne({ where: { id: input.groupId } });
    if (!group) {
      throw new NotFoundException(`Customer group ${input.groupId} not found`);
    }

    const entity = this.memberships.create({
      customerId: input.customerId,
      groupId: input.groupId,
    });
    try {
      const saved = await this.memberships.save(entity);
      return toMembershipType(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Customer ${input.customerId} already in group ${input.groupId}`,
        );
      }
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException('Customer or group not found');
      }
      throw error;
    }
  }

  async removeMember(customerId: string, groupId: string): Promise<CustomerGroupMembershipType> {
    const row = await this.memberships.findOne({
      where: { customerId, groupId },
    });
    if (!row) {
      throw new NotFoundException(
        `Membership for customer ${customerId} in group ${groupId} not found`,
      );
    }
    await this.memberships.remove(row);
    return toMembershipType(row);
  }

  async listMembers(groupId: string): Promise<CustomerGroupMembershipType[]> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Customer group ${groupId} not found`);
    }
    const rows = await this.memberships.find({
      where: { groupId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toMembershipType);
  }

  async listGroupsForCustomer(customerId: string): Promise<CustomerGroupMembershipType[]> {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    const rows = await this.memberships.find({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toMembershipType);
  }
}
