# ADR-004: SEBI Chinese Wall Enforcement & 1-Click Advisory Order Protocol

**Status**: ACCEPTED  
**Date**: September 2026  
**Deciders**: Lead FinTech Systems Architect, Chief Compliance Officer  

---

## Context
Under SEBI (Research Analysts) Regulations, 2014, an entity operating both stock research and brokerage services must maintain an uncompromised Chinese Wall between research analysts and trading dealing operations. Crucially, research analysts must not have access to client order books or non-public order flow, and dealing desk personnel must not receive advance knowledge of research recommendations prior to public release.

At the same time, retail subscribers demand friction-free execution: when an approved recommendation is received, they should be able to execute the trade on TradeGrow with 1 click without manually re-typing strike prices, limits, and stop losses.

## Decision
1. **Asymmetric Information Barrier (Chinese Wall)**:
   - Research analysts have zero access to the `broker.orders`, `broker.executions`, or `broker.positions` tables.
   - Broker trading personnel have no access to draft recommendations until they are in `APPROVED` and `PUBLISHED` status.
   - Analysts are restricted from personal trading in securities they cover (30 days prior and 5 days post publication) via automated RMS rejection rules.
2. **Statutory Client Suitability Gate**:
   - 1-click execution is only enabled if the client has an active, acknowledged Risk Profile whose risk rating meets or exceeds the instrument's risk level.
3. **Cryptographically Signed Order Intent Tokens**:
   - When a subscriber clicks "Trade on TradeGrow" from an advisory recommendation, the Advisory service issues a short-lived (120-second) HMAC-SHA256 signed Intent Token containing `recommendation_id`, `symbol`, `side`, `suggested_sl`, and `suggested_target`.
   - The Trading Terminal receives this intent token, validates its signature with the Gateway, checks live market depth, and presents a pre-filled Order Confirmation dialog. The client must explicitly confirm the order before dispatch.

## Consequences
### Positive
* Absolute regulatory compliance with SEBI RA Regulations and Investor Protection circulars.
* Protection against front-running and conflict-of-interest allegations.
* Frictionless user experience with built-in client confirmation and suitability verification.

### Negative
* Requires intent token signing and verification infrastructure.
* Strict client confirmation dialog is mandatory (disallows automated non-discretionary trading on behalf of the client, as required by SEBI).
