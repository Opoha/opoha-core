# Supply entities

**Owner:** `supply` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables.

- `suppliers` — vendor master data for purchase orders
- `purchase_orders` / `purchase_order_lines` — draft → receive (credit warehouse stock) → received; cancel from draft only

`warehouse_id` references `warehouses.id` by foreign key only (owned by warehouses). `variant_id` references catalog `product_variants` by id only.
