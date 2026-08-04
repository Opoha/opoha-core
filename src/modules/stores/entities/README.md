# Store entities

**Owner:** `stores` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Catalog products/categories reference `stores.id` via nullable `store_id`. Carts/orders carry required `store_id`. Channel settings live in `store_channel_settings` (configuration module).
