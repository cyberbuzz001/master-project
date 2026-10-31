import { NextRequest, NextResponse } from "next/server";
import { leadsStore } from "@/lib/leads-store";
import { requireStaffSession } from "@/lib/office-auth";
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  sendAdvisoryLeadWelcome,
  sendKycNudgeWhatsApp,
  sendPlanActivationWhatsApp,
  sendRiskAssessmentCertWhatsApp,
  sendResearchReportAlertWhatsApp,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp-service";

export async function GET(request: NextRequest) {
  const denied = await requireStaffSession(request);
  if (denied) return denied;
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get("leadId") || "";
    const phone = searchParams.get("phone") || "";

    if (leadId || phone) {
      const messages = leadsStore.getWhatsAppMessages(leadId || phone);
      return NextResponse.json({
        success: true,
        data: messages,
        total: messages.length,
      });
    }

    const allThreads = leadsStore.getAllWhatsAppThreads();
    return NextResponse.json({
      success: true,
      data: allThreads,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireStaffSession(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const { leadId, phone, text, templateName, templateParams, clientName } = body;

    const targetPhone = phone || (leadId ? leadsStore.getLead(leadId)?.mobile : null);
    if (!targetPhone) {
      return NextResponse.json(
        { success: false, message: "A valid recipient phone number is required" },
        { status: 400 }
      );
    }

    const cleanPhone = normalizeWhatsAppNumber(targetPhone);
    let dispatchResult: { success: boolean; messageId?: string; error?: string };
    let recordedText = text || "";
    let usedTemplate = templateName;

    // 1. Template-based dispatch
    if (templateName === "adv_lead_welcome") {
      const ref = leadId || templateParams?.[1] || "EXP-2026";
      const name = clientName || templateParams?.[0] || "Investor";
      dispatchResult = await sendAdvisoryLeadWelcome(cleanPhone, name, ref);
      recordedText = `[Template: adv_lead_welcome] Thank you for your interest in Expert Stocks Advisory, ${name}. Our SEBI-registered research team has noted your profile (Ref: ${ref}).`;
    } else if (templateName === "adv_risk_assessment_cert") {
      const name = clientName || templateParams?.[0] || "Investor";
      const tier = templateParams?.[1] || "Moderate / Growth";
      const ref = leadId || templateParams?.[2] || "RPM-2026";
      dispatchResult = await sendRiskAssessmentCertWhatsApp(cleanPhone, name, tier, ref);
      recordedText = `[Template: adv_risk_assessment_cert] Hello ${name}, Your Risk Assessment with Expert Stocks Consultancy has been completed successfully. Assigned Risk Tier: ${tier}. Reference: ${ref}.`;
    } else if (templateName === "adv_kyc_nudge") {
      const name = clientName || templateParams?.[0] || "Investor";
      const ref = leadId || templateParams?.[1] || "EXP-2026";
      dispatchResult = await sendKycNudgeWhatsApp(cleanPhone, name, ref);
      recordedText = `[Template: adv_kyc_nudge] Hello ${name}, gentle reminder regarding your onboarding profile (Ref: ${ref}). Please complete your risk assessment to activate advisory services.`;
    } else if (templateName === "adv_plan_activation") {
      const name = clientName || templateParams?.[0] || "Valued Client";
      const plan = templateParams?.[1] || "Index Options Alpha";
      const clientId = leadId || templateParams?.[2] || "CLI-2026";
      dispatchResult = await sendPlanActivationWhatsApp(cleanPhone, name, plan, clientId);
      recordedText = `[Template: adv_plan_activation] Welcome to Expert Stocks Consultancy, ${name}! Your subscription to the ${plan} plan is now active (Client ID: ${clientId}).`;
    } else if (templateName === "adv_research_report") {
      const name = clientName || templateParams?.[0] || "Investor";
      const title = templateParams?.[1] || "Nifty Weekly Technical Outlook";
      const repRef = leadId || templateParams?.[2] || "REP-2026";
      dispatchResult = await sendResearchReportAlertWhatsApp(cleanPhone, name, title, repRef);
      recordedText = `[Template: adv_research_report] Hello ${name}, our research analysts published a new report: ${title} (Ref: ${repRef}).`;
    } else if (templateName) {
      dispatchResult = await sendWhatsAppTemplate({
        to: cleanPhone,
        templateName,
        parameters: templateParams,
      });
      recordedText = `[Template: ${templateName}] ${text || ""}`;
    } else if (text) {
      // 2. Direct session text dispatch
      dispatchResult = await sendWhatsAppText({
        to: cleanPhone,
        text,
      });
    } else {
      return NextResponse.json(
        { success: false, message: "Either text or a valid templateName is required" },
        { status: 400 }
      );
    }

    if (!dispatchResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: dispatchResult.error || "Failed to dispatch WhatsApp message via Meta Cloud API",
        },
        { status: 502 }
      );
    }

    // 3. Record outbound message in persistent store
    const key = leadId || cleanPhone;
    const savedMsg = leadsStore.recordWhatsAppMessage(key, {
      text: recordedText,
      sender: "rep",
      status: "sent",
      templateName: usedTemplate,
    });

    return NextResponse.json(
      {
        success: true,
        messageId: dispatchResult.messageId,
        data: savedMsg,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
