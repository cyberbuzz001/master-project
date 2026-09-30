import os
import sys
import time
import json
import logging

logging.basicConfig(level=logging.INFO, format='[AngelOptionWS] %(asctime)s - %(levelname)s - %(message)s')

DATA_DIR = os.getenv('ANGEL_TICKS_DIR', os.path.join(os.getcwd(), 'server', 'data'))
os.makedirs(DATA_DIR, exist_ok=True)
CHAIN_FILE = os.path.join(DATA_DIR, 'angel_option_chain.json')

def main():
    logging.info("Starting Angel One Option Chain WebSocket process...")
    # Standby loop for option chain websocket writer
    while True:
        try:
            # Keep process alive and refresh timestamp
            time.sleep(30)
        except KeyboardInterrupt:
            break

if __name__ == '__main__':
    main()
