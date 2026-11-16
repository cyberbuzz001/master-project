"""Optional isolated TradingAgents runner. Never parses its prose into orders or levels."""
import json
import sys
from datetime import datetime
from zoneinfo import ZoneInfo


def run(payload):
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph
    config = DEFAULT_CONFIG.copy()
    config.update(max_debate_rounds=1, max_risk_discuss_rounds=1,
                  max_tool_rounds=3, max_recur_limit=60, max_tokens=2000,
                  benchmark_ticker="^NSEI")
    graph = TradingAgentsGraph(selected_analysts=("market", "news", "fundamentals"),
                               config=config, debug=False)
    date = datetime.fromisoformat(payload["as_of"]).astimezone(ZoneInfo("Asia/Kolkata")).date()
    state, decision = graph.propagate(payload["research_ticker"], date.isoformat())
    report = {key: str(state.get(key, ""))[:30000] for key in (
        "market_report", "news_report", "fundamentals_report", "investment_plan",
        "final_trade_decision")}
    report.update(decision=str(decision)[:10000], provider="TradingAgents",
                  scope="underlying company research; not option premium pricing",
                  ticker=payload["research_ticker"])
    return report


if __name__ == "__main__":
    # Upstream prints progress to stdout; keep the result file machine readable.
    with open(sys.argv[1], encoding="utf-8") as stream:
        payload = json.load(stream)
    result = run(payload)
    with open(sys.argv[2], "w", encoding="utf-8") as stream:
        json.dump(result, stream)
