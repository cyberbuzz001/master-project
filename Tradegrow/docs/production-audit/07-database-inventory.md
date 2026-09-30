# 07 — Database Inventory

## Database System

- **Engine:** PostgreSQL 16 (with TimescaleDB extension)
- **ORM:** None — raw SQL via `pg` pool
- **Connection Pool:** max 20 connections (PG_POOL_MAX)
- **Migration System:** Custom SQL runner (auto-applies on startup, idempotent)

## Database Configuration

| Setting | Dev Value | Production Note |
|---------|-----------|-----------------|
| PG_HOST | localhost | postgres (docker) |
| PG_PORT | 5432 | 5432 |
| PG_DATABASE | brokerage_dev | stocksharp |
| PG_USER | postgres | stocksharp |
| PG_PASSWORD | postgres | stocksharp_pg_pw_2026 |
| PG_POOL_MAX | 20 | 20 |

## Migration Files

| File | Contents | Status |
|------|----------|--------|
| 001_initial_schema.sql | users, virtual_wallets, wallet_ledger, orders, executions, positions, holdings, instruments | ACTIVE |
| 002_watchlists_audit_sessions.sql | watchlists, watchlist_items, audit_logs, sessions | ACTIVE |
| 003_admin_control_center.sql | system_settings, feature_flags, risk_events, admin_sessions | ACTIVE |
| 004_fund_requests.sql | fund_requests table | ACTIVE |
| 005_market_data_config_storage.sql | market_data_snapshots, instrument_master_versions, candle_cache | ACTIVE |
| 006_options_derivatives_engine.sql | option_contracts, greeks_cache | ACTIVE |
| 007_timescaledb_hypertables.sql | Convert market_data_snapshots to hypertable | ACTIVE (requires TimescaleDB) |
| 008_kyc_and_support.sql | kyc_applications, kyc_documents, support_tickets | ACTIVE |

## Core Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR PK | 'usr_' + UUID |
| username | VARCHAR UNIQUE | |
| email | VARCHAR UNIQUE | |
| password_hash | TEXT | Argon2id |
| role | VARCHAR | USER/ADMIN/SUPER_ADMIN/RISK_MANAGER/etc. |
| status | VARCHAR | ACTIVE/SUSPENDED/FROZEN |
| failed_login_attempts | INT | Lockout counter |
| locked_until | TIMESTAMP | Account lockout expiry |
| last_login_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### virtual_wallets
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR PK | 'wal_' + UUID |
| user_id | VARCHAR FK(users) | |
| cash_balance | DECIMAL | Available + margin |
| used_margin | DECIMAL | Locked for open positions |
| realized_pnl | DECIMAL | Closed trades P&L |
| unrealized_pnl | DECIMAL | Open positions P&L |

### wallet_ledger
Tracks every credit/debit transaction for audit trail.

### orders
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR PK | 'ord_' + UUID |
| order_id | VARCHAR | Public ID 'ORD...' |
| user_id | VARCHAR FK | |
| instrument_token | VARCHAR | |
| exchange | VARCHAR | NSE/BSE/NFO/MCX |
| symbol | VARCHAR | |
| side | VARCHAR | BUY/SELL |
| quantity | INT | |
| price | DECIMAL | |
| order_type | VARCHAR | MARKET/LIMIT/SL/SL_M |
| product_type | VARCHAR | MIS/CNC/NRML |
| status | VARCHAR | ACCEPTED/PENDING/FILLED/REJECTED/CANCELLED |
| idempotency_key | VARCHAR | Duplicate prevention |
| rejection_reason | TEXT | |
| created_at | TIMESTAMP | |

### executions
Fills/trades against orders. One order can have multiple partial fills.

### positions
Intraday net positions per user per instrument.

### holdings
Overnight delivery holdings (CNC product type).

### instruments
| Column | Notes |
|--------|-------|
| instrument_token | 'NSE_NIFTY50', 'NFO_NIFTY_24500_CE' etc. |
| exchange | NSE/BSE/NFO/MCX |
| segment | EQ/FO |
| symbol | NIFTY 50, RELIANCE etc. |
| lot_size | 25 for NIFTY |
| strike | 0 for equities |
| option_type | CE/PE/XX |
| expiry | DATE or NULL |
| instrument_type | INDEX/EQ/OPTIDX/OPTSTK |

### watchlists + watchlist_items
Per-user watchlists with multiple items.

### audit_logs
All admin actions and critical user actions logged here.

### system_settings
Key-value store for risk settings. REAL_MONEY_TRADING cannot be modified via API.

### feature_flags
Feature toggle key-value store.

### risk_events
Track margin alerts, RMS blocks, high-risk positions.

### fund_requests
Client deposit/withdrawal requests with PENDING/APPROVED/REJECTED status.

### market_data_snapshots (TimescaleDB hypertable)
Candle/tick storage. Requires TimescaleDB extension.

### instrument_master_versions
Tracks scrip master download versions (Dhan/Angel One).

### kyc_applications + kyc_documents
KYC submission tracking with document file references.

### support_tickets
Customer support ticket system.

### option_contracts
Derived option contract data for F&O.

## Table Status Classification

| Table | Status | Notes |
|-------|--------|-------|
| users | ACTIVE — CRITICAL | Core auth table |
| virtual_wallets | ACTIVE — CRITICAL | Balance tracking |
| wallet_ledger | ACTIVE | Audit trail |
| orders | ACTIVE — CRITICAL | Trading core |
| executions | ACTIVE | Trade fills |
| positions | ACTIVE | Live P&L |
| holdings | ACTIVE | CNC holdings |
| instruments | ACTIVE — CRITICAL | Symbol master |
| watchlists | ACTIVE | User watchlists |
| watchlist_items | ACTIVE | Watchlist symbols |
| audit_logs | ACTIVE — COMPLIANCE | All admin actions |
| system_settings | ACTIVE | Risk configuration |
| feature_flags | ACTIVE | Feature toggles |
| risk_events | ACTIVE | Risk monitoring |
| fund_requests | ACTIVE | Fund management |
| market_data_snapshots | ACTIVE — TimescaleDB | Candle storage |
| instrument_master_versions | ACTIVE | Scrip master tracking |
| kyc_applications | ACTIVE | KYC management |
| kyc_documents | ACTIVE | KYC file references |
| support_tickets | ACTIVE | Support system |
| option_contracts | ACTIVE | F&O contracts |
| sessions | ACTIVE-VERIFY | Session tracking (may be unused) |
| greeks_cache | ACTIVE-VERIFY | Greeks caching |

## Admin API References to Potentially Missing Tables

The adminApi.ts references these tables that may or may not exist in migrations:
- `kyc_records` — adminApi.ts line ~38 queries this, but migration 008 creates `kyc_applications`
- `risk_events` — migration 003 creates this table
- `candle_cache` — migration 005

**WARNING:** `kyc_records` vs `kyc_applications` naming inconsistency detected between adminApi.ts and the migration file. Verify column names match.
