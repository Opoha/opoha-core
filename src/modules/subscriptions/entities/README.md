# Subscriptions entities

**Owner:** `subscriptions` module (ADR-0005 / ADR-0010).

Plugins must not alter these tables. `plugin-subscription` calls the module's
public service via host-bound ports (never direct table access).

- `subscription_plans` — recurring billing plan definitions
- `subscriptions` — per-customer schedule state (period, status, next billing)

Cross-module references (ID / FK only):

- `subscriptions.plan_id` → `subscription_plans.id`
- `subscriptions.customer_id` → `customers.id`
- `subscriptions.store_id` → `stores.id`

Renewal charges are placed through the core `payment-engine` module
(`PaymentEngine.authorize` / `.capture`) — never a provider SDK import.
