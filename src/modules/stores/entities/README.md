# Store entities

**Owner:** `stores` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Catalog products/categories reference `stores.id` via nullable `store_id` (Phase 5 B-01). Orders and configuration follow in B-02/B-03.
