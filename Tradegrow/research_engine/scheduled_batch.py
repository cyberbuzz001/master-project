"""Run on a timer. Snapshot producer owns exchange holidays and instrument selection."""
import json
import os
from urllib.request import Request, urlopen
from datetime import datetime
from zoneinfo import ZoneInfo

from main import initialize, submit
from models import Snapshot


def run():
    now = datetime.now(ZoneInfo('Asia/Kolkata'))
    if now.weekday() >= 5 or not '09:15' <= now.strftime('%H:%M') <= '15:25':
        return
    # Server-controlled URL, never taken from a user request. No public Yahoo fallback.
    request = Request(os.environ['RESEARCH_SNAPSHOT_URL'], headers={
        'Authorization': 'Bearer ' + os.environ['RESEARCH_SNAPSHOT_TOKEN']})
    with urlopen(request, timeout=20) as response:
        payload = json.loads(response.read(2_000_001))
    if not isinstance(payload, dict) or payload.get('market_open') is not True:
        return
    snapshots = payload.get('snapshots', [])
    if not isinstance(snapshots, list) or len(snapshots) > 20:
        raise ValueError('At most 20 snapshots per batch')
    initialize()
    for raw in snapshots:
        snapshot = Snapshot.model_validate(raw)
        # Snapshot timestamp makes retries deterministic across overlapping timers.
        import hashlib
        key = hashlib.sha256((snapshot.token + snapshot.as_of.isoformat()).encode()).hexdigest()
        submit(snapshot, idempotency_key='scheduled-' + key)


if __name__ == '__main__':
    run()
