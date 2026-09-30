export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'OPERATIONS_MANAGER',
  'FINANCE_MANAGER',
  'KYC_OFFICER',
  'COMPLIANCE_OFFICER',
  'RISK_MANAGER',
  'RISK_OFFICER',
  'DEALER',
  'ANALYST',
  'SUPPORT_AGENT'
];

export function isStaffUser(role?: string): boolean {
  if (!role) return false;
  const upper = role.toUpperCase().trim();
  if (upper === 'USER' || upper === 'CLIENT') return false;
  return (
    STAFF_ROLES.includes(upper) ||
    upper.endsWith('_ADMIN') ||
    upper.endsWith('_MANAGER') ||
    upper.endsWith('_OFFICER') ||
    upper.endsWith('_DEALER') ||
    upper.endsWith('_AGENT')
  );
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isKycCompleted?: boolean;
  fullName?: string;
  phoneNumber?: string;
  city?: string;
  address?: string;
  dateOfBirth?: string;
  /** 'REDUCE_ONLY' when the backend RMS loss monitor has restricted this account to closing/reducing exposure only. */
  riskRestriction?: string | null;
}

export interface Wallet {
  userId: string;
  cashBalance: number;
  usedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  buyingPower: number;
}

export type TickSource = 'live' | 'guard_feed' | 'synthetic_skew' | 'cached_stale' | 'market_closed' | 'dhan' | 'fyers' | 'angelone';

export interface MarketTick {
  instrumentToken: string;
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  timestamp: number;
  source?: TickSource;
  isSynthetic?: boolean;
}

export interface Order {
  id: string;
  order_id: string;
  symbol: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  filled_quantity: number;
  price: number;
  average_price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  product_type: 'MIS' | 'CNC' | 'NRML';
  status: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Position {
  id: string;
  symbol: string;
  exchange: string;
  productType: string;
  buyQty: number;
  sellQty: number;
  netQty: number;
  averagePrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface Holding {
  id: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface OptionContractDetails {
  instrumentToken: string;
  tradingSymbol?: string;
  ltp: number;
  bid?: number;
  ask?: number;
  change: number;
  changePercent?: number;
  volume: number;
  openInterest: number;
  openInterestChange?: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  classification?: 'ITM' | 'ATM' | 'OTM';
  source?: TickSource;
  isSynthetic?: boolean;
}

export interface OptionChainItem {
  strikePrice: number;
  expiry: string;
  isAtm?: boolean;
  ce: OptionContractDetails;
  pe: OptionContractDetails;
}
