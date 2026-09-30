/**
 * Unified SSO Cross-System Token Contract
 */

export interface SSOTicketPayload {
  sub: string;               // Unified User UUID / ID
  clientCode: string;        // TG-XXXX
  phoneE164: string;         // +91XXXXXXXXXX
  email?: string;
  role: string;
  kycStatus: string;
  scope: Array<'advisory.view' | 'advisory.subscribe' | 'crm.access' | 'trading.execute'>;
  nonce: string;
  iat: number;
  exp: number;               // 60-second validity
}

export interface SSOTicketExchangeRequest {
  ticket: string;
  targetApp: 'EXPERT_STOCKS' | 'TRADE_GROW_WEB';
}

export interface SSOTicketExchangeResponse {
  success: boolean;
  accessToken: string;
  user: {
    id: string;
    phone: string;
    email?: string;
    name?: string;
    role: string;
  };
}
