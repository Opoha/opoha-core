# Warehouse entities

**Owner:** `warehouses` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. Inventory and fulfillment modules reference `warehouses.id` by foreign key only.
