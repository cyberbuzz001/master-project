# ADR-002: Unified Identity, Session Federation & Single Sign-On (SSO)

**Status**: ACCEPTED  
**Date**: September 2026  
**Deciders**: Lead FinTech Systems Architect, Security Lead  

---

## Context
Currently, `Tradegrow` uses custom JWT authentication with Argon2id password hashing in PostgreSQL, while `Expert advisory` uses Laravel Sanctum token authentication with its own user table. A customer subscribing to advisory research who also trades on the terminal would otherwise have to register twice, manage two passwords, and navigate disjointed sessions.

## Decision
We designate `core.users` within the unified PostgreSQL database as the **Single Canonical Identity Provider (IdP)**:
1. All authentication flows (`/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/two-factor`) route through the Unified API Gateway.
2. The Gateway issues standard signed RS256 JWT access tokens (15-minute expiry) accompanied by secure HTTP-only refresh cookies.
3. Both the Trading Terminal (React 19) and the Advisory Portal (Next.js 15) authenticate against this central JWT token.
4. Laravel Sanctum in `services/advisory-service` is configured with a custom JWT guard to validate the central gateway's RS256 public key, eliminating duplicate login requirements.

## Consequences
### Positive
* Single login credentials and profile for the customer across all TradeGrow properties.
* Centralized KYC state, 2FA/TOTP management, and session revocation.
* Seamless deep linking and navigation between Advisory and Trading terminal without re-authenticating.

### Negative
* Requires migration and deduplication of existing user records into `core.users`.
* Gateway becomes a critical path for authentication availability (mitigated via stateless RS256 token verification across services).
