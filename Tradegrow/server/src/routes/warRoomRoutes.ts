import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { WarRoomService } from '../services/WarRoomService';
import { WhatsAppAutomationService } from '../services/WhatsAppAutomationService';
import { EmailService } from '../services/EmailService';
import { query, queryOne, execute } from '../db/schema';
import { generateUUID } from '../utils/crypto';

export const warRoomRouter = Router();
const warRoom = WarRoomService.getInstance();
const waService = WhatsAppAutomationService.getInstance();
const emailService = EmailService.getInstance();

/**
 * Helper to build an attractive, responsive notification email HTML
 */
function buildAlertEmailHtml(params: {
  badgeTitle: string;
  badgeColor?: string;
  headline: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  extraHtml?: string;
  actionUrl?: string;
  actionLabel?: string;
}): string {
  const rows = params.details
    .map(
      (d) => `
      <tr>
        <td style="padding: 7px 0; color: #64748B; font-size: 13px; font-weight: 500; border-bottom: 1px solid #1E293B;">${d.label}</td>
        <td style="padding: 7px 0; color: #F8FAFC; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #1E293B;">${d.value || 'N/A'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${params.headline}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #020617; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 580px; border-collapse: collapse; background-color: #0B0F19; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);">
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(180deg, #131B2E 0%, #0B0F19 100%); border-bottom: 1px solid #1E293B;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; color: #10B981;">
                      Trade<span style="color: #38BDF8;">Grow</span> &bull; <span style="color: #F8FAFC; font-size: 16px; font-weight: 600;">Expert Stocks</span>
                    </div>
                    <div style="font-size: 11px; color: #64748B; font-weight: 500; text-transform: uppercase; margin-top: 2px;">
                      Unified Ingress Alert & CRM Desk
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: ${params.badgeColor || '#10B981'}20; color: ${params.badgeColor || '#10B981'}; border: 1px solid ${params.badgeColor || '#10B981'}50; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700;">
                      ${params.badgeTitle}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px;">
              <h2 style="margin: 0 0 12px; color: #F8FAFC; font-size: 18px; font-weight: 700;">${params.headline}</h2>
              <p style="margin: 0 0 20px; color: #94A3B8; font-size: 14px; line-height: 1.6;">${params.summary}</p>
              
              <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${rows}
                </table>
              </div>

              ${params.extraHtml || ''}

              ${
                params.actionUrl
                  ? `<div style="text-align: center; margin-top: 24px;">
                      <a href="${params.actionUrl}" style="display: inline-block; background-color: #10B981; color: #022C22; font-weight: 700; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
                        ${params.actionLabel || 'View Record'}
                      </a>
                    </div>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: #060911; border-top: 1px solid #1E293B; text-align: center;">
              <p style="margin: 0; color: #64748B; font-size: 11px;">
                TradeGrow Unified Ecosystem &bull; Automatic Form Notification Dispatch
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

/**
 * POST /api/v1/public/leads
 * Public Ingress for Trust Website (tradegrow.in), Expert Advisory (expertstocks.in),
 * Consultation Modals, and Risk Assessment Form.
 * Automatically dispatches real-time email notifications to info@tradegrowx.in and support@expertstocks.in.
 */
warRoomRouter.post('/public/leads', async (req: Request, res: Response) => {
  try {
    const rawPhone = req.body.phone || req.body.mobile;
    const fullName = req.body.fullName || req.body.full_name || req.body.name;
    const email = req.body.email;
    const city = req.body.city;
    const state = req.body.state;
    const source = req.body.source || req.body.form_key || 'WEBSITE';
    const message = req.body.message;
    const capitalRange = req.body.capitalRange || req.body.capital_range;
    const segments = req.body.segments;
    const assessment = req.body.assessment; // Risk Profile Questionnaire submission
    const {
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      landingPage,
      referrerUrl,
      referralCode,
      creatorCode,
      consentWhatsApp
    } = req.body;

    if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'A valid 10-digit Indian mobile number is required.' }
      });
    }

    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

    // 1. Ingest lead into War Room database
    const result = await warRoom.ingestLead({
      phone: cleanPhone,
      fullName: fullName ? String(fullName).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      source: source || 'TRUST_WEBSITE',
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      landingPage,
      referrerUrl,
      referralCode,
      creatorCode,
      consentWhatsApp: consentWhatsApp !== false,
      userIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    const isRpm = source === 'risk_assessment' || Boolean(assessment);
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // 2. Format and dispatch alert email to internal team
    const alertSubject = isRpm
      ? `[RPM Assessment] ${fullName || cleanPhone} - Tier: ${assessment?.category || 'Assessed'} (Score: ${assessment?.score || 'N/A'}/60)`
      : `[New Lead Alert] ${fullName || cleanPhone} via ${source}`;

    let extraHtml = '';
    if (message) {
      extraHtml += `
        <div style="background-color: #0F172A; border-left: 3px solid #38BDF8; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
          <strong style="color: #38BDF8; font-size: 13px; display: block; margin-bottom: 4px;">Message / Investor Note:</strong>
          <span style="color: #E2E8F0; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${message}</span>
        </div>`;
    }

    if (assessment && Array.isArray(assessment.questions)) {
      const qRows = assessment.questions
        .map(
          (q: any, idx: number) => `
          <div style="padding: 8px 0; border-bottom: 1px solid #1E293B; font-size: 12px;">
            <div style="color: #94A3B8; font-weight: 600;">${idx + 1}. ${q.question}</div>
            <div style="color: #10B981; font-weight: 700; margin-top: 2px;">&rarr; ${q.answer}</div>
          </div>`
        )
        .join('');

      extraHtml += `
        <div style="background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <strong style="color: #F8FAFC; font-size: 14px; display: block; margin-bottom: 8px;">Risk Profile Questionnaire Breakdown:</strong>
          ${qRows}
        </div>`;
    }

    const teamHtml = buildAlertEmailHtml({
      badgeTitle: isRpm ? 'RISK ASSESSMENT' : 'NEW LEAD',
      badgeColor: isRpm ? '#A855F7' : '#10B981',
      headline: isRpm ? 'Investor Risk Profile Assessment Submitted' : 'New Inbound Lead / Consultation Request',
      summary: `A client has submitted their contact details through the website. Immediate follow-up required within defined SLA.`,
      details: [
        { label: 'Investor Name', value: fullName || 'Not provided' },
        { label: 'Mobile Number', value: `+91 ${cleanPhone}` },
        { label: 'Email Address', value: email || 'Not provided' },
        { label: 'City / State', value: [city, state].filter(Boolean).join(', ') || 'Not specified' },
        { label: 'Form / Source', value: source },
        { label: 'Capital Allocation', value: capitalRange || 'Prefer to discuss' },
        { label: 'Preferred Markets', value: Array.isArray(segments) ? segments.join(', ') : segments || 'General' },
        { label: 'Lead Reference Code', value: result?.leadCode || 'N/A' },
        { label: 'Campaign / UTM', value: utmCampaign || 'Direct / Organic' },
        { label: 'Referral / Creator', value: referralCode || creatorCode || 'None' },
        { label: 'Captured At', value: `${dateStr} IST` },
      ],
      extraHtml,
      actionUrl: 'https://tradegrowx.in/admin',
      actionLabel: 'Open Executive War Room'
    });

    // Send notification to primary notification addresses
    const notificationEmails = ['info@tradegrowx.in', 'support@expertstocks.in', 'cyberbuzz.mail@gmail.com'];
    for (const targetEmail of notificationEmails) {
      emailService.sendMailAsync({
        to: targetEmail,
        subject: alertSubject,
        html: teamHtml,
        templateType: isRpm ? 'RISK_ASSESSMENT' : 'LEAD_INGRESS',
        priority: 'HIGH',
      });
    }

    // 3. Send automated confirmation email to the client if email is provided
    if (email && email.includes('@')) {
      const clientConfirmHtml = buildAlertEmailHtml({
        badgeTitle: isRpm ? 'ASSESSMENT RECORDED' : 'REQUEST RECEIVED',
        badgeColor: '#10B981',
        headline: `Thank you, ${fullName || 'Investor'}!`,
        summary: isRpm
          ? `Your SEBI-aligned Risk Profile & Suitability Questionnaire has been successfully recorded. Your risk tier is: <strong>${assessment?.category || 'Under Review'}</strong>.`
          : `We have received your enquiry. A registered advisory representative will reach out to you at +91 ${cleanPhone} during market hours.`,
        details: [
          { label: 'Reference Code', value: result?.leadCode || 'TG-LEAD-2026' },
          { label: 'Mobile Number', value: `+91 ${cleanPhone}` },
          { label: 'Status', value: 'Acknowledged & In Queue' },
          { label: 'Turnaround Time', value: 'Within 2 to 4 business hours' },
        ],
        extraHtml: `
          <div style="background-color: #0F172A; border-radius: 8px; padding: 14px; border: 1px solid #1E293B; margin-bottom: 16px;">
            <p style="margin: 0; color: #94A3B8; font-size: 13px; line-height: 1.5;">
              If your request is urgent, connect with our support desk directly on WhatsApp at
              <a href="https://wa.me/919589615649" style="color: #10B981; font-weight: 700; text-decoration: none;">+91 95896 15649</a>.
            </p>
          </div>`
      });

      emailService.sendMailAsync({
        to: email.trim(),
        subject: isRpm ? `TradeGrow & Expert Stocks: Your Risk Assessment Summary` : `We received your consultation request - TradeGrow & Expert Stocks`,
        html: clientConfirmHtml,
        templateType: 'CLIENT_CONFIRMATION',
        priority: 'NORMAL',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        ...result,
        message: `Thank you! Your request has been logged successfully (Ref: ${result?.leadCode || 'Captured'}). Our desk will revert promptly.`
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Error ingesting lead:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to record lead. Please try again.' }
    });
  }
});

/**
 * POST /api/v1/public/support/tickets
 * Public Support Ticket submission endpoint for website visitors and clients.
 * Generates an official reference ID, records to support_tickets database table,
 * and sends instant email notification to info@tradegrowx.in and customer.
 */
warRoomRouter.post('/public/support/tickets', async (req: Request, res: Response) => {
  try {
    const { name, phone, email, clientCode, category, message } = req.body;

    if (!name || !phone || !email || !message) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Name, phone, email, and description are required.' }
      });
    }

    const ticketNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `TG-TKT-2026-${ticketNum}`;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const cleanCategory = category || 'General Query';
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Store in support_tickets table
    try {
      await execute(
        `INSERT INTO support_tickets (id, customer_id, category, priority, subject, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'HIGH', $4, $5, 'OPEN', NOW(), NOW())`,
        [
          ticketId,
          clientCode || cleanPhone,
          cleanCategory,
          `[Support] ${cleanCategory}: ${name}`,
          `Name: ${name}\nPhone: +91 ${cleanPhone}\nEmail: ${email}\nClient Code: ${clientCode || 'N/A'}\nCategory: ${cleanCategory}\n\nMessage:\n${message}`
        ]
      );
    } catch (dbErr: any) {
      console.warn('[WarRoom API] Direct support_tickets insert note:', dbErr.message);
    }

    // Build internal alert email
    const internalEmailHtml = buildAlertEmailHtml({
      badgeTitle: 'SUPPORT TICKET',
      badgeColor: '#EF4444',
      headline: `New Support Ticket Logged: ${ticketId}`,
      summary: `A customer has submitted a formal support ticket on the Trust portal. Please review and assign to the support desk.`,
      details: [
        { label: 'Ticket Reference', value: ticketId },
        { label: 'Client Name', value: name },
        { label: 'Mobile Number', value: `+91 ${cleanPhone}` },
        { label: 'Email Address', value: email },
        { label: 'Client Code / Ref', value: clientCode || 'Not provided' },
        { label: 'Category', value: cleanCategory },
        { label: 'Submitted At', value: `${dateStr} IST` },
      ],
      extraHtml: `
        <div style="background-color: #0F172A; border-left: 3px solid #EF4444; padding: 14px 18px; margin-bottom: 20px; border-radius: 4px;">
          <strong style="color: #F8FAFC; font-size: 13px; display: block; margin-bottom: 6px;">Ticket Description:</strong>
          <span style="color: #CBD5E1; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${message}</span>
        </div>`,
      actionUrl: `https://tradegrowx.in/admin`,
      actionLabel: 'Open Support Console'
    });

    // Send email to operations & support desk
    const alertRecipients = ['info@tradegrowx.in', 'support@expertstocks.in', 'cyberbuzz.mail@gmail.com'];
    for (const to of alertRecipients) {
      emailService.sendMailAsync({
        to,
        subject: `[TradeGrow Support Ticket] ${ticketId} - ${cleanCategory}: ${name}`,
        html: internalEmailHtml,
        templateType: 'SUPPORT_TICKET',
        priority: 'HIGH',
      });
    }

    // Send customer receipt confirmation email
    const clientReceiptHtml = buildAlertEmailHtml({
      badgeTitle: 'TICKET CONFIRMED',
      badgeColor: '#10B981',
      headline: `We have received your ticket: ${ticketId}`,
      summary: `Hi ${name}, your request has been logged in our support queue. Our team monitors all tickets and responds within our statutory resolution window.`,
      details: [
        { label: 'Ticket Reference ID', value: ticketId },
        { label: 'Category', value: cleanCategory },
        { label: 'Expected First Response', value: 'Within 2 hours' },
        { label: 'Full Resolution TAT', value: '24 to 48 business hours' },
      ],
      extraHtml: `
        <div style="background-color: #0F172A; border-radius: 8px; padding: 16px; border: 1px solid #1E293B; margin-bottom: 16px;">
          <p style="margin: 0 0 10px; color: #94A3B8; font-size: 13px; line-height: 1.5;">
            You can check the progress of this ticket anytime on our Support Portal using your Reference ID <strong>${ticketId}</strong>.
          </p>
          <p style="margin: 0; color: #64748B; font-size: 12px;">
            For urgent escalations, reach us directly on WhatsApp at <a href="https://wa.me/919589615649" style="color: #10B981; font-weight: 700; text-decoration: none;">+91 95896 15649</a>.
          </p>
        </div>`
    });

    emailService.sendMailAsync({
      to: email.trim(),
      subject: `TradeGrow Support Ticket Received: ${ticketId}`,
      html: clientReceiptHtml,
      templateType: 'TICKET_RECEIPT',
      priority: 'HIGH',
    });

    return res.status(201).json({
      success: true,
      reference: ticketId,
      message: `Ticket received successfully. Reference: ${ticketId}. A confirmation email has been dispatched to ${email}.`
    });
  } catch (err: any) {
    console.error('[WarRoom API] Error creating support ticket:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to record support ticket. Please try again.' }
    });
  }
});

/**
 * GET /api/v1/public/support/tickets/:ref
 * Look up ticket status by reference ID
 */
warRoomRouter.get('/public/support/tickets/:ref', async (req: Request, res: Response) => {
  try {
    const rawRef = Array.isArray(req.params.ref) ? req.params.ref[0] : req.params.ref;
    const ref = String(rawRef || '').trim().toUpperCase();
    if (!ref) {
      return res.status(400).json({ success: false, error: { message: 'Reference number is required' } });
    }

    const ticket = await queryOne<any>(
      `SELECT id, customer_id, category, priority, subject, description, status, admin_notes, created_at, updated_at
       FROM support_tickets
       WHERE UPPER(id) = $1 OR UPPER(customer_id) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [ref]
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: `No active ticket found with reference ${ref}` }
      });
    }

    return res.json({
      success: true,
      ticket: {
        ref: ticket.id,
        status: ticket.status || 'Under Review',
        category: ticket.category || 'General',
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        notes: ticket.admin_notes || 'Ticket has been queued for investigation by support staff.'
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Error looking up ticket:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to look up ticket status.' }
    });
  }
});

/**
 * POST /api/v1/public/onboarding/apply
 * Captures completed KYC onboarding application from website and sends real-time email
 */
warRoomRouter.post('/public/onboarding/apply', async (req: Request, res: Response) => {
  try {
    const { ref, phone, name, pan, dob, gender, ifsc } = req.body;
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Send email alert to operations team
    const alertHtml = buildAlertEmailHtml({
      badgeTitle: 'NEW APPLICATION',
      badgeColor: '#38BDF8',
      headline: `Digital Onboarding Application Submitted: ${ref || 'TG-APP-2026'}`,
      summary: `An investor has completed the digital onboarding flow on the website. Immediate KYC and CKYC verification required.`,
      details: [
        { label: 'Application Reference', value: ref || 'TG-APP-2026' },
        { label: 'Applicant Name', value: name || 'Not provided' },
        { label: 'Mobile Number', value: `+91 ${cleanPhone}` },
        { label: 'PAN Number', value: pan || 'Not provided' },
        { label: 'Date of Birth', value: dob || 'Not provided' },
        { label: 'Gender', value: gender || 'Not provided' },
        { label: 'Bank IFSC', value: ifsc || 'Not provided' },
        { label: 'Timestamp', value: `${dateStr} IST` },
      ],
      actionUrl: 'https://tradegrowx.in/admin',
      actionLabel: 'Open Compliance Portal'
    });

    const opsEmails = ['info@tradegrowx.in', 'cyberbuzz.mail@gmail.com'];
    for (const to of opsEmails) {
      emailService.sendMailAsync({
        to,
        subject: `[TradeGrow KYC Application] ${ref || 'TG-APP-2026'} - ${name || cleanPhone}`,
        html: alertHtml,
        templateType: 'KYC_APPLICATION',
        priority: 'HIGH',
      });
    }

    return res.json({
      success: true,
      reference: ref,
      message: 'Account opening application recorded successfully.'
    });
  } catch (err: any) {
    console.error('[WarRoom API] Onboarding application error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to record application' } });
  }
});

/**
 * GET /api/v1/warroom/dashboard
 * Executive 1,000 Users North Star Cockpit Data
 */
warRoomRouter.get('/warroom/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await warRoom.getExecutiveDashboard();
    return res.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error('[WarRoom API] Dashboard error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve dashboard metrics.' }
    });
  }
});

/**
 * GET /api/v1/warroom/pacing
 * Pacing Calendar rows (Target vs Actual across the 90 days)
 */
warRoomRouter.get('/warroom/pacing', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const result = await query(
      `SELECT pacing_date, target_leads, actual_leads, target_kyc_completed, actual_kyc_completed,
              target_activations, actual_activations, budget_allocated_paisa, actual_spend_paisa,
              cumulative_activations, required_run_rate, status
       FROM warroom.daily_pacing 
       ORDER BY pacing_date DESC 
       LIMIT $1`,
      [limit]
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[WarRoom API] Pacing history error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve daily pacing.' }
    });
  }
});

/**
 * POST /api/v1/internal/events/activation
 * Internal hook triggered when a user executes their first trade or funds their wallet
 */
warRoomRouter.post('/internal/events/activation', async (req: Request, res: Response) => {
  try {
    const { userId, orderId, actionType } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: { message: 'userId is required' } });
    }

    const result = await warRoom.recordActivation(userId, orderId, actionType);
    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[WarRoom API] Activation event error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process activation.' }
    });
  }
});

/**
 * GET /api/v1/warroom/creators
 * List all creator partners & influencer tracking metrics
 */
warRoomRouter.get('/warroom/creators', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, creator_code, name, platform, handle, followers_count, category, tier,
              payout_model, payout_rate_paisa, vanity_slug, total_clicks, total_leads,
              total_kyc_completed, total_activated, is_active, created_at
       FROM warroom.creators 
       ORDER BY total_activated DESC, total_leads DESC`
    );

    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[WarRoom API] Creators list error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch creators.' }
    });
  }
});

/**
 * POST /api/v1/warroom/creators
 * Register a new Creator Partner
 */
warRoomRouter.post('/warroom/creators', async (req: Request, res: Response) => {
  try {
    const { name, platform, handle, followersCount, category, tier, payoutRatePaisa, vanitySlug } = req.body;

    if (!name || !platform || !handle || !vanitySlug) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, platform, handle, and vanitySlug are required' }
      });
    }

    const creatorCode = 'CR-' + String(vanitySlug).toUpperCase();
    const id = generateUUID();

    await query(
      `INSERT INTO warroom.creators (
        id, creator_code, name, platform, handle, followers_count, category, tier, payout_rate_paisa, vanity_slug
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        creatorCode,
        name.trim(),
        String(platform).toUpperCase(),
        handle.trim(),
        followersCount || 0,
        category || 'FINANCE_EDUCATION',
        tier || 'MICRO',
        payoutRatePaisa || 35000,
        String(vanitySlug).trim().toLowerCase()
      ]
    );

    return res.status(201).json({
      success: true,
      data: {
        id,
        creatorCode,
        vanitySlug,
        trackingUrl: `https://tradegrow.in/${vanitySlug}`
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Creator registration error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to register creator.' }
    });
  }
});

/**
 * GET /api/v1/warroom/referral-stats/:userId
 * Customer "Refer & Earn" stats
 */
warRoomRouter.get('/warroom/referral-stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId);

    // Check if referral code exists for user, else generate one
    let refRes = await query<any>(
      `SELECT id, code, total_clicks, total_signups, total_activations 
       FROM warroom.referral_codes WHERE user_id = $1`,
      [userId]
    );

    if (refRes.length === 0) {
      const code = 'TG' + userId.slice(0, 6).toUpperCase();
      const newRef = await query<any>(
        `INSERT INTO warroom.referral_codes (id, user_id, code) 
         VALUES ($1, $2, $3) RETURNING id, code, total_clicks, total_signups, total_activations`,
        [generateUUID(), userId, code]
      );
      refRes = newRef;
    }

    const ref = refRes[0];

    // Get rewards breakdown
    const rewardsRes = await query<any>(
      `SELECT COALESCE(SUM(amount_paisa), 0) as total_earned_paisa 
       FROM warroom.referral_rewards WHERE referrer_user_id = $1 AND status = 'QUALIFIED'`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        code: ref.code,
        referralUrl: `https://tradegrow.in/r/${ref.code}`,
        totalClicks: ref.total_clicks,
        totalSignups: ref.total_signups,
        totalActivations: ref.total_activations,
        totalEarnedPaisa: parseInt(rewardsRes[0]?.total_earned_paisa || '0', 10),
        rewardPerActivationPaisa: 25000 // ₹250
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Referral stats error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch referral stats.' }
    });
  }
});

/**
 * GET /api/v1/warroom/content-ideas
 * 100 Content & Ad Ideas repository
 */
warRoomRouter.get('/warroom/content-ideas', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    let sql = `SELECT idea_index, category, hook, script_body, visual_direction, caption, call_to_action, target_audience, funnel_stage, publication_status FROM warroom.content_ideas`;
    const params: any[] = [];

    if (category) {
      sql += ` WHERE category = $1`;
      params.push(category);
    }
    sql += ` ORDER BY idea_index ASC LIMIT 100`;

    const result = await query(sql, params);
    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[WarRoom API] Content ideas error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content ideas.' }
    });
  }
});

/**
 * GET /api/v1/webhooks/whatsapp
 * Meta Cloud API Webhook Challenge Verification
 */
warRoomRouter.get('/webhooks/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'tradegrow_growth_secret_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] ✅ Verification challenge successful.');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/**
 * POST /api/v1/webhooks/whatsapp
 * Inbound Webhook Listener for Meta Cloud API / Gupshup
 */
warRoomRouter.post('/webhooks/whatsapp', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change.value;

          // 1. Inbound Messages
          if (Array.isArray(value?.messages)) {
            for (const msg of value.messages) {
              const fromPhone = `+${msg.from}`;
              const text = msg.text?.body || msg.button?.text || '';
              const msgId = msg.id;

              console.log(`[WhatsApp Webhook] Inbound from ${fromPhone}: "${text}"`);
              await waService.handleInboundMessage(fromPhone, text, msgId);
            }
          }

          // 2. Status Updates (DELIVERED, READ, FAILED)
          if (Array.isArray(value?.statuses)) {
            for (const st of value.statuses) {
              const msgId = st.id;
              const status = st.status?.toUpperCase();
              const errorCode = st.errors?.[0]?.code ? String(st.errors[0].code) : undefined;

              if (['DELIVERED', 'READ', 'FAILED'].includes(status)) {
                await waService.handleStatusUpdate(msgId, status as any, errorCode);
              }
            }
          }
        }
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Error processing event:', err);
    return res.status(500).send('WEBHOOK_PROCESSING_ERROR');
  }
});

/**
 * POST /api/v1/webhooks/whatsapp/evolution
 * Inbound Webhook Listener for Evolution API (Baileys / Open-WA engine)
 */
warRoomRouter.post('/webhooks/whatsapp/evolution', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const event = payload?.event || req.headers['x-event-type'];

    // 1. Inbound Messages (UPSERT)
    if (event === 'messages.upsert') {
      const data = payload?.data || {};
      const key = data.key || {};
      const fromMe = key.fromMe;

      if (!fromMe && key.remoteJid) {
        const rawJid = String(key.remoteJid);
        const phone = rawJid.replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '');
        const phoneE164 = waService.normalizePhoneE164(phone);
        const msgId = key.id || `evo_${Date.now()}`;

        // Extract body text from conversation or extended text
        const bodyText = data.message?.conversation ||
          data.message?.extendedTextMessage?.text ||
          data.message?.buttonsResponseMessage?.selectedDisplayText ||
          data.message?.templateButtonReplyMessage?.selectedId ||
          '';

        console.log(`[Evolution API Webhook] Inbound from ${phoneE164}: "${bodyText}"`);
        await waService.handleInboundMessage(phoneE164, bodyText, msgId);
      }
    }

    // 2. Message Status Updates (DELIVERY_ACK, READ)
    else if (event === 'messages.update') {
      const updates = Array.isArray(payload?.data) ? payload.data : [payload?.data];
      for (const item of updates) {
        if (!item) continue;
        const msgId = item.key?.id;
        const rawStatus = String(item.update?.status || '').toUpperCase();

        if (msgId) {
          if (rawStatus.includes('READ') || rawStatus === 'PLAYED') {
            await waService.handleStatusUpdate(msgId, 'READ');
          } else if (rawStatus.includes('DELIVER') || rawStatus === 'DELIVERY_ACK') {
            await waService.handleStatusUpdate(msgId, 'DELIVERED');
          }
        }
      }
    }

    // 3. Connection State Updates
    else if (event === 'connection.update') {
      const state = payload?.data?.state || payload?.data?.connection;
      console.log(`[Evolution API Webhook] Connection state updated: ${state}`);
    }

    return res.status(200).json({ status: 'SUCCESS' });
  } catch (err: any) {
    console.error('[Evolution API Webhook] Error:', err);
    return res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

/**
 * GET /api/v1/warroom/whatsapp/status
 * Get connection status, warm-up metrics, and anti-ban analytics
 */
warRoomRouter.get('/warroom/whatsapp/status', async (_req: Request, res: Response) => {
  try {
    const metrics = await waService.getMetrics();
    return res.json({ success: true, data: metrics });
  } catch (err: any) {
    console.error('[WarRoom API] WhatsApp status error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/v1/warroom/whatsapp/qr
 * Visual QR Code & Pairing Code Console for WhatsApp Web linking
 */
warRoomRouter.get('/warroom/whatsapp/qr', async (req: Request, res: Response) => {
  try {
    const qrData = await waService.getQRCode();
    const conn = await waService.getConnectionState();

    // If requested via browser or format=html, return a visual pairing interface
    const acceptsHtml = req.headers.accept?.includes('text/html') || req.query.format === 'html';
    if (acceptsHtml) {
      const isConnected = conn.state === 'open';
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TradeGrow WhatsApp Gateway | Multi-Device Anti-Ban Pairing</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0a0d14;
      --card: #111827;
      --border: #1f2937;
      --primary: #10b981;
      --text: #f3f4f6;
      --muted: #9ca3af;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .badge-online { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-waiting { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.4); }
    h1 { font-size: 22px; margin: 0 0 8px 0; color: #fff; }
    p { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 16px 0;
      min-width: 256px;
      min-height: 256px;
    }
    .qr-container img { width: 256px; height: 256px; display: block; }
    ol { text-align: left; font-size: 13px; color: var(--muted); padding-left: 20px; margin-bottom: 24px; }
    ol li { margin-bottom: 8px; }
    .btn {
      background: var(--primary);
      color: #000;
      font-weight: 600;
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin: 4px;
    }
    .btn-secondary {
      background: #1f2937;
      color: #fff;
    }
    .pair-code-box {
      background: #1f2937;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      text-align: left;
    }
    .pair-code-box input {
      width: calc(100% - 24px);
      padding: 10px;
      background: #0a0d14;
      border: 1px solid #374151;
      color: #fff;
      border-radius: 6px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge ${isConnected ? 'badge-online' : 'badge-waiting'}">
      ● ${isConnected ? 'WHATSAPP CONNECTED' : 'AWAITING PAIRING (' + (conn.state || 'CONNECTING') + ')'}
    </div>
    <h1>TradeGrow WhatsApp Automation</h1>
    <p>Baileys / Open-WA Anti-Ban Engine running on TradeGrow VPS</p>

    ${isConnected ? `
      <div style="padding: 30px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; margin: 20px 0;">
        <h3 style="color: #10b981; margin-top:0;">✅ Ready to Automate</h3>
        <p style="margin: 0; font-size: 13px;">Automated Lead Welcome, KYC Reminders, and Trade Celebrations are actively protected by anti-burst jitter, spintax, and opt-out controls.</p>
      </div>
    ` : `
      <div class="qr-container">
        ${qrData.base64 ? `<img src="${qrData.base64.startsWith('data:') ? qrData.base64 : 'data:image/png;base64,' + qrData.base64}" alt="Scan QR Code" />` : '<p style="color:#666; padding: 100px 0;">Generating QR Code...</p>'}
      </div>

      <ol>
        <li>Open <b>WhatsApp</b> on your phone.</li>
        <li>Tap <b>Menu</b> (Android) or <b>Settings</b> (iPhone) &gt; <b>Linked Devices</b>.</li>
        <li>Tap <b>Link a Device</b> and point your camera at this QR code.</li>
      </ol>
    `}

    <div>
      <a href="/api/v1/warroom/whatsapp/qr?format=html" class="btn">🔄 Refresh QR</a>
      <a href="/api/v1/warroom/whatsapp/status" target="_blank" class="btn btn-secondary">📊 View Metrics</a>
    </div>

    ${!isConnected ? `
      <div class="pair-code-box">
        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 6px; font-weight: 600;">OR PAIR WITH PHONE NUMBER (NO CAMERA)</div>
        <form id="pairForm" onsubmit="getPairCode(event)">
          <input type="text" id="phoneInput" placeholder="919876543210" required />
          <button type="submit" class="btn" style="width: 100%;">Get 8-Digit Pairing Code</button>
        </form>
        <div id="pairResult" style="margin-top: 10px; font-weight: bold; color: #10b981; font-size: 16px; text-align: center;"></div>
      </div>
      <script>
        async function getPairCode(e) {
          e.preventDefault();
          const p = document.getElementById('phoneInput').value;
          const res = await fetch('/api/v1/warroom/whatsapp/pair-code', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone: p })
          });
          const d = await res.json();
          if (d.data?.pairingCode) {
            document.getElementById('pairResult').innerText = 'Pairing Code: ' + d.data.pairingCode;
          } else {
            document.getElementById('pairResult').innerText = d.error?.message || 'Check terminal';
          }
        }
      </script>
    ` : ''}
  </div>
</body>
</html>`;
      return res.status(200).send(html);
    }

    return res.json({
      success: true,
      data: {
        connection: conn,
        qr: qrData
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] WhatsApp QR error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/v1/warroom/whatsapp/pair-code
 * Generates an 8-character pairing code for phone linking without QR scan
 */
warRoomRouter.post('/warroom/whatsapp/pair-code', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: { message: 'phone number is required' } });
    }

    const result = await waService.getPairingCode(phone);
    if (result.pairingCode) {
      return res.json({ success: true, data: result });
    } else {
      return res.status(400).json({ success: false, error: { message: result.error || 'Failed to generate pairing code' } });
    }
  } catch (err: any) {
    console.error('[WarRoom API] Pairing code error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/v1/warroom/whatsapp/restart
 * Restart Evolution API instance in case of hung connection
 */
warRoomRouter.post('/warroom/whatsapp/restart', async (_req: Request, res: Response) => {
  try {
    const result = await waService.restartInstance();
    return res.json({ success: result.success, error: result.error });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/v1/warroom/whatsapp/trigger-sequence
 * Admin trigger for automated journey sequences
 */
warRoomRouter.post('/warroom/whatsapp/trigger-sequence', async (req: Request, res: Response) => {
  try {
    const { sequence, phone, leadId, fullName, stepName, userId, milestoneIndex, textBody } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: { message: 'phone is required' } });
    }

    let result;
    switch (sequence) {
      case 'LEAD_WELCOME':
        result = await waService.triggerLeadWelcome(phone, leadId || 'MANUAL_' + Date.now(), fullName);
        break;
      case 'KYC_NUDGE':
        result = await waService.triggerKYCAbandonmentNudge(phone, leadId || 'MANUAL_' + Date.now(), stepName || 'Aadhaar e-KYC');
        break;
      case 'ACTIVATION':
        result = await waService.triggerAccountApprovedActivation(phone, userId || 'MANUAL_' + Date.now(), fullName);
        break;
      case 'FIRST_TRADE':
        result = await waService.triggerFirstTradeActivationCelebration(phone, userId || 'MANUAL_' + Date.now(), milestoneIndex || 1);
        break;
      case 'CUSTOM':
        if (!textBody) return res.status(400).json({ success: false, error: { message: 'textBody is required for CUSTOM sequence' } });
        result = await waService.sendMessage({
          phoneE164: waService.normalizePhoneE164(phone),
          templateName: 'admin_custom_broadcast',
          textBody,
          idempotencyKey: `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: { message: 'Valid sequence required: LEAD_WELCOME | KYC_NUDGE | ACTIVATION | FIRST_TRADE | CUSTOM' }
        });
    }

    return res.json({ success: result.success, data: result });
  } catch (err: any) {
    console.error('[WarRoom API] Trigger sequence error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/v1/warroom/whatsapp/opt-out
 * Manually blacklist a phone number from receiving automated WhatsApp messages
 */
warRoomRouter.post('/warroom/whatsapp/opt-out', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: { message: 'phone is required' } });

    const phoneE164 = waService.normalizePhoneE164(phone);
    await waService.recordOptOut(phoneE164);
    return res.json({ success: true, message: `Contact ${phoneE164} successfully opted out.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * POST /api/v1/warroom/whatsapp/test-send
 * Admin trigger for simulated or live WhatsApp sequence test
 */
warRoomRouter.post('/warroom/whatsapp/test-send', async (req: Request, res: Response) => {
  try {
    const { phone, templateName, textBody } = req.body;
    if (!phone || !textBody) {
      return res.status(400).json({ success: false, error: { message: 'phone and textBody are required' } });
    }

    const phoneE164 = waService.normalizePhoneE164(phone);
    const result = await waService.sendMessage({
      phoneE164,
      templateName: templateName || 'admin_test_manual',
      textBody,
      idempotencyKey: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[WarRoom API] Test send error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

/**
 * GET /api/v1/warroom/whatsapp/messages
 * View WhatsApp ledger & delivery analytics
 */
warRoomRouter.get('/warroom/whatsapp/messages', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const phone = req.query.phone as string;

    let sql = `SELECT id, provider, message_id, phone_e164, direction, template_name, status, error_code, sent_at, delivered_at, read_at
               FROM warroom.whatsapp_messages`;
    const params: any[] = [];

    if (phone) {
      sql += ` WHERE phone_e164 = $1`;
      params.push(waService.normalizePhoneE164(phone));
    }

    sql += ` ORDER BY sent_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[WarRoom API] WhatsApp messages query error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch WhatsApp logs' } });
  }
});

/**
 * GET /api/v1/advisory/order-preview
 * Validates cryptographically signed deep links from Expert Stocks Advisory
 * Chinese Wall compliant: Only pre-populates order parameters; requires explicit user authentication & confirmation.
 */
warRoomRouter.get('/advisory/order-preview', (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'A signed recommendation token is required.' }
      });
    }

    const secret = process.env.ADVISORY_SHARED_SECRET || 'advisory_shared_secret_2026';
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (e: any) {
      return res.status(401).json({
        success: false,
        error: { code: 'EXPIRED_OR_INVALID', message: 'The advisory recommendation link has expired or is invalid.' }
      });
    }

    return res.json({
      success: true,
      data: {
        symbol: decoded.symbol,
        exchange: decoded.exchange || 'NSE',
        action: decoded.action || 'BUY',
        productType: decoded.productType || 'CNC',
        targetPrice: decoded.targetPrice,
        stopLoss: decoded.stopLoss,
        advisoryReportId: decoded.advisoryReportId,
        analystName: decoded.analystName || 'Expert Stocks Research Desk',
        analystRegNumber: decoded.analystRegNumber || 'INH000000000',
        disclaimer: 'This order ticket is generated via an independent SEBI Registered Research Analyst recommendation. Investment in securities market are subject to market risks. Read all related documents carefully before investing. Trade Grow acts solely as the execution broker and does not provide financial advice.'
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Advisory order preview error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to preview advisory order.' }
    });
  }
});

/**
 * POST /api/v1/auth/sso/ticket
 * Issues a single-use, 60-second SSO ticket for cross-system seamless authentication
 */
warRoomRouter.post('/auth/sso/ticket', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'stocksharp_jwt_s3cr3t_2026_virtual_trading_platform_secure_key_minimum_32_chars';
    let user: any;
    try {
      user = jwt.verify(token, jwtSecret);
    } catch (_) {
      return res.status(401).json({ success: false, error: { message: 'Invalid authentication session' } });
    }

    const ssoSecret = process.env.SSO_SHARED_SECRET || jwtSecret;
    const ticketPayload = {
      sub: user.id,
      clientCode: user.client_code || user.id,
      phoneE164: user.phone,
      email: user.email,
      role: user.role || 'client',
      kycStatus: user.kyc_status || 'VERIFIED',
      nonce: generateUUID().slice(0, 12),
      iat: Math.floor(Date.now() / 1000)
    };

    const ssoTicket = jwt.sign(ticketPayload, ssoSecret, { expiresIn: '60s' });
    const targetApp = req.body?.targetApp || 'EXPERT_STOCKS';
    const crmFrontend = process.env.EXPERT_ADVISORY_FRONTEND_URL || 'http://localhost:3000';

    return res.json({
      success: true,
      data: {
        ticket: ssoTicket,
        expiresInSeconds: 60,
        targetApp,
        redirectUrl: `${crmFrontend}/sso/consume?ticket=${encodeURIComponent(ssoTicket)}`
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] SSO ticket generation error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to generate SSO ticket' } });
  }
});

/**
 * POST /api/v1/auth/sso/verify
 * Validates an SSO ticket presented by Expert Stocks or any ecosystem client
 */
warRoomRouter.post('/auth/sso/verify', (req: Request, res: Response) => {
  try {
    const { ticket } = req.body;
    if (!ticket || typeof ticket !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Ticket string is required' } });
    }

    const ssoSecret = process.env.SSO_SHARED_SECRET || process.env.JWT_SECRET || 'stocksharp_jwt_s3cr3t_2026_virtual_trading_platform_secure_key_minimum_32_chars';
    let decoded: any;
    try {
      decoded = jwt.verify(ticket, ssoSecret);
    } catch (e: any) {
      return res.status(401).json({ success: false, error: { message: 'SSO ticket is expired or invalid' } });
    }

    return res.json({
      success: true,
      data: {
        userId: decoded.sub,
        clientCode: decoded.clientCode,
        phoneE164: decoded.phoneE164,
        email: decoded.email,
        role: decoded.role,
        kycStatus: decoded.kycStatus
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] SSO verification error:', err);
    return res.status(500).json({ success: false, error: { message: 'SSO verification failed' } });
  }
});

/**
 * GET /api/v1/internal/clients/:phone/360
 * Returns aggregated Client 360 dossier combining Demat KYC state, Wallet Balance, and CRM Lead record
 */
warRoomRouter.get('/internal/clients/:phone/360', async (req: Request, res: Response) => {
  try {
    const rawPhone = String(req.params.phone);
    const phoneE164 = warRoom.normalizePhone(rawPhone);

    const [userRows, leadRows, kycRows, walletRows] = await Promise.all([
      query<any>(`SELECT id, name, email, phone, role, status, client_code, created_at FROM users WHERE phone = $1 OR phone = $2 LIMIT 1`, [phoneE164, rawPhone]),
      query<any>(`SELECT id, lead_code, stage, score, source, created_at FROM warroom.leads WHERE phone_e164 = $1 LIMIT 1`, [phoneE164]),
      query<any>(`SELECT status, pan_number, ckyc_status, is_verified, verified_at FROM kyc_records WHERE phone = $1 LIMIT 1`, [phoneE164]),
      query<any>(`SELECT available_margin, used_margin, realized_pnl FROM trading_accounts WHERE user_id IN (SELECT id FROM users WHERE phone = $1 OR phone = $2) LIMIT 1`, [phoneE164, rawPhone])
    ]);

    const user = userRows[0] || null;
    const lead = leadRows[0] || null;
    const kyc = kycRows[0] || null;
    const wallet = walletRows[0] || null;

    return res.json({
      success: true,
      data: {
        phone: phoneE164,
        hasDematAccount: !!user,
        accountDetails: user ? {
          userId: user.id,
          name: user.name,
          email: user.email,
          clientCode: user.client_code,
          role: user.role,
          status: user.status,
          memberSince: user.created_at
        } : null,
        crmLead: lead ? {
          leadId: lead.id,
          leadCode: lead.lead_code,
          stage: lead.stage,
          intentScore: lead.score,
          channelSource: lead.source,
          capturedAt: lead.created_at
        } : null,
        kycStatus: kyc ? {
          overallStatus: kyc.status,
          panProvided: !!kyc.pan_number,
          ckycVerified: kyc.ckyc_status === 'VERIFIED',
          isFullyVerified: kyc.is_verified,
          verifiedAt: kyc.verified_at
        } : { overallStatus: 'NOT_STARTED' },
        tradingFinancials: wallet ? {
          availableMargin: parseFloat(wallet.available_margin || '0'),
          usedMargin: parseFloat(wallet.used_margin || '0'),
          realizedPnl: parseFloat(wallet.realized_pnl || '0')
        } : null
      }
    });
  } catch (err: any) {
    console.error('[WarRoom API] Client 360 error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to retrieve Client 360 record' } });
  }
});

/**
 * GET /api/v1/warroom/leads
 * Telecaller Desk: Paginated leads with stage, score, and UTM filters
 */
warRoomRouter.get('/warroom/leads', async (req: Request, res: Response) => {
  try {
    const { stage, assignedAgentId, search, page, limit } = req.query;
    const result = await warRoom.listLeads({
      stage: stage as string,
      assignedAgentId: assignedAgentId as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[WarRoom API] List leads error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to fetch leads list.' } });
  }
});

/**
 * PATCH /api/v1/warroom/leads/:id/stage
 * Telecaller Desk: Update lead funnel stage with disposition notes
 */
warRoomRouter.patch('/warroom/leads/:id/stage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stage, notes, actor } = req.body;

    if (!stage) {
      return res.status(400).json({ success: false, error: { message: 'Target stage is required.' } });
    }

    const result = await warRoom.updateLeadStage(
      String(id),
      stage,
      actor || (req as any).user?.username || 'TELECALLER_DESK',
      notes
    );

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[WarRoom API] Update lead stage error:', err);
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to update lead stage.' } });
  }
});

/**
 * PATCH /api/v1/warroom/leads/:id/assign
 * Telecaller Desk: Reassign lead to an agent
 */
warRoomRouter.patch('/warroom/leads/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId, actor } = req.body;

    if (!agentId) {
      return res.status(400).json({ success: false, error: { message: 'Target agentId is required.' } });
    }

    const result = await warRoom.assignLead(
      String(id),
      agentId,
      actor || (req as any).user?.username || 'DESK_SUPERVISOR'
    );

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[WarRoom API] Assign lead error:', err);
    return res.status(500).json({ success: false, error: { message: err.message || 'Failed to assign lead.' } });
  }
});

/**
 * GET /api/v1/warroom/agents
 * Telecaller Desk: List active agents and their lead workload
 */
warRoomRouter.get('/warroom/agents', async (_req: Request, res: Response) => {
  try {
    const agents = await warRoom.listAgents();
    return res.json({ success: true, data: agents });
  } catch (err: any) {
    console.error('[WarRoom API] List agents error:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to list agents.' } });
  }
});


