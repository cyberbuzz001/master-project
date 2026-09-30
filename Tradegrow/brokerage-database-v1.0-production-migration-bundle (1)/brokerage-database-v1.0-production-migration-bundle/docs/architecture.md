# Architecture

Canonical ownership:
User -> Customer -> Trading Account -> Instrument -> Order -> Trade -> Portfolio/Ledger.

Asynchronous events use the transactional outbox:
DB transaction -> outbox row -> publisher -> Kafka/NATS -> consumer.

The database is the source of truth for canonical financial state.
