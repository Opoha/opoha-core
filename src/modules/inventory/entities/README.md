# Inventory entities

**Owner:** `inventory` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. `variant_id` references catalog `product_variants` by id only.
