"""Indian-market research math. Prices are Decimal; outputs are research only."""
import importlib.util
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from pathlib import Path


def upstream(name, path):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / path)
    module = importlib.util.module_from_spec(spec)
    import sys
    sys.dont_write_bytecode = True
    spec.loader.exec_module(module)
    return module


scanner = upstream("day_scanner", "upstream/day-trader-skill/trader-scanner/scan.py")
exit_planner = upstream("day_exit", "upstream/day-trader-skill/trader-exit/exit.py")


def generate(snapshot, now=None):
    now = now or datetime.now(timezone.utc)
    if snapshot.source != "dhan":
        raise ValueError("Indian research requires a Dhan snapshot")
    age = (now - snapshot.as_of).total_seconds()
    if not 0 <= age <= 60:
        raise ValueError("Snapshot must be at most 60 seconds old and cannot be future dated")
    if snapshot.asset_type == "option" and snapshot.expires_at <= now:
        raise ValueError("Expired contracts cannot generate trading levels")
    bars = snapshot.bars
    if any(a.timestamp >= b.timestamp for a, b in zip(bars, bars[1:])):
        raise ValueError("Bars must have unique ascending timestamps")
    if any(b.timestamp >= snapshot.as_of for b in bars):
        raise ValueError("Only completed bars preceding the snapshot are allowed")
    if (snapshot.as_of - bars[-1].timestamp).total_seconds() > 900:
        raise ValueError("Latest completed bar is stale")
    tick = snapshot.tick_size
    def rounded(value, up=False):
        return (value / tick).to_integral_value(rounding=ROUND_CEILING if up else ROUND_FLOOR) * tick
    last = snapshot.last_price
    prior = bars[-20:]
    support = min(b.low for b in prior)
    resistance = max(b.high for b in prior)
    ranges = [max(b.high-b.low, abs(b.high-a.close), abs(b.low-a.close))
              for a, b in zip(bars[-15:-1], bars[-14:])]
    atr = sum(ranges) / len(ranges)
    entry = rounded(max(last, resistance) + tick, True)
    stop = rounded(entry - max(atr, tick * 2))
    # Upstream exact-decimal stop/target planner; exchange tick rounding follows it.
    plan = exit_planner.compute(entry, "price", stop, "r", Decimal("2"))
    target = rounded(plan["target"], True)
    if snapshot.lower_circuit is not None and (stop < snapshot.lower_circuit or target > snapshot.upper_circuit):
        raise ValueError('Trading plan extends beyond exchange circuit limits')
    risk = entry - stop
    tags, indicators = scanner.find_setups([float(b.close) for b in bars])
    quantity = int(snapshot.risk_budget / (risk * snapshot.lot_size)) * snapshot.lot_size
    return {
        "status": "DRAFT", "strategy": "long_breakout_2R", "currency": "INR",
        "symbol": snapshot.symbol, "token": snapshot.token, "asset_type": snapshot.asset_type,
        "as_of": snapshot.as_of.isoformat(), "source": snapshot.source,
        "entry_above": str(entry), "stop_loss": str(stop), "target": str(target),
        "support": str(support), "resistance": str(resistance), "atr14": str(atr),
        "reward_risk": str((target-entry)/risk), "max_quantity_at_stop": quantity,
        "lot_size": snapshot.lot_size, "risk_budget": str(snapshot.risk_budget),
        "setups": [tag.replace("20d", "20bars") for tag in tags], "indicators": indicators,
        "risk_status": "WITHIN_BUDGET" if quantity else "INSUFFICIENT_RISK_BUDGET",
        "basis": "option premium" if snapshot.asset_type == "option" else "stock price",
        "valid_until": min(snapshot.as_of.timestamp()+300,
                           snapshot.expires_at.timestamp() if snapshot.expires_at else float("inf")),
        "notes": ["Conditional entry; not an immediate buy signal.",
                  "Stop gaps and slippage can exceed the risk budget.",
                  "Stock scanner tags describe the supplied bar interval, not daily signals."],
        "execution_enabled": False,
    }
