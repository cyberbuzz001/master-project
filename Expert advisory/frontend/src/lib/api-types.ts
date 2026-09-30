export type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };

export type ApiErrorBody = {
  success: false;
  error_code: string;
  message: string;
  errors?: Record<string, string[]>;
  request_id?: string;
  timestamp?: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export type PublicSettings = {
  company?: { brand_name?: string; legal_entity_name?: string; cin?: string };
  contact?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    registered_address?: string;
    branch_address?: string;
    business_hours?: string;
  };
};

export type PolicyLink = { slug: string; title: string; category: string };

export type SiteData = {
  settings: PublicSettings;
  policies: PolicyLink[];
  regulatory_profile_verified: boolean;
  consent_text: Record<"data_processing" | "calls" | "whatsapp" | "marketing_email", string>;
};

export type RegulatoryInfo = {
  entity_type: string;
  entity_type_label: string | null;
  legal_entity_name: string | null;
  brand_name: string | null;
  research_status: string | null;
  registration_number: string | null;
  registration_date: string | null;
  registration_valid_until: string | null;
  ra_name: string | null;
  ra_contact_email: string | null;
  principal_officer: string | null;
  compliance_officer: string | null;
  grievance_officer: { name: string | null; email: string | null; phone: string | null };
  partner_ra: { name: string | null; registration_number: string | null } | null;
  public_statement: string | null;
  version: number;
  verified_at: string | null;
  review_due_at: string | null;
};

export type TrustCenterData = {
  verified: boolean;
  regulatory: RegulatoryInfo | null;
  policies: PolicyLink[];
  settings: PublicSettings;
};

export type PolicyData = {
  slug: string;
  title: string;
  version: number;
  effective_from: string | null;
  published_at: string | null;
  content_hash: string;
  body_markdown: string;
};

export type Me = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  user_type: "staff" | "client";
  status: string;
  roles: { name: string; label: string }[];
  permissions: string[];
  areas: Array<"admin" | "manager" | "research" | "workspace" | "portal">;
  two_factor: { enabled: boolean; required: boolean; enrollment_required: boolean; verified_this_session: boolean };
  employee: { employee_code: string; designation: string | null; team: string | null; is_authorized_research_person: boolean } | null;
  client: { client_code: string; onboarding_status: string } | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  demo_mode: boolean;
};

export type ReadinessCheck = { key: string; label: string; passed: boolean; detail: string };

export type ModuleStatus = { key: string; label: string; enabled: boolean; phase: number };
