/**
 * Catalog translation DTOs (Phase 5 C-01 / C-02).
 * GraphQL write surface lands in C-03; these types are shared by the service.
 */

export type CatalogTranslationFields = {
  name: string;
  slug: string | null;
  description: string | null;
};

export type ProductTranslationRecord = CatalogTranslationFields & {
  id: string;
  productId: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryTranslationRecord = CatalogTranslationFields & {
  id: string;
  categoryId: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertProductTranslationInput = {
  productId: string;
  locale: string;
  name: string;
  slug?: string | null;
  description?: string | null;
};

export type UpsertCategoryTranslationInput = {
  categoryId: string;
  locale: string;
  name: string;
  slug?: string | null;
  description?: string | null;
};
