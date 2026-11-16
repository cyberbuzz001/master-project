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
from models import Snapshot

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


@asynccontextmanager
async def lifespan(app):
    if len(os.getenv("RESEARCH_API_KEY", "")) < 32:
        raise RuntimeError("RESEARCH_API_KEY must contain at least 32 characters")
    initialize()
    task = asyncio.create_task(worker())
    yield
    task.cancel()
    try:
        await task
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
