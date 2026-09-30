/**
 * Canonical Lead Contract for Trade Grow Unified Ecosystem
 * Shared across System A (Expert Stocks CRM), System B (Trust Website), and System C (Trade Grow)
 */

export interface CanonicalLead {
  leadUuid: string;
  phoneE164: string;
  fullName?: string;
  email?: string;
  city?: string;
  state?: string;
  tradingExperience?: 'none' | 'under_1y' | '1_3y' | '3_5y' | 'over_5y';
  capitalRange?: 'under_1l' | '1l_5l' | '5l_25l' | '25l_1cr' | 'over_1cr' | 'prefer_not';
  segments?: Array<'equity' | 'options' | 'futures' | 'commodity'>;
  source: string;
  stage: 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'KYC_INITIATED' | 'KYC_COMPLETED' | 'ACTIVATED' | 'LOST';
  score: number;
  consentWhatsApp: boolean;
  consentDataProcessing: boolean;
  attribution: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    landingPage?: string;
    referrerUrl?: string;
    referralCode?: string;
    creatorCode?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IngestLeadRequest {
  phone: string;
  fullName?: string;
  email?: string;
  city?: string;
  source?: string;
  tradingExperience?: string;
  capitalRange?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrerUrl?: string;
  referralCode?: string;
  creatorCode?: string;
  consentWhatsApp?: boolean;
}

export interface IngestLeadResponse {
  success: boolean;
  leadId: string;
  leadCode: string;
  phoneE164: string;
  stage: string;
  isExisting: boolean;
}
