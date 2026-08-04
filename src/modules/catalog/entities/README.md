# Catalog entities

**Owner:** `catalog` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Cross-module references use IDs resolved via services/DataLoaders.

## Store scope (Phase 5 B-01 / B-04)

Products and categories carry optional `store_id` (FK to `stores.id`):

| `store_id` | Mode             | Visibility                                       |
| ---------- | ---------------- | ------------------------------------------------ |
| `NULL`     | Shared (default) | Visible to every store in **shared** catalogMode |
| UUID       | Store-owned      | Visible only to that store                       |

List APIs (`products` / `categories`) accept `storeId` + optional `catalogMode`:

- **shared** (default / channel setting): shared ∪ store-owned
- **isolated**: store-owned only

When `catalogMode` is omitted, the store’s `store_channel_settings.catalog_mode` is used.

Existing single-store rows migrate as **shared** (`store_id` NULL). A default store is seeded only when none exists; catalog rows are not reassigned to it.

## Translations (Phase 5 C-01)

`product_translations` / `category_translations` hold locale overrides for `name` / `slug` / `description`:

| Table                   | FK                                        | Unique                  |
| ----------------------- | ----------------------------------------- | ----------------------- |
| `product_translations`  | `product_id` → `products.id` (CASCADE)    | `(product_id, locale)`  |
| `category_translations` | `category_id` → `categories.id` (CASCADE) | `(category_id, locale)` |

The base `products` / `categories` row always holds the default-locale content. A translation row overlays `name` and, when non-null, `slug` / `description`; a `null` override falls back to the base value. `CatalogTranslationsService` (`src/modules/catalog/translations/`) owns reads/writes and the overlay logic; `products` / `categories` GraphQL queries accept a `locale` arg (falling back to `Accept-Language`) to apply it (Phase 5 C-02).
