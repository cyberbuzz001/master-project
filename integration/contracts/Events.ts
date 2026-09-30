/**
 * Standard Event Bus Contracts for Trade Grow Unified Ecosystem
 * Event envelopes and registry for Redis Streams and Webhooks
 */

export interface DomainEventEnvelope<T = any> {
  eventId: string;
  eventName: string;
  aggregateId: string;
  timestamp: string;
  version: '1.0';
  payload: T;
}

export type EcosystemEventType =
  | 'lead.created'
  | 'lead.assigned'
  | 'lead.contacted'
  | 'kyc.initiated'
  | 'kyc.stage_completed'
  | 'kyc.completed'
  | 'account.approved'
  | 'account.activated'
  | 'advisory.recommendation_published'
  | 'advisory.order_executed';

export interface LeadCreatedPayload {
  leadUuid: string;
  phoneE164: string;
  fullName?: string;
  source: string;
  utmSource?: string;
  utmCampaign?: string;
  referralCode?: string;
}

export interface KycStageCompletedPayload {
  userId: string | number;
  phoneE164: string;
  stage: 'PAN_VERIFIED' | 'DIGILOCKER_VERIFIED' | 'PENNY_DROP_VERIFIED' | 'SELFIE_VERIFIED' | 'ALL_VERIFIED';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  metadata?: Record<string, any>;
}

export interface AccountActivatedPayload {
  userId: string | number;
  clientCode: string;
  phoneE164: string;
  activatedAt: string;
  firstOrderSymbol?: string;
  firstOrderValuePaisa?: number;
  isSimulated: boolean;
}
