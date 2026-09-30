# Market Data Architecture Audit Report

## 1. Executive Summary

This document evaluates the existing market data subsystem within the StockSharp Multi-User Brokerage Simulation Platform and outlines the design for integrating Angel One SmartAPI Scrip Master ingestion, canonical database indexing, real-time WebSocket tick parsing, dynamic option chain discovery, and Option Greeks calculation.

---

## 2. Current Architecture & Components Audit

| Subsystem | Current Status | Targeted Architecture |
| :--- | :--- | :--- |
| **Instrument Storage** | Hardcoded initial database seed (10 sample stock tokens) | Scalable SQLite `instruments` master table populated directly from official Angel One `OpenAPIScripMaster.json` (over 100,000 active contracts) |
| **Master Data Refresh** | Static initial seed | Automated `InstrumentMasterService` with file checksum verification, atomic SQLite transaction updates, version tracking (`instrument_master_versions`), and change logging |
| **Market Data Provider** | Multi-provider fallback framework (`IMarketDataProvider`) | Fully connected `AngelOneAdapter` powered by official Python `SmartConnect` live ticker subprocess streaming into shared JSON cache and internal event bus |
| **Option Chain Engine** | Static strike matrix | Dynamic option contract resolver (`get_expiries`, `get_option_chain`, `get_strikes`) querying actual NFO/BFO instrument tokens and real-time live LTP feeds |
| **Option Greeks** | Static reference values | Dynamic Black-Scholes Greeks calculation engine (`Delta`, `Gamma`, `Theta`, `Vega`, `IV`) computed against live spot prices and risk-free rates |

---

## 3. Recommended Subsystem Topology

```text
Angel One OpenAPI Scrip Master (OpenAPIScripMaster.json)
                         ↓
             [ InstrumentMasterService ]
                         ↓
  [ SQLite instruments Database & Version Tracking ]
                         ↓
            [ Canonical Instrument Model ]
                         ↓
   ----------------------------------------------
   | Token Resolver | Expiry Lookup | Strikes   |
   ----------------------------------------------
                         ↓
 [ Angel One SmartAPI Live Feed (angel_ticker.py) ]
                         ↓
       [ Real-Time WebSocket Market Bus ]
                         ↓
      ┌──────────────────┴──────────────────┐
      ↓                                     ↓
[ Trading Terminal UI ]           [ Dynamic Option Chain & Greeks ]
```

---

## 4. Database Schema Extensions

### 4.1 `instruments` Table Enhancements
Add columns for `company_name`, `isin`, `security_type`, `series`, `raw_metadata`, `first_seen_at`, `last_seen_at`.

### 4.2 `instrument_master_versions` Table (NEW)
Tracks `version_id`, `source_url`, `file_hash`, `record_count`, `valid_count`, `inserted_count`, `updated_count`, `processing_duration`, `created_at`.

### 4.3 `instrument_change_log` Table (NEW)
Tracks `instrument_id`, `change_type` (`CREATED`, `UPDATED`, `EXPIRED`, `DEACTIVATED`), `old_value`, `new_value`, `source_version`, `changed_at`.

---

## 5. File Modification & Creation Plan

### Files to be Created:
- `/docs/market-data-architecture-audit.md`
- `/docs/angelone-smartapi-market-data-reference.md`
- `/docs/master-instrument-data-pipeline.md`
- `/docs/option-chain-and-greeks.md`
- `server/src/marketData/InstrumentMasterService.ts`
- `server/src/marketData/OptionChainEngine.ts`
- `server/src/marketData/GreeksEngine.ts`
- `tests/instrument_master.test.ts`

### Files to be Modified:
- `server/src/db/schema.ts`
- `server/src/marketData/AngelOneAdapter.ts`
- `server/src/marketData/angel_ticker.py`
- `server/src/routes/api.ts`
- `client/src/components/OptionChainView.tsx`
