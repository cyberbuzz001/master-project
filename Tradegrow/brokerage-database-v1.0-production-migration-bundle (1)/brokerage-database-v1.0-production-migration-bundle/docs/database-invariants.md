# Database Invariants

1. Ledger entries are append-only.
2. Audit events are append-only.
3. Every logical order is idempotent per trading account.
4. Broker trade references are unique when present.
5. Payment provider references are unique when present.
6. Position uniqueness is account + instrument + product.
7. Customer resources are isolated by customer ownership chain.
8. Financial corrections use reversal/compensating transactions.
9. Outbox events are persisted transactionally with state changes.
10. Migrations are append-only and validated in CI.
