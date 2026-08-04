import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Buyer roles within a company. */
export const COMPANY_BUYER_ROLES = ['buyer', 'approver', 'admin'] as const;
export type CompanyBuyerRole = (typeof COMPANY_BUYER_ROLES)[number];

export function isCompanyBuyerRole(value: string): value is CompanyBuyerRole {
  return (COMPANY_BUYER_ROLES as readonly string[]).includes(value);
}

/**
 * Customer membership on a B2B company.
 * OWNER: b2b module — plugins must not alter this table.
 * Cross-module FKs to `companies.id` (same module) and `customers.id` by id only.
 */
@Entity({ name: 'company_memberships' })
@Unique('company_memberships_company_customer_key', ['companyId', 'customerId'])
@Index('company_memberships_customer_id_idx', ['customerId'])
export class CompanyMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  /** Buyer customer id. FK to `customers.id`. */
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  /** buyer | approver | admin */
  @Column({ type: 'text' })
  role!: CompanyBuyerRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
