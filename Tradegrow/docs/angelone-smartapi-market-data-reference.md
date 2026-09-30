# Angel One SmartAPI Market Data & Instrument Reference Guide

`VERIFIED FROM OFFICIAL ANGEL ONE SMARTAPI DOCUMENTATION`

---

## 1. Official SmartAPI Scrip Master Endpoint

- **URL**: `https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json`
- **Format**: Array of JSON objects
- **Authentication**: Public CDN download (No API Key header required for master file)
- **Update Frequency**: Daily before market open (08:00 AM IST)

### Sample Raw Record Structure:
```json
{
  "token": "3045",
  "symbol": "SBIN-EQ",
  "name": "SBIN",
  "expiry": "",
  "strike": "-1.000000",
  "lotsize": "1",
  "instrumenttype": "",
  "exch_seg": "NSE",
  "tick_size": "0.050000"
}
```

```json
{
  "token": "49231",
  "symbol": "NIFTY28AUG2624500CE",
  "name": "NIFTY",
  "expiry": "28AUG2026",
  "strike": "24500.000000",
  "lotsize": "25",
  "instrumenttype": "OPTIDX",
  "exch_seg": "NFO",
  "tick_size": "0.050000"
}
```

---

## 2. SmartAPI Authentication & Session Flow

- **Base URL**: `https://apiconnect.angelone.in`
- **Login Endpoint**: `POST /rest/auth/angelbroking/user/v1/loginByPassword`
- **Payload**:
  ```json
  {
    "clientcode": "N89824",
    "password": "9691",
    "totp": "123456"
  }
  ```
- **Headers**:
  - `X-PrivateKey`: `{API_KEY}`
  - `X-ClientLocalIP`: `127.0.0.1`
  - `X-ClientPublicIP`: `106.193.147.98`
  - `X-MACAddress`: `{MAC_ADDRESS}`
  - `X-UserType`: `USER`
  - `X-SourceID`: `WEB`

---

## 3. Real-Time Quotes API (`getLtpData`)

- **Endpoint**: `POST /rest/secure/angelbroking/order/v1/getLtpData`
- **Headers**: `Authorization: Bearer {jwtToken}`, `X-PrivateKey: {API_KEY}`
- **Payload**:
  ```json
  {
    "exchange": "NSE",
    "tradingsymbol": "RELIANCE-EQ",
    "symboltoken": "2885"
  }
  ```
- **Response**:
  ```json
  {
    "status": true,
    "message": "SUCCESS",
    "errorcode": "",
    "data": {
      "exchange": "NSE",
      "tradingsymbol": "RELIANCE-EQ",
      "symboltoken": "2885",
      "open": 1315.2,
      "high": 1315.8,
      "low": 1308.8,
      "close": 1307.8,
      "ltp": 1310.4
    }
  }
  ```

---

## 4. WebSocket Feed Stream Specifications

- **Protocol**: Binary WebSocket over SSL
- **Heartbeat Interval**: 30 seconds
- **Rate Limit**: Max 30 requests/second for REST endpoints, 1 connection/client code for WebSockets.
