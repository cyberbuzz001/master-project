import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Download, RefreshCw, Upload, Play, AlertTriangle } from 'lucide-react';

type Snapshot = { symbol: string; token: string; asset_type: 'stock' | 'option'; as_of: string;
  last_price: string; tick_size: string; lot_size: number; bars: unknown[];
  risk_budget: string; include_ai?: boolean; research_ticker?: string; [key: string]: unknown };
type Job = { id: string; symbol: string; asset_type: string; status: string; created: number; include_ai: boolean; error?: string };
type Result = { symbol: string; as_of: string; valid_until: number; basis: string; notes: string[];
  risk_status: string; ai_research?: Record<string, string>; [key: string]: unknown };
type Detail = { id: string; status: string; result: Result | null; error: string | null };
type Instrument = { token: string; symbol: string; exchange: string; expiry: string | null };
const API = '/api/v1/admin/research';
const money = (value: unknown) => value == null ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const date = (value: string | number) => new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
const pending = (status: string) => status === 'QUEUED' || status === 'RUNNING';
const input = 'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-main)]';
const panel = 'rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5';

export function ResearchDashboard({ token }: { token: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [service, setService] = useState<'checking' | 'online' | 'unavailable'>('checking');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [risk, setRisk] = useState('1000');
  const [ai, setAi] = useState(false);
  const [ticker, setTicker] = useState('');
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const alive = useRef(true);
  const requestKey = useRef<{ payload: string; key: string } | null>(null);
  const controllers = useRef(new Set<AbortController>());

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(`${API}${path}`, { ...init, signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers } });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail :
        typeof body.error === 'string' ? body.error : body.error?.message || 'Request failed. Check the snapshot and service configuration.');
      return body;
    } finally { controllers.current.delete(controller); }
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      const data = await request('/jobs');
      if (alive.current) { setJobs(data.jobs); setCounts(data.counts); setService('online'); setError(''); }
    } catch (e) {
      if (alive.current && (e as Error).name !== 'AbortError') { setService('unavailable'); setError((e as Error).message); }
    }
  }, [request]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => { setNow(Date.now()); if (!document.hidden) void refresh(); }, 10000);
    return () => { alive.current = false; clearInterval(timer); controllers.current.forEach(controller => controller.abort()); };
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let timer: number | undefined;
    setDetail(null); setLoading(true);
    const load = async () => {
      try {
        const data: Detail = await request(`/jobs/${selected}`);
        if (cancelled) return;
        setDetail(data); setLoading(false);
        if (pending(data.status)) timer = window.setTimeout(load, 10000);
      } catch (e) {
        if (!cancelled && (e as Error).name !== 'AbortError') { setError((e as Error).message); setLoading(false); }
      }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selected, request]);

  async function importSnapshot(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('Snapshot must be smaller than 1 MB.');
      const data = JSON.parse(await file.text());
      if (!data || typeof data.symbol !== 'string' || typeof data.token !== 'string' ||
          !['stock', 'option'].includes(data.asset_type) || data.source !== 'dhan' ||
          !Array.isArray(data.bars) || data.bars.length < 30 || !Number.isFinite(Date.parse(data.as_of)) ||
          !(Number(data.last_price) > 0) || !(Number(data.tick_size) > 0) || !(Number(data.lot_size) >= 1)) {
        throw new Error('Upload a Dhan snapshot with instrument metadata, a quote and at least 30 completed OHLCV bars.');
      }
      if (!alive.current) return;
      setSnapshot(data); setRisk(String(data.risk_budget || 1000)); setAi(Boolean(data.include_ai));
      setTicker(data.research_ticker || ''); setError(''); requestKey.current = null;
    } catch (e) { if (alive.current) { setSnapshot(null); setError((e as Error).message); } }
  }

  async function searchInstruments() {
    setSearching(true); setError('');
    try {
      const data = await request(`/instruments?q=${encodeURIComponent(search.trim())}`);
      if (alive.current) { setInstruments(data.instruments); if (!data.instruments.length) setError('No active stocks or options match this search.'); }
    } catch (e) { if (alive.current && (e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (alive.current) setSearching(false); }
  }

  async function fetchSnapshot(instrument: Instrument) {
    setFetching(true); setSnapshot(null); setError('');
    try {
      const data = await request('/snapshot', { method: 'POST', body: JSON.stringify({ token: instrument.token }) });
      if (alive.current) { setSnapshot(data); setNow(Date.now()); setInstruments([]); requestKey.current = null; }
    } catch (e) { if (alive.current && (e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (alive.current) setFetching(false); }
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!snapshot || busy) return;
    setBusy(true); setError('');
    const payload = JSON.stringify({ ...snapshot, risk_budget: risk, include_ai: ai, research_ticker: ticker || null });
    if (requestKey.current?.payload !== payload) requestKey.current = { payload, key: crypto.randomUUID() };
    try {
      const data = await request('/jobs', { method: 'POST', body: payload, headers: { 'Idempotency-Key': requestKey.current.key } });
      if (alive.current) { setSelected(data.id); void refresh(); }
    } catch (e) { if (alive.current && (e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (alive.current) setBusy(false); }
  }

  const result = detail?.result;
  const stale = snapshot && (now - Date.parse(snapshot.as_of) > 60000 || Date.parse(snapshot.as_of) > now);
  const expired = result && now / 1000 >= result.valid_until;
  function download() {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `research-${detail.id}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-5 text-[var(--text-main)]">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold flex items-center gap-2"><BookOpen size={22} className="text-emerald-400" />Research Desk</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Stock and options levels · Day Trader Skill + TradingAgents</p></div>
      <div className="flex items-center gap-3"><span role="status" className={`text-xs ${service === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
        {service === 'online' ? 'Research service online' : service === 'checking' ? 'Connecting…' : 'Service unavailable'}</span>
        <button onClick={() => void refresh()} aria-label="Refresh research jobs" className="p-3 rounded-lg border border-[var(--border-color)]"><RefreshCw size={16} /></button></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400 flex gap-2"><AlertTriangle size={18} className="shrink-0" />{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].map(status =>
      <div key={status} className={panel}><p className="text-xs text-[var(--text-muted)]">{status}</p><p className="text-2xl font-semibold tabular-nums mt-1">{service === 'online' ? counts[status] || 0 : '—'}</p></div>)}</div>
    <div className="grid xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-5">
      <form onSubmit={generate} className={`${panel} space-y-4 self-start`}>
        <h2 className="font-semibold">Generate research</h2>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">Search an exact stock or option contract, then load its Dhan quote and completed five-minute candles during market hours.</p>
        <label className="block text-xs space-y-2"><span>Find stock or option contract</span><input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="RELIANCE or NIFTY" minLength={2} maxLength={64} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (search.trim().length >= 2 && !searching) void searchInstruments(); } }} /></label>
        <button type="button" onClick={() => void searchInstruments()} disabled={search.trim().length < 2 || searching || fetching} className="min-h-11 w-full rounded-lg border border-[var(--border-color)] text-sm disabled:opacity-40">{searching ? 'Searching…' : 'Search instruments'}</button>
        {fetching && <p role="status" className="text-xs text-emerald-400">Loading verified Dhan data…</p>}
        {!!instruments.length && <div className="max-h-64 overflow-y-auto space-y-2" aria-label="Instrument search results">{instruments.map(instrument => <button type="button" key={instrument.token} disabled={fetching} onClick={() => void fetchSnapshot(instrument)} className="w-full text-left border border-[var(--border-color)] rounded-lg p-3 disabled:opacity-40"><span className="block text-sm font-semibold break-words">{instrument.symbol}</span><span className="block text-xs text-[var(--text-muted)]">{instrument.exchange}{instrument.expiry ? ` · ${instrument.expiry}` : ''} · Load snapshot</span></button>)}</div>}
        <details><summary className="cursor-pointer text-xs text-[var(--text-muted)] py-2">Advanced: import snapshot file</summary><label className="block rounded-lg border border-dashed border-[var(--border-color)] p-4 cursor-pointer hover:border-emerald-500">
          <span className="flex items-center gap-2 text-sm"><Upload size={17} />Import snapshot JSON</span>
          <input aria-label="Import Dhan snapshot JSON" type="file" accept=".json,application/json" className="mt-3 w-full text-xs" onChange={e => { void importSnapshot(e.target.files?.[0]); e.target.value = ''; }} />
        </label></details>
        {snapshot && <dl className="text-xs space-y-2 break-words">{[
          ['Instrument', `${snapshot.symbol} · ${snapshot.asset_type}`], ['Token', snapshot.token],
          ['Quote', `₹${money(snapshot.last_price)}`], ['Lot / tick', `${snapshot.lot_size} / ₹${snapshot.tick_size}`],
          ['Completed bars', snapshot.bars.length], ['Snapshot (IST)', date(snapshot.as_of)],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>}
        {stale && <p role="status" className="text-xs text-amber-400">Snapshot is stale or future dated. Import a current snapshot before generating.</p>}
        <label className="block text-xs space-y-2"><span>Risk budget at planned stop (₹)</span><input className={input} type="number" min="1" max="1000000" step="0.01" required value={risk} onChange={e => setRisk(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)} />Include AI company research</label>
        {ai && <><label className="block text-xs space-y-2"><span>Underlying provider ticker</span><input required className={input} value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="e.g. RELIANCE.NS" /></label>
          <p className="text-xs text-[var(--text-muted)]">Requires configured model credentials. Company research is separate from option premium levels and may take several minutes.</p></>}
        <button disabled={!snapshot || Boolean(stale) || busy || service !== 'online'} className="w-full min-h-11 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm flex justify-center items-center gap-2 disabled:opacity-40"><Play size={16} />{busy ? 'Submitting…' : 'Generate research'}</button>
        <p className="text-xs text-[var(--text-muted)]">Draft research only. No orders or client messages are sent.</p>
      </form>
      <div className="min-w-0 space-y-5">
        <section className={panel} aria-label="Research job history"><h2 className="font-semibold mb-3">Recent research <span className="text-xs font-normal text-[var(--text-muted)]">Latest 50 jobs</span></h2>
          {!jobs.length && <p className="text-sm text-[var(--text-muted)] py-5">{service === 'online' ? 'No reports yet. Load an instrument snapshot to create your first research job.' : 'Connect the research service to load reports.'}</p>}
          <div className="max-h-72 overflow-y-auto space-y-2">{jobs.map(job => <button key={job.id} onClick={() => setSelected(job.id)} aria-pressed={selected === job.id}
            className={`w-full text-left p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 ${selected === job.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-[var(--border-color)]'}`}>
            <span><span className="font-semibold text-sm">{job.symbol}</span><span className="ml-2 text-xs text-[var(--text-muted)]">{job.asset_type}{job.include_ai ? ' + AI' : ''}</span><span className="block text-xs text-[var(--text-muted)] mt-1">{date(job.created)} IST</span></span>
            <span className={`text-xs ${job.status === 'FAILED' ? 'text-red-400' : 'text-emerald-400'}`}>{job.status}</span></button>)}</div>
        </section>
        <section className={panel} aria-label="Research report"><div className="flex flex-wrap justify-between items-center gap-2"><h2 className="font-semibold">Research report</h2>
          {detail && <button onClick={download} className="text-xs min-h-11 flex items-center gap-2"><Download size={16} />Export JSON</button>}</div>
          {!selected ? <p className="text-sm text-[var(--text-muted)] py-6">Select a job to inspect its levels and research.</p> : loading ? <p role="status" className="py-6 text-sm">Loading report…</p> : detail && <>
            <p className="text-xs text-[var(--text-muted)] my-3 break-all">Job {detail.id} · {detail.status}</p>
            {pending(detail.status) && <p role="status" className="text-sm py-4">{detail.status === 'QUEUED' ? 'Waiting for the research worker.' : 'Generating research. This panel updates automatically.'}</p>}
            {detail.error && <p role="alert" className="text-sm text-red-400">{detail.error}</p>}
            {result && <><div className="flex flex-wrap justify-between gap-2 my-4"><h3 className="font-semibold">{result.symbol} · {result.basis}</h3><span className="text-xs text-amber-400">{expired ? 'EXPIRED LEVELS' : 'DRAFT · REVIEW REQUIRED'}</span></div>
              <p className="text-xs text-[var(--text-muted)] mb-4">As of {date(result.as_of)} IST · Valid until {date(result.valid_until)} IST</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[
                ['Entry above', result.entry_above], ['Stop loss', result.stop_loss], ['Target', result.target],
                ['Support', result.support], ['Resistance', result.resistance], ['ATR (14)', result.atr14],
              ].map(([label, value]) => <div key={String(label)} className="p-3 rounded-lg bg-[var(--bg-main)]"><p className="text-xs text-[var(--text-muted)]">{String(label)}</p><p className="font-semibold tabular-nums mt-1">₹{money(value)}</p></div>)}</div>
              <p className="text-sm mt-4">Quantity at planned stop: <span className="tabular-nums font-semibold">{String(result.max_quantity_at_stop)}</span> · Reward/risk: {money(result.reward_risk)}R</p>
              {result.risk_status === 'INSUFFICIENT_RISK_BUDGET' && <p className="text-amber-400 text-sm mt-2">Risk budget cannot cover one lot at this stop.</p>}
              <div className="mt-4 text-xs text-[var(--text-muted)] space-y-1">{result.notes.map(note => <p key={note}>{note}</p>)}</div>
              {result.ai_research && <div className="mt-6 space-y-4"><h3 className="font-semibold">AI company research</h3>{Object.entries(result.ai_research).map(([key, value]) => <div key={key}><h4 className="text-xs uppercase tracking-wide text-emerald-400 mb-2">{key.replace(/_/g, ' ')}</h4><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{value || 'No content returned.'}</p></div>)}</div>}
            </>}
          </>}
        </section>
      </div>
    </div>
  </div>;
}
