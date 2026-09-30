import os
import sys
import time
import json
import pyotp
import logging
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2

logging.basicConfig(level=logging.INFO, format='[AngelTicker] %(asctime)s - %(levelname)s - %(message)s')

API_KEY = os.getenv('ANGELONE_API_KEY') or os.getenv('SMARTAPI_API_KEY') or os.getenv('ANGEL_ONE_API_KEY') or ''
CLIENT_CODE = os.getenv('ANGELONE_CLIENT_ID') or os.getenv('SMARTAPI_CLIENT_CODE') or os.getenv('ANGEL_ONE_CLIENT_CODE') or ''
PASSWORD = os.getenv('ANGELONE_CLIENT_SECRET') or os.getenv('SMARTAPI_PASSWORD') or os.getenv('ANGEL_ONE_PASSWORD') or ''
TOTP_SECRET = os.getenv('ANGELONE_TOTP_SECRET') or os.getenv('SMARTAPI_TOTP_SECRET') or os.getenv('ANGEL_ONE_TOTP_SECRET') or ''

DATA_DIR = os.getenv('ANGEL_TICKS_DIR', os.path.join(os.getcwd(), 'server', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
TICKS_FILE = os.path.join(DATA_DIR, 'angel_ticks.json')

ticks_cache = {}

def get_totp():
    if not TOTP_SECRET:
        return ""
    try:
        totp = pyotp.TOTP(TOTP_SECRET)
        return totp.now()
    except Exception as e:
        logging.error(f"Error generating TOTP: {e}")
        return ""

def main():
    logging.info("Starting Angel One SmartConnect Live Ticker...")
    if not API_KEY or not CLIENT_CODE:
        logging.warning("Angel One credentials missing (ANGEL_ONE_API_KEY / ANGEL_ONE_CLIENT_CODE). Ticker running in standby mode.")
        while True:
            time.sleep(60)

    try:
        smartApi = SmartConnect(api_key=API_KEY)
        totp = get_totp()
        data = smartApi.generateSession(CLIENT_CODE, PASSWORD, totp)
        if not data or not data.get('status'):
            logging.error(f"Angel One Login Failed: {data.get('message', 'Unknown Error')}")
            sys.exit(1)

        jwt_token = data['data']['jwtToken']
        feed_token = smartApi.getfeedToken()
        logging.info("Angel One Login Successful. Starting WebSocket V2 Feed...")

        correlation_id = "tradegrow_angel_ticker"
        sws = SmartWebSocketV2(jwt_token, API_KEY, CLIENT_CODE, feed_token)

        def on_data(wsapp, message):
            try:
                token = str(message.get('token', ''))
                ltp = float(message.get('last_traded_price', 0)) / 100.0
                close = float(message.get('close_price', 0)) / 100.0
                change = ltp - close if close > 0 else 0
                pct_change = (change / close * 100.0) if close > 0 else 0

                tick = {
                    'instrumentToken': token,
                    'exchange': 'NSE',
                    'symbol': token,
                    'tradingSymbol': token,
                    'ltp': ltp,
                    'open': float(message.get('open_price_day', 0)) / 100.0,
                    'high': float(message.get('high_price_day', 0)) / 100.0,
                    'low': float(message.get('low_price_day', 0)) / 100.0,
                    'close': close,
                    'change': round(change, 2),
                    'changePercent': round(pct_change, 2),
                    'volume': int(message.get('volume_traded_for_the_day', 0)),
                    'source': 'angel_one',
                    'isSynthetic': False,
                    'timestamp': int(time.time() * 1000)
                }

                ticks_cache[token] = tick

                # Atomic write to angel_ticks.json
                temp_file = TICKS_FILE + '.tmp'
                with open(temp_file, 'w') as f:
                    json.dump(ticks_cache, f)
                os.replace(temp_file, TICKS_FILE)

            except Exception as ex:
                logging.error(f"Error processing tick: {ex}")

        def on_open(wsapp):
            logging.info("Angel WebSocket Connected. Subscribing to tokens...")
            # Sample subscription mode 1 (Full Quote)
            token_list = [
                {"exchangeType": 1, "tokens": ["26000", "26009", "99926000"]}, # NIFTY 50, BANKNIFTY
                {"exchangeType": 3, "tokens": ["1"]} # BSE SENSEX
            ]
            sws.subscribe(correlation_id, 1, token_list)

        def on_error(wsapp, error):
            logging.error(f"Angel WebSocket Error: {error}")

        def on_close(wsapp):
            logging.warning("Angel WebSocket Connection Closed.")

        sws.on_open = on_open
        sws.on_data = on_data
        sws.on_error = on_error
        sws.on_close = on_close

        sws.connect()

    except Exception as e:
        logging.error(f"Fatal error in Angel Ticker: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
