# 18 — Environment Variables

## Complete .env Reference

### System Configuration

| Variable | Current Dev Value | Production Requirement | Required? |
|----------|------------------|----------------------|-----------|
| PORT | 5000 | 5000 (or custom) | YES |
| NODE_ENV | development | production | YES |
| JWT_SECRET | stocksharp_jwt_s3cr3t_... (WEAK) | Generate: openssl rand -hex 64 | YES — min 32 chars |
| JWT_REFRESH_SECRET | stocksharp_refresh_s3cr3t_... | Generate: openssl rand -hex 64 | YES |
| REAL_MONEY_TRADING | false | false (NEVER change) | YES — must be false |
| DEFAULT_VIRTUAL_CAPITAL | 1000000 | 1000000 (configurable) | NO |

### Angel One SmartAPI

| Variable | Current Value | Sensitivity | Rotate? |
|----------|--------------|-------------|---------|
| ANGELONE_API_KEY | 4DBv6HvT | HIGH | YES |
| ANGELONE_CLIENT_ID | N89824 | MEDIUM | YES |
| ANGELONE_CLIENT_SECRET | 9691 | HIGH (PIN) | YES |
| ANGELONE_TOTP_SECRET | AV7KF7BEJBOOCVIS53TZZB2VEU | CRITICAL | YES — immediately |
| SMARTAPI_API_KEY | 4DBv6HvT | Duplicate of ANGELONE_API_KEY | Clean up |
| SMARTAPI_CLIENT_CODE | N89824 | Duplicate | Clean up |
| SMARTAPI_PASSWORD | 9691 | Duplicate | Clean up |
| SMARTAPI_TOTP_SECRET | AV7KF7BEJBOOCVIS53TZZB2VEU | CRITICAL duplicate | Clean up |

**Note:** SMARTAPI_* duplicates ANGELONE_*. Consider consolidating.

### Dhan HQ API

| Variable | Current Value | Sensitivity | Rotate? |
|----------|--------------|-------------|---------|
| DHAN_CLIENT_ID | 1113019677 | MEDIUM | YES |
| DHAN_ACCESS_TOKEN | eyJ0eXAiOiJKV1Qi... | HIGH (JWT) | YES — verify expiry |
| DHAN_API_KEY | 21483ef7 | HIGH | YES |
| DHAN_API_SECRET | e9730aa4-682c-4e75-... | HIGH | YES |

**Token Expiry Check:**
```bash
# Decode JWT to check expiry:
echo "eyJ0eXAiOiJKV1Qi..." | cut -d'.' -f2 | base64 -d | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('exp'))"
```

### TrueData

| Variable | Current Value | Sensitivity | Rotate? |
|----------|--------------|-------------|---------|
| TRUEDATA_USERNAME | Trial208 | LOW (trial account) | YES |
| TRUEDATA_PASSWORD | nikhil208 | HIGH | YES |
| TRUEDATA_WS_PORT | 8082 | LOW | NO |
| TRUEDATA_WS_URL | wss://replay.truedata.in:8082 | LOW | Check if replay→live |

**Note:** URL points to REPLAY server, not live feed. Change to live URL for production if needed.

### Alpha Vantage

| Variable | Current Value | Sensitivity | Notes |
|----------|--------------|-------------|-------|
| ALPHAVANTAGE_API_KEY | CC23XT2DVHARWKAU | MEDIUM | Free tier: 25 req/day |

**For production:** Upgrade to paid plan or use only for fallback candle data.

### Indian Stock Market API (RapidAPI)

| Variable | Current Value | Sensitivity | Notes |
|----------|--------------|-------------|-------|
| INDIAN_STOCK_MARKET_API_BASE_URL | https://... | LOW | No API key set |

### Market Data Provider Selection

| Variable | Current Value | Options |
|----------|--------------|---------|
| PRIMARY_MARKET_DATA_PROVIDER | DHAN | DHAN, ANGELONE, TRUEDATA, ALPHAVANTAGE, MOCK_ENGINE, INDIAN_STOCK_MARKET_API |
| ALLOW_OFF_MARKET_LIVE_DATA | true | true/false — Override market hours check |

### PostgreSQL

| Variable | Dev Value | Production Value |
|----------|-----------|-----------------|
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/brokerage_dev | postgresql://stocksharp:STRONG_PW@postgres:5432/stocksharp |
| PG_HOST | localhost | postgres (docker service name) |
| PG_PORT | 5432 | 5432 |
| PG_DATABASE | brokerage_dev | stocksharp |
| PG_USER | postgres | stocksharp |
| PG_PASSWORD | postgres | GENERATE STRONG PASSWORD |
| PG_POOL_MAX | 20 | 20 |

**Note:** Both DATABASE_URL and individual PG_* vars are in .env. Schema.ts uses PG_* vars. Ensure consistency.

### Redis

| Variable | Dev Value | Production Value |
|----------|-----------|-----------------|
| REDIS_URL | redis://localhost:6379 | redis://redis:6379 |
| REDIS_HOST | localhost | redis |
| REDIS_PORT | 6379 | 6379 |

### CORS

| Variable | Dev Value | Production Value |
|----------|-----------|-----------------|
| ALLOWED_ORIGINS | http://localhost:3000,...5173,...5000 | https://yourdomain.com |

## Variables Used in Code (Verified)

| Variable | Used In |
|----------|---------|
| PORT | server/src/index.ts |
| NODE_ENV | Multiple (rate limiting, CSP, HSTS) |
| JWT_SECRET | middleware/auth.ts |
| JWT_REFRESH_SECRET | middleware/auth.ts |
| REAL_MONEY_TRADING | services/SafetyLock.ts |
| ALLOWED_ORIGINS | server/src/index.ts |
| PRIMARY_MARKET_DATA_PROVIDER | marketData/MarketDataEngine.ts |
| ALLOW_OFF_MARKET_LIVE_DATA | marketData/MarketDataEngine.ts |
| ANGELONE_* | marketData/AngelOneAdapter.ts |
| DHAN_* | marketData/DhanAdapter.ts |
| TRUEDATA_* | marketData/TrueDataAdapter.ts |
| ALPHAVANTAGE_API_KEY | marketData/AlphaVantageAdapter.ts |
| PG_* | server/src/db/schema.ts, pool.ts |
| REDIS_* | server/src/db/redis.ts |
| DEFAULT_VIRTUAL_CAPITAL | Used in db/init.ts (not currently — hardcoded 0) |

## Variables Defined But NOT Used

| Variable | Where Defined | Used In |
|----------|--------------|---------|
| INDIAN_STOCK_MARKET_API_BASE_URL | .env | IndianStockMarketApiAdapter (verify) |
| DEFAULT_VIRTUAL_CAPITAL | .env | db/init.ts hardcodes 0.0 — env var ignored |
| DATABASE_URL | .env | Not used — pool.ts uses PG_HOST/PORT/etc. |

## Production .env Template

```bash
# === PRODUCTION .ENV TEMPLATE ===
# Copy to .env.production, fill in values, DO NOT commit to git

PORT=5000
NODE_ENV=production
REAL_MONEY_TRADING=false

# Generate: openssl rand -hex 64
JWT_SECRET=REPLACE_WITH_STRONG_SECRET_MIN_64_CHARS
JWT_REFRESH_SECRET=REPLACE_WITH_STRONG_SECRET_MIN_64_CHARS

DEFAULT_VIRTUAL_CAPITAL=1000000

# Choose one primary provider
PRIMARY_MARKET_DATA_PROVIDER=DHAN
ALLOW_OFF_MARKET_LIVE_DATA=false

# Dhan (recommended)
DHAN_CLIENT_ID=YOUR_DHAN_CLIENT_ID
DHAN_ACCESS_TOKEN=YOUR_DHAN_ACCESS_TOKEN
DHAN_API_KEY=YOUR_DHAN_API_KEY
DHAN_API_SECRET=YOUR_DHAN_API_SECRET

# Angel One (optional secondary)
ANGELONE_API_KEY=YOUR_API_KEY
ANGELONE_CLIENT_ID=YOUR_CLIENT_ID
ANGELONE_CLIENT_SECRET=YOUR_PIN
ANGELONE_TOTP_SECRET=YOUR_TOTP_BASE32_SECRET

# Database
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=stocksharp
PG_USER=stocksharp
PG_PASSWORD=GENERATE_STRONG_DB_PASSWORD
PG_POOL_MAX=20

# Redis
REDIS_URL=redis://redis:6379

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```
