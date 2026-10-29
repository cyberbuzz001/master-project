import os
import sys
import time
import json
import logging
import threading
import pyotp

logging.basicConfig(
    level=logging.INFO,
    format='[AngelTicker] %(asctime)s - %(levelname)s - %(message)s'
)

# Optional redis import with graceful fallback
try:
    import redis
    HAVE_REDIS = True
except ImportError:
    HAVE_REDIS = False
    logging.warning("redis-py not installed; Redis direct publishing disabled.")

from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2

API_KEY = os.getenv('ANGELONE_API_KEY') or os.getenv('SMARTAPI_API_KEY') or os.getenv('ANGEL_ONE_API_KEY') or '4DBv6HvT'
CLIENT_CODE = os.getenv('ANGELONE_CLIENT_ID') or os.getenv('SMARTAPI_CLIENT_CODE') or os.getenv('ANGEL_ONE_CLIENT_CODE') or 'N89824'
PASSWORD = os.getenv('ANGELONE_CLIENT_SECRET') or os.getenv('SMARTAPI_PASSWORD') or os.getenv('ANGEL_ONE_PASSWORD') or '9691'
TOTP_SECRET = os.getenv('ANGELONE_TOTP_SECRET') or os.getenv('SMARTAPI_TOTP_SECRET') or os.getenv('ANGEL_ONE_TOTP_SECRET') or 'AV7KF7BEJBOOCVIS53TZZB2VEU'

REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))

DATA_DIR = os.getenv('ANGEL_TICKS_DIR', os.path.join(os.getcwd(), 'server', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
TICKS_FILE = os.path.join(DATA_DIR, 'angel_ticks.json')

r = None
if HAVE_REDIS:
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        logging.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        logging.warning(f"Failed to connect to Redis ({e}), will fallback to file storage.")
        r = None

# Known index and prominent equity tokens mapping
TOKEN_META = {
    # NSE Indices (Exchange 1)
    '99926000': {'symbol': 'NSE_NIFTY50', 'tradingSymbol': 'NIFTY 50', 'exchange': 'NSE', 'aliases': ['NSE_NIFTY50', 'NSE_NIFTY', 'NIFTY', '99926000', '26000']},
    '26000':    {'symbol': 'NSE_NIFTY50', 'tradingSymbol': 'NIFTY 50', 'exchange': 'NSE', 'aliases': ['NSE_NIFTY50', 'NSE_NIFTY', 'NIFTY', '99926000', '26000']},
    '99926009': {'symbol': 'NSE_BANKNIFTY', 'tradingSymbol': 'BANKNIFTY', 'exchange': 'NSE', 'aliases': ['NSE_BANKNIFTY', 'BANKNIFTY', '99926009', '26009']},
    '26009':    {'symbol': 'NSE_BANKNIFTY', 'tradingSymbol': 'BANKNIFTY', 'exchange': 'NSE', 'aliases': ['NSE_BANKNIFTY', 'BANKNIFTY', '99926009', '26009']},
    '99926037': {'symbol': 'NSE_FINNIFTY', 'tradingSymbol': 'FINNIFTY', 'exchange': 'NSE', 'aliases': ['NSE_FINNIFTY', 'FINNIFTY', '99926037', '26037']},
    '26037':    {'symbol': 'NSE_FINNIFTY', 'tradingSymbol': 'FINNIFTY', 'exchange': 'NSE', 'aliases': ['NSE_FINNIFTY', 'FINNIFTY', '99926037', '26037']},
    '99926074': {'symbol': 'NSE_MIDCPNIFTY', 'tradingSymbol': 'NIFTY MID SELECT', 'exchange': 'NSE', 'aliases': ['NSE_MIDCPNIFTY', 'MIDCPNIFTY', '99926074', '26074']},
    '26074':    {'symbol': 'NSE_MIDCPNIFTY', 'tradingSymbol': 'NIFTY MID SELECT', 'exchange': 'NSE', 'aliases': ['NSE_MIDCPNIFTY', 'MIDCPNIFTY', '99926074', '26074']},
    # BSE Indices (Exchange 3)
    '99919000': {'symbol': 'BSE_SENSEX', 'tradingSymbol': 'SENSEX', 'exchange': 'BSE', 'aliases': ['BSE_SENSEX', 'SENSEX', '99919000', '1']},
    '1':        {'symbol': 'BSE_SENSEX', 'tradingSymbol': 'SENSEX', 'exchange': 'BSE', 'aliases': ['BSE_SENSEX', 'SENSEX', '99919000', '1']},
    # Prominent Equities (Exchange 1)
    '2885':     {'symbol': 'NSE_RELIANCE', 'tradingSymbol': 'RELIANCE-EQ', 'exchange': 'NSE', 'aliases': ['NSE_RELIANCE', 'RELIANCE', '2885']},
    '11536':    {'symbol': 'NSE_TCS', 'tradingSymbol': 'TCS-EQ', 'exchange': 'NSE', 'aliases': ['NSE_TCS', 'TCS', '11536']},
    '1594':     {'symbol': 'NSE_INFY', 'tradingSymbol': 'INFY-EQ', 'exchange': 'NSE', 'aliases': ['NSE_INFY', 'INFY', '1594']},
    '1333':     {'symbol': 'NSE_HDFCBANK', 'tradingSymbol': 'HDFCBANK-EQ', 'exchange': 'NSE', 'aliases': ['NSE_HDFCBANK', 'HDFCBANK', '1333']},
    '4963':     {'symbol': 'NSE_ICICIBANK', 'tradingSymbol': 'ICICIBANK-EQ', 'exchange': 'NSE', 'aliases': ['NSE_ICICIBANK', 'ICICIBANK', '4963']},
    '3456':     {'symbol': 'NSE_TATAMOTORS', 'tradingSymbol': 'TATAMOTORS-EQ', 'exchange': 'NSE', 'aliases': ['NSE_TATAMOTORS', 'TATAMOTORS', '3456']},
    '3045':     {'symbol': 'NSE_SBIN', 'tradingSymbol': 'SBIN-EQ', 'exchange': 'NSE', 'aliases': ['NSE_SBIN', 'SBIN', '3045']},
    '10604':    {'symbol': 'NSE_BHARTIARTL', 'tradingSymbol': 'BHARTIARTL-EQ', 'exchange': 'NSE', 'aliases': ['NSE_BHARTIARTL', 'BHARTIARTL', '10604']},
    '3499':     {'symbol': 'NSE_TATASTEEL', 'tradingSymbol': 'TATASTEEL-EQ', 'exchange': 'NSE', 'aliases': ['NSE_TATASTEEL', 'TATASTEEL', '3499']},
    '1660':     {'symbol': 'NSE_ITC', 'tradingSymbol': 'ITC-EQ', 'exchange': 'NSE', 'aliases': ['NSE_ITC', 'ITC', '1660']},
    '1394':     {'symbol': 'NSE_HINDUNILVR', 'tradingSymbol': 'HINDUNILVR-EQ', 'exchange': 'NSE', 'aliases': ['NSE_HINDUNILVR', 'HINDUNILVR', '1394']},
    '317':      {'symbol': 'NSE_BAJFINANCE', 'tradingSymbol': 'BAJFINANCE-EQ', 'exchange': 'NSE', 'aliases': ['NSE_BAJFINANCE', 'BAJFINANCE', '317']},
    '14977':    {'symbol': 'NSE_POWERGRID', 'tradingSymbol': 'POWERGRID-EQ', 'exchange': 'NSE', 'aliases': ['NSE_POWERGRID', 'POWERGRID', '14977']},
    '11630':    {'symbol': 'NSE_NTPC', 'tradingSymbol': 'NTPC-EQ', 'exchange': 'NSE', 'aliases': ['NSE_NTPC', 'NTPC', '11630']},
    '3506':     {'symbol': 'NSE_TITAN', 'tradingSymbol': 'TITAN-EQ', 'exchange': 'NSE', 'aliases': ['NSE_TITAN', 'TITAN', '3506']},
    '25':       {'symbol': 'NSE_ADANIENT', 'tradingSymbol': 'ADANIENT-EQ', 'exchange': 'NSE', 'aliases': ['NSE_ADANIENT', 'ADANIENT', '25']},
    '15083':    {'symbol': 'NSE_ADANIPORTS', 'tradingSymbol': 'ADANIPORTS-EQ', 'exchange': 'NSE', 'aliases': ['NSE_ADANIPORTS', 'ADANIPORTS', '15083']},
}

EXCHANGE_TYPE_MAP = {
    1: 'NSE',
    2: 'NFO',
    3: 'BSE',
    4: 'BFO',
    5: 'MCX',
    7: 'NCX',
    13: 'CDS',
}

ticks_cache = {}
last_file_flush = 0
subscribed_tokens_set = set()
sws_instance = None

def get_totp():
    if not TOTP_SECRET:
        return ""
    try:
        return pyotp.TOTP(TOTP_SECRET).now()
    except Exception as e:
        logging.error(f"Error generating TOTP: {e}")
        return ""

def authenticate():
    logging.info(f"Authenticating Angel One SmartConnect for client {CLIENT_CODE}...")
    for attempt in range(1, 4):
        try:
            smart_api = SmartConnect(api_key=API_KEY)
            totp = get_totp()
            data = smart_api.generateSession(CLIENT_CODE, PASSWORD, totp)
            if data and data.get('status'):
                jwt_token = data['data']['jwtToken']
                feed_token = smart_api.getfeedToken()
                logging.info(f"Angel One Login Successful on attempt {attempt}")
                return smart_api, jwt_token, feed_token
            logging.warning(f"Auth attempt {attempt} failed: {data.get('message')}")
        except Exception as ex:
            logging.error(f"Auth attempt {attempt} error: {ex}")
        time.sleep(3)
    return None, None, None

def flush_file_cache():
    global last_file_flush
    now = time.time()
    if now - last_file_flush >= 1.0:
        last_file_flush = now
        try:
            temp_file = TICKS_FILE + '.tmp'
            with open(temp_file, 'w') as f:
                json.dump(ticks_cache, f)
            os.replace(temp_file, TICKS_FILE)
        except Exception:
            pass

def on_data_callback(wsapp, message):
    global last_file_flush
    try:
        token = str(message.get('token', ''))
        if not token:
            return

        exch_type = message.get('exchange_type', 1)
        exchange = EXCHANGE_TYPE_MAP.get(exch_type, 'NSE')

        # Convert paise to Rupees (Angel One represents quotes in paise)
        ltp = float(message.get('last_traded_price', 0)) / 100.0
        close = float(message.get('closed_price', 0)) / 100.0
        open_price = float(message.get('open_price_of_the_day', 0)) / 100.0
        high_price = float(message.get('high_price_of_the_day', 0)) / 100.0
        low_price = float(message.get('low_price_of_the_day', 0)) / 100.0
        volume = int(message.get('volume_trade_for_the_day', 0))

        if ltp <= 0 and close > 0:
            ltp = close
        if close <= 0 and ltp > 0:
            close = ltp

        change = round(ltp - close, 2) if close > 0 else 0.0
        change_pct = round((change / close) * 100.0, 2) if close > 0 else 0.0

        meta = TOKEN_META.get(token)
        if meta:
            primary_token = meta['symbol']
            trading_symbol = meta['tradingSymbol']
            aliases = meta['aliases']
        else:
            primary_token = f"{exchange}_{token}"
            trading_symbol = primary_token
            aliases = [primary_token, token, f"{exchange}_{token}"]

        tick = {
            'instrumentToken': primary_token,
            'exchange': exchange,
            'symbol': primary_token,
            'tradingSymbol': trading_symbol,
            'ltp': ltp,
            'open': open_price if open_price > 0 else ltp,
            'high': high_price if high_price > 0 else ltp,
            'low': low_price if low_price > 0 else ltp,
            'close': close,
            'change': change,
            'changePercent': change_pct,
            'volume': volume,
            'source': 'ANGEL_ONE',
            'isSynthetic': False,
            'timestamp': int(time.time() * 1000)
        }

        # Update in-memory cache
        ticks_cache[primary_token] = tick
        ticks_cache[token] = tick

        # Broadcast via Redis
        if r is not None:
            tick_json = json.dumps(tick)
            r.publish('market:ticks', tick_json)
            r.set(f"tick:{primary_token}", tick_json, ex=3600)
            for alias in aliases:
                r.set(f"tick:{alias}", tick_json, ex=3600)

            # Circular history buffer for charts
            history_item = json.dumps({
                'ltp': ltp,
                'timestamp': tick['timestamp'],
                'volume': volume,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'close': close
            })
            r.rpush(f"market:ticks:{primary_token}", history_item)
            r.ltrim(f"market:ticks:{primary_token}", -500, -1)

        flush_file_cache()

    except Exception as ex:
        logging.error(f"Error processing tick: {ex}")

def on_open_callback(wsapp):
    logging.info("Angel One SmartWebSocketV2 connected! Subscribing to core instruments...")
    core_nse = [
        '99926000', '26000', '99926009', '26009', '99926037', '26037', '99926074', '26074',
        '2885', '11536', '1594', '1333', '4963', '3456', '3045', '10604', '3499', '1660',
        '1394', '317', '14977', '11630', '3506', '25', '15083'
    ]
    core_bse = ['99919000', '1']

    token_list = [
        {"exchangeType": 1, "tokens": core_nse},
        {"exchangeType": 3, "tokens": core_bse}
    ]

    for t in core_nse + core_bse:
        subscribed_tokens_set.add(t)

    try:
        sws_instance.subscribe("tg_core", 2, token_list) # Mode 2 = Full Quote (OHLC + Volume)
        logging.info(f"Subscribed to {len(core_nse) + len(core_bse)} core instruments on Angel One.")
    except Exception as e:
        logging.error(f"Error subscribing: {e}")

def on_error_callback(*args, **kwargs):
    logging.warning(f"Angel WebSocket warning/error: {args} {kwargs}")

def on_close_callback(*args, **kwargs):
    logging.warning(f"Angel WebSocket closed: {args} {kwargs}")

def redis_subscription_listener(sws):
    """Background thread listening for dynamic token subscription requests from TradeGrow cluster."""
    if r is None:
        return
    pubsub = r.pubsub()
    pubsub.subscribe('market:subscriptions', 'angel:subscriptions')
    logging.info("Dynamic subscription listener active on channels: market:subscriptions, angel:subscriptions")

    for message in pubsub.listen():
        if not message or message['type'] != 'message':
            continue
        try:
            data = message['data']
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            tokens = json.loads(data)
            if not isinstance(tokens, list):
                continue

            nse_tokens = []
            bse_tokens = []
            nfo_tokens = []
            mcx_tokens = []

            for tok_str in tokens:
                clean_tok = str(tok_str).strip()
                if clean_tok in subscribed_tokens_set:
                    continue

                if clean_tok.startswith('BSE_') or clean_tok.startswith('BFO_'):
                    parts = clean_tok.split('_')
                    t = parts[-1]
                    if clean_tok.startswith('BFO_'):
                        nfo_tokens.append(t)
                    else:
                        bse_tokens.append(t)
                elif clean_tok.startswith('NFO_'):
                    parts = clean_tok.split('_')
                    nfo_tokens.append(parts[-1])
                elif clean_tok.startswith('MCX_'):
                    parts = clean_tok.split('_')
                    mcx_tokens.append(parts[-1])
                else:
                    parts = clean_tok.split('_')
                    nse_tokens.append(parts[-1])

                subscribed_tokens_set.add(clean_tok)

            sub_batch = []
            if nse_tokens:
                sub_batch.append({"exchangeType": 1, "tokens": nse_tokens[:100]})
            if bse_tokens:
                sub_batch.append({"exchangeType": 3, "tokens": bse_tokens[:100]})
            if nfo_tokens:
                sub_batch.append({"exchangeType": 2, "tokens": nfo_tokens[:200]})
            if mcx_tokens:
                sub_batch.append({"exchangeType": 5, "tokens": mcx_tokens[:50]})

            if sub_batch and sws_instance:
                sws_instance.subscribe("tg_dyn", 2, sub_batch)
                logging.info(f"Dynamically subscribed to {sum(len(b['tokens']) for b in sub_batch)} tokens.")
        except Exception as ex:
            logging.warning(f"Error handling dynamic subscription: {ex}")

def main():
    global sws_instance
    logging.info("Starting Angel One SmartAPI Feed Engine (WebSocket V2)...")

    if not API_KEY or not CLIENT_CODE:
        logging.error("Angel One credentials missing. Exiting.")
        sys.exit(1)

    while True:
        try:
            smart_api, jwt_token, feed_token = authenticate()
            if not jwt_token or not feed_token:
                logging.error("Authentication failed. Retrying in 15 seconds...")
                time.sleep(15)
                continue

            sws = SmartWebSocketV2(
                jwt_token,
                API_KEY,
                CLIENT_CODE,
                feed_token,
                max_retry_attempt=10,
                retry_delay=5
            )
            sws_instance = sws

            sws.on_data = on_data_callback
            sws.on_open = on_open_callback
            sws.on_error = on_error_callback
            sws.on_close = on_close_callback

            # Start dynamic subscription worker
            sub_thread = threading.Thread(target=redis_subscription_listener, args=(sws,), daemon=True)
            sub_thread.start()

            logging.info("Connecting to Angel One Live WebSocket...")
            sws.connect()

        except Exception as e:
            logging.error(f"WebSocket session terminated with error: {e}")
            time.sleep(5)

if __name__ == '__main__':
    main()
