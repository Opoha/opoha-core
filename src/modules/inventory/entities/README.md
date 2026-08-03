# Inventory entities

**Owner:** `inventory` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. `variant_id` references catalog `product_variants` by id only. `warehouse_id` references `warehouses.id` by foreign key only (owned by the warehouses module).

Stock is keyed by `(variant_id, warehouse_id)` — one inventory item row per variant per location.

Stock transfers (`stock_transfers` / `stock_transfer_lines`) move quantity between warehouses: draft → ship (deduct source) → receive (credit destination).
