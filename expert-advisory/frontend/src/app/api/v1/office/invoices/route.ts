import { NextRequest, NextResponse } from "next/server";
import { invoicesStore } from "@/lib/invoices-store";
import { requireStaffSession } from "@/lib/office-auth";

export async function GET(request: NextRequest) {
  const denied = await requireStaffSession(request);
  if (denied) return denied;
  try {
    const payments = invoicesStore.getPayments();
    const installments = invoicesStore.getInstallments();
    const invoices = invoicesStore.getInvoices();

    const totalCollections = payments
      .filter((p) => p.status === "SUCCESSFUL")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalGst = payments
      .filter((p) => p.status === "SUCCESSFUL")
      .reduce((sum, p) => sum + p.gstAmount, 0);

    const totalInstallmentReceivables = installments.reduce((sum, i) => sum + i.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        installments,
        invoices,
        metrics: {
          totalCollections,
          totalGst,
          totalInstallmentReceivables,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireStaffSession(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    switch (action) {
      case "RECORD_PAYMENT": {
        if (!payload || !payload.customerName || !payload.amount) {
          return NextResponse.json({ success: false, error: "customerName and amount are required." }, { status: 400 });
        }
        const result = invoicesStore.recordPayment(payload);
        return NextResponse.json({
          success: true,
          data: result,
          message: `Payment ${result.payment.id} recorded. GST invoice ${result.invoice.invoiceNumber} generated.`,
        });
      }

      case "SUBMIT_UTR": {
        const { installmentId, utrNumber, submittedBy } = payload || {};
        if (!installmentId || !utrNumber) {
          return NextResponse.json({ success: false, error: "installmentId and utrNumber are required." }, { status: 400 });
        }
        const success = invoicesStore.submitUtr(installmentId, utrNumber, submittedBy || "Sales RM");
        if (!success) {
          return NextResponse.json({ success: false, error: "Installment milestone not found." }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          message: `UTR #${utrNumber} queued for Finance Desk verification.`,
        });
      }

      case "FINANCE_APPROVE": {
        const { installmentId, verifiedBy } = payload || {};
        if (!installmentId) {
          return NextResponse.json({ success: false, error: "installmentId is required." }, { status: 400 });
        }
        const payment = invoicesStore.financeApprove(installmentId, verifiedBy || "Finance Manager");
        if (!payment) {
          return NextResponse.json({ success: false, error: "Installment milestone not found." }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          data: payment,
          message: `Bank credit confirmed. Tax invoice ${payment.invoiceNumber} generated.`,
        });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
