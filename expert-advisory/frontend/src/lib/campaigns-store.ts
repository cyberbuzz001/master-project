import { CrmCampaign, CrmReferral, INITIAL_CAMPAIGNS, INITIAL_REFERRALS } from "./crm-data";

export interface PayoutRecord {
  id: string;
  referralId: string;
  partnerName: string;
  partnerCode: string;
  grossAmount: number;
  tdsRatePercent: number; // 5% Section 194H
  tdsDeducted: number;
  netPayoutAmount: number;
  utrNumber: string;
  paymentMode: "NEFT" | "RTGS" | "IMPS";
  processedAt: string;
  processedBy: string;
  status: "COMPLETED" | "FAILED";
}

class CampaignsStore {
  private campaigns: CrmCampaign[] = [];
  private referrals: CrmReferral[] = [];
  private payoutHistory: PayoutRecord[] = [];

  constructor() {
    this.campaigns = [...INITIAL_CAMPAIGNS];
    this.referrals = [...INITIAL_REFERRALS];
    this.payoutHistory = [
      {
        id: "PAY-2026-081",
        referralId: "REF-2026-099",
        partnerName: "Rajesh Singhania",
        partnerCode: "SINGH_HNI",
        grossAmount: 15000,
        tdsRatePercent: 5,
        tdsDeducted: 750,
        netPayoutAmount: 14250,
        utrNumber: "HDFCN2610029841",
        paymentMode: "NEFT",
        processedAt: "2026-10-02 14:30:00",
        processedBy: "Finance Desk (Accounts)",
        status: "COMPLETED",
      },
    ];
  }

  public getCampaigns(): CrmCampaign[] {
    return this.campaigns;
  }

  public getReferrals(): CrmReferral[] {
    return this.referrals;
  }

  public getPayoutHistory(): PayoutRecord[] {
    return this.payoutHistory;
  }

  public addCampaign(campaign: CrmCampaign): CrmCampaign {
    this.campaigns.unshift(campaign);
    return campaign;
  }

  public processPayout(referralId: string, utrNumber: string, processedBy: string = "Finance Desk"): PayoutRecord | null {
    const referral = this.referrals.find((r) => r.id === referralId);
    if (!referral) return null;

    referral.payoutStatus = "PAID";

    const gross = referral.rewardEarned || 0;
    const tds = Math.round(gross * 0.05); // 5% TDS u/s 194H
    const net = gross - tds;

    const record: PayoutRecord = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      referralId: referral.id,
      partnerName: referral.referrerName,
      partnerCode: referral.referrerCode,
      grossAmount: gross,
      tdsRatePercent: 5,
      tdsDeducted: tds,
      netPayoutAmount: net,
      utrNumber,
      paymentMode: "NEFT",
      processedAt: new Date().toISOString(),
      processedBy,
      status: "COMPLETED",
    };

    this.payoutHistory.unshift(record);
    return record;
  }
}

const globalForCampaigns = globalThis as unknown as { campaignsStore?: CampaignsStore };
export const campaignsStore = globalForCampaigns.campaignsStore || new CampaignsStore();
if (process.env.NODE_ENV !== "production") globalForCampaigns.campaignsStore = campaignsStore;
