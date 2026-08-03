# Warehouse entities

**Owner:** `warehouses` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Inventory and fulfillment modules reference `warehouses.id` by foreign key only.

`store_warehouses` is the store ↔ warehouse allow-list (Phase 5 E-01). Cross-module FK to `stores.id` only — no TypeORM relation into the stores module.
