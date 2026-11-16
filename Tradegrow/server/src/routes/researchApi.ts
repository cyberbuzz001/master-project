import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, checkRole } from '../middleware/auth';
import { query } from '../db/schema';
import { buildResearchSnapshot } from '../services/ResearchSnapshotService';

const router = Router();
router.use(authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'ANALYST']));
router.use(rateLimit({ windowMs: 60_000, limit: 20 }));

async function proxy(req: any, res: any, path: string, method = 'GET') {
  const endpoint = process.env.RESEARCH_SERVICE_URL;
  const key = process.env.RESEARCH_API_KEY;
  if (!endpoint || !key) {
    res.status(503).json({ error: 'Research service is not configured' });
    return;
  }
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
      method, signal: AbortSignal.timeout(10_000), redirect: 'error',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        ...(method === 'POST' ? { 'Idempotency-Key': req.get('Idempotency-Key') || '' } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
    });
    res.status(response.status).json(await response.json());
  } catch {
    res.status(502).json({ error: 'Research service unavailable' });
  }
}

router.get('/health', (req, res) => proxy(req, res, '/health'));
router.get('/instruments', async (req, res) => {
  const search = String(req.query.q || '').trim();
  if (search.length < 2 || search.length > 64) { res.status(400).json({ error: 'Enter 2–64 search characters' }); return; }
  try {
    const instruments = await query(`SELECT instrument_token AS token, trading_symbol AS symbol, exchange,
      option_type, to_char(expiry, 'YYYY-MM-DD') AS expiry FROM instruments
      WHERE active=true AND exchange IN ('NSE','BSE','NFO','BFO')
      AND (option_type IN ('CE','PE') OR instrument_type IN ('EQ','EQUITY'))
      AND trading_symbol ILIKE $1 ORDER BY trading_symbol LIMIT 20`, [`%${search.replace(/[%_\\]/g, '\\$&')}%`]);
    res.json({ instruments });
  } catch { res.status(503).json({ error: 'Instrument search unavailable' }); }
});
router.post('/snapshot', async (req, res) => {
  if (typeof req.body.token !== 'string' || req.body.token.length > 100) { res.status(400).json({ error: 'Select an instrument' }); return; }
  try { res.json(await buildResearchSnapshot(req.body.token)); }
  catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Dhan snapshot unavailable' }); }
});
router.get('/jobs', (req, res) => proxy(req, res, '/jobs'));
router.post('/jobs', (req, res) => proxy(req, res, '/jobs', 'POST'));
router.get('/jobs/:id', (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(String(req.params.id))) {
    res.status(400).json({ error: 'Invalid research job ID' });
    return;
  }
  return proxy(req, res, `/jobs/${req.params.id}`);
});
export default router;
