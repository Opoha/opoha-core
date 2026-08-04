import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttributesService } from './attributes.service';
import { AttributeAppliesToEnum, AttributeValueTypeEnum } from './attribute.types';
import type { AttributeDefinitionEntity } from '../entities/attribute-definition.entity';
import type { AttributeValueEntity } from '../entities/attribute-value.entity';

describe('AttributesService', () => {
  let definitions: Map<string, AttributeDefinitionEntity>;
  let values: Map<string, AttributeValueEntity>;
  let products: Set<string>;
  let variants: Set<string>;
  let service: AttributesService;

  beforeEach(() => {
    definitions = new Map();
    values = new Map();
    products = new Set(['prod-1']);
    variants = new Set(['var-1']);

    const defRepo = {
      create: vi.fn(
        (data: Partial<AttributeDefinitionEntity>) => ({ ...data }) as AttributeDefinitionEntity,
      ),
      save: vi.fn(async (row: AttributeDefinitionEntity) => {
        if (!row.id) {
          row.id = `def-${definitions.size + 1}`;
          row.createdAt = new Date('2026-08-03T00:00:00Z');
          row.updatedAt = row.createdAt;
        }
        definitions.set(row.id, { ...row });
        return definitions.get(row.id)!;
      }),
      find: vi.fn(async () => [...definitions.values()]),
      findOne: vi.fn(
        async ({ where }: { where: { id: string } }) => definitions.get(where.id) ?? null,
      ),
      delete: vi.fn(async ({ id }: { id: string }) => {
        definitions.delete(id);
        return { affected: 1 };
      }),
    };

    const valueRepo = {
      create: vi.fn((data: Partial<AttributeValueEntity>) => ({ ...data }) as AttributeValueEntity),
      save: vi.fn(async (row: AttributeValueEntity) => {
        if (!row.id) {
          row.id = `val-${values.size + 1}`;
          row.createdAt = new Date('2026-08-03T00:00:00Z');
          row.updatedAt = row.createdAt;
        }
        values.set(row.id, { ...row });
        return values.get(row.id)!;
      }),
      find: vi.fn(async ({ where }: { where: { productId?: string; variantId?: string } }) =>
        [...values.values()].filter((v) => {
          if (where.productId) return v.productId === where.productId;
          if (where.variantId) return v.variantId === where.variantId;
          return true;
        }),
      ),
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: {
            id?: string;
            attributeDefinitionId?: string;
            productId?: string;
            variantId?: string;
          };
        }) => {
          if (where.id) return values.get(where.id) ?? null;
          return (
            [...values.values()].find((v) => {
              if (
                where.attributeDefinitionId &&
                v.attributeDefinitionId !== where.attributeDefinitionId
              ) {
                return false;
              }
              if (where.productId && v.productId !== where.productId) {
                return false;
              }
              if (where.variantId && v.variantId !== where.variantId) {
                return false;
              }
              return true;
            }) ?? null
          );
        },
      ),
      delete: vi.fn(async ({ id }: { id: string }) => {
        values.delete(id);
        return { affected: 1 };
      }),
    };

    const productRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
        products.has(where.id) ? { id: where.id } : null,
      ),
    };
    const variantRepo = {
      findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
        variants.has(where.id) ? { id: where.id } : null,
      ),
    };

    service = new AttributesService(
      defRepo as never,
      valueRepo as never,
      productRepo as never,
      variantRepo as never,
    );
  });

  it('creates definitions and attaches values to products/variants', async () => {
    const def = await service.createDefinition({
      code: 'color',
      name: 'Color',
      valueType: AttributeValueTypeEnum.text,
      appliesTo: AttributeAppliesToEnum.both,
    });
    expect(def.code).toBe('color');

    const productValue = await service.setProductAttribute({
      productId: 'prod-1',
      attributeDefinitionId: def.id,
      value: 'Red',
    });
    expect(productValue.value).toBe('Red');
    expect(productValue.productId).toBe('prod-1');

    const variantValue = await service.setVariantAttribute({
      variantId: 'var-1',
      attributeDefinitionId: def.id,
      value: 'Blue',
    });
    expect(variantValue.variantId).toBe('var-1');
    expect(variantValue.value).toBe('Blue');
  });

  it('rejects boolean/number parse errors and appliesTo mismatches', async () => {
    const boolDef = await service.createDefinition({
      code: 'organic',
      name: 'Organic',
      valueType: AttributeValueTypeEnum.boolean,
      appliesTo: AttributeAppliesToEnum.product,
    });
    await expect(
      service.setProductAttribute({
        productId: 'prod-1',
        attributeDefinitionId: boolDef.id,
        value: 'maybe',
      }),
    ).rejects.toThrow(/Boolean/);

    await expect(
      service.setVariantAttribute({
        variantId: 'var-1',
        attributeDefinitionId: boolDef.id,
        value: 'true',
      }),
    ).rejects.toThrow(/applies to product/);
  });
});
