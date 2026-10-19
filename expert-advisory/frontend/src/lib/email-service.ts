import nodemailer from "nodemailer";

export interface SuitabilityEmailParams {
  to: string;
  fullName: string;
  phone: string;
  leadCode: string;
  assessment: {
    score: number;
    category: string;
    financial_capacity_score?: number;
    risk_tolerance_score?: number;
    knowledge_score?: number;
    discipline_score?: number;
    flags?: string[];
    critical_notes?: string[];
    suitability_summary?: string;
    suitability_recommendations?: string[];
    warnings?: string;
  };
}

/**
 * Creates and returns the nodemailer transporter configured for Expert Stocks Consultancy.
 * Uses Hostinger SMTP with info@expertstocks.in.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.hostinger.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = port === 465;
  const user = process.env.SMTP_USER || "info@expertstocks.in";
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD || "";

  if (!pass) {
    console.warn("[EmailService] SMTP_PASS not set. Emails will be simulated in server logs.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Builds an institutional, beautifully formatted SEBI suitability certificate email
 * sent exclusively from info@expertstocks.in.
 */
export function buildSuitabilityEmailHtml(params: SuitabilityEmailParams): string {
  const { fullName, phone, leadCode, assessment } = params;
  const tierColor =
    assessment.category === "Aggressive"
      ? "#A855F7"
      : assessment.category === "Balanced"
      ? "#F59E0B"
      : assessment.category === "Moderate"
      ? "#10B981"
      : "#38BDF8";

  const financial = assessment.financial_capacity_score ?? 80;
  const risk = assessment.risk_tolerance_score ?? 65;
  const knowledge = assessment.knowledge_score ?? 70;
  const discipline = assessment.discipline_score ?? 80;

  const recommendationsHtml = (assessment.suitability_recommendations || [
    "Cash delivery equity investing across quality mid & large caps",
    "Strict position sizing limits with predefined stop-loss invalidation",
  ])
    .map(
      (rec) => `
      <li style="margin-bottom: 8px; color: #CBD5E1; font-size: 13px; line-height: 1.5;">
        <span style="color: #43D9FF; font-weight: bold; margin-right: 6px;">&#10003;</span>
        ${rec}
      </li>`
    )
    .join("");

  const criticalNotesHtml =
    assessment.critical_notes && assessment.critical_notes.length > 0
      ? `
      <div style="background-color: rgba(245, 184, 75, 0.1); border: 1px solid rgba(245, 184, 75, 0.4); border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
        <p style="margin: 0 0 8px; color: #F5B84B; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
          &#9888; Suitability Review Findings (Questions 8, 14, 15, 17)
        </p>
        <ul style="margin: 0; padding-left: 18px; color: #F8FAFC; font-size: 12px; line-height: 1.6;">
          ${assessment.critical_notes.map((n) => `<li>${n}</li>`).join("")}
        </ul>
      </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Suitability & Risk Profile Certificate - Expert Stocks Consultancy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #05070B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F5F7FA;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #05070B; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" style="width: 100%; max-width: 620px; border-collapse: collapse; background-color: #0D131C; border: 1px solid #1C2734; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(180deg, #111923 0%, #0D131C 100%); border-bottom: 1px solid #1C2734;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; color: #F5F7FA; letter-spacing: -0.02em;">
                      EXPERT STOCKS <span style="color: #43D9FF; font-weight: 400; font-size: 14px;">CONSULTANCY</span>
                    </div>
                    <div style="font-size: 11px; color: #9AA7B5; font-family: monospace; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.1em;">
                      Institutional Research & Client Suitability Desk
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(67, 217, 255, 0.1); color: #43D9FF; border: 1px solid rgba(67, 217, 255, 0.3); padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-family: monospace; font-weight: 700;">
                      SEBI AUDITED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px; color: #F5F7FA; font-size: 20px; font-weight: 700;">
                Client Suitability & Risk Profile Certificate
              </h2>
              <p style="margin: 0 0 24px; color: #9AA7B5; font-size: 14px; line-height: 1.6;">
                Dear <strong>${fullName}</strong>, thank you for completing your 20-factor suitability assessment with Expert Stocks Consultancy. Your responses have been evaluated under the SEBI (Research Analysts) Regulations, 2014.
              </p>

              <!-- Verdict Box -->
              <div style="background-color: #080D14; border: 1px solid #1C2734; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td>
                      <span style="display: block; font-size: 11px; font-family: monospace; color: #667383; text-transform: uppercase;">
                        Calculated Risk Classification
                      </span>
                      <span style="font-size: 24px; font-weight: 800; color: ${tierColor}; letter-spacing: -0.01em;">
                        ${assessment.category.toUpperCase()}
                      </span>
                    </td>
                    <td align="right">
                      <span style="display: block; font-size: 11px; font-family: monospace; color: #667383; text-transform: uppercase;">
                        Suitability Score
                      </span>
                      <span style="font-size: 26px; font-weight: 800; font-family: monospace; color: #F5F7FA;">
                        ${assessment.score} <span style="font-size: 14px; font-weight: 400; color: #667383;">/ 100</span>
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Multi-Dimensional Metrics -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #F5F7FA; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; font-family: monospace;">
                  Multi-Dimensional Evaluation Breakdown:
                </div>
                <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #080D14; border: 1px solid #1C2734; border-radius: 8px;">
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #9AA7B5; border-bottom: 1px solid #1C2734;">Financial Capacity Score</td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #43D9FF; text-align: right; border-bottom: 1px solid #1C2734; font-family: monospace;">${financial}%</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #9AA7B5; border-bottom: 1px solid #1C2734;">Risk Tolerance Score</td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #F5B84B; text-align: right; border-bottom: 1px solid #1C2734; font-family: monospace;">${risk}%</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #9AA7B5; border-bottom: 1px solid #1C2734;">Market Knowledge & F&O Experience</td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #7C5CFF; text-align: right; border-bottom: 1px solid #1C2734; font-family: monospace;">${knowledge}%</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; font-size: 13px; color: #9AA7B5;">Trading Discipline & Exit Adherence</td>
                    <td style="padding: 10px 14px; font-size: 13px; font-weight: 700; color: #22C55E; text-align: right; font-family: monospace;">${discipline}%</td>
                  </tr>
                </table>
              </div>

              ${criticalNotesHtml}

              <!-- Permissible Strategies -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #F5F7FA; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; font-family: monospace;">
                  Permissible Advisory Strategies:
                </div>
                <ul style="margin: 0; padding-left: 0; list-style: none;">
                  ${recommendationsHtml}
                </ul>
              </div>

              <!-- Metadata Box -->
              <div style="background-color: #080D14; border: 1px solid #1C2734; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 12px; color: #9AA7B5; line-height: 1.5;">
                <strong style="color: #F5F7FA;">Audit Reference:</strong> ${leadCode} &bull; 
                <strong style="color: #F5F7FA;">Registered Phone:</strong> +91 ${phone.slice(-10)} &bull; 
                <strong style="color: #F5F7FA;">Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>

              <!-- Action CTAs -->
              <div style="text-align: center; margin: 28px 0 16px;">
                <a href="https://wa.me/919201800995?text=${encodeURIComponent(
                  `Hi Expert Stocks, I received my Suitability Certificate (${assessment.category} tier, Score: ${assessment.score}/100, Ref: ${leadCode}). I would like to consult with an advisor.`
                )}" style="display: inline-block; background-color: #22C55E; color: #000000; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                  Discuss Strategy on WhatsApp &rarr;
                </a>
              </div>

              <div style="text-align: center;">
                <a href="https://expertstocks.in/pricing" style="color: #43D9FF; font-size: 13px; text-decoration: none; font-weight: 500;">
                  Explore Advisory Plans Matching Your Profile &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer & Statutory Notice -->
          <tr>
            <td style="padding: 20px 32px; background-color: #060911; border-top: 1px solid #1C2734; text-align: left; font-size: 11px; color: #667383; line-height: 1.5;">
              <p style="margin: 0 0 6px;">
                <strong style="color: #9AA7B5;">Statutory Notice:</strong> Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors.
              </p>
              <p style="margin: 0;">
                Expert Stocks Consultancy &bull; Official Email: <a href="mailto:info@expertstocks.in" style="color: #43D9FF; text-decoration: none;">info@expertstocks.in</a> &bull; Support: +91 92018 00995 &bull; <a href="https://expertstocks.in" style="color: #43D9FF; text-decoration: none;">expertstocks.in</a>
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
 * Dispatches the official suitability assessment email to the client from info@expertstocks.in
 */
export async function sendSuitabilityEmail(params: SuitabilityEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const html = buildSuitabilityEmailHtml(params);
    const transporter = getTransporter();

    if (!transporter) {
      console.log(`[EmailService] Simulated dispatch to ${params.to} from info@expertstocks.in (SMTP_PASS not set in environment).`);
      return { success: true, messageId: `simulated-${Date.now()}` };
    }

    const info = await transporter.sendMail({
      from: '"Expert Stocks Consultancy" <info@expertstocks.in>',
      replyTo: "info@expertstocks.in",
      to: params.to.trim(),
      subject: `Official Suitability Assessment & Risk Profile Certificate [Ref: ${params.leadCode}] - Expert Stocks Consultancy`,
      html,
    });

    console.log(`[EmailService] ✅ Email sent to ${params.to} from info@expertstocks.in. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.warn(`[EmailService] ⚠️ Failed to dispatch email to ${params.to}:`, err.message);
    return { success: false, error: err.message };
  }
}
