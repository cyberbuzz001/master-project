import os
import sys
import time
import json
import pyotp
from SmartApi import SmartConnect

SYMBOLS = [
    {"internalToken": "NSE_RELIANCE",   "exchange": "NSE", "tradingSymbol": "RELIANCE-EQ",  "symbolToken": "2885",     "symbol": "RELIANCE"},
    {"internalToken": "NSE_TCS",        "exchange": "NSE", "tradingSymbol": "TCS-EQ",        "symbolToken": "11536",    "symbol": "TCS"},
    {"internalToken": "NSE_INFY",       "exchange": "NSE", "tradingSymbol": "INFY-EQ",       "symbolToken": "1594",     "symbol": "INFY"},
    {"internalToken": "NSE_HDFCBANK",   "exchange": "NSE", "tradingSymbol": "HDFCBANK-EQ",   "symbolToken": "1333",     "symbol": "HDFCBANK"},
    {"internalToken": "NSE_ICICIBANK",  "exchange": "NSE", "tradingSymbol": "ICICIBANK-EQ",  "symbolToken": "4963",     "symbol": "ICICIBANK"},
    {"internalToken": "NSE_SBIN",       "exchange": "NSE", "tradingSymbol": "SBIN-EQ",       "symbolToken": "3045",     "symbol": "SBIN"},
    {"internalToken": "NSE_BHARTIARTL", "exchange": "NSE", "tradingSymbol": "BHARTIARTL-EQ","symbolToken": "10604",    "symbol": "BHARTIARTL"},
    {"internalToken": "NSE_TATAMOTORS", "exchange": "NSE", "tradingSymbol": "TATAMOTORS-EQ", "symbolToken": "3456",     "symbol": "TATAMOTORS"},
    {"internalToken": "NSE_TATASTEEL",  "exchange": "NSE", "tradingSymbol": "TATASTEEL-EQ",  "symbolToken": "3499",     "symbol": "TATASTEEL"},
    {"internalToken": "NSE_HAL",        "exchange": "NSE", "tradingSymbol": "HAL-EQ",        "symbolToken": "2303",     "symbol": "HAL"},
    {"internalToken": "NSE_MARUTI",     "exchange": "NSE", "tradingSymbol": "MARUTI-EQ",     "symbolToken": "10999",    "symbol": "MARUTI"},
    {"internalToken": "NSE_BAJFINANCE", "exchange": "NSE", "tradingSymbol": "BAJFINANCE-EQ", "symbolToken": "317",      "symbol": "BAJFINANCE"},
    {"internalToken": "NSE_SUNPHARMA",  "exchange": "NSE", "tradingSymbol": "SUNPHARMA-EQ",  "symbolToken": "3351",     "symbol": "SUNPHARMA"},
    {"internalToken": "NSE_ITC",        "exchange": "NSE", "tradingSymbol": "ITC-EQ",        "symbolToken": "1660",     "symbol": "ITC"},
    {"internalToken": "NSE_HINDUNILVR","exchange": "NSE", "tradingSymbol": "HINDUNILVR-EQ","symbolToken": "1394",     "symbol": "HINDUNILVR"},
    {"internalToken": "NSE_NTPC",       "exchange": "NSE", "tradingSymbol": "NTPC-EQ",       "symbolToken": "11630",    "symbol": "NTPC"},
    {"internalToken": "NSE_POWERGRID",  "exchange": "NSE", "tradingSymbol": "POWERGRID-EQ",  "symbolToken": "14977",    "symbol": "POWERGRID"},
    {"internalToken": "NSE_M&M",        "exchange": "NSE", "tradingSymbol": "M&M-EQ",        "symbolToken": "2031",     "symbol": "M&M"},
    {"internalToken": "NSE_TITAN",      "exchange": "NSE", "tradingSymbol": "TITAN-EQ",      "symbolToken": "3506",     "symbol": "TITAN"},
    {"internalToken": "NSE_ULTRACEMCO","exchange": "NSE", "tradingSymbol": "ULTRACEMCO-EQ","symbolToken": "11532",    "symbol": "ULTRACEMCO"},
    {"internalToken": "NSE_ADANIENT",   "exchange": "NSE", "tradingSymbol": "ADANIENT-EQ",   "symbolToken": "25",       "symbol": "ADANIENT"},
    {"internalToken": "NSE_ADANIPORTS", "exchange": "NSE", "tradingSymbol": "ADANIPORTS-EQ", "symbolToken": "15083",    "symbol": "ADANIPORTS"},
    {"internalToken": "NSE_CUPID",      "exchange": "NSE", "tradingSymbol": "CUPID-EQ",      "symbolToken": "14349",    "symbol": "CUPID"},
    {"internalToken": "NSE_MVELEC",     "exchange": "NSE", "tradingSymbol": "MVELEC-EQ",     "symbolToken": "18921",    "symbol": "MVELEC"},
    {"internalToken": "NSE_ASKAUTO",    "exchange": "NSE", "tradingSymbol": "ASKAUTO-EQ",    "symbolToken": "19830",    "symbol": "ASKAUTO"},
    {"internalToken": "NSE_KALYANKJIL", "exchange": "NSE", "tradingSymbol": "KALYANKJIL-EQ", "symbolToken": "18290",    "symbol": "KALYANKJIL"},
    {"internalToken": "NSE_NIFTY50",    "exchange": "NSE", "tradingSymbol": "NIFTY 50",      "symbolToken": "99926000", "symbol": "NIFTY 50"},
    {"internalToken": "NSE_BANKNIFTY",  "exchange": "NSE", "tradingSymbol": "BANKNIFTY",     "symbolToken": "99926009", "symbol": "BANKNIFTY"},
    {"internalToken": "BSE_SENSEX",     "exchange": "BSE", "tradingSymbol": "SENSEX",        "symbolToken": "99919000", "symbol": "SENSEX"},
    {"internalToken": "NSE_FINNIFTY",   "exchange": "NSE", "tradingSymbol": "FINNIFTY",      "symbolToken": "99926037", "symbol": "FINNIFTY"},
    {"internalToken": "NSE_MIDCPNIFTY", "exchange": "NSE", "tradingSymbol": "NIFTY MID SELECT", "symbolToken": "99926074", "symbol": "MIDCPNIFTY"},
]

def authenticate(api_key, client_code, password, totp_secret):
    """Authenticate and return SmartConnect instance. Raises on failure."""
    for attempt in range(3):
        try:
            totp = pyotp.TOTP(totp_secret).now()
            smart_api = SmartConnect(api_key=api_key)
            data = smart_api.generateSession(client_code, password, totp)
            if data and data.get('status'):
                print(f"[AngelTicker] Authenticated! (attempt {attempt+1})", flush=True)
                return smart_api
            print(f"[AngelTicker] Auth attempt {attempt+1} failed: {data}", flush=True)
        except Exception as e:
            print(f"[AngelTicker] Auth attempt {attempt+1} error: {e}", flush=True)
        time.sleep(3)
    raise RuntimeError("[AngelTicker] All auth attempts failed")

def main():
    api_key     = os.getenv("SMARTAPI_API_KEY",     "4DBv6HvT")
    client_code = os.getenv("SMARTAPI_CLIENT_CODE", "N89824")
    password    = os.getenv("SMARTAPI_PASSWORD",    "9691")
    totp_secret = os.getenv("SMARTAPI_TOTP_SECRET", "AV7KF7BEJBOOCVIS53TZZB2VEU")

    # Resolve output file path
    out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/angel_ticks.json"))
    if not os.path.exists(os.path.dirname(out_file)):
        out_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/angel_ticks.json"))
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

    print(f"[AngelTicker] Starting Python SmartConnect Live Stream for Client: {client_code}...", flush=True)

    smart_api    = authenticate(api_key, client_code, password, totp_secret)
    fail_streak  = 0  # consecutive failures → trigger re-auth

    while True:
        ticks = {}
        for s in SYMBOLS:
            try:
                res = smart_api.ltpData(s["exchange"], s["tradingSymbol"], s["symbolToken"])
                if res and res.get('status') and res.get('data'):
                    d = res['data']
                    ltp    = float(d.get('ltp',   0))
                    close  = float(d.get('close', ltp) or ltp)
                    change = round(ltp - close, 2)
                    chg_pct = round((change / close) * 100, 2) if close > 0 else 0.0

                    ticks[s["internalToken"]] = {
                        "instrumentToken": s["internalToken"],
                        "exchange":        s["exchange"],
                        "symbol":          s["symbol"],
                        "ltp":             ltp,
                        "open":            float(d.get('open',   ltp)),
                        "high":            float(d.get('high',   ltp)),
                        "low":             float(d.get('low',    ltp)),
                        "close":           close,
                        "volume":          int(d.get('tradedVolume', 0)) or 15000,
                        "change":          change,
                        "changePercent":   chg_pct,
                        "bid":             round(ltp - 0.10, 2),
                        "ask":             round(ltp + 0.10, 2),
                        "bidQty":          100,
                        "askQty":          100,
                        "timestamp":       int(time.time() * 1000)
                    }
                    fail_streak = 0
                else:
                    fail_streak += 1
            except Exception as e:
                fail_streak += 1

        # Write atomically
        tmp = out_file + ".tmp"
        with open(tmp, "w") as f:
            json.dump(ticks, f)
        
        for attempt in range(5):
            try:
                os.replace(tmp, out_file)
                break
            except PermissionError:
                time.sleep(0.05)

        print(f"[AngelTicker] Updated live prices for {len(ticks)} instruments.", flush=True)

        # Re-authenticate if too many consecutive failures (session likely expired)
        if fail_streak >= len(SYMBOLS) * 2:
            print("[AngelTicker] Too many failures — re-authenticating...", flush=True)
            try:
                smart_api   = authenticate(api_key, client_code, password, totp_secret)
                fail_streak = 0
            except Exception as e:
                print(f"[AngelTicker] Re-auth failed: {e}", flush=True)
                time.sleep(30)

        time.sleep(1.5)

if __name__ == "__main__":
    main()
