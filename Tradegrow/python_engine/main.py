import time
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.greeks_service import GreeksService, PY_VOLLIB_AVAILABLE
from services.angel_service import AngelSmartApiFeed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StockSharpPythonEngine")

app = FastAPI(
    title="StockSharp Paper Trading Python Engine",
    description="FastAPI Market Data Ingestion, py_vollib Options Pricing & Redis WebSocket Gateway",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

angel_feed = AngelSmartApiFeed()


class CalculationRequest(BaseModel):
    spot: float
    strike: float
    time_to_expiry_years: float
    is_call: bool
    iv: Optional[float] = 0.15
    target_ltp: Optional[float] = None


@app.on_event("startup")
async def startup_event():
    logger.info("=======================================================")
    logger.info("🚀 STARTING STOCKSHARP PYTHON 3.11+ FASTAPI ENGINE")
    logger.info(f"📊 PY_VOLLIB STATUS: {'AVAILABLE (NATIVE ACCELERATED)' if PY_VOLLIB_AVAILABLE else 'FALLBACK (ANALYTICAL)'}")
    logger.info("=======================================================")


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "engine": "FastAPI (Python 3.11+)",
        "py_vollib": PY_VOLLIB_AVAILABLE,
        "angel_feed_healthy": angel_feed.is_healthy(),
        "timestamp": int(time.time() * 1000)
    }


@app.post("/api/v1/greeks/calculate")
def calculate_greeks(req: CalculationRequest):
    iv = req.iv or 0.15
    if req.target_ltp and req.target_ltp > 0:
        iv = GreeksService.calculate_implied_volatility(
            target_ltp=req.target_ltp,
            spot=req.spot,
            strike=req.strike,
            time_to_expiry_years=req.time_to_expiry_years,
            is_call=req.is_call,
            fallback_iv=iv
        )

    price = GreeksService.calculate_option_price(
        spot=req.spot,
        strike=req.strike,
        time_to_expiry_years=req.time_to_expiry_years,
        is_call=req.is_call,
        iv=iv
    )

    greeks = GreeksService.calculate_greeks(
        spot=req.spot,
        strike=req.strike,
        time_to_expiry_years=req.time_to_expiry_years,
        is_call=req.is_call,
        iv=iv
    )

    return {
        "price": price,
        "greeks": greeks
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("[FastAPI WS] Client connected to FastAPI WebSocket stream.")
    try:
        while True:
            data = await websocket.receive_text()
            # Echo handshake / keepalive ping
            await websocket.send_text(json.dumps({"type": "PONG", "received": data}))
    except WebSocketDisconnect:
        logger.info("[FastAPI WS] Client disconnected.")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
