export type CrmModuleId =
  | "dashboard"
  | "leads"
  | "customers"
  | "pipeline"
  | "ai_assistant"
  | "calling"
  | "whatsapp"
  | "tasks"
  | "appointments"
  | "subscriptions"
  | "payments"
  | "advisory"
  | "recommendations"
  | "portfolio"
  | "renewals"
  | "retention"
  | "campaigns"
  | "referrals"
  | "support"
  | "reports"
  | "ai_intelligence"
  | "team"
  | "settings"
  | "audit_logs"
  | "compliance";

export type CrmRole =
  | "super_admin"
  | "management"
  | "sales_manager"
  | "sales_agent"
  | "advisor"
  | "relationship_manager"
  | "support_agent"
  | "finance"
  | "compliance";

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  role: CrmRole;
  avatar?: string;
  department: string;
  conversionRate: number;
  revenueThisMonth: number;
  leadsHandled: number;
}

export type LeadTemperature = "VERY_HOT" | "HOT" | "WARM" | "COLD" | "LOW_PRIORITY";
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "INTERESTED"
  | "QUALIFIED"
  | "CONSULTATION_SCHEDULED"
  | "OFFER_PRESENTED"
  | "PAYMENT_PENDING"
  | "CONVERTED"
  | "ONBOARDING"
  | "ACTIVE_CLIENT"
  | "RENEWAL"
  | "LOST";

export interface CrmLead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  whatsapp: string;
  city: string;
  state: string;
  country: string;
  source: string;
  campaign: string;
  landingPage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referralSource?: string;
  assignedAgent: string;
  status: LeadStatus;
  temperature: LeadTemperature;
  aiScore: number; // 0-100
  aiScoreRationale: string;
  aiNextAction: string;
  aiNextActionWhy: string;
  investmentExperience: "None" | "<1 Year" | "1-3 Years" | "3-5 Years" | "5+ Years";
  tradingExperience: "Equity Cash" | "Index Options" | "Stock F&O" | "Commodities" | "HNI Portfolio";
  preferredMarket: "NSE Equities" | "Nifty/BankNifty F&O" | "MCX Commodities" | "Swing Equity";
  preferredService: string;
  budget: string;
  estimatedValue: number;
  riskPreference: "Conservative" | "Moderate" | "Aggressive";
  lastContacted: string;
  nextFollowUp: string;
  callsCount: number;
  npcAttempts: number;
  whatsappCount: number;
  conversationsCount: number;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer360 {
  id: string;
  leadId: string;
  name: string;
  mobile: string;
  email: string;
  customerCode: string; // ESC-2026-XXXX
  status: "ACTIVE" | "PENDING_KYC" | "RENEWAL_DUE" | "EXPIRED" | "SUSPENDED";
  customerValue: number;
  aiScore: number;
  healthScore: "Healthy" | "Needs Attention" | "At Risk";
  healthRationale: string;
  riskCategory: "Conservative" | "Moderate" | "Aggressive";
  riskScore: number;
  kycStatus: "VERIFIED" | "PENDING" | "REJECTED";
  panMasked: string;
  aadhaarMasked: string;
  currentSubscription: {
    planName: string;
    startDate: string;
    expiryDate: string;
    daysRemaining: number;
    amount: number;
  };
  relationshipManager: string;
  assignedAdvisor: string;
  joinedDate: string;
  portfolioSize: string;
  openPositionsCount: number;
  realizedPnlPercent: string;
  satisfactionRating: number; // 1-5
}

export interface TimelineEvent {
  id: string;
  customerId: string;
  timestamp: string;
  type:
    | "CALL"
    | "WHATSAPP"
    | "EMAIL"
    | "NOTE"
    | "TASK"
    | "PAYMENT"
    | "SUBSCRIPTION"
    | "ADVISORY"
    | "COMPLAINT"
    | "KYC";
  title: string;
  description: string;
  agent: string;
  meta?: Record<string, any>;
}

export interface AdvisoryRecommendation {
  id: string; // REC-2026-XXXX
  symbol: string;
  exchange: "NSE" | "BSE" | "MCX";
  instrumentType: "EQUITY_CASH" | "INDEX_OPTIONS" | "STOCK_FUTURES" | "COMMODITY";
  direction: "BUY" | "SELL";
  entryRange: string;
  target1: string;
  target2: string;
  stopLoss: string;
  timeHorizon: string;
  rationale: string;
  advisor: string;
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
  approvedBy?: string;
  status: "ACTIVE" | "TARGET_1_HIT" | "TARGET_2_HIT" | "STOPLOSS_HIT" | "CLOSED";
  pnlReturn: string;
  publishedAt: string;
  complianceChecked: boolean;
  eligibleSegments: string[];
}

export interface CrmTask {
  id: string;
  title: string;
  type: "CALL" | "WHATSAPP" | "MEETING" | "FOLLOWUP" | "KYC" | "PAYMENT" | "RENEWAL";
  customerName: string;
  customerId: string;
  owner: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  dueDate: string;
  status: "PENDING" | "COMPLETED" | "OVERDUE";
  notes?: string;
}

export interface CrmPayment {
  id: string; // PAY-2026-XXXX
  customerName: string;
  customerId: string;
  amount: number;
  gstAmount: number;
  service: string;
  gateway: "Razorpay" | "Cashfree" | "Direct NEFT" | "UPI";
  status: "SUCCESSFUL" | "PENDING" | "FAILED" | "REFUNDED";
  invoiceNumber: string;
  transactionRef: string;
  date: string;
  agent: string;
  complianceApproved: boolean;
}

export interface CrmSubscription {
  id: string;
  customerName: string;
  customerId: string;
  planName: string;
  price: number;
  durationMonths: number;
  startDate: string;
  expiryDate: string;
  renewalAlertCadence: "30d" | "15d" | "7d" | "3d" | "1d" | "EXPIRED";
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "CANCELLED";
  assignedAdvisor: string;
  autoRenew: boolean;
}

export interface CrmTicket {
  id: string; // TKT-2026-XXXX
  customerName: string;
  customerId: string;
  category: "PAYMENT" | "SUBSCRIPTION" | "LOGIN" | "ADVISORY" | "TECHNICAL" | "REFUND" | "SEBI_SCORES";
  subject: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CLIENT" | "RESOLVED" | "CLOSED";
  assignedAgent: string;
  slaRemainingDays: number;
  createdAt: string;
}

export interface CallLogItem {
  id: string;
  leadId: string;
  leadName: string;
  agent: string;
  durationSec: number;
  timestamp: string;
  disposition: string;
  audioRecordingUrl?: string;
  summary: {
    customerRequirement: string;
    objectionsDetected: string[];
    agentResponse: string;
    sentiment: "POSITIVE" | "NEUTRAL" | "HESITANT" | "SKEPTICAL";
    interestedService: string;
    purchaseIntent: "HIGH" | "MEDIUM" | "LOW";
    actionItems: string[];
  };
  qualityScore: {
    overall: number; // 0-100
    intro: number;
    discovery: number;
    productExpl: number;
    compliance: number;
    objectionHandling: number;
    closing: number;
  };
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  details: string;
  hashVerified: boolean;
}

// ================= SEED DATA =================

export const CRM_USERS: CrmUser[] = [
  { id: "usr_1", name: "Nikhil Kushwaha", email: "nikhil@expertstocks.in", role: "super_admin", department: "Executive / Tech", conversionRate: 28.5, revenueThisMonth: 1240000, leadsHandled: 142 },
  { id: "usr_2", name: "Priya Sharma", email: "priya.s@expertstocks.in", role: "sales_manager", department: "Retail Sales", conversionRate: 24.2, revenueThisMonth: 890000, leadsHandled: 198 },
  { id: "usr_3", name: "Vikram Malhotra", email: "vikram.m@expertstocks.in", role: "sales_agent", department: "Options Desk", conversionRate: 21.0, revenueThisMonth: 620000, leadsHandled: 230 },
  { id: "usr_4", name: "Dr. Ananya Ray", email: "ananya.r@expertstocks.in", role: "advisor", department: "SEBI Research Desk", conversionRate: 0, revenueThisMonth: 0, leadsHandled: 45 },
  { id: "usr_5", name: "Rajeshwar Rao", email: "rajeshwar@expertstocks.in", role: "compliance", department: "Regulatory Compliance", conversionRate: 0, revenueThisMonth: 0, leadsHandled: 0 },
  { id: "usr_6", name: "Sunita Verma", email: "sunita.v@expertstocks.in", role: "relationship_manager", department: "HNI Wealth", conversionRate: 31.8, revenueThisMonth: 1450000, leadsHandled: 75 },
];

export const INITIAL_LEADS: CrmLead[] = [
  {
    id: "TG-LD-901",
    name: "Harish Raghavan",
    mobile: "+91 98201 44521",
    email: "harish.r@gmail.com",
    whatsapp: "+91 98201 44521",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    source: "Google Search Ads",
    campaign: "Nifty Options Alpha",
    landingPage: "/services/index-options",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "nifty_options_q4",
    utmContent: "ad_variant_3",
    assignedAgent: "Priya Sharma",
    status: "QUALIFIED",
    temperature: "VERY_HOT",
    aiScore: 94,
    aiScoreRationale: "Visited pricing page 4x, high declared capital (₹25L+), completed risk test with aggressive profile.",
    aiNextAction: "Call immediately with Custom Options Desk Proposal.",
    aiNextActionWhy: "Lead has opened the pricing page 3 times today and downloaded the Performance Ledger.",
    investmentExperience: "3-5 Years",
    tradingExperience: "Index Options",
    preferredMarket: "Nifty/BankNifty F&O",
    preferredService: "Bespoke Index Derivative Advisory",
    budget: "₹25,000 / Quarter",
    estimatedValue: 75000,
    riskPreference: "Aggressive",
    lastContacted: "Today, 11:15 AM",
    nextFollowUp: "Today, 04:30 PM",
    callsCount: 3,
    npcAttempts: 0,
    whatsappCount: 4,
    conversationsCount: 2,
    tags: ["HNI", "Options Trader", "Pricing Viewed", "High Intent"],
    notes: "Very familiar with option Greeks. Wants strict SL guidance. Ready to initiate ₹25K quarterly plan.",
    createdAt: "2026-10-06 10:20 AM",
    updatedAt: "2026-10-08 11:15 AM",
  },
  {
    id: "TG-LD-902",
    name: "Sunita Verma",
    mobile: "+91 99304 88721",
    email: "sunita.v@outlook.com",
    whatsapp: "+91 99304 88721",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    source: "Website Header Call",
    campaign: "Organic Direct",
    landingPage: "/research",
    utmSource: "direct",
    utmMedium: "none",
    utmCampaign: "organic",
    utmContent: "",
    assignedAgent: "Vikram Malhotra",
    status: "CONSULTATION_SCHEDULED",
    temperature: "HOT",
    aiScore: 82,
    aiScoreRationale: "Requested senior research consultation, verified capital ₹10L, steady phone engagement.",
    aiNextAction: "Conduct consultation at 02:00 PM; prepare Large-Cap Equity swing presentation.",
    aiNextActionWhy: "Consultation booked via automated calendar; risk score matches Moderate Equity.",
    investmentExperience: "1-3 Years",
    tradingExperience: "Equity Cash",
    preferredMarket: "NSE Equities",
    preferredService: "Equity Swing Advisory",
    budget: "₹15,000 / Quarter",
    estimatedValue: 45000,
    riskPreference: "Moderate",
    lastContacted: "Yesterday, 04:10 PM",
    nextFollowUp: "Today, 02:00 PM",
    callsCount: 2,
    npcAttempts: 0,
    whatsappCount: 2,
    conversationsCount: 1,
    tags: ["Consultation Booked", "Equity Cash", "Moderate Risk"],
    notes: "Prefers delivery swing trades holding 2-6 weeks. Dislikes intraday leverage.",
    createdAt: "2026-10-07 09:30 AM",
    updatedAt: "2026-10-08 09:00 AM",
  },
  {
    id: "TG-LD-903",
    name: "Rajeshwar Rao",
    mobile: "+91 94401 23901",
    email: "r.rao@rediffmail.com",
    whatsapp: "+91 94401 23901",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    source: "Meta Ads (Instagram)",
    campaign: "Wealth Compounder",
    landingPage: "/pricing",
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmCampaign: "hni_wealth_2026",
    utmContent: "video_testimonial",
    assignedAgent: "Priya Sharma",
    status: "PAYMENT_PENDING",
    temperature: "VERY_HOT",
    aiScore: 91,
    aiScoreRationale: "Invoice #ESC-INV-2026-0842 generated, payment link sent via Razorpay, client clicked link twice.",
    aiNextAction: "Send WhatsApp payment reminder with NEFT alternative details.",
    aiNextActionWhy: "Razorpay session opened but incomplete; potential bank net banking limit query.",
    investmentExperience: "5+ Years",
    tradingExperience: "HNI Portfolio",
    preferredMarket: "NSE Equities",
    preferredService: "HNI Multi-Cap Advisory",
    budget: "₹50,000 / Year",
    estimatedValue: 120000,
    riskPreference: "Moderate",
    lastContacted: "Today, 10:45 AM",
    nextFollowUp: "Today, 03:00 PM",
    callsCount: 4,
    npcAttempts: 0,
    whatsappCount: 6,
    conversationsCount: 3,
    tags: ["Payment Link Sent", "High Value", "HNI"],
    notes: "Approved ₹50,000 annual package. Requested direct NEFT bank details for company accounting.",
    createdAt: "2026-10-05 03:15 PM",
    updatedAt: "2026-10-08 10:45 AM",
  },
  {
    id: "TG-LD-904",
    name: "Aman Preet Singh",
    mobile: "+91 98112 55902",
    email: "aman.singh@gmail.com",
    whatsapp: "+91 98112 55902",
    city: "Chandigarh",
    state: "Punjab",
    country: "India",
    source: "YouTube Sponsorship",
    campaign: "Market Masterclass",
    landingPage: "/academy",
    utmSource: "youtube",
    utmMedium: "influencer",
    utmCampaign: "tradegrow_collab",
    utmContent: "description_link",
    assignedAgent: "Vikram Malhotra",
    status: "CONTACTED",
    temperature: "WARM",
    aiScore: 68,
    aiScoreRationale: "Engaged in video content, downloaded 2 research reports, answered call on first ring.",
    aiNextAction: "Send educational WhatsApp follow-up with SEBI risk disclosures.",
    aiNextActionWhy: "Expressed interest in intraday momentum but has only 6 months trading experience.",
    investmentExperience: "<1 Year",
    tradingExperience: "Equity Cash",
    preferredMarket: "NSE Equities",
    preferredService: "Starter Equity Advisory",
    budget: "₹8,000 / Quarter",
    estimatedValue: 24000,
    riskPreference: "Conservative",
    lastContacted: "Yesterday, 02:30 PM",
    nextFollowUp: "Tomorrow, 11:00 AM",
    callsCount: 1,
    npcAttempts: 0,
    whatsappCount: 1,
    conversationsCount: 1,
    tags: ["New Trader", "Education Focused"],
    notes: "Needs handholding on position sizing. Advised against aggressive option buying.",
    createdAt: "2026-10-07 11:00 AM",
    updatedAt: "2026-10-07 02:30 PM",
  },
  {
    id: "TG-LD-905",
    name: "Kavita Deshmukh",
    mobile: "+91 98220 99412",
    email: "kavita.d@yahoo.com",
    whatsapp: "+91 98220 99412",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    source: "Meta Ads (Facebook)",
    campaign: "Retirement Wealth",
    landingPage: "/contact",
    utmSource: "facebook",
    utmMedium: "social_cpm",
    utmCampaign: "retiree_wealth",
    utmContent: "carousel_1",
    assignedAgent: "Priya Sharma",
    status: "CONTACTED",
    temperature: "COLD",
    aiScore: 42,
    aiScoreRationale: "2 NPC (No Pick) attempts recorded over 24 hours. High bounce likelihood.",
    aiNextAction: "Do not call now. Schedule automated WhatsApp nurture message for tomorrow 10:00 AM.",
    aiNextActionWhy: "Already attempted twice today without answer; repeated dialing risks harassment complaint.",
    investmentExperience: "1-3 Years",
    tradingExperience: "Equity Cash",
    preferredMarket: "NSE Equities",
    preferredService: "Dividend & Bluechip Portfolio",
    budget: "₹10,000 / Quarter",
    estimatedValue: 30000,
    riskPreference: "Conservative",
    lastContacted: "Today, 09:15 AM",
    nextFollowUp: "Tomorrow, 10:00 AM",
    callsCount: 2,
    npcAttempts: 2,
    whatsappCount: 1,
    conversationsCount: 0,
    tags: ["NPC", "Nurture Queue"],
    notes: "Attempted call 09:15 AM (Ringing, not answered). Attempted 12:00 PM (Busy).",
    createdAt: "2026-10-06 05:00 PM",
    updatedAt: "2026-10-08 12:00 PM",
  },
  {
    id: "TG-LD-906",
    name: "Arjun Nambiar",
    mobile: "+91 98471 33201",
    email: "arjun.n@keralafin.org",
    whatsapp: "+91 98471 33201",
    city: "Kochi",
    state: "Kerala",
    country: "India",
    source: "Partner Referral",
    campaign: "Wealth Partner",
    landingPage: "/services",
    utmSource: "referral",
    utmMedium: "partner",
    utmCampaign: "hni_affiliate",
    utmContent: "partner_code_KL09",
    assignedAgent: "Sunita Verma",
    status: "CONVERTED",
    temperature: "VERY_HOT",
    aiScore: 98,
    aiScoreRationale: "Verified payment ₹75,000 received via HDFC NetBanking, KYC completed with DigiLocker.",
    aiNextAction: "Initiate Onboarding Call with Senior Research Head Dr. Ananya Ray.",
    aiNextActionWhy: "Client subscription is active; schedule initial 1-on-1 portfolio alignment.",
    investmentExperience: "5+ Years",
    tradingExperience: "HNI Portfolio",
    preferredMarket: "NSE Equities",
    preferredService: "HNI Bespoke Advisory",
    budget: "₹75,000 / Year",
    estimatedValue: 180000,
    riskPreference: "Moderate",
    lastContacted: "Today, 12:30 PM",
    nextFollowUp: "Tomorrow, 03:00 PM",
    callsCount: 5,
    npcAttempts: 0,
    whatsappCount: 8,
    conversationsCount: 4,
    tags: ["Converted", "HNI", "DigiLocker Verified"],
    notes: "Converted to annual Bespoke Plan. Dedicated RM assigned: Sunita Verma.",
    createdAt: "2026-10-04 11:20 AM",
    updatedAt: "2026-10-08 12:30 PM",
  },
];

export const INITIAL_CUSTOMERS: Customer360[] = [
  {
    id: "CUST-1001",
    leadId: "TG-LD-906",
    name: "Arjun Nambiar",
    mobile: "+91 98471 33201",
    email: "arjun.n@keralafin.org",
    customerCode: "ESC-2026-0042",
    status: "ACTIVE",
    customerValue: 75000,
    aiScore: 98,
    healthScore: "Healthy",
    healthRationale: "Regular research engagement, high recommendation adherence, zero support tickets.",
    riskCategory: "Moderate",
    riskScore: 62,
    kycStatus: "VERIFIED",
    panMasked: "ABCDE****F",
    aadhaarMasked: "XXXX-XXXX-8912",
    currentSubscription: {
      planName: "HNI Bespoke Advisory (Annual)",
      startDate: "2026-10-08",
      expiryDate: "2027-10-07",
      daysRemaining: 364,
      amount: 75000,
    },
    relationshipManager: "Sunita Verma",
    assignedAdvisor: "Dr. Ananya Ray",
    joinedDate: "2026-10-08",
    portfolioSize: "₹45,00,000",
    openPositionsCount: 4,
    realizedPnlPercent: "+6.4%",
    satisfactionRating: 5,
  },
  {
    id: "CUST-1002",
    leadId: "TG-LD-840",
    name: "Devendra Patel",
    mobile: "+91 98250 11984",
    email: "d.patel@gujaratsteel.co.in",
    customerCode: "ESC-2026-0038",
    status: "RENEWAL_DUE",
    customerValue: 45000,
    aiScore: 86,
    healthScore: "Needs Attention",
    healthRationale: "Subscription expires in 6 days. Last 2 research reports opened but no trades logged.",
    riskCategory: "Aggressive",
    riskScore: 78,
    kycStatus: "VERIFIED",
    panMasked: "PATEL****K",
    aadhaarMasked: "XXXX-XXXX-3341",
    currentSubscription: {
      planName: "Index Derivatives Alpha (Quarterly)",
      startDate: "2026-07-15",
      expiryDate: "2026-10-14",
      daysRemaining: 6,
      amount: 25000,
    },
    relationshipManager: "Priya Sharma",
    assignedAdvisor: "Dr. Ananya Ray",
    joinedDate: "2026-07-15",
    portfolioSize: "₹20,00,000",
    openPositionsCount: 2,
    realizedPnlPercent: "+12.8%",
    satisfactionRating: 4,
  },
  {
    id: "CUST-1003",
    leadId: "TG-LD-720",
    name: "Sanjay Singhania",
    mobile: "+91 99100 48821",
    email: "sanjay@singhaniagroup.in",
    customerCode: "ESC-2026-0021",
    status: "ACTIVE",
    customerValue: 150000,
    aiScore: 95,
    healthScore: "Healthy",
    healthRationale: "HNI client with 14 active months, prompt renewal payments, 5 star review.",
    riskCategory: "Aggressive",
    riskScore: 84,
    kycStatus: "VERIFIED",
    panMasked: "SINGH****M",
    aadhaarMasked: "XXXX-XXXX-4902",
    currentSubscription: {
      planName: "Institutional Equity & F&O Desk",
      startDate: "2026-05-01",
      expiryDate: "2027-04-30",
      daysRemaining: 204,
      amount: 150000,
    },
    relationshipManager: "Sunita Verma",
    assignedAdvisor: "Dr. Ananya Ray",
    joinedDate: "2025-08-10",
    portfolioSize: "₹1,20,00,000",
    openPositionsCount: 7,
    realizedPnlPercent: "+18.2%",
    satisfactionRating: 5,
  },
];

export const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    id: "EVT-1",
    customerId: "CUST-1001",
    timestamp: "Today, 12:35 PM",
    type: "SUBSCRIPTION",
    title: "Subscription Activated",
    description: "HNI Bespoke Advisory (Annual) activated following payment confirmation.",
    agent: "System Engine",
  },
  {
    id: "EVT-2",
    customerId: "CUST-1001",
    timestamp: "Today, 12:30 PM",
    type: "PAYMENT",
    title: "Payment Received: ₹75,000",
    description: "HDFC NetBanking TXN #HDFC9481944. GST Invoice #ESC-INV-2026-0845 dispatched.",
    agent: "Finance Desk",
  },
  {
    id: "EVT-3",
    customerId: "CUST-1001",
    timestamp: "Today, 11:45 AM",
    type: "KYC",
    title: "DigiLocker KYC Verified",
    description: "Aadhaar XML & PAN verification matched 100% with Arjun Nambiar.",
    agent: "Compliance Gate",
  },
  {
    id: "EVT-4",
    customerId: "CUST-1001",
    timestamp: "Today, 10:15 AM",
    type: "CALL",
    title: "Closing Sales Call (14 mins)",
    description: "Discussed multi-cap research methodology and stop-loss execution parameters.",
    agent: "Sunita Verma",
  },
  {
    id: "EVT-5",
    customerId: "CUST-1001",
    timestamp: "Yesterday, 04:00 PM",
    type: "WHATSAPP",
    title: "WhatsApp Service Charter Dispatched",
    description: "Sent official SEBI Research Analyst Investor Charter & Pricing Matrix PDF.",
    agent: "WhatsApp Cloud API",
  },
];

export const INITIAL_RECOMMENDATIONS: AdvisoryRecommendation[] = [
  {
    id: "REC-2026-0104",
    symbol: "HDFCBANK",
    exchange: "NSE",
    instrumentType: "EQUITY_CASH",
    direction: "BUY",
    entryRange: "1680 - 1710",
    target1: "1820",
    target2: "1910",
    stopLoss: "1620",
    timeHorizon: "2-4 Months",
    rationale: "Double bottom breakout on weekly timeframe; credit growth outperforming industry with multi-year low NPAs.",
    advisor: "Dr. Ananya Ray",
    approvalStatus: "APPROVED",
    approvedBy: "Head of Research (SEBI Reg #INH00001842)",
    status: "ACTIVE",
    pnlReturn: "+3.2%",
    publishedAt: "2026-10-06 09:30 AM",
    complianceChecked: true,
    eligibleSegments: ["Equity Cash", "HNI Bespoke"],
  },
  {
    id: "REC-2026-0105",
    symbol: "NIFTY 25600 CE",
    exchange: "NSE",
    instrumentType: "INDEX_OPTIONS",
    direction: "BUY",
    entryRange: "145 - 155",
    target1: "210",
    target2: "265",
    stopLoss: "105",
    timeHorizon: "Positional Expiry",
    rationale: "Implied Volatility (IV) compression breakout above 25550 anchor level. High PCR support at 25500.",
    advisor: "Dr. Ananya Ray",
    approvalStatus: "APPROVED",
    approvedBy: "Head of Research",
    status: "TARGET_1_HIT",
    pnlReturn: "+41.9%",
    publishedAt: "2026-10-07 10:15 AM",
    complianceChecked: true,
    eligibleSegments: ["Index Derivatives Alpha", "HNI Bespoke"],
  },
  {
    id: "REC-2026-0106",
    symbol: "L&T",
    exchange: "NSE",
    instrumentType: "EQUITY_CASH",
    direction: "BUY",
    entryRange: "3480 - 3510",
    target1: "3740",
    target2: "3920",
    stopLoss: "3360",
    timeHorizon: "3-6 Months",
    rationale: "Strong order book visibility across international hydrocarbons and defense infrastructure.",
    advisor: "Dr. Ananya Ray",
    approvalStatus: "APPROVED",
    approvedBy: "Head of Research",
    status: "ACTIVE",
    pnlReturn: "+4.1%",
    publishedAt: "2026-10-05 11:00 AM",
    complianceChecked: true,
    eligibleSegments: ["Equity Cash", "HNI Bespoke"],
  },
];

export const INITIAL_TASKS: CrmTask[] = [
  {
    id: "TSK-101",
    title: "Call Harish Raghavan with Options Proposal",
    type: "CALL",
    customerName: "Harish Raghavan",
    customerId: "TG-LD-901",
    owner: "Priya Sharma",
    priority: "URGENT",
    dueDate: "Today, 04:30 PM",
    status: "PENDING",
    notes: "High intent lead. Visited pricing page 4 times.",
  },
  {
    id: "TSK-102",
    title: "Verify Bank Wire for Rajeshwar Rao",
    type: "PAYMENT",
    customerName: "Rajeshwar Rao",
    customerId: "TG-LD-903",
    owner: "Priya Sharma",
    priority: "HIGH",
    dueDate: "Today, 05:00 PM",
    status: "PENDING",
    notes: "Client sent UTR #HDFC77281. Match with statement.",
  },
  {
    id: "TSK-103",
    title: "Conduct 1-on-1 Consultation with Sunita Verma",
    type: "MEETING",
    customerName: "Sunita Verma",
    customerId: "TG-LD-902",
    owner: "Vikram Malhotra",
    priority: "HIGH",
    dueDate: "Today, 02:00 PM",
    status: "PENDING",
  },
  {
    id: "TSK-104",
    title: "Renewal Call with Devendra Patel (Expires in 6d)",
    type: "RENEWAL",
    customerName: "Devendra Patel",
    customerId: "CUST-1002",
    owner: "Priya Sharma",
    priority: "HIGH",
    dueDate: "Tomorrow, 11:30 AM",
    status: "PENDING",
    notes: "Offer loyalty renewal discount voucher.",
  },
];

export const INITIAL_PAYMENTS: CrmPayment[] = [
  {
    id: "PAY-2026-0845",
    customerName: "Arjun Nambiar",
    customerId: "CUST-1001",
    amount: 75000,
    gstAmount: 11440,
    service: "HNI Bespoke Advisory (Annual)",
    gateway: "Direct NEFT",
    status: "SUCCESSFUL",
    invoiceNumber: "ESC-INV-2026-0845",
    transactionRef: "HDFC9481944",
    date: "2026-10-08 12:30 PM",
    agent: "Sunita Verma",
    complianceApproved: true,
  },
  {
    id: "PAY-2026-0844",
    customerName: "Kailash Chandani",
    customerId: "CUST-0994",
    amount: 25000,
    gstAmount: 3813,
    service: "Index Derivatives Alpha (Quarterly)",
    gateway: "Razorpay",
    status: "SUCCESSFUL",
    invoiceNumber: "ESC-INV-2026-0844",
    transactionRef: "pay_Rzp91823901",
    date: "2026-10-07 04:15 PM",
    agent: "Priya Sharma",
    complianceApproved: true,
  },
  {
    id: "PAY-2026-0843",
    customerName: "Rajeshwar Rao",
    customerId: "TG-LD-903",
    amount: 50000,
    gstAmount: 7627,
    service: "HNI Multi-Cap Advisory",
    gateway: "Direct NEFT",
    status: "PENDING",
    invoiceNumber: "ESC-INV-2026-0843",
    transactionRef: "PENDING_VERIFY",
    date: "2026-10-08 10:45 AM",
    agent: "Priya Sharma",
    complianceApproved: false,
  },
];

export const INITIAL_CALL_LOGS: CallLogItem[] = [
  {
    id: "CALL-2026-091",
    leadId: "TG-LD-901",
    leadName: "Harish Raghavan",
    agent: "Priya Sharma",
    durationSec: 420,
    timestamp: "Today, 11:15 AM",
    disposition: "Answered - Qualified",
    summary: {
      customerRequirement: "Wants disciplined Nifty/BankNifty derivative strategy with defined drawdown limits.",
      objectionsDetected: ["Dislikes high brokerage churn", "Inquired about advisory fee structure"],
      agentResponse: "Explained 1:2 risk-reward setups, max 2 trades/day, and fixed quarterly pricing.",
      sentiment: "POSITIVE",
      interestedService: "Bespoke Index Derivative Advisory",
      purchaseIntent: "HIGH",
      actionItems: ["Send custom proposal", "Follow up at 04:30 PM"],
    },
    qualityScore: {
      overall: 92,
      intro: 95,
      discovery: 90,
      productExpl: 95,
      compliance: 100, // zero guaranteed return claims
      objectionHandling: 88,
      closing: 85,
    },
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: "AUD-2026-501",
    timestamp: "2026-10-08 12:35:10",
    user: "Sunita Verma",
    userRole: "relationship_manager",
    action: "STATUS_CHANGE",
    entityType: "Customer",
    entityId: "CUST-1001",
    ipAddress: "14.139.12.94",
    details: "Customer status transitioned to ACTIVE following ₹75,000 NEFT confirmation.",
    hashVerified: true,
  },
  {
    id: "AUD-2026-500",
    timestamp: "2026-10-08 12:30:45",
    user: "Nikhil Kushwaha",
    userRole: "super_admin",
    action: "PAYMENT_VERIFIED",
    entityType: "Payment",
    entityId: "PAY-2026-0845",
    ipAddress: "103.21.144.18",
    details: "Approved ₹75,000 payment for Arjun Nambiar under SAC 997159 GST compliance.",
    hashVerified: true,
  },
  {
    id: "AUD-2026-499",
    timestamp: "2026-10-08 10:15:20",
    user: "Dr. Ananya Ray",
    userRole: "advisor",
    action: "RECOMMENDATION_PUBLISHED",
    entityType: "ResearchRecommendation",
    entityId: "REC-2026-0105",
    ipAddress: "103.21.144.20",
    details: "Published NIFTY 25600 CE with dual-analyst sign-off and mandatory risk disclosure.",
    hashVerified: true,
  },
];

export interface CrmCampaign {
  id: string;
  name: string;
  type: "NEW_LEAD" | "RENEWAL" | "EDUCATIONAL" | "PRODUCT_LAUNCH" | "HNI_BESPOKE";
  channel: "Google Ads" | "Meta Instagram" | "WhatsApp Broadcast" | "YouTube" | "Email";
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
  spend: number;
  roi: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
}

export interface CrmReferral {
  id: string;
  referrerName: string;
  referrerCode: string;
  referredClient: string;
  date: string;
  status: "CONVERTED" | "QUALIFIED" | "PENDING";
  revenue: number;
  rewardEarned: number;
  payoutStatus: "PAID" | "PENDING_TDS";
}

export const INITIAL_CAMPAIGNS: CrmCampaign[] = [
  {
    id: "CMP-2026-01",
    name: "Nifty Options Alpha Q4",
    type: "NEW_LEAD",
    channel: "Google Ads",
    sent: 45000,
    delivered: 44800,
    opened: 18200,
    clicked: 3840,
    converted: 42,
    revenue: 1850000,
    spend: 380000,
    roi: "4.86x",
    status: "ACTIVE",
  },
  {
    id: "CMP-2026-02",
    name: "HNI Wealth Compounder 2026",
    type: "HNI_BESPOKE",
    channel: "Meta Instagram",
    sent: 32000,
    delivered: 31800,
    opened: 14200,
    clicked: 2100,
    converted: 16,
    revenue: 1200000,
    spend: 290000,
    roi: "4.13x",
    status: "ACTIVE",
  },
  {
    id: "CMP-2026-03",
    name: "Automated Renewal Nudge (T-15d)",
    type: "RENEWAL",
    channel: "WhatsApp Broadcast",
    sent: 120,
    delivered: 118,
    opened: 110,
    clicked: 68,
    converted: 24,
    revenue: 600000,
    spend: 1200,
    roi: "500.0x",
    status: "ACTIVE",
  },
];

export const INITIAL_REFERRALS: CrmReferral[] = [
  {
    id: "REF-2026-101",
    referrerName: "Sanjay Singhania",
    referrerCode: "SINGH_HNI",
    referredClient: "Arjun Nambiar",
    date: "2026-10-04",
    status: "CONVERTED",
    revenue: 75000,
    rewardEarned: 7500,
    payoutStatus: "PENDING_TDS",
  },
  {
    id: "REF-2026-102",
    referrerName: "Devendra Patel",
    referrerCode: "PATEL_GUJ",
    referredClient: "Hitesh Shah",
    date: "2026-10-06",
    status: "QUALIFIED",
    revenue: 0,
    rewardEarned: 0,
    payoutStatus: "PENDING_TDS",
  },
];

export const INITIAL_TICKETS: CrmTicket[] = [
  {
    id: "TKT-2026-042",
    customerName: "Devendra Patel",
    customerId: "CUST-1002",
    category: "SUBSCRIPTION",
    subject: "Inquiry on Index Alpha vs Swing Equity plan upgrade",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    assignedAgent: "Priya Sharma",
    slaRemainingDays: 14,
    createdAt: "2026-10-07 03:15 PM",
  },
  {
    id: "TKT-2026-041",
    customerName: "Kailash Chandani",
    customerId: "CUST-0994",
    category: "PAYMENT",
    subject: "Request for GST input tax credit certificate (B2B)",
    priority: "HIGH",
    status: "RESOLVED",
    assignedAgent: "Sunita Verma",
    slaRemainingDays: 18,
    createdAt: "2026-10-06 11:00 AM",
  },
  {
    id: "TKT-2026-040",
    customerName: "Sunil Mehra",
    customerId: "CUST-0891",
    category: "SEBI_SCORES",
    subject: "Grievance verification: Clarification on stop-loss execution timing",
    priority: "CRITICAL",
    status: "RESOLVED",
    assignedAgent: "Rajeshwar Rao (Compliance Officer)",
    slaRemainingDays: 20,
    createdAt: "2026-10-05 09:30 AM",
  },
];

