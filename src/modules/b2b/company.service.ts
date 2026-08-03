import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CustomersService } from '../customer/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { StoreService } from '../stores/public';
import {
  COMPANY_BUYER_ROLES,
  CompanyEntity,
  CompanyMembershipEntity,
  isCompanyBuyerRole,
  type CompanyBuyerRole,
} from './entities';
import type {
  AddCompanyMemberInput,
  CompanyMembershipType,
  CompanyType,
  CreateCompanyInput,
  RemoveCompanyMemberInput,
  UpdateCompanyInput,
  UpdateCompanyMemberRoleInput,
} from './company.types';

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

function assertBuyerRole(role: string): CompanyBuyerRole {
  const normalized = role.trim().toLowerCase();
  if (!isCompanyBuyerRole(normalized)) {
    throw new BadRequestException(
      `Invalid buyer role "${role}"; expected one of: ${COMPANY_BUYER_ROLES.join(', ')}`,
    );
  }
  return normalized;
}

function toCompanyType(row: CompanyEntity): CompanyType {
  return {
    id: row.id,
    storeId: row.storeId,
    name: row.name,
    creditLimitMinor:
      row.creditLimitMinor == null ? null : String(row.creditLimitMinor),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMembershipType(row: CompanyMembershipEntity): CompanyMembershipType {
  return {
    id: row.id,
    companyId: row.companyId,
    customerId: row.customerId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const APPROVER_ROLES: readonly CompanyBuyerRole[] = ['approver', 'admin'];
const BUYER_ROLES: readonly CompanyBuyerRole[] = ['buyer', 'admin'];

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(CompanyMembershipEntity)
    private readonly memberships: Repository<CompanyMembershipEntity>,
    private readonly stores: StoreService,
    private readonly customers: CustomersService,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(storeId?: string): Promise<CompanyType[]> {
    const rows = await this.companies.find({
      where: storeId ? { storeId } : undefined,
      order: { createdAt: 'ASC' },
    });
    return rows.map(toCompanyType);
  }

  async findById(id: string): Promise<CompanyType> {
    const row = await this.requireCompany(id);
    return toCompanyType(row);
  }

  async create(input: CreateCompanyInput): Promise<CompanyType> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Company name is required');
    }
    await this.stores.findById(input.storeId);

    let creditLimitMinor: string | null = null;
    if (input.creditLimitMinor !== undefined && input.creditLimitMinor !== null) {
      const raw = String(input.creditLimitMinor).trim();
      if (!/^\d+$/.test(raw)) {
        throw new BadRequestException(
          'creditLimitMinor must be a non-negative integer string',
        );
      }
      creditLimitMinor = raw;
    }

    const entity = this.companies.create({
      storeId: input.storeId,
      name,
      creditLimitMinor,
      isActive: input.isActive ?? true,
    });

    let saved: CompanyEntity;
    try {
      saved = await this.companies.save(entity);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Store ${input.storeId} does not exist`,
        );
      }
      throw error;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.CompanyCreated,
      aggregateType: 'company',
      aggregateId: saved.id,
      data: {
        companyId: saved.id,
        storeId: saved.storeId,
        name: saved.name,
      },
    });

    return toCompanyType(saved);
  }

  async update(input: UpdateCompanyInput): Promise<CompanyType> {
    const row = await this.requireCompany(input.id);
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('Company name is required');
      }
      row.name = name;
    }
    if (input.creditLimitMinor !== undefined) {
      if (input.creditLimitMinor === null) {
        row.creditLimitMinor = null;
      } else {
        const raw = String(input.creditLimitMinor).trim();
        if (!/^\d+$/.test(raw)) {
          throw new BadRequestException(
            'creditLimitMinor must be a non-negative integer string',
          );
        }
        row.creditLimitMinor = raw;
      }
    }
    if (input.isActive !== undefined) {
      row.isActive = input.isActive;
    }
    const saved = await this.companies.save(row);
    return toCompanyType(saved);
  }

  async listMembers(companyId: string): Promise<CompanyMembershipType[]> {
    await this.requireCompany(companyId);
    const rows = await this.memberships.find({
      where: { companyId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toMembershipType);
  }

  async addMember(input: AddCompanyMemberInput): Promise<CompanyMembershipType> {
    const company = await this.requireCompany(input.companyId);
    if (!company.isActive) {
      throw new BadRequestException(
        `Company ${input.companyId} is inactive`,
      );
    }
    await this.customers.findById(input.customerId);
    const role = assertBuyerRole(input.role);

    const entity = this.memberships.create({
      companyId: input.companyId,
      customerId: input.customerId,
      role,
    });

    let saved: CompanyMembershipEntity;
    try {
      saved = await this.memberships.save(entity);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Customer ${input.customerId} is already a member of company ${input.companyId}`,
        );
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Customer ${input.customerId} or company ${input.companyId} does not exist`,
        );
      }
      throw error;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.CompanyMembershipUpdated,
      aggregateType: 'company',
      aggregateId: saved.companyId,
      data: {
        companyId: saved.companyId,
        customerId: saved.customerId,
        role: saved.role,
      },
    });

    return toMembershipType(saved);
  }

  async updateMemberRole(
    input: UpdateCompanyMemberRoleInput,
  ): Promise<CompanyMembershipType> {
    await this.requireCompany(input.companyId);
    const role = assertBuyerRole(input.role);
    const row = await this.memberships.findOne({
      where: { companyId: input.companyId, customerId: input.customerId },
    });
    if (!row) {
      throw new NotFoundException(
        `Membership for customer ${input.customerId} in company ${input.companyId} not found`,
      );
    }
    row.role = role;
    const saved = await this.memberships.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.CompanyMembershipUpdated,
      aggregateType: 'company',
      aggregateId: saved.companyId,
      data: {
        companyId: saved.companyId,
        customerId: saved.customerId,
        role: saved.role,
      },
    });

    return toMembershipType(saved);
  }

  async removeMember(input: RemoveCompanyMemberInput): Promise<boolean> {
    await this.requireCompany(input.companyId);
    const row = await this.memberships.findOne({
      where: { companyId: input.companyId, customerId: input.customerId },
    });
    if (!row) {
      throw new NotFoundException(
        `Membership for customer ${input.customerId} in company ${input.companyId} not found`,
      );
    }
    await this.memberships.remove(row);

    await this.eventBus.publish({
      eventName: CoreEventName.CompanyMembershipUpdated,
      aggregateType: 'company',
      aggregateId: input.companyId,
      data: {
        companyId: input.companyId,
        customerId: input.customerId,
        role: null,
        removed: true,
      },
    });

    return true;
  }

  async getMembership(
    companyId: string,
    customerId: string,
  ): Promise<CompanyMembershipType | null> {
    const row = await this.memberships.findOne({
      where: { companyId, customerId },
    });
    return row ? toMembershipType(row) : null;
  }

  /** Assert customer may place B2B carts/orders for the company. */
  async assertCanBuy(companyId: string, customerId: string): Promise<void> {
    const company = await this.requireCompany(companyId);
    if (!company.isActive) {
      throw new BadRequestException(`Company ${companyId} is inactive`);
    }
    const membership = await this.memberships.findOne({
      where: { companyId, customerId },
    });
    if (!membership || !BUYER_ROLES.includes(membership.role)) {
      throw new ForbiddenException(
        `Customer ${customerId} cannot place B2B orders for company ${companyId}`,
      );
    }
  }

  /** Assert customer may approve draft B2B orders. */
  async assertCanApprove(companyId: string, customerId: string): Promise<void> {
    const company = await this.requireCompany(companyId);
    if (!company.isActive) {
      throw new BadRequestException(`Company ${companyId} is inactive`);
    }
    const membership = await this.memberships.findOne({
      where: { companyId, customerId },
    });
    if (!membership || !APPROVER_ROLES.includes(membership.role)) {
      throw new ForbiddenException(
        `Customer ${customerId} cannot approve orders for company ${companyId}`,
      );
    }
  }

  private async requireCompany(id: string): Promise<CompanyEntity> {
    const row = await this.companies.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return row;
  }
}
