# TradeGrow Unified Platform — API Contracts & Protocol Specifications

**Document Reference**: `docs/api/01_UNIFIED_API_CONTRACTS.md`  
**API Specification Version**: v1.0.0  
**Transport**: HTTPS (REST / JSON) + WebSocket (`wss://`)  
**Base Path**: `/api/v1`

---

## 1. Gateway Conventions & Standard Envelope

### 1.1 Standard Request Headers
* `Authorization`: `Bearer <jwt_token>` (Mandatory for authenticated endpoints)
* `Idempotency-Key`: UUIDv4 string (Mandatory for mutating financial actions: `POST /orders`, `POST /payments`)
* `X-Request-ID`: Client-generated tracing UUID
* `X-TradeGrow-Platform`: `WEB_TERMINAL` | `ADVISORY_PORTAL` | `MOBILE_APP` | `MARKETING_SITE`

### 1.2 Standard Success Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-09-29T09:30:00.000Z",
    "requestId": "req_8f192bce94"
  }
}
```

### 1.3 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_MARGIN",
    "message": "Required margin ₹42,500.00 exceeds available cash balance ₹15,200.00",
    "details": {
      "requiredMarginPaisa": 4250000,
      "availableBalancePaisa": 1520000,
      "shortfallPaisa": 2730000
    }
  },
  "meta": {
    "timestamp": "2026-09-29T09:30:00.000Z",
    "requestId": "req_8f192bce94"
  }
}
```

---

## 2. Authentication & Unified SSO Endpoints (`/api/v1/auth`)

### 2.1 User Login
`POST /api/v1/auth/login`

* **Request**:
```json
{
  "identifier": "trader@example.com",
  "password": "SecurePassword123!"
}
```

* **Response (Success - 2FA Required)**:
```json
{
  "success": true,
  "data": {
    "challengeToken": "chl_92bf881ac3094e",
    "requiresTwoFactor": true,
    "method": "TOTP"
  }
}
```

### 2.2 Verify 2FA & Issue Unified Session
`POST /api/v1/auth/two-factor/verify`

* **Request**:
```json
{
  "challengeToken": "chl_92bf881ac3094e",
  "code": "489210"
}
```

* **Response (Success - 200 OK)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "rft_8291f...",
    "expiresIn": 86400,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "clientCode": "TG108422",
      "email": "trader@example.com",
      "role": "RETAIL_TRADER",
      "kycStatus": "VERIFIED",
      "advisorySubscription": {
        "status": "ACTIVE",
        "planCode": "INDEX_OPTIONS_PRO"
      }
    }
  }
}
```

---

## 3. Public Trust & Lead Ingestion (`/api/v1/public`)

### 3.1 Marketing Site Lead Capture
`POST /api/v1/public/leads`  
*Rate Limit: 5 requests / minute / IP*

* **Request**:
```json
{
  "phone": "+919876543210",
  "fullName": "Amit Verma",
  "email": "amit.verma@example.com",
  "source": "WEBSITE_ACQUISITION_CALCULATOR",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "fno_launch_q3",
  "referrerUrl": "https://tradegrow.com/pricing"
}
```

* **Response (Success - 201 Created)**:
```json
{
  "success": true,
  "data": {
    "leadCode": "LD-2026-91823",
    "stage": "NEW",
    "message": "Thank you! Our relationship team will connect with your verified onboarding link."
  }
}
```

---

## 4. Brokerage Trading Endpoints (`/api/v1/trading`)

### 4.1 Submit Order
`POST /api/v1/trading/orders`  
*Mandatory Header*: `Idempotency-Key: <UUID>`

* **Request**:
```json
{
  "symbol": "INFY",
  "exchange": "NSE",
  "side": "BUY",
  "orderType": "LIMIT",
  "productType": "MIS",
  "quantity": 100,
  "pricePaisa": 180500,
  "triggerPricePaisa": 0,
  "advisoryRecommendationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

* **Response (Success - 202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-20260929-108422-001",
    "status": "ACCEPTED",
    "symbol": "INFY",
    "quantity": 100,
    "blockedMarginPaisa": 3610000,
    "createdAt": "2026-09-29T09:35:10.120Z"
  }
}
```

### 4.2 Query Options Chain & Greeks
`GET /api/v1/trading/options/chain?symbol=NIFTY&expiry=2026-10-01`

* **Response (Success - 200 OK)**:
```json
{
  "success": true,
  "data": {
    "underlying": "NIFTY",
    "spotPricePaisa": 2485050,
    "expiry": "2026-10-01",
    "strikes": [
      {
        "strikePricePaisa": 2480000,
        "ce": {
          "token": "NFO:58921",
          "ltpPaisa": 12500,
          "iv": 13.85,
          "delta": 0.54,
          "theta": -12.4,
          "gamma": 0.00045,
          "vega": 18.2,
          "oi": 2840050,
          "volume": 849200
        },
        "pe": {
          "token": "NFO:58922",
          "ltpPaisa": 7450,
          "iv": 14.10,
          "delta": -0.46,
          "theta": -10.8,
          "gamma": 0.00045,
          "vega": 17.9,
          "oi": 3120900,
          "volume": 670100
        }
      }
    ]
  }
}
```

---

## 5. SEBI Advisory Desk Endpoints (`/api/v1/advisory`)

### 5.1 List Active Recommendations
`GET /api/v1/advisory/recommendations?status=ACTIVE`

* **Response (Success - 200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "referenceNo": "REC-2026-NSE-INFY-0091",
      "symbol": "INFY",
      "exchange": "NSE",
      "segment": "EQUITIES",
      "action": "BUY",
      "horizon": "SWING",
      "entryRangeMinPaisa": 180000,
      "entryRangeMaxPaisa": 181000,
      "target1Paisa": 186000,
      "target2Paisa": 190000,
      "stopLossPaisa": 177000,
      "riskRewardRatio": "1:2.3",
      "rationale": "Bullish breakout on ascending triangle supported by higher volumes.",
      "publishedAt": "2026-09-29T08:45:00.000Z",
      "tradeDeepLink": "/terminal?symbol=INFY&action=BUY&qty=100&sl=1770&tgt=1860&recId=3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ]
}
```

### 5.2 Research Head Dual-Signature Approval
`POST /api/v1/advisory/recommendations/:id/approve`  
*Permission Required*: `research_recommendations.approve`

* **Request**:
```json
{
  "decision": "APPROVED",
  "remarks": "Technical breakout verified against sector indices. Risk-reward compliant with SEBI guidelines."
}
```

---

## 6. Real-time WebSocket Protocol (`wss://api.tradegrow.com/ws`)

### 6.1 Client Authentication & Subscription
```json
{
  "action": "auth",
  "token": "eyJhbGciOi..."
}
```

```json
{
  "action": "subscribe",
  "channels": [
    "market:ticks:NSE:INFY",
    "market:ticks:NFO:NIFTY26SEP24500CE",
    "user:orders",
    "advisory:broadcast"
  ]
}
```

### 6.2 Server Inbound Message (Market Tick)
```json
{
  "channel": "market:ticks:NSE:INFY",
  "data": {
    "symbol": "INFY",
    "ltpPaisa": 180550,
    "changePaisa": 1250,
    "changePct": 0.69,
    "highPaisa": 181200,
    "lowPaisa": 179500,
    "volume": 2489100,
    "timestamp": 1727602510100
  }
}
```

---
*API contracts specification certified and saved to [01_UNIFIED_API_CONTRACTS.md](file:///d:/2026%20C%20downloads/tradegrow%20app/docs/api/01_UNIFIED_API_CONTRACTS.md).*
