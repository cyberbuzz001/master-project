import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../db/schema';
import { authenticateToken, checkPermission, checkRole, AuthenticatedRequest } from '../middleware/auth';
import { aiResearchEngine, ReportCategory } from '../services/AiResearchEngine';
import { researchDistributionService, DistributionChannel } from '../services/ResearchDistributionService';

export const researchRouter = Router();

// =============================================================================
// PUBLIC & CLIENT ENDPOINTS
// =============================================================================

/**
 * GET /api/v1/research/reports
 * Query published research reports with optional filtering.
 */
researchRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const { category, sentiment, limit = '20', offset = '0' } = req.query;
    const l = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const o = Math.max(0, parseInt(offset as string, 10) || 0);

    let whereClause = `WHERE status = 'PUBLISHED'`;
    const params: any[] = [];

    if (category && category !== 'All Reports') {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (sentiment) {
      params.push(sentiment);
      whereClause += ` AND sentiment = $${params.length}`;
    }

    params.push(l, o);
    const sql = `
      SELECT id, report_code, category, title, summary, timeframe, sentiment, author,
             compliance_id, read_time, tags, metrics, content, recommendations, disclosures,
             published_at, created_at
      FROM research_reports
      ${whereClause}
      ORDER BY published_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const reports = await query<any>(sql, params);
    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) as count FROM research_reports ${whereClause.replace(`LIMIT $${params.length - 1} OFFSET $${params.length}`, '')}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      success: true,
      data: reports,
      meta: {
        total: parseInt(totalRow?.count || '0', 10),
        limit: l,
        offset: o
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/research/reports/latest
 * Fetch latest pre-market, post-market, and stock reports for quick display.
 */
researchRouter.get('/reports/latest', async (req: Request, res: Response) => {
  try {
    const latestReports = await query<any>(
      `SELECT id, report_code, category, title, summary, timeframe, sentiment, author,
              metrics, content, recommendations, published_at
       FROM research_reports
       WHERE status = 'PUBLISHED'
       ORDER BY published_at DESC
       LIMIT 5`
    );

    res.json({
      success: true,
      data: latestReports
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/research/reports/:id
 * Fetch detailed report by ID or report_code.
 */
researchRouter.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await queryOne<any>(
      `SELECT * FROM research_reports WHERE id = $1 OR report_code = $1`,
      [id]
    );

    if (!report) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Research report not found' } });
      return;
    }

    res.json({
      success: true,
      data: report
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

/**
 * GET /api/v1/research/feed
 * Next.js Advisory Portal compatible feed endpoint.
 */
researchRouter.get('/feed', async (req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT id as uuid, report_code, title, summary, category, category as report_type,
              published_at, valid_until, author, recommendations
       FROM research_reports
       WHERE status = 'PUBLISHED'
       ORDER BY published_at DESC
       LIMIT 30`
    );

    res.json({
      active_subscription: true,
      reports: rows
    });
  } catch (err: any) {
    res.status(500).json({ active_subscription: false, reports: [], error: err.message });
  }
});

// =============================================================================
// ADMIN & RESEARCH DESK ENDPOINTS
// =============================================================================

/**
 * POST /api/v1/research/admin/generate
 * Trigger AI research report generation on demand.
 */
researchRouter.post(
  '/admin/generate',
  authenticateToken,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ANALYST']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        category = 'Pre-market report',
        symbol = 'NIFTY',
        exchange = 'NSE',
        customPrompt,
        autoPublish = true,
        autoDispatch = true
      } = req.body;

      // 1. Generate Report with AI
      const report = await aiResearchEngine.generateReport({
        category: category as ReportCategory,
        symbol,
        exchange,
        customPrompt,
        autoPublish
      });

      // 2. If autoDispatch is true and status is PUBLISHED, distribute to clients
      let distributionResult = null;
      if (autoPublish && autoDispatch) {
        distributionResult = await researchDistributionService.distributeReport(report.id);
      }

      res.status(201).json({
        success: true,
        message: `Research report generated successfully [${report.reportCode}]`,
        data: {
          report,
          distribution: distributionResult
        }
      });
    } catch (err: any) {
      console.error('[ResearchRoutes] Generate error:', err);
      res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: err.message } });
    }
  }
);

/**
 * POST /api/v1/research/admin/publish/:id
 * Approve & publish a drafted or generated report.
 */
researchRouter.post(
  '/admin/publish/:id',
  authenticateToken,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ANALYST']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { dispatchToClients = true } = req.body;

      const report = await queryOne<any>(
        `UPDATE research_reports
         SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW()
         WHERE id = $1 OR report_code = $1
         RETURNING *`,
        [id]
      );

      if (!report) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } });
        return;
      }

      let distributionResult = null;
      if (dispatchToClients) {
        distributionResult = await researchDistributionService.distributeReport(report.id);
      }

      res.json({
        success: true,
        message: `Report ${report.report_code} published successfully`,
        data: {
          report,
          distribution: distributionResult
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'PUBLISH_FAILED', message: err.message } });
    }
  }
);

/**
 * POST /api/v1/research/admin/dispatch/:id
 * Manually trigger or re-trigger distribution of a report.
 */
researchRouter.post(
  '/admin/dispatch/:id',
  authenticateToken,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ANALYST']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const { channels } = req.body; // e.g. ['WHATSAPP', 'EMAIL', 'WEBSOCKET', 'IN_APP']

      const activeChannels: DistributionChannel[] =
        Array.isArray(channels) && channels.length > 0
          ? channels
          : ['WEBSOCKET', 'IN_APP', 'WHATSAPP', 'EMAIL'];

      const result = await researchDistributionService.distributeReport(id, activeChannels);

      res.json({
        success: true,
        message: `Report dispatched across channels`,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'DISPATCH_FAILED', message: err.message } });
    }
  }
);

/**
 * GET /api/v1/research/admin/distributions/:id
 * View delivery logs for a specific report.
 */
researchRouter.get(
  '/admin/distributions/:id',
  authenticateToken,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ANALYST']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const rows = await query<any>(
        `SELECT * FROM research_distributions WHERE report_id = $1 ORDER BY sent_at DESC LIMIT 200`,
        [id]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }
);

/**
 * GET /api/v1/research/admin/analytics
 * View overall research generation and distribution analytics.
 */
researchRouter.get(
  '/admin/analytics',
  authenticateToken,
  checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ANALYST']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [totalReports, publishedReports, distributionStats] = await Promise.all([
        queryOne<any>(`SELECT COUNT(*) as count FROM research_reports`),
        queryOne<any>(`SELECT COUNT(*) as count FROM research_reports WHERE status = 'PUBLISHED'`),
        query<any>(
          `SELECT channel, status, COUNT(*) as count FROM research_distributions GROUP BY channel, status`
        )
      ]);

      res.json({
        success: true,
        data: {
          totalReports: parseInt(totalReports?.count || '0', 10),
          publishedReports: parseInt(publishedReports?.count || '0', 10),
          distributions: distributionStats
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }
);
