import { query, queryOne, execute, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { AdvisoryWhatsAppService } from './AdvisoryWhatsAppService';
import { EmailService } from './EmailService';
import { broadcastToAllClients } from '../websocket/server';

export type DistributionChannel = 'WHATSAPP' | 'EMAIL' | 'WEBSOCKET' | 'IN_APP';

export interface DistributionResult {
  reportId: string;
  reportCode: string;
  totalRecipients: number;
  channelBreakdown: Record<DistributionChannel, { attempted: number; sent: number; failed: number }>;
}

export class ResearchDistributionService {
  private static instance: ResearchDistributionService;

  private constructor() {}

  public static getInstance(): ResearchDistributionService {
    if (!ResearchDistributionService.instance) {
      ResearchDistributionService.instance = new ResearchDistributionService();
    }
    return ResearchDistributionService.instance;
  }

  /**
   * Dispatches a published research report to clients across all configured channels.
   */
  public async distributeReport(
    reportIdOrCode: string,
    channels: DistributionChannel[] = ['WEBSOCKET', 'IN_APP', 'WHATSAPP', 'EMAIL']
  ): Promise<DistributionResult> {
    const report = await queryOne<any>(
      `SELECT * FROM research_reports WHERE id = $1 OR report_code = $1`,
      [reportIdOrCode]
    );

    if (!report) {
      throw new Error(`Report not found: ${reportIdOrCode}`);
    }

    const reportUrl = `${process.env.APP_BASE_URL || 'https://tradegrowx.in'}/research/${report.id}`;
    const result: DistributionResult = {
      reportId: report.id,
      reportCode: report.report_code,
      totalRecipients: 0,
      channelBreakdown: {
        WEBSOCKET: { attempted: 0, sent: 0, failed: 0 },
        IN_APP: { attempted: 0, sent: 0, failed: 0 },
        WHATSAPP: { attempted: 0, sent: 0, failed: 0 },
        EMAIL: { attempted: 0, sent: 0, failed: 0 }
      }
    };

    // ── 1. Real-Time WebSocket Broadcast ──────────────────────────────────────
    if (channels.includes('WEBSOCKET')) {
      try {
        result.channelBreakdown.WEBSOCKET.attempted = 1;
        broadcastToAllClients({
          type: 'RESEARCH_REPORT_PUBLISHED',
          channel: 'advisory:broadcast',
          data: {
            id: report.id,
            reportCode: report.report_code,
            category: report.category,
            title: report.title,
            summary: report.summary,
            sentiment: report.sentiment,
            publishedAt: report.published_at,
            metrics: report.metrics,
            content: report.content,
            recommendations: report.recommendations
          }
        });

        await execute(
          `INSERT INTO research_distributions (id, report_id, channel, destination, status, sent_at)
           VALUES ($1, $2, 'WEBSOCKET', 'ALL_CONNECTED_CLIENTS', 'DELIVERED', NOW())`,
          ['dist_ws_' + generateUUID(), report.id]
        );
        result.channelBreakdown.WEBSOCKET.sent = 1;
      } catch (err: any) {
        console.warn('[ResearchDistributionService] WebSocket broadcast error:', err.message);
        result.channelBreakdown.WEBSOCKET.failed = 1;
      }
    }

    // ── 2. In-App Notifications ──────────────────────────────────────────────
    if (channels.includes('IN_APP')) {
      try {
        const users = await query<any>(
          `SELECT id, username FROM users WHERE status = 'ACTIVE' LIMIT 500`
        );
        result.channelBreakdown.IN_APP.attempted = users.length;

        for (const u of users) {
          try {
            await execute(
              `INSERT INTO notifications (id, user_id, type, title, body, metadata)
               VALUES ($1, $2, 'RESEARCH_REPORT', $3, $4, $5)`,
              [
                'notif_' + generateUUID(),
                u.id,
                `Research Report: ${report.title}`,
                report.summary,
                JSON.stringify({ reportId: report.id, reportCode: report.report_code, category: report.category })
              ]
            );

            await execute(
              `INSERT INTO research_distributions (id, report_id, recipient_id, recipient_name, channel, destination, status, sent_at)
               VALUES ($1, $2, $3, $4, 'IN_APP', $5, 'SENT', NOW())`,
              ['dist_inapp_' + generateUUID(), report.id, u.id, u.username, u.id]
            );
            result.channelBreakdown.IN_APP.sent++;
          } catch (_) {
            result.channelBreakdown.IN_APP.failed++;
          }
        }
      } catch (err: any) {
        console.warn('[ResearchDistributionService] In-App notification error:', err.message);
      }
    }

    // ── 3. WhatsApp Direct Notification ──────────────────────────────────────
    if (channels.includes('WHATSAPP')) {
      const waToggle = await queryOne<any>(
        `SELECT value FROM system_settings WHERE key = 'AI_RESEARCH_AUTO_DISPATCH_WHATSAPP'`
      );
      const isWaEnabled = waToggle ? waToggle.value !== 'false' : true;

      if (isWaEnabled) {
        try {
          // Query active users and converted advisory leads with mobile numbers
          const waRecipients = await query<any>(
            `SELECT id, phone, COALESCE(full_name, username) as name FROM users 
             WHERE status = 'ACTIVE' AND phone IS NOT NULL AND LENGTH(phone) >= 10
             UNION
             SELECT id::TEXT, phone, full_name as name FROM warroom.leads 
             WHERE status IN ('WARM', 'HOT', 'CONVERTED') AND phone IS NOT NULL AND LENGTH(phone) >= 10
             LIMIT 100`
          );

          result.channelBreakdown.WHATSAPP.attempted = waRecipients.length;
          const advisoryWa = AdvisoryWhatsAppService.getInstance();

          for (const recipient of waRecipients) {
            try {
              const res = await advisoryWa.triggerResearchReportDispatch(
                recipient.phone,
                recipient.id,
                report.title,
                reportUrl
              );

              const status = res.success ? 'SENT' : 'FAILED';
              await execute(
                `INSERT INTO research_distributions (id, report_id, recipient_id, recipient_name, channel, destination, status, external_message_id, error_message, sent_at)
                 VALUES ($1, $2, $3, $4, 'WHATSAPP', $5, $6, $7, $8, NOW())`,
                [
                  'dist_wa_' + generateUUID(),
                  report.id,
                  recipient.id,
                  recipient.name,
                  recipient.phone,
                  status,
                  res.messageId || null,
                  res.error || null
                ]
              );

              if (res.success) {
                result.channelBreakdown.WHATSAPP.sent++;
              } else {
                result.channelBreakdown.WHATSAPP.failed++;
              }
            } catch (recipientErr: any) {
              result.channelBreakdown.WHATSAPP.failed++;
            }
          }
        } catch (err: any) {
          console.warn('[ResearchDistributionService] WhatsApp dispatch error:', err.message);
        }
      }
    }

    // ── 4. Email Direct Notification ─────────────────────────────────────────
    if (channels.includes('EMAIL')) {
      const emailToggle = await queryOne<any>(
        `SELECT value FROM system_settings WHERE key = 'AI_RESEARCH_AUTO_DISPATCH_EMAIL'`
      );
      const isEmailEnabled = emailToggle ? emailToggle.value !== 'false' : true;

      if (isEmailEnabled) {
        try {
          const emailRecipients = await query<any>(
            `SELECT id, email, COALESCE(full_name, username) as name FROM users 
             WHERE status = 'ACTIVE' AND email IS NOT NULL AND email LIKE '%@%'
             LIMIT 100`
          );

          result.channelBreakdown.EMAIL.attempted = emailRecipients.length;
          const emailService = EmailService.getInstance();

          const reportContent = typeof report.content === 'string' ? JSON.parse(report.content) : report.content;
          const reportMetrics = typeof report.metrics === 'string' ? JSON.parse(report.metrics) : report.metrics;

          for (const recipient of emailRecipients) {
            try {
              const res = await emailService.sendResearchReportEmail(
                recipient.email,
                recipient.name || 'Valued Trader',
                {
                  title: report.title,
                  category: report.category,
                  summary: report.summary,
                  sentiment: report.sentiment,
                  timeframe: report.timeframe,
                  complianceId: report.compliance_id,
                  publishedAt: new Date(report.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                  metrics: reportMetrics,
                  technicalLevels: reportContent?.technicalLevels,
                  keyObservations: reportContent?.keyObservations,
                  actionableTakeaway: reportContent?.actionableTakeaway,
                  reportUrl
                }
              );

              const status = res.success ? 'SENT' : 'FAILED';
              await execute(
                `INSERT INTO research_distributions (id, report_id, recipient_id, recipient_name, channel, destination, status, error_message, sent_at)
                 VALUES ($1, $2, $3, $4, 'EMAIL', $5, $6, $7, NOW())`,
                [
                  'dist_em_' + generateUUID(),
                  report.id,
                  recipient.id,
                  recipient.name,
                  recipient.email,
                  status,
                  res.error || null
                ]
              );

              if (res.success) {
                result.channelBreakdown.EMAIL.sent++;
              } else {
                result.channelBreakdown.EMAIL.failed++;
              }
            } catch (recipientErr: any) {
              result.channelBreakdown.EMAIL.failed++;
            }
          }
        } catch (err: any) {
          console.warn('[ResearchDistributionService] Email dispatch error:', err.message);
        }
      }
    }

    result.totalRecipients =
      result.channelBreakdown.WHATSAPP.sent +
      result.channelBreakdown.EMAIL.sent +
      result.channelBreakdown.IN_APP.sent;

    console.log(
      `[ResearchDistributionService] 🚀 Report ${report.report_code} distributed: ` +
      `WA: ${result.channelBreakdown.WHATSAPP.sent}/${result.channelBreakdown.WHATSAPP.attempted}, ` +
      `Email: ${result.channelBreakdown.EMAIL.sent}/${result.channelBreakdown.EMAIL.attempted}, ` +
      `InApp: ${result.channelBreakdown.IN_APP.sent}/${result.channelBreakdown.IN_APP.attempted}`
    );

    return result;
  }
}

export const researchDistributionService = ResearchDistributionService.getInstance();
