# Market Data Operations Runbook

## 1. System Maintenance & Master Data Synchronization

### How to Trigger Manual Master Instrument Sync
Administrators can trigger a full refresh of the official Angel One Scrip Master database via API:
```bash
curl -X POST http://localhost:5000/api/v1/admin/instruments/sync \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

### How to Check Ingestion Version History
```bash
curl -X GET http://localhost:5000/api/v1/admin/instruments/versions \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"
```

---

## 2. Troubleshooting & Diagnostics

### Symptom: Live Prices Not Updating
1. Verify Python SmartConnect ticker process:
   ```bash
   python server/src/marketData/angel_ticker.py
   ```
2. Check `server/data/angel_ticks.json` file timestamp.
3. Verify Angel One API key credentials in `.env`:
   - `SMARTAPI_API_KEY`
   - `SMARTAPI_CLIENT_CODE`
   - `SMARTAPI_PASSWORD`
   - `SMARTAPI_TOTP_SECRET`

### Symptom: Option Chain Shows Empty Table
1. Verify backend server logs for `OptionChainEngine` execution.
2. Trigger hard refresh on Option Chain tab using the `Refresh` button.
