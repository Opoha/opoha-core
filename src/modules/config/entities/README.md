# Configuration entities

**Owner:** `config` / configuration module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. `store_channel_settings.store_id` references `stores.id` as a cross-module UUID FK only.
