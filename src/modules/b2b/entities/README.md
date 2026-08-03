# B2B entities

**Owner:** `b2b` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables.

| Table | Purpose |
|-------|---------|
| `companies` | B2B company accounts scoped to a store channel |
| `company_memberships` | Customer ↔ company buyer roles (`buyer`, `approver`, `admin`) |
| `company_price_list_items` | Customer-specific (company ↔ variant) negotiated prices (F-04) |

Cross-module references use UUID columns only (`stores.id`, `customers.id`) — no TypeORM relations into other modules.

Cart/order `company_id` columns and B2B approval statuses (`draft` / `approved`) are owned by the **order** module (F-03).
