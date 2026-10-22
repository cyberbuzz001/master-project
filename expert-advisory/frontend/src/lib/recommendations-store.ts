import { INITIAL_RECOMMENDATIONS, type AdvisoryRecommendation } from "./crm-data";

export interface ExtendedRecommendation extends AdvisoryRecommendation {
  approvalStage?: "DRAFT" | "PENDING_SENIOR_REVIEW" | "PENDING_COMPLIANCE_GATE" | "READY_TO_BROADCAST" | "APPROVED" | "REJECTED";
  juniorAnalyst?: string;
  seniorReviewer?: string;
  complianceReviewer?: string;
  seniorComments?: string;
  complianceComments?: string;
  rrRatio?: string;
  contentHash?: string;
  conflictDeclared?: boolean;
  mfeReturn?: string;
  maeReturn?: string;
  target2Pnl?: string;
}

const SEED_APPROVAL_QUEUE: ExtendedRecommendation[] = [
  {
    id: "REC-2026-DRAFT-01",
    symbol: "INFY",
    exchange: "NSE",
    instrumentType: "EQUITY_CASH",
    direction: "BUY",
    entryRange: "1880 - 1900",
    target1: "2040",
    target2: "2160",
    stopLoss: "1820",
    timeHorizon: "2-3 Months",
    rationale: "Strong quarterly constant-currency deal pipeline; breakout from 6-month consolidation base on above-average institutional delivery volume.",
    advisor: "Kavita Rao (Junior RA)",
    approvalStatus: "PENDING_APPROVAL",
    approvalStage: "PENDING_SENIOR_REVIEW",
    juniorAnalyst: "Kavita Rao",
    status: "ACTIVE",
    pnlReturn: "0.0%",
    publishedAt: "Drafted Today, 09:15 AM",
    complianceChecked: false,
    eligibleSegments: ["Equity Cash", "HNI Bespoke"],
    rrRatio: "1 : 2.05",
    conflictDeclared: true,
    contentHash: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  },
  {
    id: "REC-2026-DRAFT-02",
    symbol: "BANKNIFTY 52000 CE",
    exchange: "NSE",
    instrumentType: "INDEX_OPTIONS",
    direction: "BUY",
    entryRange: "310 - 325",
    target1: "460",
    target2: "580",
    stopLoss: "250",
    timeHorizon: "Weekly Expiry",
    rationale: "Private bank credit revival; Put Call Ratio (PCR) at 1.34 with open interest unwinding at 51800 PE.",
    advisor: "Dr. Ananya Ray",
    approvalStatus: "PENDING_APPROVAL",
    approvalStage: "PENDING_COMPLIANCE_GATE",
    juniorAnalyst: "Sameer Joshi",
    seniorReviewer: "Dr. Ananya Ray (Head of Research)",
    seniorComments: "R:R of 1:2.2 verified against implied volatility term structure. Levels cleared for compliance gate.",
    status: "ACTIVE",
    pnlReturn: "0.0%",
    publishedAt: "Reviewed Today, 09:45 AM",
    complianceChecked: false,
    eligibleSegments: ["Index Derivatives Alpha", "HNI Bespoke"],
    rrRatio: "1 : 2.20",
    conflictDeclared: true,
    contentHash: "f6e5d4c3b2a10987fedcba0987654321fedcba0987654321fedcba0987654321",
  },
];

class RecommendationsStore {
  private publishedRecs: ExtendedRecommendation[] = [];
  private queue: ExtendedRecommendation[] = [];

  constructor() {
    this.publishedRecs = INITIAL_RECOMMENDATIONS.map((r) => ({
      ...r,
      approvalStage: "APPROVED",
      seniorReviewer: r.approvedBy || "Dr. Ananya Ray",
      complianceReviewer: "Adv. Rajesh Kothari (Compliance Officer)",
      rrRatio: "1 : 2.45",
      mfeReturn: "+12.4%",
      maeReturn: "-1.8%",
      contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      conflictDeclared: true,
    }));
    this.queue = [...SEED_APPROVAL_QUEUE];
  }

  public getPublished(): ExtendedRecommendation[] {
    return this.publishedRecs;
  }

  public getQueue(): ExtendedRecommendation[] {
    return this.queue;
  }

  public addDraft(draft: ExtendedRecommendation): ExtendedRecommendation {
    this.queue.unshift(draft);
    return draft;
  }

  public seniorApprove(id: string, reviewer: string = "Dr. Ananya Ray (Head of Research)"): boolean {
    const item = this.queue.find((r) => r.id === id);
    if (!item) return false;
    item.approvalStage = "PENDING_COMPLIANCE_GATE";
    item.seniorReviewer = reviewer;
    item.seniorComments = "R:R ratio, stop loss invalidation, and liquidity validated. Passed to Compliance Gate.";
    return true;
  }

  public compliancePass(id: string, reviewer: string = "Adv. Rajesh Kothari (Compliance Officer)"): boolean {
    const item = this.queue.find((r) => r.id === id);
    if (!item) return false;
    item.approvalStage = "READY_TO_BROADCAST";
    item.complianceReviewer = reviewer;
    item.complianceChecked = true;
    item.complianceComments = "Regulatory profile verified, conflict declarations audited, statutory disclaimer bound.";
    return true;
  }

  public broadcast(id: string): ExtendedRecommendation | null {
    const idx = this.queue.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const [item] = this.queue.splice(idx, 1);
    const published: ExtendedRecommendation = {
      ...item,
      approvalStage: "APPROVED",
      approvalStatus: "APPROVED",
      publishedAt: "Today, Just now",
      pnlReturn: "+0.0%",
    };
    this.publishedRecs.unshift(published);
    return published;
  }

  public updateOutcome(id: string, status: AdvisoryRecommendation["status"], pnl: string): boolean {
    const item = this.publishedRecs.find((r) => r.id === id);
    if (!item) return false;
    item.status = status;
    item.pnlReturn = pnl;
    return true;
  }
}

const globalForRecs = globalThis as unknown as { recommendationsStore?: RecommendationsStore };
export const recommendationsStore = globalForRecs.recommendationsStore || new RecommendationsStore();
if (process.env.NODE_ENV !== "production") globalForRecs.recommendationsStore = recommendationsStore;
