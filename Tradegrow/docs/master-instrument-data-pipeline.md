# Master Instrument Data Pipeline Guide

## 1. Executive Overview
The Master Instrument Data Subsystem is responsible for downloading, parsing, validating, and maintaining official contract metadata from the Angel One SmartAPI ecosystem (`OpenAPIScripMaster.json`).

---

## 2. Ingestion Workflow & Data Lifecycle

```text
[ Official OpenAPI Scrip Master JSON ]  (https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json)
                   ↓
     [ InstrumentMasterService.downloadMasterJson ]
                   ↓
        [ SHA256 Checksum Hash Validation ]
                   ↓
    [ Canonical Record Parsing & Schema Mapping ]
                   ↓
      [ SQLite Transaction Upsert (`instruments`) ]
                   ↓
  [ Version Record (`instrument_master_versions`) ]
```

---

## 3. Ingested Canonical Schema (`instruments`)

| Column Name | Data Type | Key Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` | Format: `{EXCHANGE}_{TOKEN}` (e.g. `NSE_2885`) |
| `instrument_token` | `TEXT` | `UNIQUE` | Unique broker token string |
| `exchange` | `TEXT` | NOT NULL | Exchange segment (`NSE`, `BSE`, `NFO`, `BFO`, `MCX`) |
| `segment` | `TEXT` | NOT NULL | `EQ` (Equity), `FO` (Derivatives), `COM` (Commodities) |
| `symbol` | `TEXT` | NOT NULL | Underlyer symbol (e.g. `RELIANCE`, `NIFTY`) |
| `trading_symbol` | `TEXT` | NOT NULL | Broker trading symbol (e.g. `RELIANCE-EQ`, `NIFTY28AUG2624500CE`) |
| `lot_size` | `INTEGER` | DEFAULT 1 | Contract lot size |
| `tick_size` | `REAL` | DEFAULT 0.05 | Minimum price tick movement |
| `strike` | `REAL` | DEFAULT 0.0 | Option strike price |
| `option_type` | `TEXT` | DEFAULT 'XX' | `CE` (Call Option), `PE` (Put Option), `XX` (Equity/Index) |
| `expiry` | `TEXT` | Nullable | Expiry date string (e.g. `28AUG2026`) |
