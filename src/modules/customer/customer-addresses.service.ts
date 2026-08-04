import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CustomerAddressEntity } from './entities/customer-address.entity';
import { CustomerEntity } from './entities/customer.entity';
import type {
  CreateCustomerAddressInput,
  CustomerAddressType,
  UpdateCustomerAddressInput,
} from './customer-address.types';

function toAddressType(row: CustomerAddressEntity): CustomerAddressType {
  return {
    id: row.id,
    customerId: row.customerId,
    label: row.label,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    province: row.province,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    phone: row.phone,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertRequiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  return trimmed;
}

function assertCountryCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new BadRequestException(`countryCode must be ISO 3166-1 alpha-2 (got "${code}")`);
  }
  return normalized;
}

@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(CustomerAddressEntity)
    private readonly addresses: Repository<CustomerAddressEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
  ) {}

  async listByCustomer(customerId: string): Promise<CustomerAddressType[]> {
    await this.assertCustomerExists(customerId);
    const rows = await this.addresses.find({
      where: { customerId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
    return rows.map(toAddressType);
  }

  async findById(id: string): Promise<CustomerAddressType> {
    const row = await this.addresses.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Customer address ${id} not found`);
    }
    return toAddressType(row);
  }

  async create(input: CreateCustomerAddressInput): Promise<CustomerAddressType> {
    await this.assertCustomerExists(input.customerId);

    const existingCount = await this.addresses.count({
      where: { customerId: input.customerId },
    });
    const isDefault = input.isDefault === true || existingCount === 0;

    if (isDefault) {
      await this.clearDefault(input.customerId);
    }

    const row = this.addresses.create({
      customerId: input.customerId,
      label: input.label?.trim() || null,
      firstName: assertRequiredText(input.firstName, 'firstName'),
      lastName: assertRequiredText(input.lastName, 'lastName'),
      company: input.company?.trim() || null,
      line1: assertRequiredText(input.line1, 'line1'),
      line2: input.line2?.trim() || null,
      city: assertRequiredText(input.city, 'city'),
      province: input.province?.trim() || null,
      postalCode: assertRequiredText(input.postalCode, 'postalCode'),
      countryCode: assertCountryCode(input.countryCode),
      phone: input.phone?.trim() || null,
      isDefault,
    });

    const saved = await this.addresses.save(row);
    return this.findById(saved.id);
  }

  async update(input: UpdateCustomerAddressInput): Promise<CustomerAddressType> {
    const row = await this.addresses.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Customer address ${input.id} not found`);
    }

    if (input.label !== undefined) {
      row.label = input.label.trim() || null;
    }
    if (input.firstName !== undefined) {
      row.firstName = assertRequiredText(input.firstName, 'firstName');
    }
    if (input.lastName !== undefined) {
      row.lastName = assertRequiredText(input.lastName, 'lastName');
    }
    if (input.company !== undefined) {
      row.company = input.company.trim() || null;
    }
    if (input.line1 !== undefined) {
      row.line1 = assertRequiredText(input.line1, 'line1');
    }
    if (input.line2 !== undefined) {
      row.line2 = input.line2.trim() || null;
    }
    if (input.city !== undefined) {
      row.city = assertRequiredText(input.city, 'city');
    }
    if (input.province !== undefined) {
      row.province = input.province.trim() || null;
    }
    if (input.postalCode !== undefined) {
      row.postalCode = assertRequiredText(input.postalCode, 'postalCode');
    }
    if (input.countryCode !== undefined) {
      row.countryCode = assertCountryCode(input.countryCode);
    }
    if (input.phone !== undefined) {
      row.phone = input.phone.trim() || null;
    }
    if (input.isDefault === true) {
      await this.clearDefault(row.customerId, row.id);
      row.isDefault = true;
    } else if (input.isDefault === false) {
      row.isDefault = false;
    }

    await this.addresses.save(row);
    return this.findById(row.id);
  }

  async remove(id: string): Promise<CustomerAddressType> {
    const existing = await this.findById(id);
    await this.addresses.delete({ id });
    return existing;
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
  }

  private async clearDefault(customerId: string, exceptId?: string): Promise<void> {
    const defaults = await this.addresses.find({
      where: { customerId, isDefault: true },
    });
    for (const row of defaults) {
      if (exceptId && row.id === exceptId) {
        continue;
      }
      row.isDefault = false;
      await this.addresses.save(row);
    }
  }
}
