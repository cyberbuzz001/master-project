import { CrmPayment, CrmInstallment, INITIAL_PAYMENTS, INITIAL_INSTALLMENTS } from "./crm-data";

export interface GstTaxInvoice {
  invoiceNumber: string;
  paymentId: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerPan?: string;
  customerAddress?: string;
  sacCode: string; // 998311 - Management & Financial Consulting / Advisory Services
  serviceDescription: string;
  baseAmount: number;
  cgstAmount: number; // 9%
  sgstAmount: number; // 9%
  igstAmount: number; // 18% for inter-state
  totalTaxAmount: number;
  totalInvoiceAmount: number;
  invoiceDate: string;
  paymentMode: string;
  transactionRef: string;
  sebiRegistrationNo: string; // INH000018942
  companyGstin: string; // 27AAACT2026M1Z2
  companyPan: string; // AAACT2026M
}

class InvoicesStore {
  private payments: CrmPayment[] = [];
  private installments: CrmInstallment[] = [];
  private invoices: GstTaxInvoice[] = [];

  constructor() {
    this.payments = [...INITIAL_PAYMENTS];
    this.installments = [...INITIAL_INSTALLMENTS];

    // Seed initial tax invoices for initial successful payments
    this.invoices = INITIAL_PAYMENTS.filter((p) => p.status === "SUCCESSFUL").map((p) => {
      const base = p.amount - p.gstAmount;
      const cgst = Math.round(p.gstAmount / 2);
      const sgst = p.gstAmount - cgst;

      return {
        invoiceNumber: p.invoiceNumber,
        paymentId: p.id,
        customerId: p.customerId,
        customerName: p.customerName,
        sacCode: "998311",
        serviceDescription: `${p.service} - SEBI Registered Research Advisory`,
        baseAmount: base,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: 0,
        totalTaxAmount: p.gstAmount,
        totalInvoiceAmount: p.amount,
        invoiceDate: p.date,
        paymentMode: p.gateway,
        transactionRef: p.transactionRef,
        sebiRegistrationNo: "INH000018942",
        companyGstin: "27AAACT2026M1Z2",
        companyPan: "AAACT2026M",
      };
    });
  }

  public getPayments(): CrmPayment[] {
    return this.payments;
  }

  public getInstallments(): CrmInstallment[] {
    return this.installments;
  }

  public getInvoices(): GstTaxInvoice[] {
    return this.invoices;
  }

  public recordPayment(payment: CrmPayment): { payment: CrmPayment; invoice: GstTaxInvoice } {
    this.payments.unshift(payment);

    const base = payment.amount - payment.gstAmount;
    const cgst = Math.round(payment.gstAmount / 2);
    const sgst = payment.gstAmount - cgst;

    const invoice: GstTaxInvoice = {
      invoiceNumber: payment.invoiceNumber,
      paymentId: payment.id,
      customerId: payment.customerId,
      customerName: payment.customerName,
      sacCode: "998311",
      serviceDescription: `${payment.service} - SEBI Registered Research Advisory Mandate`,
      baseAmount: base,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: 0,
      totalTaxAmount: payment.gstAmount,
      totalInvoiceAmount: payment.amount,
      invoiceDate: payment.date,
      paymentMode: payment.gateway,
      transactionRef: payment.transactionRef,
      sebiRegistrationNo: "INH000018942",
      companyGstin: "27AAACT2026M1Z2",
      companyPan: "AAACT2026M",
    };

    this.invoices.unshift(invoice);
    return { payment, invoice };
  }

  public submitUtr(installmentId: string, utrNumber: string, submittedBy: string = "Sales RM"): boolean {
    const inst = this.installments.find((i) => i.id === installmentId);
    if (!inst) return false;
    inst.status = "PENDING_VERIFICATION";
    inst.utrNumber = utrNumber;
    inst.submittedBy = submittedBy;
    return true;
  }

  public financeApprove(installmentId: string, verifiedBy: string = "Finance Manager"): CrmPayment | null {
    const inst = this.installments.find((i) => i.id === installmentId);
    if (!inst) return null;

    inst.status = "APPROVED";
    inst.verifiedBy = verifiedBy;
    inst.verifiedAt = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const gstVal = Math.round((inst.amount * 18) / 118);
    const newPayment: CrmPayment = {
      id: `PAY-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: inst.customerName,
      customerId: inst.customerId,
      amount: inst.amount,
      gstAmount: gstVal,
      service: "Advisory Installment Milestone",
      gateway: "Direct NEFT",
      status: "SUCCESSFUL",
      invoiceNumber: `ESC-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      transactionRef: inst.utrNumber || `VERIFIED-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      agent: inst.submittedBy || "Finance Desk",
      complianceApproved: true,
    };

    this.recordPayment(newPayment);
    return newPayment;
  }
}

const globalForInvoices = globalThis as unknown as { invoicesStore?: InvoicesStore };
export const invoicesStore = globalForInvoices.invoicesStore || new InvoicesStore();
if (process.env.NODE_ENV !== "production") globalForInvoices.invoicesStore = invoicesStore;
