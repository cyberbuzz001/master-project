/**
 * SEBI Chinese-Wall Compliant Advisory Recommendation & 1-Click Execution Contract
 */

export interface AdvisoryRecommendationPayload {
  advisoryReportId: string;
  symbol: string;
  exchange: 'NSE' | 'BSE' | 'MCX';
  action: 'BUY' | 'SELL';
  productType: 'CNC' | 'MIS' | 'NRML';
  targetPrice: number;
  stopLoss: number;
  recommendedEntryRange?: [number, number];
  rationale?: string;
  analystName: string;
  analystRegNumber: string;
  sebiEntityName: string;
  validUntil: string;
}

export interface AdvisoryOrderPreviewResponse {
  symbol: string;
  exchange: string;
  action: 'BUY' | 'SELL';
  productType: string;
  targetPrice: number;
  stopLoss: number;
  advisoryReportId: string;
  analystName: string;
  analystRegNumber: string;
  disclaimer: string;
}
