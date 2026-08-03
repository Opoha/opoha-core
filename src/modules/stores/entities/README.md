# Store entities

**Owner:** `stores` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Catalog, orders, and configuration modules will reference `stores.id` by foreign key only (Phase 5 B+).
