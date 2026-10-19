import fs from "fs";
import path from "path";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "call_back"
  | "follow_up"
  | "expected_payment"
  | "converted"
  | "not_interested"
  | "lost";

export interface CallLogEntry {
  id: string;
  timestamp: string;
  durationSec: number;
  disposition: string;
  notes?: string;
  agent?: string;
}

export interface StoredLead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  capital: string;
  segment: string;
  status: LeadStatus;
  createdAt: string;
  source: string;
  message?: string;
  city?: string;
  assessment?: {
    score: number;
    category: string;
    suitability_summary?: string;
    financial_capacity_score?: number;
    risk_tolerance_score?: number;
    knowledge_score?: number;
    discipline_score?: number;
    flags?: string[];
    critical_notes?: string[];
    questions?: Array<{ code: string; question: string; answer: string }>;
  };
  npcAttempts?: number;
  lastContactedAt?: string;
  nextFollowup?: string;
  assignedTo?: string;
  assignedAgent?: string;
  priority?: "hni" | "high" | "standard";
  callLogs?: CallLogEntry[];
  temperature?: "VERY_HOT" | "HOT" | "WARM" | "COLD" | "LOW_PRIORITY";
  aiScore?: number;
  aiScoreRationale?: string;
  aiNextAction?: string;
  aiNextActionWhy?: string;
  estimatedValue?: number;
  budget?: string;
  preferredService?: string;
  tags?: string[];
  notes?: string;
  updatedAt?: string;
}

export interface StoredKycRecord {
  code: string;
  name: string;
  mobile: string;
  score: string;
  profile: string;
  kyc: string;
  rm: string;
  createdAt: string;
  summary?: string;
}

export interface StoredSubscription {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  planName: string;
  tier: string;
  amount: number;
  duration: string;
  startDate: string;
  expiryDate: string;
  daysRemaining: number;
  status: "ACTIVE" | "PAUSED" | "EXPIRED" | "CANCELLED";
  paymentMethod: string;
  relationshipManager: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const STORE_FILE = path.join(process.cwd(), "scratch_leads_store.json");
const TMP_STORE_FILE = "/tmp/expert_leads_store.json";

// Default seed leads
const DEFAULT_LEADS: StoredLead[] = [
  {
    id: "TG-LEAD-2026-1001",
    name: "Nikhil Kushwaha",
    mobile: "+91 86024 67804",
    email: "nikhil.kushwaha@client.test",
    capital: "₹10L - ₹25L",
    segment: "Nifty & Bank Nifty Options",
    status: "new",
    createdAt: "Today, Just now",
    source: "Contact Form (/contact)",
    message: "Requested consultation regarding institutional advisory portfolio strategies.",
    assignedTo: "Vikram Malhotra",
    assignedAgent: "Vikram Malhotra",
    temperature: "VERY_HOT",
    aiScore: 92,
    aiScoreRationale: "High declared capital with active index derivatives interest.",
    aiNextAction: "Dial immediately to qualify trading capital & review advisory tier.",
    aiNextActionWhy: "Verified inbound contact with high intent.",
    estimatedValue: 45000,
    budget: "₹10L - ₹25L",
    preferredService: "Nifty & Bank Nifty Options",
    tags: ["Inbound", "High Intent"],
  },
  {
    id: "LD-2026-901",
    name: "Vikram Malhotra",
    mobile: "+91 98201 44521",
    email: "vikram.m@gmail.com",
    capital: "₹10L - ₹25L",
    segment: "Large-cap Equity & Options",
    status: "new",
    createdAt: "Today, 10:15 AM",
    source: "Direct Consultation",
    assignedTo: "Sunita Verma",
    assignedAgent: "Sunita Verma",
    temperature: "HOT",
    aiScore: 84,
    estimatedValue: 35000,
    budget: "₹10L - ₹25L",
    preferredService: "Large-cap Equity & Options",
  },
  {
    id: "LD-2026-902",
    name: "Sunita Verma",
    mobile: "+91 99304 88721",
    email: "sunita.v@outlook.com",
    capital: "₹5L - ₹10L",
    segment: "Cash Equity Only",
    status: "contacted",
    createdAt: "Today, 09:30 AM",
    source: "Website Header Call",
    assignedTo: "Vikram Malhotra",
    assignedAgent: "Vikram Malhotra",
    temperature: "WARM",
    aiScore: 68,
    estimatedValue: 20000,
    budget: "₹5L - ₹10L",
    preferredService: "Cash Equity Only",
  },
  {
    id: "LD-2026-903",
    name: "Rajeshwar Rao",
    mobile: "+91 94401 23901",
    email: "r.rao@rediffmail.com",
    capital: "₹25L+",
    segment: "HNI Wealth & Index Derivatives",
    status: "qualified",
    createdAt: "Yesterday",
    source: "WhatsApp Referral",
    assignedTo: "Priya Sharma",
    assignedAgent: "Priya Sharma",
    temperature: "VERY_HOT",
    aiScore: 96,
    estimatedValue: 75000,
    budget: "₹25L+",
    preferredService: "HNI Wealth & Index Derivatives",
  },
];

const DEFAULT_KYC: StoredKycRecord[] = [
  {
    code: "TG-KYC-2026-001",
    name: "Nikhil Kushwaha",
    mobile: "+91 86024 67804",
    score: "78/100",
    profile: "Aggressive Equity & Derivatives",
    kyc: "Verification Pending (DigiLocker/PAN Submitted)",
    rm: "Priya Sharma",
    createdAt: "Today, Just now",
    summary: "High risk capacity, time horizon > 3 years, capital growth mandate.",
  },
  {
    code: "ESC-2026-9841",
    name: "Demo Client",
    mobile: "+91 92388 37041",
    score: "72/100",
    profile: "Moderately Aggressive",
    kyc: "Verified (PAN/Aadhaar)",
    rm: "Priya Sharma",
    createdAt: "Yesterday",
  },
];

const DEFAULT_SUBSCRIPTIONS: StoredSubscription[] = [
  {
    id: "SUB-2026-1001",
    customerId: "CUST-1001",
    customerName: "Arjun Nambiar",
    customerCode: "ESC-2026-0042",
    planName: "HNI Bespoke Advisory",
    tier: "Annual (12 Months)",
    amount: 75000,
    duration: "12 Months",
    startDate: "2026-10-08",
    expiryDate: "2027-10-07",
    daysRemaining: 360,
    status: "ACTIVE",
    paymentMethod: "HDFC NetBanking / RTGS",
    relationshipManager: "Sunita Verma",
    notes: "Converted from partner referral. Annual bespoke equity coverage.",
    createdAt: "2026-10-08 11:30 AM",
    updatedAt: "2026-10-08 11:30 AM",
  },
  {
    id: "SUB-2026-1002",
    customerId: "CUST-1002",
    customerName: "Devendra Patel",
    customerCode: "ESC-2026-0189",
    planName: "Index Derivatives Alpha",
    tier: "Quarterly (3 Months)",
    amount: 25000,
    duration: "3 Months",
    startDate: "2026-09-15",
    expiryDate: "2026-12-14",
    daysRemaining: 63,
    status: "ACTIVE",
    paymentMethod: "Razorpay / UPI",
    relationshipManager: "Vikram Malhotra",
    notes: "Nifty & Bank Nifty F&O directional calls.",
    createdAt: "2026-09-15 10:00 AM",
    updatedAt: "2026-09-15 10:00 AM",
  },
  {
    id: "SUB-2026-1003",
    customerId: "CUST-1003",
    customerName: "Meenakshi Sundaram",
    customerCode: "ESC-2026-0214",
    planName: "Equity Swing & Momentum",
    tier: "Quarterly (3 Months)",
    amount: 15000,
    duration: "3 Months",
    startDate: "2026-08-20",
    expiryDate: "2026-10-18",
    daysRemaining: 6,
    status: "ACTIVE",
    paymentMethod: "Cashfree UPI",
    relationshipManager: "Priya Sharma",
    notes: "Renewal due in 6 days. 7d reminder dispatched.",
    createdAt: "2026-08-20 02:15 PM",
    updatedAt: "2026-10-12 09:30 AM",
  },
  {
    id: "SUB-2026-1004",
    customerId: "CUST-1004",
    customerName: "Sanjay Singhania",
    customerCode: "ESC-2026-0331",
    planName: "Multi-Segment Pro (F&O + MCX)",
    tier: "Half-Yearly (6 Months)",
    amount: 45000,
    duration: "6 Months",
    startDate: "2026-07-10",
    expiryDate: "2026-10-14",
    daysRemaining: 2,
    status: "ACTIVE",
    paymentMethod: "ICICI Bank Transfer",
    relationshipManager: "Vikram Malhotra",
    notes: "Expiring in 48 hours. Urgently schedule renewal call.",
    createdAt: "2026-07-10 11:00 AM",
    updatedAt: "2026-10-12 11:00 AM",
  },
];

interface StoreSchema {
  leads: StoredLead[];
  kyc: StoredKycRecord[];
  subscriptions: StoredSubscription[];
}

let memoryStore: StoreSchema | null = null;

function getStoreFilePath(): string {
  try {
    if (process.env.STORE_PATH) return process.env.STORE_PATH;
    if (process.platform !== "win32" && fs.existsSync("/tmp")) return TMP_STORE_FILE;
  } catch {}
  return STORE_FILE;
}

function loadStore(): StoreSchema {
  if (memoryStore) return memoryStore;

  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data?.leads)) {
        memoryStore = {
          leads: data.leads,
          kyc: Array.isArray(data.kyc) ? data.kyc : [...DEFAULT_KYC],
          subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [...DEFAULT_SUBSCRIPTIONS],
        };
        return memoryStore;
      }
    }
  } catch (e) {
    console.warn("[LeadsStore] Could not read store file, using seed defaults:", e);
  }

  memoryStore = {
    leads: [...DEFAULT_LEADS],
    kyc: [...DEFAULT_KYC],
    subscriptions: [...DEFAULT_SUBSCRIPTIONS],
  };
  saveStore(memoryStore);
  return memoryStore;
}

function saveStore(data: StoreSchema) {
  memoryStore = data;
  const filePath = getStoreFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("[LeadsStore] Could not write store file:", e);
  }
}

export const leadsStore = {
  // ── LEADS CRUD ─────────────────────────────────────────────────────────────
  getLeads(): StoredLead[] {
    return loadStore().leads;
  },

  getLead(id: string): StoredLead | null {
    return loadStore().leads.find((l) => l.id === id) || null;
  },

  getKycRecords(): StoredKycRecord[] {
    return loadStore().kyc;
  },

  addLead(input: {
    leadCode?: string;
    fullName: string;
    mobile: string;
    email?: string;
    city?: string;
    capitalRange?: string;
    segments?: string | string[];
    source?: string;
    message?: string;
    assessment?: any;
    assignedAgent?: string;
    notes?: string;
    status?: LeadStatus;
  }): StoredLead {
    const store = loadStore();

    const formattedSegment = Array.isArray(input.segments)
      ? input.segments.join(", ")
      : input.segments || "Nifty & Bank Nifty Options";

    const cap = input.capitalRange || "₹5L - ₹10L";
    let aiScore = 65;
    if (cap.includes("25") || cap.includes("50")) aiScore = 95;
    else if (cap.includes("10")) aiScore = 85;
    else if (cap.includes("5")) aiScore = 72;

    const assigned = input.assignedAgent || "Vikram Malhotra";
    const leadId = input.leadCode || `TG-LEAD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newLead: StoredLead = {
      id: leadId,
      name: input.fullName.trim(),
      mobile: input.mobile.startsWith("+91") ? input.mobile : `+91 ${input.mobile.replace(/\D/g, "").slice(-10)}`,
      email: input.email?.trim() || `${input.mobile.replace(/\D/g, "").slice(-10)}@client.in`,
      capital: cap,
      segment: formattedSegment,
      status: input.status || "new",
      createdAt: "Today, Just now",
      source: input.source || "Manual Direct Inbound",
      message: input.message,
      city: input.city || "Mumbai",
      assignedTo: assigned,
      assignedAgent: assigned,
      temperature: aiScore >= 85 ? "VERY_HOT" : aiScore >= 70 ? "HOT" : "WARM",
      aiScore,
      aiScoreRationale: `Lead captured via ${input.source || "CRM Desk"}. Capital bracket: ${cap}.`,
      aiNextAction: "Dial immediately to qualify trading capital & review advisory tier.",
      aiNextActionWhy: "Verified inbound contact added to advisory sales queue.",
      estimatedValue: aiScore >= 90 ? 75000 : aiScore >= 80 ? 45000 : 25000,
      budget: cap,
      preferredService: formattedSegment,
      tags: ["Inbound", input.source ? input.source.slice(0, 16) : "CRM Added"],
      notes: input.notes || input.message || "Added via CRM Lead Management.",
      updatedAt: "Today, Just now",
      assessment: input.assessment
        ? {
            score: input.assessment.score || 0,
            category: input.assessment.category || "Unclassified",
            suitability_summary: input.assessment.suitability_summary,
            financial_capacity_score: (input.assessment as any).financial_capacity_score,
            risk_tolerance_score: (input.assessment as any).risk_tolerance_score,
            knowledge_score: (input.assessment as any).knowledge_score,
            discipline_score: (input.assessment as any).discipline_score,
            flags: (input.assessment as any).flags,
            critical_notes: (input.assessment as any).critical_notes,
            questions: (input.assessment as any).questions,
          }
        : undefined,
    };

    store.leads = [newLead, ...store.leads];

    if (input.assessment || input.source === "risk_assessment") {
      const score = input.assessment?.score ? `${input.assessment.score}/100` : "Assessed";
      const profile = input.assessment?.category || "Risk Assessment Pending Review";
      const critNotes = (input.assessment as any)?.critical_notes;
      const summaryText = Array.isArray(critNotes) && critNotes.length > 0
        ? `[CRITICAL REVIEW: ${critNotes.join(" | ")}] ${input.assessment?.suitability_summary || ""}`
        : (input.assessment?.suitability_summary || "Submitted via online portal.");

      const newKyc: StoredKycRecord = {
        code: `KYC-${newLead.id.replace(/\D/g, "").slice(-4) || "2026"}`,
        name: input.fullName,
        mobile: newLead.mobile,
        score,
        profile,
        kyc: "Submitted (In Review)",
        rm: assigned,
        createdAt: "Today, Just now",
        summary: summaryText,
      };
      store.kyc = [newKyc, ...store.kyc];
    }

    saveStore(store);
    return newLead;
  },

  updateLeadStatus(id: string, status: StoredLead["status"]): StoredLead | null {
    const store = loadStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.status = status;
    lead.updatedAt = "Today, Just now";
    saveStore(store);
    return lead;
  },

  updateLead(id: string, updates: Partial<StoredLead>): StoredLead | null {
    const store = loadStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) return null;

    if (updates.assignedAgent && !updates.assignedTo) {
      updates.assignedTo = updates.assignedAgent;
    }
    if (updates.assignedTo && !updates.assignedAgent) {
      updates.assignedAgent = updates.assignedTo;
    }

    Object.assign(lead, updates, { updatedAt: "Today, Just now" });
    saveStore(store);
    return lead;
  },

  deleteLead(id: string): boolean {
    const store = loadStore();
    const initialLen = store.leads.length;
    store.leads = store.leads.filter((l) => l.id !== id);
    if (store.leads.length !== initialLen) {
      saveStore(store);
      return true;
    }
    return false;
  },

  recordCall(id: string, log: { durationSec: number; disposition: string; notes?: string; agent?: string }): StoredLead | null {
    const store = loadStore();
    const lead = store.leads.find((l) => l.id === id);
    if (!lead) return null;

    const newLog: CallLogEntry = {
      id: `CALL-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      durationSec: log.durationSec,
      disposition: log.disposition,
      notes: log.notes,
      agent: log.agent || "Advisory Rep",
    };

    lead.callLogs = [newLog, ...(lead.callLogs || [])];
    lead.lastContactedAt = "Today, Just now";
    lead.updatedAt = "Today, Just now";

    if (log.disposition === "NPC") {
      lead.npcAttempts = (lead.npcAttempts || 0) + 1;
      if (lead.npcAttempts >= 7) {
        lead.status = "lost";
      }
    } else if (log.disposition === "Call Back") {
      lead.status = "call_back";
    } else if (log.disposition === "Follow Up") {
      lead.status = "follow_up";
    } else if (log.disposition === "Expected Payment") {
      lead.status = "expected_payment";
    } else if (log.disposition === "Converted") {
      lead.status = "converted";
    } else if (log.disposition === "Not Interested") {
      lead.status = "not_interested";
    } else if (log.disposition === "Qualified") {
      lead.status = "qualified";
    } else if (lead.status === "new") {
      lead.status = "contacted";
    }

    saveStore(store);
    return lead;
  },

  // ── SUBSCRIPTIONS CRUD ─────────────────────────────────────────────────────
  getSubscriptions(): StoredSubscription[] {
    return loadStore().subscriptions;
  },

  getSubscription(id: string): StoredSubscription | null {
    return loadStore().subscriptions.find((s) => s.id === id) || null;
  },

  addSubscription(input: {
    customerId: string;
    customerName: string;
    customerCode?: string;
    planName: string;
    tier?: string;
    amount: number;
    duration?: string;
    startDate?: string;
    expiryDate: string;
    paymentMethod?: string;
    relationshipManager?: string;
    notes?: string;
  }): StoredSubscription {
    const store = loadStore();
    const id = `SUB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const todayStr = new Date().toISOString().split("T")[0];
    const expiryDate = input.expiryDate || todayStr;
    const diffTime = Math.max(0, new Date(expiryDate).getTime() - new Date().getTime());
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 90;

    const newSub: StoredSubscription = {
      id,
      customerId: input.customerId,
      customerName: input.customerName,
      customerCode: input.customerCode || `ESC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      planName: input.planName,
      tier: input.tier || "Standard Advisory",
      amount: Number(input.amount) || 25000,
      duration: input.duration || "3 Months",
      startDate: input.startDate || todayStr,
      expiryDate,
      daysRemaining,
      status: "ACTIVE",
      paymentMethod: input.paymentMethod || "Razorpay / UPI",
      relationshipManager: input.relationshipManager || "Vikram Malhotra",
      notes: input.notes || "Enrolled via Advisory CRM Desk.",
      createdAt: "Today, Just now",
      updatedAt: "Today, Just now",
    };

    store.subscriptions = [newSub, ...store.subscriptions];
    saveStore(store);
    return newSub;
  },

  updateSubscription(id: string, updates: Partial<StoredSubscription>): StoredSubscription | null {
    const store = loadStore();
    const sub = store.subscriptions.find((s) => s.id === id);
    if (!sub) return null;

    if (updates.expiryDate) {
      const diffTime = new Date(updates.expiryDate).getTime() - new Date().getTime();
      updates.daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    Object.assign(sub, updates, { updatedAt: "Today, Just now" });
    saveStore(store);
    return sub;
  },

  deleteSubscription(id: string): boolean {
    const store = loadStore();
    const initialLen = store.subscriptions.length;
    store.subscriptions = store.subscriptions.filter((s) => s.id !== id);
    if (store.subscriptions.length !== initialLen) {
      saveStore(store);
      return true;
    }
    return false;
  },
};
