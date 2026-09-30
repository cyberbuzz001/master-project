import crypto from 'crypto';
import { query, queryOne, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { WhatsAppAutomationService } from './WhatsAppAutomationService';

export interface IngestLeadInput {
  phone: string;
  fullName?: string;
  email?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrerUrl?: string;
  referralCode?: string;
  creatorCode?: string;
  consentWhatsApp?: boolean;
  userIp?: string;
  userAgent?: string;
}

export interface IngestLeadResult {
  success: boolean;
  leadCode: string;
  stage: string;
  isExisting: boolean;
  onboardingUrl: string;
  leadId: string;
}

export interface WarRoomDashboardData {
  goal: {
    targetUsers: number;
    currentActivated: number;
    remainingUsers: number;
    completionPercentage: number;
    daysRemaining: number;
    requiredDailyRunRate: number;
    currentDailyRunRate: number;
  };
  economics: {
    totalBudgetPaisa: number;
    totalSpentPaisa: number;
    currentCpauPaisa: number;
    targetCpauPaisa: number;
    cpauVariancePct: number;
  };
  todayPacing: {
    date: string;
    targetLeads: number;
    actualLeads: number;
    targetKyc: number;
    actualKyc: number;
    targetActivations: number;
    actualActivations: number;
    varianceActivations: number;
    status: string;
  };
  funnelSummary: {
    totalLeads: number;
    kycStarted: number;
    kycCompleted: number;
    approvedAccounts: number;
    activatedUsers: number;
  };
  channelBreakdown: Array<{
    channel: string;
    leads: number;
    activations: number;
    spentPaisa: number;
    cpauPaisa: number;
  }>;
  alerts: Array<{
    id: string;
    severity: 'RED' | 'YELLOW' | 'GREEN';
    title: string;
    message: string;
    recommendation: string;
  }>;
}

export class WarRoomService {
  private static instance: WarRoomService;

  public static getInstance(): WarRoomService {
    if (!WarRoomService.instance) {
      WarRoomService.instance = new WarRoomService();
    }
    return WarRoomService.instance;
  }

  /**
   * Normalize an Indian mobile phone number to standard E.164 (+91XXXXXXXXXX)
   */
  public normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    return `+${digits}`;
  }

  /**
   * One-way cryptographic hash of IP address for DPDP Act 2023 compliance
   */
  public hashIp(ip?: string): string {
    if (!ip) return 'anonymous';
    return crypto.createHash('sha256').update(ip + '_tg_salt_2026').digest('hex');
  }

  /**
   * Ingest a lead from the Trust Website, Creator Landers, or Ad Campaigns
   */
  public async ingestLead(input: IngestLeadInput): Promise<IngestLeadResult> {
    const phoneE164 = this.normalizePhone(input.phone);
    const ipHash = this.hashIp(input.userIp);
    const sessionId = 'sess_' + generateUUID().slice(0, 16);
    const source = input.source || 'TRUST_WEBSITE';
    const landingPage = input.landingPage || 'https://tradegrow.in';

    const res = await withTransaction(async (client) => {
      // 1. Check for existing active lead
      const existing = await client.query(
        `SELECT id, lead_code, stage, score FROM warroom.leads 
         WHERE phone_e164 = $1 AND is_deleted = FALSE LIMIT 1`,
        [phoneE164]
      );

      let leadId: string;
      let leadCode: string;
      let stage: string;
      let isExisting = false;

      if (existing.rows.length > 0) {
        leadId = existing.rows[0].id;
        leadCode = existing.rows[0].lead_code;
        stage = existing.rows[0].stage;
        isExisting = true;

        // Bump intent score on repeated engagement
        await client.query(
          `UPDATE warroom.leads SET score = score + 5, updated_at = clock_timestamp() WHERE id = $1`,
          [leadId]
        );
      } else {
        leadId = generateUUID();
        leadCode = 'LD-' + Date.now().toString().slice(-6);
        stage = 'NEW';

        await client.query(
          `INSERT INTO warroom.leads (
            id, lead_code, phone_e164, email, full_name, source, stage, score, consent_whatsapp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 20, $8)`,
          [
            leadId,
            leadCode,
            phoneE164,
            input.email ? input.email.trim().toLowerCase() : null,
            input.fullName ? input.fullName.trim() : null,
            source,
            stage,
            input.consentWhatsApp !== false
          ]
        );

        // Record initial state transition
        await client.query(
          `INSERT INTO warroom.lead_events (lead_id, from_stage, to_stage, actor, notes)
           VALUES ($1, NULL, 'NEW', 'INGRESS_API', 'Lead captured via ' || $2)`,
          [leadId, source]
        );

        // Update WhatsApp contacts opt-in table
        await client.query(
          `INSERT INTO warroom.whatsapp_contacts (phone_e164, opt_in)
           VALUES ($1, $2)
           ON CONFLICT (phone_e164) DO UPDATE SET opt_in = EXCLUDED.opt_in, last_message_at = clock_timestamp()`,
          [phoneE164, input.consentWhatsApp !== false]
        );

        // Increment today's actual leads in daily pacing
        await client.query(
          `UPDATE warroom.daily_pacing 
           SET actual_leads = actual_leads + 1, updated_at = clock_timestamp()
           WHERE pacing_date = CURRENT_DATE`
        );
      }

      // 2. Record immutable touchpoint
      const touchpointRes = await client.query(
        `INSERT INTO warroom.touchpoints (
          session_id, lead_id, channel, utm_source, utm_medium, utm_campaign, 
          utm_term, utm_content, landing_page, referrer_url, ip_hash, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          sessionId,
          leadId,
          input.utmSource ? input.utmSource.toUpperCase() : 'ORGANIC',
          input.utmSource || null,
          input.utmMedium || null,
          input.utmCampaign || null,
          input.utmTerm || null,
          input.utmContent || null,
          landingPage,
          input.referrerUrl || null,
          ipHash,
          input.userAgent || null
        ]
      );

      const touchpointId = touchpointRes.rows[0]?.id;

      // Update lead with touchpoint references
      if (!isExisting && touchpointId) {
        await client.query(
          `UPDATE warroom.leads SET first_touchpoint_id = $1, last_touchpoint_id = $1 WHERE id = $2`,
          [touchpointId, leadId]
        );
      } else if (touchpointId) {
        await client.query(
          `UPDATE warroom.leads SET last_touchpoint_id = $1 WHERE id = $2`,
          [touchpointId, leadId]
        );
      }

      // If creator or referral code provided, register interaction
      if (input.referralCode) {
        await client.query(
          `UPDATE warroom.referral_codes SET total_clicks = total_clicks + 1 WHERE code = $1`,
          [input.referralCode]
        );
      }
      if (input.creatorCode) {
        await client.query(
          `UPDATE warroom.creators SET total_leads = total_leads + 1 WHERE creator_code = $1`,
          [input.creatorCode]
        );
      }

      return {
        success: true,
        leadId,
        leadCode,
        stage,
        isExisting,
        onboardingUrl: `https://tradegrow.in/open-account?lead=${leadCode}`
      };
    });

    // Auto-trigger WhatsApp Welcome sequence if new lead and consented
    if (res.success && !res.isExisting && input.consentWhatsApp !== false) {
      WhatsAppAutomationService.getInstance()
        .triggerLeadWelcome(phoneE164, res.leadId, input.fullName)
        .catch((err) => console.warn(`[WarRoom] Auto WhatsApp lead welcome failed: ${err.message}`));
    }

    // Cross-system synchronization: Sync lead to System A (Expert Stocks CRM)
    if (res.success && !res.isExisting) {
      this.syncLeadToExpertAdvisoryCRM(input, phoneE164, res.leadCode)
        .catch((err) => console.warn(`[WarRoom] CRM lead sync notice: ${err.message}`));
    }

    return res;
  }

  /**
   * Synchronize captured lead into System A (Expert Stocks Laravel CRM)
   */
  public async syncLeadToExpertAdvisoryCRM(input: IngestLeadInput, phoneE164: string, leadCode: string): Promise<void> {
    const crmBaseUrl = process.env.EXPERT_ADVISORY_API_URL || 'http://localhost:8000/api/v1';
    const crmUrl = `${crmBaseUrl.replace(/\/$/, '')}/public/leads`;

    try {
      const payload = {
        full_name: input.fullName || `Lead ${leadCode}`,
        mobile: phoneE164,
        email: input.email || undefined,
        form_key: 'landing_page',
        trading_experience: 'none',
        capital_range: '1l_5l',
        consents: {
          data_processing: true,
          whatsapp: input.consentWhatsApp !== false,
          calls: true
        },
        attribution: {
          utm_source: input.utmSource || 'TRADE_GROW_TRUST_WEBSITE',
          utm_medium: input.utmMedium || 'WEB',
          utm_campaign: input.utmCampaign || '1000_USERS_WAR_ROOM',
          utm_term: input.utmTerm || undefined,
          utm_content: input.utmContent || undefined,
          landing_page: input.landingPage || 'https://tradegrow.in',
          referrer: input.referrerUrl || undefined,
          referral_code: input.referralCode || undefined
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(crmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'TradeGrow-Integration-Bridge/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        console.log(`[WarRoom] ✅ Successfully synchronized lead ${leadCode} (${phoneE164}) to Expert Stocks CRM!`);
      } else {
        console.warn(`[WarRoom] ℹ️ CRM sync responded with status ${resp.status}`);
      }
    } catch (err: any) {
      console.log(`[WarRoom] ℹ️ CRM sync to Expert Stocks queued/offline (${err.message}). Lead recorded safely in Trade Grow.`);
    }
  }

  /**
   * Record User Activation when First Meaningful Action (FMA) / Order is filled
   */
  public async recordActivation(
    userId: string,
    orderId?: string,
    actionType: string = 'FIRST_ORDER_FILLED'
  ): Promise<{ activated: boolean; milestoneIndex: number }> {
    const actResult = await withTransaction(async (client) => {
      // Check if already activated
      const existing = await client.query(
        `SELECT milestone_index FROM warroom.activation_records WHERE user_id = $1`,
        [userId]
      );

      if (existing.rows.length > 0) {
        return { activated: false, milestoneIndex: existing.rows[0].milestone_index };
      }

      // Calculate next milestone index
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(milestone_index), 0) + 1 AS next_index FROM warroom.activation_records`
      );
      const milestoneIndex = parseInt(maxRes.rows[0].next_index, 10);

      // Insert activation record
      await client.query(
        `INSERT INTO warroom.activation_records (
          user_id, milestone_index, first_meaningful_action, reference_order_id, activated_at
        ) VALUES ($1, $2, $3, $4, clock_timestamp())`,
        [userId, milestoneIndex, actionType, orderId || null]
      );

      // Increment today's pacing activations and cumulative count
      await client.query(
        `UPDATE warroom.daily_pacing 
         SET actual_activations = actual_activations + 1,
             cumulative_activations = cumulative_activations + 1,
             updated_at = clock_timestamp()
         WHERE pacing_date = CURRENT_DATE`
      );

      // Update lead stage if converted
      await client.query(
        `UPDATE warroom.leads 
         SET stage = 'ACTIVATED', score = 100, updated_at = clock_timestamp() 
         WHERE converted_user_id = $1`,
        [userId]
      );

      // Qualify any pending referral reward
      const refReward = await client.query(
        `UPDATE warroom.referral_rewards 
         SET status = 'QUALIFIED' 
         WHERE referee_user_id = $1 AND status = 'PENDING'
         RETURNING referral_code_id`,
        [userId]
      );

      if (refReward.rows.length > 0) {
        await client.query(
          `UPDATE warroom.referral_codes 
           SET total_activations = total_activations + 1 
           WHERE id = $1`,
          [refReward.rows[0].referral_code_id]
        );
      }

      console.log(`[WarRoom] 🎯 MILESTONE ACTIVATION! User ${userId} is Activated User #${milestoneIndex} of 1,000!`);
      return { activated: true, milestoneIndex };
    });

    if (actResult.activated) {
      // Send milestone celebration via WhatsApp if user phone exists
      queryOne<{ phone?: string }>(`SELECT phone FROM users WHERE id = $1`, [userId])
        .then((u) => {
          if (u?.phone) {
            WhatsAppAutomationService.getInstance()
              .triggerFirstTradeActivationCelebration(u.phone, userId, actResult.milestoneIndex)
              .catch((err) => console.warn(`[WarRoom] Milestone celebration trigger error: ${err.message}`));
          }
        })
        .catch(() => {});
    }

    return actResult;
  }

  /**
   * Fetch Real-Time 1,000 Users Executive War Room Dashboard Data
   */
  public async getExecutiveDashboard(): Promise<WarRoomDashboardData> {
    // 1. Get active plan
    const planRes = await queryOne<{
      target_activated_users: number;
      total_budget_paisa: string;
      target_cpau_paisa: string;
      start_date: string;
      end_date: string;
    }>(
      `SELECT target_activated_users, total_budget_paisa, target_cpau_paisa, start_date, end_date
       FROM warroom.growth_plans WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );

    const targetUsers = planRes?.target_activated_users || 1000;
    const totalBudgetPaisa = parseInt(planRes?.total_budget_paisa || '75000000', 10);
    const targetCpauPaisa = parseInt(planRes?.target_cpau_paisa || '75000', 10);

    // 2. Count total activated users
    const actRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM warroom.activation_records`
    );
    const currentActivated = parseInt(actRes?.count || '0', 10);
    const remainingUsers = Math.max(0, targetUsers - currentActivated);
    const completionPercentage = parseFloat(((currentActivated / targetUsers) * 100).toFixed(1));

    // Calculate days remaining
    const endDate = planRes?.end_date ? new Date(planRes.end_date) : new Date(Date.now() + 90 * 86400000);
    const daysRemaining = Math.max(1, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const requiredDailyRunRate = parseFloat((remainingUsers / daysRemaining).toFixed(2));

    // 3. Today's pacing
    const todayRes = await queryOne<{
      target_leads: number;
      actual_leads: number;
      target_kyc_completed: number;
      actual_kyc_completed: number;
      target_activations: number;
      actual_activations: number;
      actual_spend_paisa: string;
      status: string;
    }>(
      `SELECT target_leads, actual_leads, target_kyc_completed, actual_kyc_completed,
              target_activations, actual_activations, actual_spend_paisa, status
       FROM warroom.daily_pacing WHERE pacing_date = CURRENT_DATE`
    );

    const targetActivations = todayRes?.target_activations || 11;
    const actualActivations = todayRes?.actual_activations || 0;
    const varianceActivations = actualActivations - targetActivations;

    // 4. Funnel counts
    const funnelRes = await queryOne<{
      total_leads: string;
      kyc_started: string;
      kyc_completed: string;
      approved_accounts: string;
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM warroom.leads WHERE is_deleted = FALSE) as total_leads,
        (SELECT COUNT(*) FROM warroom.kyc_applications WHERE status = 'IN_PROGRESS') as kyc_started,
        (SELECT COUNT(*) FROM warroom.kyc_applications WHERE status = 'COMPLETED') as kyc_completed,
        (SELECT COUNT(*) FROM core.users WHERE status = 'ACTIVE') as approved_accounts`
    );

    // 5. Economics & Spend
    const spendRes = await queryOne<{ total_spend: string }>(
      `SELECT COALESCE(SUM(actual_spend_paisa), 0) as total_spend FROM warroom.daily_pacing`
    );
    const totalSpentPaisa = parseInt(spendRes?.total_spend || '0', 10);
    const currentCpauPaisa = currentActivated > 0 ? Math.round(totalSpentPaisa / currentActivated) : 0;
    const cpauVariancePct = targetCpauPaisa > 0 
      ? parseFloat((((currentCpauPaisa - targetCpauPaisa) / targetCpauPaisa) * 100).toFixed(1))
      : 0;

    // 6. Recent daily velocity (7-day moving avg)
    const movingAvgRes = await queryOne<{ avg_activations: string }>(
      `SELECT COALESCE(AVG(actual_activations), 0) as avg_activations 
       FROM warroom.daily_pacing 
       WHERE pacing_date >= CURRENT_DATE - INTERVAL '7 days'`
    );
    const currentDailyRunRate = parseFloat(parseFloat(movingAvgRes?.avg_activations || '0').toFixed(2));

    // 7. Channel Breakdown
    const channelsRes = await query<{
      channel: string;
      leads: string;
      activations: string;
    }>(
      `SELECT 
        COALESCE(t.channel, 'ORGANIC') as channel,
        COUNT(DISTINCT l.id) as leads,
        COUNT(DISTINCT a.id) as activations
       FROM warroom.touchpoints t
       LEFT JOIN warroom.leads l ON t.lead_id = l.id
       LEFT JOIN warroom.activation_records a ON l.converted_user_id = a.user_id
       GROUP BY t.channel
       ORDER BY activations DESC, leads DESC
       LIMIT 6`
    );

    const channelBreakdown = (channelsRes || []).map((r: any) => {
      const acts = parseInt(r.activations, 10);
      const lds = parseInt(r.leads, 10);
      return {
        channel: r.channel,
        leads: lds,
        activations: acts,
        spentPaisa: acts * 75000, // estimated or actual allocation
        cpauPaisa: acts > 0 ? 75000 : 0
      };
    });

    // 8. Alerts
    const alerts: WarRoomDashboardData['alerts'] = [];
    if (currentDailyRunRate < requiredDailyRunRate && currentActivated < targetUsers) {
      alerts.push({
        id: 'alt_pacing_deficit',
        severity: 'YELLOW',
        title: 'Daily Activation Run-Rate Behind Pacing',
        message: `Current 7-day velocity is ${currentDailyRunRate}/day vs required ${requiredDailyRunRate}/day. Deficit: ${(requiredDailyRunRate - currentDailyRunRate).toFixed(1)} users/day.`,
        recommendation: 'Scale top 3 creator partnerships and trigger WhatsApp rescue sequence for KYC abandoners.'
      });
    }

    if (currentCpauPaisa > targetCpauPaisa && currentActivated >= 10) {
      alerts.push({
        id: 'alt_cpau_breach',
        severity: 'RED',
        title: 'CPAU Above Target Threshold',
        message: `Blended CPAU is ₹${(currentCpauPaisa / 100).toFixed(2)} (+${cpauVariancePct}%) vs target ₹${(targetCpauPaisa / 100).toFixed(2)}.`,
        recommendation: 'Pause cold Meta ad sets with zero activations; shift budget to Refer & Earn cash reward pool.'
      });
    }

    return {
      goal: {
        targetUsers,
        currentActivated,
        remainingUsers,
        completionPercentage,
        daysRemaining,
        requiredDailyRunRate,
        currentDailyRunRate
      },
      economics: {
        totalBudgetPaisa,
        totalSpentPaisa,
        currentCpauPaisa,
        targetCpauPaisa,
        cpauVariancePct
      },
      todayPacing: {
        date: new Date().toISOString().split('T')[0],
        targetLeads: todayRes?.target_leads || 56,
        actualLeads: todayRes?.actual_leads || 0,
        targetKyc: todayRes?.target_kyc_completed || 16,
        actualKyc: todayRes?.actual_kyc_completed || 0,
        targetActivations,
        actualActivations,
        varianceActivations,
        status: todayRes?.status || 'ON_TRACK'
      },
      funnelSummary: {
        totalLeads: parseInt(funnelRes?.total_leads || '0', 10),
        kycStarted: parseInt(funnelRes?.kyc_started || '0', 10),
        kycCompleted: parseInt(funnelRes?.kyc_completed || '0', 10),
        approvedAccounts: parseInt(funnelRes?.approved_accounts || '0', 10),
        activatedUsers: currentActivated
      },
      channelBreakdown,
      alerts
    };
  }
}
