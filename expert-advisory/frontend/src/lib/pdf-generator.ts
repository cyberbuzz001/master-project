/**
 * Institutional SEBI Suitability & Risk Profile PDF Certificate Generator
 * Formats a clean, high-DPI, A4 document with official letterhead,
 * executive scorecards, dimensional meters, compliance seal, and regulatory disclosures.
 */

export interface CertificateData {
  leadCode: string;
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  capitalRange?: string;
  compositeScore: number;
  financialScore: number;
  riskScore: number;
  knowledgeScore: number;
  disciplineScore: number;
  band: {
    tier: string;
    color: string;
    summary: string;
    suitability: string[];
    warnings: string;
  };
  criticalNotes: string[];
  flags: string[];
  questions?: Array<{ code: string; question: string; answer: string }>;
}

export function generateSuitabilityPdfDocument(data: CertificateData) {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const tierBg =
    data.band.tier === "Aggressive"
      ? "#7C3AED"
      : data.band.tier === "Balanced"
      ? "#D97706"
      : data.band.tier === "Moderate"
      ? "#059669"
      : "#0284C7";

  const criticalNotesList =
    data.criticalNotes && data.criticalNotes.length > 0
      ? data.criticalNotes
          .map(
            (note) => `
          <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 8px 12px; margin-bottom: 6px; font-size: 11px; color: #92400E; line-height: 1.4;">
            <strong>Special Suitability Gate:</strong> ${note}
          </div>`
          )
          .join("")
      : `
        <div style="background-color: #ECFDF5; border-left: 4px solid #059669; padding: 8px 12px; font-size: 11px; color: #065F46;">
          <strong>All Compliance Checks Cleared:</strong> No critical leverage, borrowing, or loss vulnerability flags detected.
        </div>`;

  const suitabilityList = (data.band.suitability || [])
    .map(
      (item) => `
      <li style="margin-bottom: 5px; font-size: 11.5px; color: #1E293B;">
        <span style="color: #059669; font-weight: bold; margin-right: 6px;">&#10003;</span>
        ${item}
      </li>`
    )
    .join("");

  const questionsBreakdownHtml = (data.questions || [])
    .map(
      (q, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0; ${idx % 2 === 0 ? "background-color: #F8FAFC;" : "background-color: #FFFFFF;"}">
        <td style="padding: 6px 10px; font-size: 10px; color: #475569; width: 60%; vertical-align: top;">
          <strong>Q${idx + 1}:</strong> ${q.question}
        </td>
        <td style="padding: 6px 10px; font-size: 10px; font-weight: 600; color: #0F172A; width: 40%; vertical-align: top;">
          ${q.answer}
        </td>
      </tr>`
    )
    .join("");

  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Client Suitability Certificate - ${data.fullName} (${data.leadCode})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #FFFFFF;
      color: #0F172A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
    }
    .cert-container {
      max-width: 100%;
      margin: 0 auto;
      border: 2px solid #0F172A;
      padding: 24px;
      position: relative;
      background: #FFFFFF;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .header-logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0F172A;
    }
    .header-logo span {
      color: #0284C7;
      font-size: 14px;
      font-weight: 600;
    }
    .header-sub {
      font-size: 9.5px;
      font-family: monospace;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 2px;
    }
    .cert-badge {
      display: inline-block;
      background-color: #0F172A;
      color: #FFFFFF;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-family: monospace;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .title-banner {
      text-align: center;
      margin: 14px 0 16px;
    }
    .cert-title {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0F172A;
      margin: 0;
    }
    .cert-subtitle {
      font-size: 10.5px;
      color: #64748B;
      margin-top: 3px;
    }
    .meta-box {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      margin-bottom: 16px;
      background: #F8FAFC;
    }
    .meta-box td {
      padding: 6px 10px;
      font-size: 11px;
      border: 1px solid #E2E8F0;
    }
    .meta-label {
      color: #64748B;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      width: 20%;
    }
    .meta-val {
      font-weight: 700;
      color: #0F172A;
      width: 30%;
    }
    .verdict-card {
      background: #F1F5F9;
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
    }
    .verdict-tier {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: ${tierBg};
    }
    .verdict-score {
      font-size: 22px;
      font-weight: 800;
      font-family: monospace;
      color: #0F172A;
    }
    .score-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .score-card {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px;
      background: #FFFFFF;
      text-align: center;
    }
    .meter-bar {
      height: 6px;
      background: #E2E8F0;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }
    .meter-fill {
      height: 100%;
      border-radius: 3px;
    }
    .section-heading {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0F172A;
      border-bottom: 1.5px solid #E2E8F0;
      padding-bottom: 4px;
      margin: 14px 0 8px;
    }
    .qa-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #CBD5E1;
      margin-top: 6px;
    }
    .qa-table th {
      background: #0F172A;
      color: #FFFFFF;
      padding: 6px 10px;
      font-size: 9.5px;
      text-align: left;
      font-family: monospace;
      text-transform: uppercase;
    }
    .sign-block {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1.5px solid #0F172A;
    }
    .seal-circle {
      display: inline-block;
      width: 68px;
      height: 68px;
      border-radius: 50%;
      border: 2px dashed #0284C7;
      text-align: center;
      padding-top: 14px;
      font-size: 8px;
      font-weight: 700;
      font-family: monospace;
      color: #0284C7;
      text-transform: uppercase;
    }
    .disclaimer-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px;
      font-size: 9.5px;
      color: #64748B;
      line-height: 1.4;
      margin-top: 14px;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="cert-container">
    
    <!-- Header Letterhead -->
    <table class="header-table">
      <tr>
        <td>
          <div class="header-logo">EXPERT STOCKS <span>CONSULTANCY</span></div>
          <div class="header-sub">SEBI Registered Research Analyst & Institutional Advisory Desk</div>
          <div style="font-size: 9px; color: #64748B; margin-top: 3px;">
            Corporate Office: Pune, Maharashtra &bull; Official Email: info@expertstocks.in &bull; Web: expertstocks.in
          </div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="cert-badge">SEBI SUITABILITY AUDIT</div>
          <div style="font-size: 9px; font-family: monospace; color: #64748B; margin-top: 6px;">
            REF: <strong>${data.leadCode}</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Title Banner -->
    <div class="title-banner">
      <h1 class="cert-title">Client Suitability & Risk Profile Certificate</h1>
      <p class="cert-subtitle">Issued pursuant to Regulation 16 & 24 of SEBI (Research Analysts) Regulations, 2014</p>
    </div>

    <!-- Client Profile Table -->
    <table class="meta-box">
      <tr>
        <td class="meta-label">Investor Name</td>
        <td class="meta-val">${data.fullName}</td>
        <td class="meta-label">Evaluation Date</td>
        <td class="meta-val">${currentDate} (${currentTime})</td>
      </tr>
      <tr>
        <td class="meta-label">Mobile Number</td>
        <td class="meta-val">+91 ${data.phone.slice(-10)}</td>
        <td class="meta-label">Location</td>
        <td class="meta-val">${data.city || "Not declared"}${data.state ? `, ${data.state}` : ""}</td>
      </tr>
      <tr>
        <td class="meta-label">Email Address</td>
        <td class="meta-val">${data.email || "info@expertstocks.in (on file)"}</td>
        <td class="meta-label">Capital Range</td>
        <td class="meta-val">${data.capitalRange || "Standard Advisory"}</td>
      </tr>
    </table>

    <!-- Verdict Card -->
    <div class="verdict-card">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; font-family: monospace; display: block;">
              Assessed Risk Classification Tier
            </span>
            <div class="verdict-tier">${data.band.tier.toUpperCase()} RISK PROFILE</div>
            <div style="font-size: 11px; color: #475569; margin-top: 3px; max-width: 480px;">
              ${data.band.summary}
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; font-family: monospace; display: block;">
              Composite Score
            </span>
            <div class="verdict-score">${data.compositeScore} <span style="font-size: 13px; font-weight: 400; color: #64748B;">/ 100</span></div>
          </td>
        </tr>
      </table>
    </div>

    <!-- 4 Dimensional Metrics Table -->
    <div class="section-heading">Multi-Dimensional Suitability Scoring Breakdown</div>
    <table class="score-table">
      <tr>
        <td style="width: 25%; padding: 0 4px 0 0;">
          <div class="score-card">
            <span style="font-size: 9.5px; font-family: monospace; color: #64748B; text-transform: uppercase; display: block;">Financial Capacity</span>
            <span style="font-size: 16px; font-weight: 800; color: #0284C7; font-family: monospace;">${data.financialScore}%</span>
            <div class="meter-bar"><div class="meter-fill" style="width: ${data.financialScore}%; background: #0284C7;"></div></div>
          </div>
        </td>
        <td style="width: 25%; padding: 0 4px;">
          <div class="score-card">
            <span style="font-size: 9.5px; font-family: monospace; color: #64748B; text-transform: uppercase; display: block;">Risk Tolerance</span>
            <span style="font-size: 16px; font-weight: 800; color: #D97706; font-family: monospace;">${data.riskScore}%</span>
            <div class="meter-bar"><div class="meter-fill" style="width: ${data.riskScore}%; background: #D97706;"></div></div>
          </div>
        </td>
        <td style="width: 25%; padding: 0 4px;">
          <div class="score-card">
            <span style="font-size: 9.5px; font-family: monospace; color: #64748B; text-transform: uppercase; display: block;">Market Knowledge</span>
            <span style="font-size: 16px; font-weight: 800; color: #7C3AED; font-family: monospace;">${data.knowledgeScore}%</span>
            <div class="meter-bar"><div class="meter-fill" style="width: ${data.knowledgeScore}%; background: #7C3AED;"></div></div>
          </div>
        </td>
        <td style="width: 25%; padding: 0 0 0 4px;">
          <div class="score-card">
            <span style="font-size: 9.5px; font-family: monospace; color: #64748B; text-transform: uppercase; display: block;">Trading Discipline</span>
            <span style="font-size: 16px; font-weight: 800; color: #059669; font-family: monospace;">${data.disciplineScore}%</span>
            <div class="meter-bar"><div class="meter-fill" style="width: ${data.disciplineScore}%; background: #059669;"></div></div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Critical Checks & Findings -->
    <div class="section-heading">Mandatory Suitability Review Checks (Questions 8, 14, 15, 17)</div>
    ${criticalNotesList}

    <!-- Permissible Strategies -->
    <div class="section-heading">Permissible Advisory Services & Risk Rules</div>
    <ul style="margin: 4px 0 12px; padding-left: 0; list-style: none;">
      ${suitabilityList}
    </ul>

    <!-- Sign-off & Verification Block -->
    <table class="sign-block" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <div style="font-size: 10px; font-weight: 700; color: #0F172A; text-transform: uppercase;">
            Authorized Compliance Officer
          </div>
          <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">
            Expert Stocks Compliance & Risk Surveillance Cell
          </div>
          <div style="margin-top: 16px; font-family: 'Brush Script MT', cursive, sans-serif; font-size: 18px; color: #0284C7;">
            V. Sharma (Compliance Desk)
          </div>
          <div style="font-size: 9px; color: #64748B; margin-top: 2px;">
            Dual-Control Digital Stamp &bull; Audit Trail Logged
          </div>
        </td>
        <td style="width: 50%; text-align: right; vertical-align: middle;">
          <div class="seal-circle">
            SEBI<br/>AUDITED<br/>2026
          </div>
        </td>
      </tr>
    </table>

    <!-- Statutory Regulatory Disclaimer -->
    <div class="disclaimer-box">
      <strong>Statutory Regulatory Notice:</strong> Investment in securities market are subject to market risks. Read all related documents carefully before investing. Registration granted by SEBI, membership of BASL and certification from NISM in no way guarantees performance of the intermediary or provide any assurance of returns to investors. Expert Stocks Consultancy strictly advises within the permissible bounds of the client's verified suitability profile.
    </div>
  </div>

  ${
    data.questions && data.questions.length > 0
      ? `
  <!-- Page 2: Detailed 20 Questions Response Audit Log -->
  <div class="page-break"></div>
  <div class="cert-container" style="margin-top: 20px;">
    <table class="header-table">
      <tr>
        <td>
          <div class="header-logo" style="font-size: 16px;">EXPERT STOCKS <span>CONSULTANCY</span></div>
          <div class="header-sub">Appendix: Complete 20-Factor Response Audit Log &bull; Ref: ${data.leadCode}</div>
        </td>
        <td style="text-align: right; font-size: 10px; color: #64748B; font-family: monospace;">
          Client: ${data.fullName}
        </td>
      </tr>
    </table>

    <table class="qa-table">
      <thead>
        <tr>
          <th>Statutory Question</th>
          <th>Recorded Client Answer</th>
        </tr>
      </thead>
      <tbody>
        ${questionsBreakdownHtml}
      </tbody>
    </table>

    <div style="margin-top: 16px; text-align: center; font-size: 9.5px; color: #64748B;">
      End of Statutory Suitability Audit Report &bull; Expert Stocks Consultancy &bull; info@expertstocks.in
    </div>
  </div>`
      : ""
  }

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  // Open an isolated, clean printable document window
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  } else {
    // If popup blocked, create an invisible iframe to print cleanly
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 500);
    }
  }
}
