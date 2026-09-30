import os
import json
import time
import asyncio
import logging
from typing import Dict, Any, List, Optional
import pyotp
import redis

logger = logging.getLogger("AngelSmartApiFeed")
logger.setLevel(logging.INFO)


class AngelSmartApiFeed:
    """
    Manages single persistent upstream WebSocket connection to Angel One SmartAPI.
    Uses pyotp for automated TOTP generation, normalizes market ticks, and broadcasts via Redis Pub/Sub.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.api_key = os.getenv("ANGELONE_API_KEY") or os.getenv("SMARTAPI_API_KEY") or "4DBv6HvT"
        self.client_code = os.getenv("ANGELONE_CLIENT_ID") or os.getenv("SMARTAPI_CLIENT_CODE") or "N89824"
        self.password = os.getenv("ANGELONE_CLIENT_SECRET") or os.getenv("SMARTAPI_PASSWORD") or "9691"
        self.totp_secret = os.getenv("ANGELONE_TOTP_SECRET") or os.getenv("SMARTAPI_TOTP_SECRET") or "AV7KF7BEJBOOCVIS53TZZB2VEU"

        r_url = redis_url or os.getenv("REDIS_URL") or "redis://localhost:6379"
        self.redis_client = redis.Redis.from_url(r_url, decode_responses=True)

        self.smart_api = None
        self.auth_token = None
        self.feed_token = None
        self.is_connected = False
        self.last_tick_timestamp = 0

    def generate_totp(self) -> str:
        """Generates 6-digit Time-based One Time Password (TOTP) from secret"""
        totp = pyotp.TOTP(self.totp_secret)
        token = totp.now()
        logger.info(f"[AngelSmartApiFeed] Generated fresh TOTP token for client {self.client_code}")
        return token

    def authenticate(self) -> bool:
        """Authenticates with Angel One SmartAPI using API Key, Password, and pyotp TOTP"""
        try:
            from SmartApi import SmartConnect
            self.smart_api = SmartConnect(api_key=self.api_key)
            totp_code = self.generate_totp()

            data = self.smart_api.generateSession(self.client_code, self.password, totp_code)
            if data and data.get("status"):
                self.auth_token = data["data"]["jwtToken"]
                self.feed_token = self.smart_api.getfeedToken()
                logger.info(f"[AngelSmartApiFeed] ✅ Successfully authenticated session for {self.client_code}")
                return True
            else:
                logger.warning(f"[AngelSmartApiFeed] Authentication failed: {data}")
                return False
        except Exception as e:
            logger.error(f"[AngelSmartApiFeed] SmartConnect Login Error: {e}")
            return False

    def publish_tick(self, token: str, tick_data: Dict[str, Any]):
        """Publishes normalized tick payload to Redis Pub/Sub and latest-tick cache"""
        try:
            payload = json.dumps(tick_data)
            self.redis_client.set(f"tick:{token}", payload, ex=3600)
            self.redis_client.publish("market:ticks", payload)
            self.last_tick_timestamp = time.time() * 1000
        except Exception as err:
            logger.error(f"[AngelSmartApiFeed] Redis Publish Error: {err}")

    def is_healthy(self) -> bool:
        """Checks if feed is connected and ticks arrived in last 15 seconds"""
        if not self.is_connected:
            return False
        now_ms = time.time() * 1000
        return (now_ms - self.last_tick_timestamp) < 15000
