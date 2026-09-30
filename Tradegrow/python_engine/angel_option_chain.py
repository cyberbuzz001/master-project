"""
angel_option_chain.py
Fetches live NIFTY/BANKNIFTY option chain data from Angel One SmartAPI.

Strategy:
  1. Download the Angel One Instrument Master (cached daily)
  2. Filter for NIFTY / BANKNIFTY options (OPTIDX)
  3. Extract unique expiry dates (sorted ascending)
  4. For the nearest weekly expiry, fetch LTP for each strike via ltpData()
  5. Write results to data/angel_option_chain.json every ~5 seconds
"""

import os, sys, time, json, requests, pyotp
from datetime import datetime, date
from SmartApi import SmartConnect

SCIRP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data"))
os.makedirs(OUT_DIR, exist_ok=True)

MASTER_FILE  = os.path.join(OUT_DIR, "angel_scrip_master.json")
CHAIN_FILE   = os.path.join(OUT_DIR, "angel_option_chain.json")

SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY"]

# ── Instrument master — refreshed once per day ──────────────────────────────
def load_instrument_master() -> list:
    today = date.today().isoformat()
    meta_file = MASTER_FILE + ".date"
    cached_date = ""
    if os.path.exists(meta_file):
        with open(meta_file) as f:
            cached_date = f.read().strip()

    if cached_date != today or not os.path.exists(MASTER_FILE):
        print("[OptionChain] Downloading Angel One Instrument Master...", flush=True)
        resp = requests.get(SCIRP_MASTER_URL, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        with open(MASTER_FILE, "w") as f:
            json.dump(data, f)
        with open(meta_file, "w") as f:
            f.write(today)
        print(f"[OptionChain] Instrument Master downloaded ({len(data)} instruments)", flush=True)
    else:
        with open(MASTER_FILE) as f:
            data = json.load(f)
        print(f"[OptionChain] Loaded cached Instrument Master ({len(data)} instruments)", flush=True)

    return data

# ── Parse expiry string "28AUG2026" → date ──────────────────────────────────
def parse_expiry(s: str) -> date | None:
    try:
        return datetime.strptime(s.strip(), "%d%b%Y").date()
    except Exception:
        return None

# ── Build filtered option chain lookup per symbol ───────────────────────────
def build_option_index(master: list) -> dict:
    """
    Returns:
      { "NIFTY": { "2026-08-07": [{"token","strike","optionType"},...], ... }, ... }
    """
    index: dict = {}
    for row in master:
        name = row.get("name", "").upper()
        inst = row.get("instrumenttype", "").upper()
        if name not in SYMBOLS or inst != "OPTIDX":
            continue
        exp_raw = row.get("expiry", "")
        exp_date = parse_expiry(exp_raw)
        if not exp_date or exp_date < date.today():
            continue
        exp_str = exp_date.isoformat()
        try:
            strike = float(row["strike"]) / 100.0  # Angel stores strike * 100
        except Exception:
            continue
        opt_type = row.get("symbol", "")[-2:].upper()  # "CE" or "PE"
        token = row.get("token", "")
        trading_symbol = row.get("symbol", "")
        if not token or opt_type not in ("CE", "PE"):
            continue

        index.setdefault(name, {}).setdefault(exp_str, []).append({
            "token": token,
            "tradingSymbol": trading_symbol,
            "strike": strike,
            "optionType": opt_type,
        })
    return index

# ── Fetch LTP for a batch of tokens ─────────────────────────────────────────
MAX_LTP_BATCH = 50   # Angel One allows up to 50 per call

def fetch_ltp_batch(smart_api: SmartConnect, contracts: list) -> dict:
    """Returns {token: ltp}"""
    prices = {}
    # Build request payload
    data = [{"exchange": "NFO", "tradingSymbol": c["tradingSymbol"], "symbolToken": c["token"]}
            for c in contracts]
    try:
        # marketData API (MODE_FULL or MODE_LTP)
        resp = smart_api.marketData("LTP", data)
        if resp and resp.get("status") and resp.get("data"):
            for item in resp["data"].get("fetched", []):
                tok = item.get("symbolToken", "")
                ltp = float(item.get("ltp", 0))
                prices[tok] = ltp
    except Exception as e:
        print(f"[OptionChain] LTP batch error: {e}", flush=True)
    return prices

# ── Build option chain rows for ONE expiry ──────────────────────────────────
def build_chain_rows(smart_api: SmartConnect, contracts: list, spot: float) -> list:
    """
    Fetches LTPs, pairs CE/PE by strike, returns sorted list of rows.
    Each row: { strikePrice, ce:{ltp,token}, pe:{ltp,token} }
    """
    # Group by strike
    strike_map: dict = {}
    for c in contracts:
        s = c["strike"]
        strike_map.setdefault(s, {})[c["optionType"]] = c

    # Collect all tokens for batch LTP fetch
    all_contracts = [c for s, opts in strike_map.items() for c in opts.values()]
    
    # Fetch in batches of MAX_LTP_BATCH
    prices: dict = {}
    for i in range(0, len(all_contracts), MAX_LTP_BATCH):
        batch = all_contracts[i:i + MAX_LTP_BATCH]
        prices.update(fetch_ltp_batch(smart_api, batch))

    # Pick strikes near ATM (within ±10 strikes)
    atm_strike = round(spot / 50) * 50
    strike_range = sorted([s for s in strike_map if abs(s - atm_strike) <= 10 * 50])

    rows = []
    for strike in strike_range:
        opts = strike_map[strike]
        ce = opts.get("CE")
        pe = opts.get("PE")
        if not ce or not pe:
            continue
        ce_ltp = prices.get(ce["token"], 0)
        pe_ltp = prices.get(pe["token"], 0)
        rows.append({
            "strikePrice": strike,
            "ce": {"token": ce["token"], "tradingSymbol": ce["tradingSymbol"], "ltp": ce_ltp},
            "pe": {"token": pe["token"], "tradingSymbol": pe["tradingSymbol"], "ltp": pe_ltp},
        })

    return rows

# ── Main loop ────────────────────────────────────────────────────────────────
def main():
    api_key     = os.getenv("SMARTAPI_API_KEY", "4DBv6HvT")
    client_code = os.getenv("SMARTAPI_CLIENT_CODE", "N89824")
    password    = os.getenv("SMARTAPI_PASSWORD", "9691")
    totp_secret = os.getenv("SMARTAPI_TOTP_SECRET", "AV7KF7BEJBOOCVIS53TZZB2VEU")

    print("[OptionChain] Authenticating with Angel One...", flush=True)
    totp = pyotp.TOTP(totp_secret).now()
    smart_api = SmartConnect(api_key=api_key)
    session = smart_api.generateSession(client_code, password, totp)
    if not session or not session.get("status"):
        print("[OptionChain] Authentication failed:", session, flush=True)
        sys.exit(1)
    print("[OptionChain] Authenticated!", flush=True)

    master = load_instrument_master()
    option_index = build_option_index(master)

    # Compute expiry list per symbol
    expiry_map: dict = {}
    for sym, expiries in option_index.items():
        sorted_expiries = sorted(expiries.keys())
        expiry_map[sym] = sorted_expiries
        print(f"[OptionChain] {sym} expiries: {sorted_expiries[:6]}", flush=True)

    # LTP token map for spot prices (NIFTY index)
    SPOT_TOKENS = {
        "NIFTY":     {"exchange": "NSE", "tradingSymbol": "NIFTY 50",   "symbolToken": "99926000"},
        "BANKNIFTY": {"exchange": "NSE", "tradingSymbol": "BANKNIFTY",  "symbolToken": "99926009"},
        "FINNIFTY":  {"exchange": "NSE", "tradingSymbol": "FINNIFTY",   "symbolToken": "99926037"},
    }

    while True:
        output: dict = {"updatedAt": int(time.time() * 1000), "expiries": expiry_map, "chains": {}}

        for sym in SYMBOLS:
            if sym not in option_index:
                continue
            expiries = sorted(option_index[sym].keys())
            if not expiries:
                continue

            # Fetch spot price
            spot = 0.0
            try:
                spot_info = SPOT_TOKENS.get(sym)
                if spot_info:
                    resp = smart_api.ltpData(spot_info["exchange"], spot_info["tradingSymbol"], spot_info["symbolToken"])
                    if resp and resp.get("status") and resp.get("data"):
                        spot = float(resp["data"].get("ltp", 0))
            except Exception as e:
                print(f"[OptionChain] Spot fetch error for {sym}: {e}", flush=True)

            output["chains"][sym] = {}
            # Fetch chain for first 3 expiries to keep it fast
            for exp in expiries[:3]:
                contracts = option_index[sym][exp]
                rows = build_chain_rows(smart_api, contracts, spot if spot > 0 else 24500)
                output["chains"][sym][exp] = {
                    "spot": spot,
                    "rows": rows,
                }
                print(f"[OptionChain] {sym} {exp}: {len(rows)} strikes, spot={spot}", flush=True)

        with open(CHAIN_FILE, "w") as f:
            json.dump(output, f)

        print(f"[OptionChain] Written to {CHAIN_FILE}", flush=True)
        time.sleep(5)  # refresh every 5 seconds

if __name__ == "__main__":
    main()
