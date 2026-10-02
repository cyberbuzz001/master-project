import fs from "fs";
import path from "path";

export interface StoredLead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  capital: string;
  segment: string;
  status: "new" | "contacted" | "qualified" | "converted";
  createdAt: string;
  source: string;
  message?: string;
  city?: string;
  assessment?: {
    score: number;
    category: string;
    suitability_summary?: string;
  };
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

const STORE_FILE = path.join(process.cwd(), "scratch_leads_store.json");
const TMP_STORE_FILE = "/tmp/expert_leads_store.json";

// Default seed data containing the initial records + Nikhil Kushwaha's submitted lead & recent KYCs
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
  {
    code: "ESC-2026-9842",
    name: "Rameshwar K.",
    mobile: "+91 98112 55902",
    score: "54/100",
    profile: "Balanced Conservative",
    kyc: "Verified",
    rm: "Priya Sharma",
    createdAt: "2 days ago",
  },
];

// In-memory cache (persists within node process / serverless instance)
let memoryStore: { leads: StoredLead[]; kyc: StoredKycRecord[] } | null = null;

function getStoreFilePath(): string {
  try {
    if (fs.existsSync("/tmp")) return TMP_STORE_FILE;
  } catch {}
  return STORE_FILE;
}

function loadStore(): { leads: StoredLead[]; kyc: StoredKycRecord[] } {
  if (memoryStore) return memoryStore;

  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data?.leads) && Array.isArray(data?.kyc)) {
        memoryStore = data;
        return memoryStore!;
      }
    }
  } catch (e) {
    console.warn("[LeadsStore] Could not read store file, using seed defaults:", e);
  }

  memoryStore = {
    leads: [...DEFAULT_LEADS],
    kyc: [...DEFAULT_KYC],
  };
  saveStore(memoryStore);
  return memoryStore;
}

function saveStore(data: { leads: StoredLead[]; kyc: StoredKycRecord[] }) {
  memoryStore = data;
  const filePath = getStoreFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.warn("[LeadsStore] Could not write store file:", e);
  }
}

export const leadsStore = {
  getLeads(): StoredLead[] {
    return loadStore().leads;
  },

  getKycRecords(): StoredKycRecord[] {
    return loadStore().kyc;
  },

  addLead(input: {
    leadCode: string;
    fullName: string;
    mobile: string;
    email?: string;
    city?: string;
    capitalRange?: string;
    segments?: string | string[];
    source?: string;
    message?: string;
    assessment?: any;
  }): StoredLead {
    const store = loadStore();

    const formattedSegment = Array.isArray(input.segments)
      ? input.segments.join(", ")
      : input.segments || "General Advisory";

    const newLead: StoredLead = {
      id: input.leadCode,
      name: input.fullName,
      mobile: input.mobile.startsWith("+91") ? input.mobile : `+91 ${input.mobile}`,
      email: input.email || "Not specified",
      capital: input.capitalRange || "₹5L - ₹10L",
      segment: formattedSegment,
      status: "new",
      createdAt: "Today, Just now",
      source: input.source || "Contact Form",
      message: input.message,
      city: input.city,
      assessment: input.assessment
        ? {
            score: input.assessment.score || 0,
            category: input.assessment.category || "Unclassified",
            suitability_summary: input.assessment.suitability_summary,
          }
        : undefined,
    };

    // Unshift to top of leads
    store.leads = [newLead, ...store.leads];

    // If this submission includes a risk assessment or KYC form, record it in KYC queue as well
    if (input.assessment || input.source === "risk_assessment") {
      const score = input.assessment?.score ? `${input.assessment.score}/100` : "Assessed";
      const profile = input.assessment?.category || "Risk Assessment Pending Review";
      const newKyc: StoredKycRecord = {
        code: `KYC-${input.leadCode.replace(/\D/g, "").slice(-4) || "2026"}`,
        name: input.fullName,
        mobile: input.mobile.startsWith("+91") ? input.mobile : `+91 ${input.mobile}`,
        score,
        profile,
        kyc: "Submitted (In Review)",
        rm: "Unassigned",
        createdAt: "Today, Just now",
        summary: input.assessment?.suitability_summary || "Submitted via online portal.",
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
    saveStore(store);
    return lead;
  },
};
