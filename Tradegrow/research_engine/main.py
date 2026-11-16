"""Private research API with durable, idempotent jobs and a single bounded worker."""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from levels import generate
from models import Snapshot, Schedule

DB = os.getenv("RESEARCH_DB", "/data/research.sqlite")


@contextmanager
def connect():
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY, key TEXT UNIQUE, digest TEXT, payload TEXT,
          status TEXT, result TEXT, error TEXT, created REAL, started REAL)""")
        db.execute('''CREATE TABLE IF NOT EXISTS schedules (
          id TEXT PRIMARY KEY, token TEXT UNIQUE, config TEXT, next_run REAL,
          last_job TEXT, last_error TEXT, revision TEXT)''')


def process_one():
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        # A crash after an LLM request is ambiguous; require a new reviewed request.
        db.execute("UPDATE jobs SET status='FAILED', error='Worker interrupted; review before retry' "
                   "WHERE status='RUNNING' AND started < ?", (time.time()-660,))
        row = db.execute("SELECT * FROM jobs WHERE status='QUEUED' ORDER BY created LIMIT 1").fetchone()
        if not row:
            return
        db.execute("UPDATE jobs SET status='RUNNING', started=? WHERE id=?", (time.time(), row["id"]))
    try:
        snapshot = Snapshot.model_validate_json(row["payload"])
        result = generate(snapshot)
        if snapshot.include_ai:
            with tempfile.TemporaryDirectory(prefix="tgx-research-") as folder:
                request = Path(folder)/"request.json"
                response = Path(folder)/"response.json"
                request.write_text(row["payload"], encoding="utf-8")
                # No shell; timeout bounds a slow upstream graph. Logs stay off the API.
                subprocess.run([sys.executable, str(Path(__file__).with_name("ai_report.py")),
                                str(request), str(response)], check=True, timeout=600,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                result["ai_research"] = json.loads(response.read_text(encoding="utf-8"))
        with connect() as db:
            db.execute("UPDATE jobs SET status='COMPLETED', result=? WHERE id=?",
                       (json.dumps(result), row["id"]))
    except Exception as exc:
        with connect() as db:
            db.execute("UPDATE jobs SET status='FAILED', error=? WHERE id=?",
                       (type(exc).__name__ + ": research generation failed; inspect worker configuration/data", row["id"]))


async def worker():
    while True:
        try:
            await asyncio.to_thread(process_one)
        except Exception:
            logging.exception("Research queue iteration failed")
        await asyncio.sleep(1)


def process_schedule(at=None):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from urllib.request import Request, urlopen
    now = at or datetime.now(ZoneInfo('Asia/Kolkata'))
    if now.weekday() >= 5 or not '09:15' <= now.strftime('%H:%M') <= '15:25':
        return
    endpoint = os.getenv('RESEARCH_NODE_URL')
    if not endpoint:
        return
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM schedules WHERE next_run<=? ORDER BY next_run LIMIT 1', (time.time(),)).fetchone()
        if not row:
            return
        config = Schedule.model_validate_json(row['config'])
        db.execute('UPDATE schedules SET next_run=? WHERE id=?', (time.time()+config.interval_seconds, row['id']))
    try:
        request = Request(endpoint.rstrip('/')+'/internal/research/snapshot',
            data=json.dumps({'token': config.token}).encode(), method='POST',
            headers={'Authorization': 'Bearer '+os.environ['RESEARCH_API_KEY'], 'Content-Type':'application/json'})
        with urlopen(request, timeout=15) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError('Snapshot too large')
        payload = json.loads(raw)
        payload.update(risk_budget=str(config.risk_budget), include_ai=config.include_ai,
                       research_ticker=config.research_ticker)
        snapshot = Snapshot.model_validate(payload)
        if snapshot.token != config.token:
            raise ValueError('Snapshot token does not match schedule')
        # An edit/removal while fetching prevents a stale schedule from submitting.
        with connect() as db:
            current = db.execute('SELECT revision FROM schedules WHERE id=?', (row['id'],)).fetchone()
        if not current or current['revision'] != row['revision']:
            return
        key = 'schedule-'+row['id']+'-'+str(int(row['next_run']))
        job = submit(snapshot, idempotency_key=key)
        with connect() as db:
            db.execute('UPDATE schedules SET last_job=?,last_error=NULL WHERE id=? AND revision=?',
                       (job['id'], row['id'], row['revision']))
    except Exception:
        with connect() as db:
            db.execute('UPDATE schedules SET last_error=? WHERE id=? AND revision=?',
                       ('Snapshot/job unavailable: inspect feed, session, circuit limits and queue capacity', row['id'], row['revision']))


async def scheduler():
    while True:
        try:
            await asyncio.to_thread(process_schedule)
        except Exception:
            logging.exception('Research scheduler iteration failed')
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app):
    if len(os.getenv("RESEARCH_API_KEY", "")) < 32:
        raise RuntimeError("RESEARCH_API_KEY must contain at least 32 characters")
    initialize()
    task = asyncio.create_task(worker())
    scheduled_task = asyncio.create_task(scheduler())
    yield
    task.cancel()
    scheduled_task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    try:
        await scheduled_task
    except asyncio.CancelledError:
        pass


def authorize(authorization: str = Header(default="")):
    if not hmac.compare_digest(authorization, "Bearer " + os.environ["RESEARCH_API_KEY"]):
        raise HTTPException(401, "Invalid research service credentials")


app = FastAPI(title="TradeGrowX Research", lifespan=lifespan,
              dependencies=[Depends(authorize)], docs_url=None, redoc_url=None)


@app.get("/health")
def health():
    with connect() as db:
        queued = db.execute("SELECT count(*) FROM jobs WHERE status='QUEUED'").fetchone()[0]
    return {"status": "UP", "queued": queued, "execution_enabled": False}


@app.post("/jobs", status_code=202)
def submit(snapshot: Snapshot, idempotency_key: str = Header(min_length=8, max_length=128)):
    payload = snapshot.model_dump_json()
    digest = hashlib.sha256(payload.encode()).hexdigest()
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT id,digest FROM jobs WHERE key=?", (idempotency_key,)).fetchone()
        if existing:
            if existing["digest"] != digest:
                raise HTTPException(409, "Idempotency key already used with another payload")
            return {"id": existing["id"]}
        try:
            generate(snapshot)  # Validate new submissions; retries keep their original ID.
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        pending = db.execute("SELECT count(*) FROM jobs WHERE status IN ('QUEUED','RUNNING')").fetchone()[0]
        if pending >= 20:
            raise HTTPException(429, "Research queue full")
        job_id = str(uuid.uuid4())
        db.execute("INSERT INTO jobs (id,key,digest,payload,status,created) VALUES (?,?,?,?,?,?)",
                   (job_id, idempotency_key, digest, payload, "QUEUED", time.time()))
    return {"id": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    with connect() as db:
        row = db.execute("SELECT id,status,result,error,created FROM jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Research job not found")
    result = dict(row)
    result["result"] = json.loads(result["result"]) if result["result"] else None
    return result


@app.get("/jobs")
def list_jobs():
    with connect() as db:
        rows = db.execute("SELECT id,status,error,created,payload FROM jobs ORDER BY created DESC LIMIT 50").fetchall()
        counts = dict(db.execute("SELECT status,count(*) FROM jobs GROUP BY status").fetchall())
    jobs = []
    for row in rows:
        payload = json.loads(row['payload'])
        jobs.append({key: row[key] for key in ('id', 'status', 'error', 'created')} |
                    {key: payload.get(key) for key in ('symbol', 'token', 'asset_type', 'include_ai')})
    return {'jobs': jobs, 'counts': counts}


@app.get('/schedules')
def list_schedules():
    with connect() as db:
        rows = db.execute('SELECT * FROM schedules ORDER BY token').fetchall()
    return {'configured': bool(os.getenv('RESEARCH_NODE_URL')), 'schedules': [dict(row) | {'config': json.loads(row['config'])} for row in rows]}


@app.post('/schedules')
def save_schedule(config: Schedule):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT id FROM schedules WHERE token=?', (config.token,)).fetchone()
        if not existing and db.execute('SELECT count(*) FROM schedules').fetchone()[0] >= 10:
            raise HTTPException(429, 'Maximum ten watchlist schedules')
        schedule_id = existing['id'] if existing else str(uuid.uuid4())
        db.execute('''INSERT INTO schedules (id,token,config,next_run,revision) VALUES (?,?,?,?,?)
          ON CONFLICT(token) DO UPDATE SET config=excluded.config,next_run=excluded.next_run,
          revision=excluded.revision,last_error=NULL''',
          (schedule_id, config.token, config.model_dump_json(), time.time(), str(uuid.uuid4())))
    return {'id':schedule_id}


@app.delete('/schedules/{schedule_id}')
def remove_schedule(schedule_id: str):
    with connect() as db:
        db.execute('DELETE FROM schedules WHERE id=?', (schedule_id,))
    return {'removed':True}
