# Catalog entities

**Owner:** `catalog` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Cross-module references use IDs resolved via services/DataLoaders.

## Store scope (Phase 5 B-01 / B-04)

Products and categories carry optional `store_id` (FK to `stores.id`):

| `store_id` | Mode | Visibility |
|------------|------|------------|
| `NULL` | Shared (default) | Visible to every store in **shared** catalogMode |
| UUID | Store-owned | Visible only to that store |

List APIs (`products` / `categories`) accept `storeId` + optional `catalogMode`:

- **shared** (default / channel setting): shared ∪ store-owned
- **isolated**: store-owned only

When `catalogMode` is omitted, the store’s `store_channel_settings.catalog_mode` is used.

Existing single-store rows migrate as **shared** (`store_id` NULL). A default store is seeded only when none exists; catalog rows are not reassigned to it.
