# Vendor entities

**Owner:** `vendors` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables.

- `vendors` — marketplace seller accounts (catalog listing + order routing)

Distinct from `suppliers` (supply / purchase orders).

Cross-module references (ID / FK only):

- `vendors.store_id` → `stores.id`
- `products.vendor_id` → `vendors.id` (column owned by **catalog**)
- `orders.vendor_id` / `order_lines.vendor_id` → `vendors.id` (columns owned by **order**)
