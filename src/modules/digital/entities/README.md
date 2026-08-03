# Digital entities

**Owner:** `digital` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables.

- `digital_download_tokens` — secure download entitlements for digital SKUs
- `digital_license_keys` — license keys issued with digital fulfillment

Cross-module references (ID / FK only):

- `order_id` → `orders.id`
- `order_line_id` → `order_lines.id`
- `variant_id` → `product_variants.id`
- `customer_id` → `customers.id`
