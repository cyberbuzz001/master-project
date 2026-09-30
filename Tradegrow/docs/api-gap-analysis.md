# API Gap Analysis

## 1. Identified Endpoint Gaps & Status

| Category | Endpoint Path | HTTP Method | Implementation Status | Action Plan |
|---|---|---|---|---|
| **Multi-Leg Orders** | `/api/v1/orders/multileg` | `POST` | Implemented via sequential `/api/v1/orders` calls | Add dedicated `/orders/multileg` endpoint for atomic batch placement |
| **L2 Market Depth** | `/api/v1/market/depth/:symbol` | `GET` | Integrated dynamically in `MarketDepthView.tsx` | Add server-side L2 depth stream generator |
| **Auth Refresh Token**| `/api/v1/auth/refresh` | `POST` | `getRefreshSecret()` created in `auth.ts` | Add `/auth/refresh` route to `api.ts` |
| **Funds Operations** | `/api/v1/funds/add`, `/api/v1/funds/withdraw` | `POST` | Handled via admin adjust balance | Add client-initiated deposit/withdrawal request routes |
| **CRM & KYC Queue** | `/api/v1/admin/kyc/queue` | `GET` / `POST` | Schema created | Connect admin KYC workflow endpoints |
