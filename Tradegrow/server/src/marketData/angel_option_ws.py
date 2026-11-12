import os
import sys
import time
import json
import math
import logging
from datetime import datetime, date
import pyotp

logging.basicConfig(
    level=logging.INFO,
    format='[AngelOptionWS] %(asctime)s - %(levelname)s - %(message)s'
)

API_KEY = os.getenv('ANGELONE_API_KEY') or os.getenv('SMARTAPI_API_KEY') or '4DBv6HvT'
CLIENT_CODE = os.getenv('ANGELONE_CLIENT_ID') or os.getenv('SMARTAPI_CLIENT_CODE') or 'N89824'
PASSWORD = os.getenv('ANGELONE_CLIENT_SECRET') or os.getenv('SMARTAPI_PASSWORD') or '9691'
TOTP_SECRET = os.getenv('ANGELONE_TOTP_SECRET') or os.getenv('SMARTAPI_TOTP_SECRET') or 'AV7KF7BEJBOOCVIS53TZZB2VEU'

DATA_DIR = os.getenv('ANGEL_TICKS_DIR', '/app/server/data' if os.path.exists('/app/server/data') else os.path.join(os.getcwd(), 'server', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
CHAIN_FILE = os.path.join(DATA_DIR, 'angel_option_chain.json')
TICKS_FILE = os.path.join(DATA_DIR, 'angel_ticks.json')
MAP_FILE = os.path.join(DATA_DIR, 'option_instruments_map.json')

try:
    from SmartApi import SmartConnect
except ImportError:
    logging.error("smartapi-python is not installed!")
    sys.exit(1)

# ── Black-Scholes Greeks Implementation ───────────────────────────────────────
def norm_cdf(x):
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

def norm_pdf(x):
    return (1.0 / math.sqrt(2.0 * math.pi)) * math.exp(-0.5 * x * x)

def calculate_greeks(spot, strike, t_years, is_call, iv_dec, r=0.07):
    if t_years <= 0 or iv_dec <= 0 or spot <= 0 or strike <= 0:
        return {'iv': round(iv_dec * 100, 2), 'delta': 0.5 if is_call else -0.5, 'gamma': 0.0, 'theta': 0.0, 'vega': 0.0}
    try:
        sqrt_t = math.sqrt(t_years)
        d1 = (math.log(spot / strike) + (r + 0.5 * iv_dec * iv_dec) * t_years) / (iv_dec * sqrt_t)
        d2 = d1 - iv_dec * sqrt_t
        pdf_d1 = norm_pdf(d1)

        gamma = pdf_d1 / (spot * iv_dec * sqrt_t)
        vega = (spot * sqrt_t * pdf_d1) / 100.0

        if is_call:
            delta = norm_cdf(d1)
            theta_annual = -(spot * pdf_d1 * iv_dec) / (2.0 * sqrt_t) - r * strike * math.exp(-r * t_years) * norm_cdf(d2)
        else:
            delta = norm_cdf(d1) - 1.0
            theta_annual = -(spot * pdf_d1 * iv_dec) / (2.0 * sqrt_t) + r * strike * math.exp(-r * t_years) * norm_cdf(-d2)

        theta = theta_annual / 365.0
        return {
            'iv': round(iv_dec * 100, 2),
            'delta': round(delta, 4),
            'gamma': round(gamma, 6),
            'theta': round(theta, 2),
            'vega': round(vega, 2)
        }
    except Exception:
        return {'iv': round(iv_dec * 100, 2), 'delta': 0.5 if is_call else -0.5, 'gamma': 0.0, 'theta': 0.0, 'vega': 0.0}

def implied_volatility(price, spot, strike, t_years, is_call, r=0.07):
    if price <= 0.05 or spot <= 0 or strike <= 0 or t_years <= 0:
        return 0.15
    low_iv, high_iv = 0.01, 3.0
    for _ in range(30):
        mid_iv = (low_iv + high_iv) / 2.0
        sqrt_t = math.sqrt(t_years)
        d1 = (math.log(spot / strike) + (r + 0.5 * mid_iv * mid_iv) * t_years) / (mid_iv * sqrt_t)
        d2 = d1 - mid_iv * sqrt_t
        if is_call:
            theo = spot * norm_cdf(d1) - strike * math.exp(-r * t_years) * norm_cdf(d2)
        else:
            theo = strike * math.exp(-r * t_years) * norm_cdf(-d2) - spot * norm_cdf(-d1)
        diff = theo - price
        if abs(diff) < 0.02:
            return mid_iv
        if diff > 0:
            high_iv = mid_iv
        else:
            low_iv = mid_iv
    return (low_iv + high_iv) / 2.0

class AngelOptionWorker:
    def __init__(self):
        self.sc = None
        self.instruments_by_sym_exp = {}
        self.all_expiries_by_sym = {}
        self.last_login_time = 0
        self.cached_greeks = {}  # (symbol, expiry) -> {strike_type: {...}}
        self.last_greek_fetch = 0

    def login(self):
        try:
            logging.info("Connecting to Angel One SmartAPI...")
            client = SmartConnect(api_key=API_KEY)
            totp = pyotp.TOTP(TOTP_SECRET).now()
            res = client.generateSession(CLIENT_CODE, PASSWORD, totp)
            if res and res.get('status'):
                self.sc = client
                self.last_login_time = time.time()
                logging.info(f"Angel One SmartAPI authentication SUCCESS (Client: {CLIENT_CODE})")
                return True
            else:
                logging.error(f"Angel One login failed: {res}")
                return False
        except Exception as e:
            logging.error(f"Angel One login exception: {e}")
            return False

    def load_instruments(self):
        if not os.path.exists(MAP_FILE):
            logging.warning(f"Instrument map {MAP_FILE} does not exist yet.")
            return False
        try:
            with open(MAP_FILE, 'r') as f:
                raw = json.load(f)
            self.instruments_by_sym_exp.clear()
            self.all_expiries_by_sym.clear()
            today_str = date.today().isoformat()

            for item in raw:
                sym = item.get('symbol')
                exp_raw = item.get('expiry')
                if not sym or not exp_raw:
                    continue
                exp_date = str(exp_raw)[:10]
                if exp_date < today_str:
                    continue

                key = (sym, exp_date)
                if key not in self.instruments_by_sym_exp:
                    self.instruments_by_sym_exp[key] = []
                self.instruments_by_sym_exp[key].append(item)

                if sym not in self.all_expiries_by_sym:
                    self.all_expiries_by_sym[sym] = set()
                self.all_expiries_by_sym[sym].add(exp_date)

            for s in self.all_expiries_by_sym:
                self.all_expiries_by_sym[s] = sorted(list(self.all_expiries_by_sym[s]))

            logging.info(f"Indexed {len(raw)} instruments across symbols: {list(self.all_expiries_by_sym.keys())}")
            return True
        except Exception as e:
            logging.error(f"Error loading instruments map: {e}")
            return False

    def get_spot_price(self, symbol):
        # Read from angel_ticks.json if available
        try:
            if os.path.exists(TICKS_FILE):
                with open(TICKS_FILE, 'r') as f:
                    ticks = json.load(f)
                token_map = {
                    'NIFTY': ['NSE_NIFTY50', '26000', 'NSE_NIFTY', 'NIFTY'],
                    'BANKNIFTY': ['NSE_BANKNIFTY', '26009', 'BANKNIFTY'],
                    'SENSEX': ['BSE_SENSEX', '1', 'SENSEX'],
                    'FINNIFTY': ['NSE_FINNIFTY', '26037', 'FINNIFTY']
                }
                for tok in token_map.get(symbol, []):
                    t = ticks.get(tok)
                    if t and t.get('ltp', 0) > 0:
                        return float(t['ltp'])
        except Exception:
            pass

        # Fallbacks
        defaults = {'NIFTY': 25100.0, 'BANKNIFTY': 52100.0, 'SENSEX': 81400.0, 'FINNIFTY': 23500.0}
        return defaults.get(symbol, 25000.0)

    def fetch_quotes_for_tokens(self, exchange, tokens):
        if not self.sc or not tokens:
            return {}
        quotes = {}
        # Batch in chunks of 50
        chunk_size = 50
        for i in range(0, len(tokens), chunk_size):
            chunk = tokens[i:i + chunk_size]
            try:
                res = self.sc.getMarketData("FULL", {exchange: chunk})
                if res and res.get('status') and res.get('data'):
                    fetched = res['data'].get('fetched', [])
                    for q in fetched:
                        tok = str(q.get('symbolToken', ''))
                        if tok:
                            quotes[tok] = q
            except Exception as e:
                logging.warning(f"Error fetching market data for {exchange} tokens {chunk[:3]}...: {e}")
        return quotes

    def process_underlying(self, symbol, full_ticks_update):
        expiries = self.all_expiries_by_sym.get(symbol, [])
        if not expiries:
            return None

        # Process nearest expiry (active weekly contract)
        nearest_exp = expiries[0]
        instruments = self.instruments_by_sym_exp.get((symbol, nearest_exp), [])
        if not instruments:
            return None

        spot = self.get_spot_price(symbol)
        step = 100 if symbol in ('SENSEX', 'BANKNIFTY') else 50
        atm_strike = round(spot / step) * step
        range_count = 12

        min_strike = atm_strike - (range_count * step)
        max_strike = atm_strike + (range_count * step)

        strikes = [s for s in range(min_strike, max_strike + step, step)]
        exchange = 'BFO' if symbol == 'SENSEX' else 'NFO'

        ce_by_strike = {}
        pe_by_strike = {}

        for inst in instruments:
            st = float(inst.get('strike', 0))
            if min_strike <= st <= max_strike:
                raw_token = str(inst.get('instrument_token', '')).replace('NFO_', '').replace('BFO_', '')
                ts = inst.get('trading_symbol', '')
                if inst.get('option_type') == 'CE':
                    ce_by_strike[st] = {'token': raw_token, 'trading_symbol': ts, 'instrument': inst}
                elif inst.get('option_type') == 'PE':
                    pe_by_strike[st] = {'token': raw_token, 'trading_symbol': ts, 'instrument': inst}

        tokens_to_fetch = []
        for s in strikes:
            if s in ce_by_strike:
                tokens_to_fetch.append(ce_by_strike[s]['token'])
            if s in pe_by_strike:
                tokens_to_fetch.append(pe_by_strike[s]['token'])

        quotes = self.fetch_quotes_for_tokens(exchange, tokens_to_fetch)
        now_ts = int(time.time() * 1000)

        # Time to expiry in years
        try:
            exp_date_obj = datetime.strptime(nearest_exp, '%Y-%m-%d')
            diff_days = max(0.01, (exp_date_obj.timestamp() + 15.5 * 3600 - time.time()) / 86400.0)
            t_years = diff_days / 365.0
        except Exception:
            t_years = 6.0 / 365.0

        rows = []
        for strike in strikes:
            ce_info = ce_by_strike.get(strike)
            pe_info = pe_by_strike.get(strike)

            ce_row = None
            if ce_info:
                tok = ce_info['token']
                ts_sym = ce_info['trading_symbol']
                q = quotes.get(tok, {})
                ltp = float(q.get('ltp', 0))
                change = float(q.get('netChange', 0))
                pct = float(q.get('percentChange', 0))
                vol = int(q.get('tradeVolume', 0))
                oi = int(q.get('opnInterest', 0))

                # Depth
                depth = q.get('depth', {})
                buy_depth = depth.get('buy', [])
                sell_depth = depth.get('sell', [])
                bid = float(buy_depth[0].get('price', ltp * 0.998)) if buy_depth else round(ltp * 0.998, 2)
                ask = float(sell_depth[0].get('price', ltp * 1.002)) if sell_depth else round(ltp * 1.002, 2)

                iv = implied_volatility(ltp, spot, strike, t_years, True)
                grk = calculate_greeks(spot, strike, t_years, True, iv)

                ce_row = {
                    'token': tok,
                    'symbol': f"{exchange}_{tok}",
                    'tradingSymbol': ts_sym,
                    'ltp': ltp,
                    'bid': bid,
                    'ask': ask,
                    'change': change,
                    'changePercent': pct,
                    'volume': vol,
                    'openInterest': oi,
                    'openInterestChange': 0,
                    'iv': grk['iv'],
                    'delta': grk['delta'],
                    'gamma': grk['gamma'],
                    'theta': grk['theta'],
                    'vega': grk['vega'],
                    'source': 'live' if ltp > 0 else 'model',
                    'depth': depth
                }

                # Update live ticks map
                if ltp > 0:
                    tick_obj = {
                        'instrumentToken': f"{exchange}_{tok}",
                        'exchange': exchange,
                        'symbol': ts_sym,
                        'tradingSymbol': ts_sym,
                        'ltp': ltp,
                        'open': float(q.get('open', ltp)),
                        'high': float(q.get('high', ltp)),
                        'low': float(q.get('low', ltp)),
                        'close': float(q.get('close', ltp)),
                        'volume': vol,
                        'change': change,
                        'changePercent': pct,
                        'bid': bid,
                        'ask': ask,
                        'bidQty': int(buy_depth[0].get('quantity', 0)) if buy_depth else 0,
                        'askQty': int(sell_depth[0].get('quantity', 0)) if sell_depth else 0,
                        'timestamp': now_ts,
                        'source': 'live'
                    }
                    full_ticks_update[f"{exchange}_{tok}"] = tick_obj
                    full_ticks_update[tok] = tick_obj
                    full_ticks_update[f"{exchange}_{symbol}_{int(strike)}_CE"] = tick_obj
                    full_ticks_update[ts_sym] = tick_obj

            pe_row = None
            if pe_info:
                tok = pe_info['token']
                ts_sym = pe_info['trading_symbol']
                q = quotes.get(tok, {})
                ltp = float(q.get('ltp', 0))
                change = float(q.get('netChange', 0))
                pct = float(q.get('percentChange', 0))
                vol = int(q.get('tradeVolume', 0))
                oi = int(q.get('opnInterest', 0))

                depth = q.get('depth', {})
                buy_depth = depth.get('buy', [])
                sell_depth = depth.get('sell', [])
                bid = float(buy_depth[0].get('price', ltp * 0.998)) if buy_depth else round(ltp * 0.998, 2)
                ask = float(sell_depth[0].get('price', ltp * 1.002)) if sell_depth else round(ltp * 1.002, 2)

                iv = implied_volatility(ltp, spot, strike, t_years, False)
                grk = calculate_greeks(spot, strike, t_years, False, iv)

                pe_row = {
                    'token': tok,
                    'symbol': f"{exchange}_{tok}",
                    'tradingSymbol': ts_sym,
                    'ltp': ltp,
                    'bid': bid,
                    'ask': ask,
                    'change': change,
                    'changePercent': pct,
                    'volume': vol,
                    'openInterest': oi,
                    'openInterestChange': 0,
                    'iv': grk['iv'],
                    'delta': grk['delta'],
                    'gamma': grk['gamma'],
                    'theta': grk['theta'],
                    'vega': grk['vega'],
                    'source': 'live' if ltp > 0 else 'model',
                    'depth': depth
                }

                if ltp > 0:
                    tick_obj = {
                        'instrumentToken': f"{exchange}_{tok}",
                        'exchange': exchange,
                        'symbol': ts_sym,
                        'tradingSymbol': ts_sym,
                        'ltp': ltp,
                        'open': float(q.get('open', ltp)),
                        'high': float(q.get('high', ltp)),
                        'low': float(q.get('low', ltp)),
                        'close': float(q.get('close', ltp)),
                        'volume': vol,
                        'change': change,
                        'changePercent': pct,
                        'bid': bid,
                        'ask': ask,
                        'bidQty': int(buy_depth[0].get('quantity', 0)) if buy_depth else 0,
                        'askQty': int(sell_depth[0].get('quantity', 0)) if sell_depth else 0,
                        'timestamp': now_ts,
                        'source': 'live'
                    }
                    full_ticks_update[f"{exchange}_{tok}"] = tick_obj
                    full_ticks_update[tok] = tick_obj
                    full_ticks_update[f"{exchange}_{symbol}_{int(strike)}_PE"] = tick_obj
                    full_ticks_update[ts_sym] = tick_obj

            rows.append({
                'strikePrice': strike,
                'ce': ce_row,
                'pe': pe_row
            })

        return {
            'expiry': nearest_exp,
            'spot': spot,
            'rows': rows
        }

    def run(self):
        logging.info("Angel Option WebSocket / Real-Time Poller daemon started")
        while not self.login():
            logging.warning("Retrying login in 5s...")
            time.sleep(5)

        self.load_instruments()

        chains_output = {}

        while True:
            try:
                # Re-login once every 12 hours
                if time.time() - self.last_login_time > 43200:
                    self.login()

                t0 = time.time()
                full_ticks_update = {}

                for sym in ['NIFTY', 'BANKNIFTY', 'SENSEX']:
                    chain_res = self.process_underlying(sym, full_ticks_update)
                    if chain_res and chain_res.get('rows'):
                        exp = chain_res['expiry']
                        if sym not in chains_output:
                            chains_output[sym] = {}
                        chains_output[sym][exp] = chain_res
                    # Rate limit pause between broker API calls (max 3 req/sec)
                    time.sleep(0.35)

                if chains_output:
                    # Write angel_option_chain.json atomically with PID to avoid collision
                    payload = {
                        'timestamp': int(time.time() * 1000),
                        'chains': chains_output,
                        'expiries': self.all_expiries_by_sym
                    }
                    tmp_chain = f"{CHAIN_FILE}.{os.getpid()}.tmp"
                    with open(tmp_chain, 'w') as f:
                        json.dump(payload, f)
                    os.replace(tmp_chain, CHAIN_FILE)

                # Merge ticks into angel_ticks.json atomically
                if full_ticks_update and os.path.exists(TICKS_FILE):
                    try:
                        with open(TICKS_FILE, 'r') as f:
                            existing_ticks = json.load(f)
                        existing_ticks.update(full_ticks_update)
                        tmp_ticks = f"{TICKS_FILE}.{os.getpid()}.tmp"
                        with open(tmp_ticks, 'w') as f:
                            json.dump(existing_ticks, f)
                        os.replace(tmp_ticks, TICKS_FILE)
                    except Exception as te:
                        logging.warning(f"Ticks file merge warning: {te}")

                elapsed = time.time() - t0
                sleep_time = max(0.5, 2.0 - elapsed)
                time.sleep(sleep_time)

            except Exception as e:
                logging.error(f"Worker iteration error: {e}", exc_info=True)
                time.sleep(3)

def main():
    worker = AngelOptionWorker()
    worker.run()

if __name__ == '__main__':
    main()
