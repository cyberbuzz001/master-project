/**
 * Static platform-policy knowledge for the AI support bot (supportBot.ts).
 *
 * Every fact here must be either (a) grounded in this codebase, or (b) a
 * deliberate business/operational policy signed off by the support team.
 * Facts of type (b) are marked POLICY in the comments below so the next
 * person editing knows which lines are enforced by code and which are
 * enforced by humans. If you add a fact, do the same — the whole point of
 * this file is that the bot never says something nobody can stand behind.
 *
 * This is a separate module from supportBot.ts on purpose — it's the part
 * meant to be edited/reviewed as "what the bot is trained to know" without
 * touching the request/response plumbing around it.
 */
export const SUPPORT_KNOWLEDGE_BASE = `
About TradeGrow:
- TradeGrow (https://tradegrowx.in) is a zero-cost Indian trading platform — ₹0 brokerage and ₹0 platform tax across equity delivery, intraday, and F&O.
- Support team contact: support@tradegrowx.in, active Monday to Friday, 9:00 AM to 6:00 PM IST.
- Customers log in at tradegrowx.in with their registered credentials.

Charges — TradeGrow is a zero-cost platform:
- Brokerage: ₹0 on every segment — equity delivery (CNC), equity intraday (MIS), and F&O.
- Platform tax / commission: ₹0. TradeGrow levies no internal commission, service charge, or maintenance surcharge.
- Account opening: ₹0. No annual maintenance charge (AMC).
- This is true regardless of trade volume, lot size, or segment. Never quote a per-order fee, a percentage cut, or a GST figure on brokerage — there is none.

Margins & leverage:
- Equity/futures intraday (MIS): ~20% of order value required (about 5x leverage).
- Equity/futures delivery or overnight (CNC/NRML): 100% of order value required, no leverage.
- Buying an option (any product type): full premium is charged as margin, no leverage.
- Writing/selling an option: SPAN + exposure + additional margin, calculated per underlying.

Order types & products:
- Order types: MARKET, LIMIT, SL (stop-loss), SL-M (stop-loss market).
- Product types: MIS (intraday), CNC (equity delivery), NRML (F&O carry-forward).
- Order statuses a customer may see: ACCEPTED, PENDING, EXECUTING, FILLED, CANCELLED, REJECTED, TRIGGER_PENDING (a stop-loss waiting for its trigger price).
- Indices with options available: NIFTY, BANKNIFTY, SENSEX, FINNIFTY.
- A handful of large-cap equities are also tradable (e.g. RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK, TATAMOTORS).
- Index option lot sizes: NIFTY 65, SENSEX 20, BANKNIFTY 30, FINNIFTY 60, MIDCPNIFTY 120, BANKEX 30. Equities trade in single units.
- MCX commodities are also offered: CRUDEOIL, GOLD, GOLDM, SILVER, SILVERM, NATURALGAS and COPPER, browsable under Explore. Commodity lot sizes: CRUDEOIL 100, GOLD 100, GOLDM 10, SILVER 30, SILVERM 5, NATURALGAS 1250, COPPER 2500.
- Trading sessions (orders are accepted only inside these windows, Monday–Friday):
  - Equity, F&O (NSE/BSE/NFO/BFO): 9:15 AM – 3:30 PM IST.
  - MCX commodities: 9:00 AM – 11:30 PM IST.
- Orders placed outside the relevant session are rejected with a "Markets are closed" message. This applies to exits too — a customer cannot square off a position while the market is shut, exactly as at any broker. Automatic RMS square-offs are the one exception and can run at any hour.
- Markets are closed on Saturdays and Sundays, and on NSE exchange trading holidays (the platform tracks the official holiday calendar and rejects orders on those days with the holiday name in the message).
- You do not have the holiday list in front of you. Never state or deny that a specific future date is a holiday — say the platform will show it on the day, or point the customer to the NSE holiday calendar.
- Diwali Muhurat trading is not offered. That special session falls outside normal hours and the platform stays closed for it.

Why an order was rejected — the actual reasons the system gives:
- "Insufficient buying power" — the required margin exceeds available funds. The rejection message states both the required and available amounts.
- "Account restricted to reduce-only trading pending risk review" — the account crossed the ~70% loss tier (see RMS below). The customer can still close or reduce existing positions; they cannot open new ones or grow exposure until a human clears the restriction.
- "Account is suspended or disabled" — an account-status issue; escalate to the team.
- "Contract has expired" — trading expired option/futures contracts is blocked outright.
- "Instrument is currently inactive or suspended by exchange".
- Quantity must be greater than zero.
- Order size caps: a single order cannot exceed 50,000 quantity or ₹1,00,00,000 (₹1 crore) in value. These are platform-configurable, so treat them as current defaults rather than fixed law.
- "Duplicate in-flight order request detected" — a double-submit guard. The customer should simply retry.
- "Markets are closed" — the order was placed outside the trading session for that segment (see the session windows above).
- KYC not yet submitted — see KYC below.

Positions, holdings and exits:
- Positions tab shows open intraday and F&O positions (MIS and NRML). Holdings tab shows delivery equity (CNC). A CNC buy is a holding, not a position — don't call it a position.
- Once a position is squared off it moves out of Positions into Trade History with its realised P&L.
- "Square Off" places an immediate MARKET exit order — the fill price comes from the exchange and may differ from the LTP shown at the moment of clicking.
- "Target" places a LIMIT exit order at a chosen price, which closes the position automatically if that price trades. Target prices must be in ₹0.05 tick increments. A target on a long must sit above the current price; on a short, below it.
- "Exit All Positions" sends MARKET square-off orders for every open position at once and cannot be reversed.

Intraday square-off and MIS → CNC conversion:
- MIS (intraday) positions do NOT auto-convert to CNC (delivery). A customer who wants to carry a position overnight must convert it manually and hold full margin in their ledger before the cutoff.
- Any MIS position still open at the cutoff is squared off automatically by the Risk Management System (RMS) at market price, between 3:15 PM and 3:20 PM IST.
- Separately, a continuous risk monitor watches unrealized loss as a percentage of margin used on a position and escalates automatically: ~50% loss triggers an internal warning, ~60% an alert, ~70% restricts the account to reduce-only, ~80% and ~90% trigger automatic square-off, and ~100% suspends the account. These are approximate tiers, not exact numbers to quote back.

KYC:
- Required details: PAN, Aadhaar, and bank account (name, account number, IFSC).
- Documents collected: PAN card, Aadhaar front and back, and bank proof.
- Two verification paths: instant online verification, or manual document review by staff.
- Statuses: NOT_STARTED, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUIRED.
- Trading is unlocked once KYC is SUBMITTED (approval isn't required to start placing orders), so "my KYC is still under review" does not by itself explain a blocked order.

Login and account access:
- A customer can sign in with their registered email, their username, or their client ID (format TG-USR-XXXX).
- After 5 consecutive failed password attempts the account locks automatically for 15 minutes. It unlocks on its own — no action needed, and it is not a permanent ban.
- A login session lasts 24 hours before requiring re-login.
- Account statuses: ACTIVE, SUSPENDED, DISABLED, PENDING_VERIFICATION. Only ACTIVE accounts can log in or trade.
- There is no self-service "forgot password" flow. A customer who cannot get in must be handed to a human agent — never walk them through a reset yourself, and never ask them for their password, OTP, or PIN in chat.

Support tickets (separate from this live chat):
- Customers can raise a formal ticket under Profile for issues that need a tracked, written record — this chat is the fast/real-time channel.
- Ticket categories: TRADING, ACCOUNT, KYC, FUNDS, TECHNICAL, OTHER. Priorities: LOW, MEDIUM, HIGH, URGENT. Statuses: OPEN, IN_PROGRESS, RESOLVED, CLOSED.

Deposits:
- Deposits via UPI or net banking reflect in the trading ledger instantly, 24/7.

Withdrawals — POLICY (enforced by staff review, not automatically):
- Every withdrawal request goes through manual review by the team before payout. Nothing is paid out instantly.
- Payout batches: requests submitted before 8:00 AM IST are processed in the morning batch; later requests clear in the evening batch (~7:00 PM IST) on working days. Money reaching the customer's bank therefore follows a next-working-day (T+1) cycle.
- The withdrawable figure shown in the app is the customer's settled cash minus margin currently blocked by open positions, further reduced by any open unrealized loss. An open unrealized profit does not raise it until the position is closed and the profit is realized.
- This is why today's profit can look "missing": if the position is still open, the margin backing it is blocked, so that money isn't withdrawable yet. Closing the position releases it. Explain it that way — do not tell a customer their realized profit is locked until tomorrow, because the app will already be showing it as available.

Account type:
- Starting virtual capital is ₹10,00,000 by default.
- All trade execution happens inside TradeGrow's own simulated matching engine — orders are not routed to NSE/BSE or any real exchange. Funds a customer deposits are tracked in their own account ledger; the trading itself is simulated end to end.

Not offered (say so plainly if asked — do not imply these exist):
- After Market Orders (AMO) and GTT / Good Till Triggered orders are not available on TradeGrow.
- There is no pre-market or post-market session.
- There is no mutual fund, IPO, or bond offering — TradeGrow covers equity, F&O and MCX commodities only.
`.trim();
