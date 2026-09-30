import nodemailer, { Transporter } from 'nodemailer';
import { query, queryOne, execute } from '../db/schema';

export type EmailPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  enabled: boolean;
  highPriorityOnly: boolean;
  requireRegistrationOtp: boolean;
  notifyOrders: boolean;
  notifyFunds: boolean;
  notifyKyc: boolean;
  notifySecurity: boolean;
  superAdminAlertEmail: string;
  superAdminNotificationsEnabled: boolean;
}

export interface EmailLog {
  id: string;
  user_id?: string;
  to_email: string;
  subject: string;
  template_type: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error_message?: string;
  created_at: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter | null = null;
  private cachedConfig: EmailConfig | null = null;
  private lastConfigLoad: number = 0;
  private readonly CONFIG_CACHE_TTL_MS = 60 * 1000;

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Load SMTP and notification settings from system_config table,
   * falling back to environment variables or Hostinger defaults.
   */
  public async getConfig(forceFresh = false): Promise<EmailConfig> {
    const now = Date.now();
    if (!forceFresh && this.cachedConfig && (now - this.lastConfigLoad < this.CONFIG_CACHE_TTL_MS)) {
      return this.cachedConfig;
    }

    try {
      const rows = await query<{ key: string; value: string }>(
        `SELECT key, value FROM system_config WHERE key LIKE 'SMTP_%' OR key LIKE 'EMAIL_%' OR key LIKE 'SUPER_ADMIN_%'`
      );

      const map = new Map<string, string>();
      rows.forEach(r => map.set(r.key, r.value));

      const host = map.get('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.hostinger.com';
      const port = parseInt(map.get('SMTP_PORT') || process.env.SMTP_PORT || '465', 10);
      const secure = (map.get('SMTP_SECURE') || process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
      const user = map.get('SMTP_USER') || process.env.SMTP_USER || 'info@tradegrowx.in';
      const pass = map.get('SMTP_PASS') || process.env.SMTP_PASS || '';
      const from = map.get('EMAIL_FROM') || process.env.EMAIL_FROM || '"TradeGrow" <info@tradegrowx.in>';

      const enabled = (map.get('EMAIL_NOTIFICATIONS_ENABLED') ?? 'true').toLowerCase() === 'true';
      const highPriorityOnly = (map.get('EMAIL_HIGH_PRIORITY_ONLY') ?? 'true').toLowerCase() === 'true';
      const requireRegistrationOtp = (map.get('REQUIRE_REGISTRATION_EMAIL_OTP') ?? 'true').toLowerCase() === 'true';
      const notifyOrders = (map.get('EMAIL_NOTIFY_ORDERS') ?? 'false').toLowerCase() === 'true';
      const notifyFunds = (map.get('EMAIL_NOTIFY_FUNDS') ?? 'true').toLowerCase() === 'true';
      const notifyKyc = (map.get('EMAIL_NOTIFY_KYC') ?? 'true').toLowerCase() === 'true';
      const notifySecurity = (map.get('EMAIL_NOTIFY_SECURITY') ?? 'true').toLowerCase() === 'true';
      const superAdminAlertEmail = map.get('SUPER_ADMIN_ALERT_EMAIL') || process.env.SUPER_ADMIN_ALERT_EMAIL || 'cyberbuzz.mail@gmail.com';
      const superAdminNotificationsEnabled = (map.get('SUPER_ADMIN_NOTIFICATIONS_ENABLED') ?? 'true').toLowerCase() === 'true';

      this.cachedConfig = {
        smtpHost: host,
        smtpPort: isNaN(port) ? 465 : port,
        smtpSecure: secure,
        smtpUser: user,
        smtpPass: pass,
        emailFrom: from,
        enabled,
        highPriorityOnly,
        requireRegistrationOtp,
        notifyOrders,
        notifyFunds,
        notifyKyc,
        notifySecurity,
        superAdminAlertEmail,
        superAdminNotificationsEnabled,
      };

      this.lastConfigLoad = now;
      return this.cachedConfig;
    } catch (err: any) {
      console.warn('[EmailService] Failed to load config from database, using env/defaults:', err.message);
      return {
        smtpHost: process.env.SMTP_HOST || 'smtp.hostinger.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '465', 10),
        smtpSecure: (process.env.SMTP_SECURE || 'true') === 'true',
        smtpUser: process.env.SMTP_USER || 'info@tradegrowx.in',
        smtpPass: process.env.SMTP_PASS || '',
        emailFrom: process.env.EMAIL_FROM || '"TradeGrow" <info@tradegrowx.in>',
        enabled: true,
        highPriorityOnly: true,
        requireRegistrationOtp: true,
        notifyOrders: false,
        notifyFunds: true,
        notifyKyc: true,
        notifySecurity: true,
        superAdminAlertEmail: process.env.SUPER_ADMIN_ALERT_EMAIL || 'cyberbuzz.mail@gmail.com',
        superAdminNotificationsEnabled: true,
      };
    }
  }

  /**
   * Updates email settings in system_config and resets the active transporter.
   */
  public async updateConfig(newConfig: Partial<EmailConfig>): Promise<EmailConfig> {
    const current = await this.getConfig(true);
    const updated = { ...current, ...newConfig };

    const upsert = async (key: string, value: string) => {
      await execute(
        `INSERT INTO system_config (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
    };

    if (newConfig.smtpHost !== undefined) await upsert('SMTP_HOST', updated.smtpHost);
    if (newConfig.smtpPort !== undefined) await upsert('SMTP_PORT', String(updated.smtpPort));
    if (newConfig.smtpSecure !== undefined) await upsert('SMTP_SECURE', String(updated.smtpSecure));
    if (newConfig.smtpUser !== undefined) await upsert('SMTP_USER', updated.smtpUser);
    if (newConfig.smtpPass !== undefined) await upsert('SMTP_PASS', updated.smtpPass);
    if (newConfig.emailFrom !== undefined) await upsert('EMAIL_FROM', updated.emailFrom);
    if (newConfig.enabled !== undefined) await upsert('EMAIL_NOTIFICATIONS_ENABLED', String(updated.enabled));
    if (newConfig.highPriorityOnly !== undefined) await upsert('EMAIL_HIGH_PRIORITY_ONLY', String(updated.highPriorityOnly));
    if (newConfig.requireRegistrationOtp !== undefined) await upsert('REQUIRE_REGISTRATION_EMAIL_OTP', String(updated.requireRegistrationOtp));
    if (newConfig.notifyOrders !== undefined) await upsert('EMAIL_NOTIFY_ORDERS', String(updated.notifyOrders));
    if (newConfig.notifyFunds !== undefined) await upsert('EMAIL_NOTIFY_FUNDS', String(updated.notifyFunds));
    if (newConfig.notifyKyc !== undefined) await upsert('EMAIL_NOTIFY_KYC', String(updated.notifyKyc));
    if (newConfig.notifySecurity !== undefined) await upsert('EMAIL_NOTIFY_SECURITY', String(updated.notifySecurity));
    if (newConfig.superAdminAlertEmail !== undefined) await upsert('SUPER_ADMIN_ALERT_EMAIL', updated.superAdminAlertEmail);
    if (newConfig.superAdminNotificationsEnabled !== undefined) await upsert('SUPER_ADMIN_NOTIFICATIONS_ENABLED', String(updated.superAdminNotificationsEnabled));

    // Reset transporter cache
    this.transporter = null;
    this.cachedConfig = null;
    return this.getConfig(true);
  }

  /**
   * Lazily initializes and returns the pooled nodemailer transporter.
   */
  private async getTransporter(): Promise<Transporter | null> {
    const config = await this.getConfig();
    if (!config.smtpPass) {
      return null; // SMTP password not set yet
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure, // true for 465, false for other ports
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
      });
    }

    return this.transporter;
  }

  /**
   * Test SMTP credentials. Returns connection status and diagnostic message.
   */
  public async verifyConnection(testConfig?: Partial<EmailConfig>): Promise<{ success: boolean; message: string }> {
    let t: Transporter;
    if (testConfig && testConfig.smtpHost && testConfig.smtpUser && testConfig.smtpPass) {
      t = nodemailer.createTransport({
        host: testConfig.smtpHost,
        port: testConfig.smtpPort || 465,
        secure: testConfig.smtpSecure ?? true,
        auth: {
          user: testConfig.smtpUser,
          pass: testConfig.smtpPass,
        },
      });
    } else {
      const active = await this.getTransporter();
      if (!active) {
        return { success: false, message: 'SMTP password is not configured. Please enter password in Email Settings.' };
      }
      t = active;
    }

    try {
      await t.verify();
      return { success: true, message: 'SMTP connection established successfully! Credentials verified.' };
    } catch (err: any) {
      return { success: false, message: `SMTP connection failed: ${err.message}` };
    }
  }

  /**
   * Asynchronously send an email without blocking calling code.
   * Logs delivery outcome into email_delivery_logs.
   */
  public sendMailAsync(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    templateType: string;
    userId?: string;
    priority?: EmailPriority;
  }): void {
    // Run completely decoupled from current execution loop
    setImmediate(async () => {
      const { to, subject, html, text, templateType, userId, priority } = params;

      try {
        const config = await this.getConfig();
        if (!config.enabled) {
          await this.logDelivery(userId, to, subject, templateType, 'SKIPPED', 'Email notifications disabled globally');
          return;
        }

        // If a specific userId is provided, check if client has disabled email notifications
        // (Security OTPs and Password Resets always bypass client preference for account access safety)
        if (userId && !['SECURITY_OTP', 'REGISTRATION_OTP', 'PASSWORD_RESET'].includes(templateType)) {
          const userPref = await queryOne<{ email_notifications_enabled: boolean }>(
            'SELECT email_notifications_enabled FROM users WHERE id = $1',
            [userId]
          );
          if (userPref && userPref.email_notifications_enabled === false) {
            console.log(`[EmailService] ⏭️ Skipped email to <${to}> [${templateType}]: "${subject}" (Client disabled email notifications)`);
            await this.logDelivery(userId, to, subject, templateType, 'SKIPPED', 'Skipped: Client email notifications turned off');
            return;
          }
        }

        // Determine effective priority: security OTPs, KYC, deposits, reminders, broadcasts, and test emails are HIGH priority.
        const effectivePriority: EmailPriority = priority || (
          [
            'SECURITY_OTP', 'REGISTRATION_OTP', 'PASSWORD_RESET', 'MARGIN_CALL', 'RMS_SQUAREOFF',
            'KYC_APPROVED', 'KYC_REJECTED', 'KYC_REMINDER', 'OFFER_BROADCAST', 'ACCOUNT_BONUS',
            'SUPER_ADMIN_ALERT', 'FUNDS_CREDITED', 'TEST_EMAIL'
          ].includes(templateType)
            ? 'HIGH'
            : 'NORMAL'
        );

        // Filter out non-high-priority emails if high-priority-only mode is active
        if (config.highPriorityOnly && effectivePriority !== 'HIGH') {
          console.log(`[EmailService] ⏭️ Skipped non-high-priority email to <${to}> [${templateType}]: "${subject}" (High-Priority Only Mode Active)`);
          await this.logDelivery(userId, to, subject, templateType, 'SKIPPED', 'Skipped: High-priority only filter active');
          return;
        }

        const transporter = await this.getTransporter();
        if (!transporter) {
          console.warn(`[EmailService] ⚠️ SMTP password not set. Simulated email to <${to}>: "${subject}"`);
          await this.logDelivery(userId, to, subject, templateType, 'SKIPPED', 'SMTP password not configured');
          return;
        }

        await transporter.sendMail({
          from: config.emailFrom,
          to,
          subject,
          text: text || subject,
          html,
        });

        console.log(`[EmailService] ✉️  Email delivered to ${to} [${templateType}]: "${subject}"`);
        await this.logDelivery(userId, to, subject, templateType, 'SENT');
      } catch (err: any) {
        console.error(`[EmailService] ❌ Failed to deliver email to ${to}:`, err.message);
        await this.logDelivery(userId, to, subject, templateType, 'FAILED', err.message);
      }
    });
  }

  private async logDelivery(
    userId: string | undefined,
    to: string,
    subject: string,
    templateType: string,
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    error?: string
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO email_delivery_logs (user_id, to_email, subject, template_type, status, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [userId || null, to, subject, templateType, status, error || null]
      );
    } catch (_) {}
  }

  public async getDeliveryLogs(limit = 50): Promise<EmailLog[]> {
    try {
      return await query<EmailLog>(
        `SELECT id, user_id, to_email, subject, template_type, status, error_message, created_at 
         FROM email_delivery_logs 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );
    } catch {
      return [];
    }
  }

  // ============================================================
  // High-Level Automated Event Email Senders
  // ============================================================

  /**
   * 1. Order Executed / Filled
   */
  public async sendOrderExecutionEmail(
    user: { id: string; email: string; name?: string },
    order: {
      orderId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      price: number;
      orderType?: string;
      timestamp?: number;
    }
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.notifyOrders || !user.email) return;

    const isBuy = order.side.toUpperCase() === 'BUY';
    const totalVal = (order.quantity * order.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedPrice = order.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateStr = new Date(order.timestamp || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const subject = `Trade Executed: ${order.side} ${order.quantity} ${order.symbol} @ ₹${formattedPrice}`;
    const html = this.buildBaseEmailLayout({
      title: 'Order Executed Successfully',
      badge: isBuy ? 'BUY FILLED' : 'SELL FILLED',
      badgeColor: isBuy ? '#10B981' : '#EF4444',
      userName: user.name || 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          Your order has been filled at the best available price on the TradeGrow High-Frequency Matching Engine.
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Contract / Symbol</td>
              <td style="color: #F8FAFC; font-weight: 600; text-align: right; padding: 6px 0;">${order.symbol}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Action</td>
              <td style="color: ${isBuy ? '#10B981' : '#EF4444'}; font-weight: 700; text-align: right; padding: 6px 0;">${order.side}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Executed Quantity</td>
              <td style="color: #F8FAFC; font-weight: 600; text-align: right; padding: 6px 0;">${order.quantity}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Execution Price</td>
              <td style="color: #F8FAFC; font-weight: 600; text-align: right; padding: 6px 0;">₹${formattedPrice}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Total Turnover</td>
              <td style="color: #F8FAFC; font-weight: 700; text-align: right; padding: 6px 0;">₹${totalVal}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Order ID</td>
              <td style="color: #94A3B8; font-family: monospace; font-size: 12px; text-align: right; padding: 6px 0;">${order.orderId}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Executed At</td>
              <td style="color: #94A3B8; text-align: right; padding: 6px 0;">${dateStr} IST</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="https://tradegrowx.in/orders" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Orders & Positions</a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: 'ORDER_FILLED',
      userId: user.id,
      priority: 'NORMAL',
    });
  }

  /**
   * 2. Funds Deposited / Credited
   */
  public async sendFundCreditEmail(
    user: { id: string; email: string; name?: string },
    data: { amount: number; balance: number; referenceId: string; type?: string }
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.notifyFunds || !user.email) return;

    const formattedAmount = data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedBalance = data.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subject = `Funds Credited: ₹${formattedAmount} added to your TradeGrow Wallet`;

    const html = this.buildBaseEmailLayout({
      title: 'Wallet Balance Updated',
      badge: 'FUNDS CREDITED',
      badgeColor: '#10B981',
      userName: user.name || 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          Your deposit request has been approved and credited to your trading wallet. You can immediately use this margin for equity and options trading.
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Amount Credited</td>
              <td style="color: #10B981; font-weight: 700; font-size: 16px; text-align: right; padding: 6px 0;">+₹${formattedAmount}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">New Available Balance</td>
              <td style="color: #F8FAFC; font-weight: 700; text-align: right; padding: 6px 0;">₹${formattedBalance}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 6px 0;">Reference ID / UTR</td>
              <td style="color: #94A3B8; font-family: monospace; font-size: 12px; text-align: right; padding: 6px 0;">${data.referenceId}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="https://tradegrowx.in" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">Open Trading Terminal</a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: 'FUNDS_CREDITED',
      userId: user.id,
      priority: 'HIGH',
    });
  }

  /**
   * 3. KYC Status Update
   */
  public async sendKycStatusEmail(
    user: { id: string; email: string; name?: string },
    data: { status: 'APPROVED' | 'REJECTED'; reason?: string }
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.notifyKyc || !user.email) return;

    const isApproved = data.status === 'APPROVED';
    const subject = isApproved
      ? `KYC Verified: Your TradeGrow Account is Fully Activated`
      : `Action Required: Your KYC Application Needs Review`;

    const html = this.buildBaseEmailLayout({
      title: isApproved ? 'KYC Verification Approved' : 'KYC Verification Update',
      badge: isApproved ? 'VERIFIED' : 'ACTION REQUIRED',
      badgeColor: isApproved ? '#10B981' : '#F59E0B',
      userName: user.name || 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          ${
            isApproved
              ? 'Congratulations! Your identity and documents have been successfully verified. You now have full access to high-speed Equity, BSE/NSE Index Derivatives (F&O), and Commodity trading.'
              : `Your KYC submission could not be approved at this time. Reason: <strong style="color: #F8FAFC;">${data.reason || 'Document mismatch or unclear image'}</strong>. Please upload updated documents to activate your account.`
          }
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${isApproved ? 'https://tradegrowx.in' : 'https://tradegrowx.in/profile'}" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            ${isApproved ? 'Start Trading Now' : 'Update KYC Documents'}
          </a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: isApproved ? 'KYC_APPROVED' : 'KYC_REJECTED',
      userId: user.id,
      priority: 'HIGH',
    });
  }

  /**
   * 4. Password Reset OTP
   */
  public async sendOtpEmail(email: string, otp: string, purpose = 'Password Reset'): Promise<void> {
    const subject = `${otp} is your TradeGrow Verification Code`;

    const html = this.buildBaseEmailLayout({
      title: `${purpose} Verification`,
      badge: 'SECURITY OTP',
      badgeColor: '#3B82F6',
      userName: 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          You requested a verification code for <strong>${purpose}</strong>. Enter the 6-digit code below to proceed:
        </p>
        <div style="background-color: #0F172A; border: 1px dashed #3B82F6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: 800; color: #60A5FA;">${otp}</span>
        </div>
        <p style="margin: 0; color: #64748B; font-size: 12px; line-height: 1.5; text-align: center;">
          This code is valid for <strong>10 minutes</strong>. Never share this code with anyone. TradeGrow staff will never ask for your verification code.
        </p>
      `,
    });

    this.sendMailAsync({
      to: email,
      subject,
      html,
      templateType: 'SECURITY_OTP',
      priority: 'HIGH',
    });
  }

  /**
   * 4b. Registration OTP for New Account Creation
   */
  public async sendRegistrationOtpEmail(email: string, otp: string, username?: string): Promise<void> {
    const subject = `${otp} is your TradeGrow Account Verification Code`;
    const displayName = username ? username.trim() : 'Trader';

    const html = this.buildBaseEmailLayout({
      title: 'Verify Your Email Address',
      badge: 'ACCOUNT VERIFICATION',
      badgeColor: '#10B981',
      userName: displayName,
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          Welcome to <strong>TradeGrow</strong>! Please use the 6-digit verification code below to verify your email address and activate your trading account.
        </p>
        <div style="background-color: #0F172A; border: 1px dashed #10B981; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <div style="color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Verification Code</div>
          <span style="font-family: monospace; font-size: 36px; letter-spacing: 10px; font-weight: 800; color: #34D399;">${otp}</span>
        </div>
        <p style="margin: 0 0 12px; color: #94A3B8; font-size: 13px; line-height: 1.5; text-align: center;">
          This verification code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="margin: 0; color: #64748B; font-size: 12px; line-height: 1.5; text-align: center;">
          If you did not request this account creation, please disregard this email.
        </p>
      `,
    });

    this.sendMailAsync({
      to: email,
      subject,
      html,
      templateType: 'REGISTRATION_OTP',
      priority: 'HIGH',
    });
  }

  /**
   * 5. Test Email to verify SMTP
   */
  public async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return { success: false, message: 'SMTP credentials not configured. Please save SMTP password first.' };
    }

    const config = await this.getConfig();
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const html = this.buildBaseEmailLayout({
      title: 'Hostinger SMTP Test Successful',
      badge: 'SYSTEM TEST',
      badgeColor: '#10B981',
      userName: 'Administrator',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          This test email confirms that your <strong>Hostinger SMTP relay</strong> is active and communicating seamlessly with TradeGrow.
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748B; padding: 4px 0;">SMTP Host</td>
              <td style="color: #F8FAFC; text-align: right; padding: 4px 0;">${config.smtpHost}:${config.smtpPort}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Sender Address</td>
              <td style="color: #F8FAFC; text-align: right; padding: 4px 0;">${config.smtpUser}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">SSL/TLS Secure</td>
              <td style="color: #10B981; text-align: right; padding: 4px 0;">${config.smtpSecure ? 'Enabled (Port 465)' : 'Disabled'}</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Timestamp</td>
              <td style="color: #94A3B8; text-align: right; padding: 4px 0;">${dateStr} IST</td>
            </tr>
          </table>
        </div>
      `,
    });

    try {
      await transporter.sendMail({
        from: config.emailFrom,
        to: toEmail,
        subject: `[TradeGrow] Hostinger SMTP Test Email (${dateStr})`,
        html,
      });

      await this.logDelivery(undefined, toEmail, 'SMTP Test Email', 'SYSTEM_TEST', 'SENT');
      return { success: true, message: `Test email successfully sent to ${toEmail}!` };
    } catch (err: any) {
      await this.logDelivery(undefined, toEmail, 'SMTP Test Email', 'SYSTEM_TEST', 'FAILED', err.message);
      return { success: false, message: `Failed to send test email: ${err.message}` };
    }
  }

  /**
   * 6. Manual KYC Pending Reminder
   */
  public async sendKycReminderEmail(
    user: { id: string; email: string; name?: string; clientId?: string }
  ): Promise<void> {
    if (!user.email) return;

    const subject = `Action Required: Please complete your KYC Verification — TradeGrow`;
    const html = this.buildBaseEmailLayout({
      title: 'KYC Verification Pending',
      badge: 'ACTION REQUIRED',
      badgeColor: '#F59E0B',
      userName: user.name || 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          We noticed that your TradeGrow account registration is incomplete because your KYC verification has not been submitted yet.
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px; color: #F8FAFC; font-size: 13px; font-weight: 700;">Why complete KYC verification?</h4>
          <ul style="margin: 0; padding-left: 20px; color: #94A3B8; font-size: 13px; line-height: 1.8;">
            <li><strong style="color: #10B981;">Full Trading Access:</strong> Unlock high-speed NSE & BSE Options (NIFTY, SENSEX, BANKNIFTY) and Equity Cash trading.</li>
            <li><strong style="color: #10B981;">Instant Wallet Deposits:</strong> Add capital to your trading account with UPI and Bank Transfer.</li>
            <li><strong style="color: #10B981;">Zero Brokerage Benefits:</strong> Access intraday leverage and real-time market data streaming.</li>
          </ul>
        </div>
        <p style="margin: 0 0 20px; color: #E2E8F0; font-size: 13px;">
          It takes less than 2 minutes to upload your PAN and Aadhaar details.
        </p>
        <div style="text-align: center;">
          <a href="https://tradegrowx.in/profile" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">Complete KYC Verification Now</a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: 'KYC_REMINDER',
      userId: user.id,
      priority: 'HIGH',
    });
  }

  /**
   * 7. Special Offer Broadcast Email
   */
  public async sendOfferBroadcastEmail(
    user: { id: string; email: string; name?: string },
    offer: {
      title: string;
      subject?: string;
      offerDetails?: string;
      promoCode?: string;
      bonusText?: string;
      actionUrl?: string;
      actionLabel?: string;
    }
  ): Promise<void> {
    if (!user.email) return;

    const subject = offer.subject || `Special Trader Privilege: ${offer.title} — TradeGrow`;
    const html = this.buildBaseEmailLayout({
      title: offer.title || 'Exclusive Trader Privilege',
      badge: 'EXCLUSIVE OFFER',
      badgeColor: '#8B5CF6',
      userName: user.name || 'Trader',
      bodyHtml: `
        <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: #C4B5FD; margin-bottom: 8px;">
            ${offer.title}
          </div>
          ${offer.promoCode ? `
            <div style="display: inline-block; margin: 8px auto; padding: 6px 16px; background-color: #0F172A; border: 2px dashed #8B5CF6; border-radius: 6px; font-family: monospace; font-size: 16px; font-weight: 700; color: #A78BFA; letter-spacing: 2px;">
              ${offer.promoCode}
            </div>
          ` : ''}
          ${offer.bonusText ? `
            <div style="color: #10B981; font-weight: 700; font-size: 14px; margin-top: 6px;">
              ${offer.bonusText}
            </div>
          ` : ''}
        </div>
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6; white-space: pre-line;">
          ${offer.offerDetails || 'Take advantage of our exclusive trading benefits on NSE/BSE options, lower margin requirements, and high-speed execution.'}
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${offer.actionUrl || 'https://tradegrowx.in'}" style="display: inline-block; background-color: #8B5CF6; color: #FFFFFF; font-weight: 700; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
            ${offer.actionLabel || 'Claim Offer & Start Trading'}
          </a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: 'OFFER_BROADCAST',
      userId: user.id,
      priority: 'HIGH',
    });
  }

  /**
   * 8. Account Activation & First Trade Bonus Email
   */
  public async sendAccountBonusEmail(
    user: { id: string; email: string; name?: string },
    data: {
      bonusAmount: number;
      headline?: string;
      description?: string;
      actionUrl?: string;
    }
  ): Promise<void> {
    if (!user.email) return;

    const formattedBonus = (data.bonusAmount || 1000).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const subject = `Welcome Bonus: ₹${formattedBonus} Added to Your Account — TradeGrow`;
    const html = this.buildBaseEmailLayout({
      title: data.headline || 'Account Activation & First Trade Bonus',
      badge: 'FIRST TRADE BONUS',
      badgeColor: '#10B981',
      userName: user.name || 'Trader',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          ${data.description || 'Welcome to TradeGrow! Your account has been approved and activated. We have unlocked a special First Trade Bonus to help you kickstart your trading journey.'}
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 4px;">Trading Bonus Allocated</div>
          <div style="font-size: 32px; font-weight: 800; color: #10B981; letter-spacing: -0.5px;">+₹${formattedBonus}</div>
          <div style="font-size: 12px; color: #94A3B8; margin-top: 6px;">Available in your trading margin ledger for Equities & Derivatives</div>
        </div>
        <div style="background-color: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Eligible Contracts:</td>
              <td style="color: #F8FAFC; font-weight: 600; text-align: right; padding: 4px 0;">NIFTY, SENSEX, BANKNIFTY Options & Cash</td>
            </tr>
            <tr>
              <td style="color: #64748B; padding: 4px 0;">Matching Engine:</td>
              <td style="color: #10B981; font-weight: 600; text-align: right; padding: 4px 0;">Ultra Low Latency (&lt;5ms)</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="${data.actionUrl || 'https://tradegrowx.in'}" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
            Open Terminal & Place First Trade
          </a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: user.email,
      subject,
      html,
      templateType: 'ACCOUNT_BONUS',
      userId: user.id,
      priority: 'HIGH',
    });
  }

  /**
   * 9. Super Admin Operational Alert Email
   * Dispatched immediately to cyberbuzz.mail@gmail.com on critical lifecycle events:
   * new client registration, KYC submission, fund deposit/withdrawal requests.
   */
  public async sendSuperAdminAlert(params: {
    subject: string;
    eventType: 'NEW_REGISTRATION' | 'KYC_SUBMITTED' | 'FUND_REQUEST' | 'CRITICAL_ALERT';
    summary: string;
    details: Array<{ label: string; value: string }>;
    actionUrl?: string;
    actionLabel?: string;
  }): Promise<void> {
    const config = await this.getConfig();
    if (!config.superAdminNotificationsEnabled) return;

    const toEmail = config.superAdminAlertEmail || 'cyberbuzz.mail@gmail.com';
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const badgeColorMap: Record<string, string> = {
      NEW_REGISTRATION: '#38BDF8',
      KYC_SUBMITTED: '#F59E0B',
      FUND_REQUEST: '#10B981',
      CRITICAL_ALERT: '#EF4444',
    };

    const subject = `[TradeGrow Admin Alert] ${params.subject}`;
    const rowsHtml = params.details
      .map(
        d => `
        <tr>
          <td style="color: #64748B; padding: 6px 0; font-size: 13px;">${d.label}</td>
          <td style="color: #F8FAFC; font-weight: 600; text-align: right; padding: 6px 0; font-size: 13px; font-family: monospace;">${d.value}</td>
        </tr>
      `
      )
      .join('');

    const html = this.buildBaseEmailLayout({
      title: params.subject,
      badge: params.eventType.replace('_', ' '),
      badgeColor: badgeColorMap[params.eventType] || '#38BDF8',
      userName: 'Super Admin',
      bodyHtml: `
        <p style="margin: 0 0 16px; color: #94A3B8; font-size: 14px; line-height: 1.6;">
          ${params.summary}
        </p>
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            ${rowsHtml}
            <tr>
              <td style="color: #64748B; padding: 6px 0; font-size: 13px;">Timestamp</td>
              <td style="color: #94A3B8; text-align: right; padding: 6px 0; font-size: 13px;">${dateStr} IST</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="${params.actionUrl || 'https://tradegrowx.in/admin'}" style="display: inline-block; background-color: #38BDF8; color: #02131F; font-weight: 700; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            ${params.actionLabel || 'Open Admin Portal'}
          </a>
        </div>
      `,
    });

    this.sendMailAsync({
      to: toEmail,
      subject,
      html,
      templateType: 'SUPER_ADMIN_ALERT',
      priority: 'HIGH',
    });
  }

  // ============================================================
  // Responsive TradeGrow Branded Email Layout
  // ============================================================
  private buildBaseEmailLayout(params: {
    title: string;
    badge?: string;
    badgeColor?: string;
    userName?: string;
    bodyHtml: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #020617; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 560px; border-collapse: collapse; background-color: #0B0F19; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(180deg, #131B2E 0%, #0B0F19 100%); border-bottom: 1px solid #1E293B;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #10B981;">
                      Trade<span style="color: #38BDF8;">Grow</span>
                    </div>
                    <div style="font-size: 11px; color: #64748B; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px;">
                      Smart Trading Platform
                    </div>
                  </td>
                  ${
                    params.badge
                      ? `<td align="right">
                          <span style="display: inline-block; background-color: ${params.badgeColor || '#10B981'}20; color: ${params.badgeColor || '#10B981'}; border: 1px solid ${params.badgeColor || '#10B981'}50; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                            ${params.badge}
                          </span>
                        </td>`
                      : ''
                  }
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #F8FAFC; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">
                ${params.title}
              </h2>
              ${params.userName ? `<p style="margin: 0 0 16px; color: #E2E8F0; font-size: 14px;">Hi <strong>${params.userName}</strong>,</p>` : ''}
              ${params.bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #060911; border-top: 1px solid #1E293B; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748B; font-size: 11px; line-height: 1.5;">
                This is an automated system notification from TradeGrow Platform (<a href="https://tradegrowx.in" style="color: #38BDF8; text-decoration: none;">tradegrowx.in</a>).
              </p>
              <p style="margin: 0; color: #475569; font-size: 10px; line-height: 1.4;">
                Need help? Contact support at <a href="mailto:info@tradegrowx.in" style="color: #10B981; text-decoration: none;">info@tradegrowx.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
