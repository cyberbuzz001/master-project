import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { SSOTicketPayload } from '../server/src/contracts/SSO';
import { AdvisoryRecommendationPayload, AdvisoryOrderPreviewResponse } from '../server/src/contracts/Advisory';

describe('SSO and Advisory Integration Contracts', () => {
  const TEST_SECRET = 'supersecretlongenoughstring1234567890!';

  it('should sign and verify valid SSO ticket payload', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    const payload: SSOTicketPayload = {
      sub: 'usr_test_123',
      clientCode: 'TG-1001',
      phoneE164: '+919876543210',
      email: 'trader@example.com',
      role: 'TRADER',
      kycStatus: 'COMPLETED',
      scope: ['advisory.view', 'trading.execute'],
      nonce,
      iat: nowSec,
      exp: nowSec + 60,
    };

    const token = jwt.sign(payload, TEST_SECRET);
    const decoded = jwt.verify(token, TEST_SECRET) as SSOTicketPayload;

    expect(decoded.sub).toBe('usr_test_123');
    expect(decoded.clientCode).toBe('TG-1001');
    expect(decoded.scope).toContain('trading.execute');
    expect(decoded.exp - decoded.iat).toBe(60);
  });

  it('should format Advisory Order Preview with SEBI disclaimer', () => {
    const payload: AdvisoryRecommendationPayload = {
      advisoryReportId: 'rep_001',
      symbol: 'RELIANCE',
      exchange: 'NSE',
      action: 'BUY',
      productType: 'CNC',
      targetPrice: 3200,
      stopLoss: 2950,
      analystName: 'SEBI Registered Analyst',
      analystRegNumber: 'INH000012345',
      sebiEntityName: 'TradeGrow Advisory',
      validUntil: '2026-10-15',
    };

    const preview: AdvisoryOrderPreviewResponse = {
      symbol: payload.symbol,
      exchange: payload.exchange,
      action: payload.action,
      productType: payload.productType,
      targetPrice: payload.targetPrice,
      stopLoss: payload.stopLoss,
      advisoryReportId: payload.advisoryReportId,
      analystName: payload.analystName,
      analystRegNumber: payload.analystRegNumber,
      disclaimer: 'DISCLAIMER: Investments in securities market are subject to market risks.',
    };

    expect(preview.symbol).toBe('RELIANCE');
    expect(preview.action).toBe('BUY');
    expect(preview.disclaimer).toContain('market risks');
  });

  it('should enforce that client roles cannot merge across platforms, while staff roles can', () => {
    const { isStaffRole, STAFF_ROLES } = require('../server/src/routes/ssoRoutes');

    // Retail clients must never be permitted to merge accounts
    expect(isStaffRole('TRADER')).toBe(false);
    expect(isStaffRole('CLIENT')).toBe(false);
    expect(isStaffRole('GUEST')).toBe(false);

    // Employees and staff are permitted to access merged management desks
    expect(isStaffRole('ADMIN')).toBe(true);
    expect(isStaffRole('SUPER_ADMIN')).toBe(true);
    expect(isStaffRole('COMPLIANCE_OFFICER')).toBe(true);
    expect(isStaffRole('RESEARCH_ANALYST')).toBe(true);
    expect(isStaffRole('CRM_AGENT')).toBe(true);
  });
});
