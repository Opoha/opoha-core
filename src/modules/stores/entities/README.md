# Store entities

**Owner:** `stores` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Catalog products/categories reference `stores.id` via nullable `store_id` (Phase 5 B-01). Carts/orders carry required `store_id` (Phase 5 B-02). Channel settings live in `store_channel_settings` (configuration module, B-03).
