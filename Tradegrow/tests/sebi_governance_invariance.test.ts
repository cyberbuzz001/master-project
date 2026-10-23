/**
 * tests/sebi_governance_invariance.test.ts
 *
 * TradeGrow Phase 7 Testing Suite — SEBI Regulatory Governance & Chinese Wall Invariance
 * Enforces:
 * 1. SEBI Blackout Period [T-30, T+5] restrictions for analysts on covered securities.
 * 2. Four-Eyes Principle / Dual-authorization approval gate before research publication.
 * 3. Chinese Wall separation of duties between Sales telecallers and licensed Research Analysts.
 * 4. Cryptographic SHA-256 tamper-evident audit hashing of research rationales and disclosures.
 */

import crypto from 'crypto';
import { runMigrations, queryOne, execute } from '../server/src/db/schema';
import { seedDatabase } from '../server/src/db/init';
import { generateUUID } from '../server/src/utils/crypto';

// SEBI Governance Enforcement Helpers
export class SebiGovernanceEngine {
  /**
   * Evaluates whether a personal trade is prohibited by SEBI Research Analyst Regulations (Blackout Window: T-30 to T+5 days)
   */
  public static checkBlackoutRestriction(params: {
    userRole: string;
    symbol: string;
    activeRecommendations: Array<{
      symbol: string;
      analystId: string;
      publishedAt: Date;
      status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
    }>;
    analystId: string;
    tradeDate?: Date;
  }): { allowed: boolean; reason?: string } {
    const isAnalystOrStaff = ['ANALYST', 'RESEARCH_ANALYST', 'RESEARCH_HEAD'].includes(params.userRole);
    if (!isAnalystOrStaff) {
      return { allowed: true }; // Retail traders are not subject to analyst trading blackout
    }

    const tradeTime = (params.tradeDate || new Date()).getTime();

    for (const rec of params.activeRecommendations) {
      if (rec.symbol.toUpperCase() === params.symbol.toUpperCase()) {
        const pubTime = new Date(rec.publishedAt).getTime();
        const diffDays = (tradeTime - pubTime) / (1000 * 60 * 60 * 24);

        // SEBI RA Regulation: Blackout period applies 30 days before publication to 5 days after
        if (diffDays >= -30 && diffDays <= 5) {
          return {
            allowed: false,
            reason: `SEBI_BLACKOUT_RESTRICTION: Personal trade prohibited on covered symbol ${params.symbol} within [T-30, T+5] days of research publication. (Delta: ${diffDays.toFixed(1)} days)`
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Enforces Four-Eyes Principle: Recommendations must pass Senior RA + Compliance Officer before client broadcast
   */
  public static validatePublishingGate(recommendation: {
    id: string;
    symbol: string;
    juniorAnalystId: string;
    seniorApproverId?: string | null;
    complianceOfficerId?: string | null;
    conflictDeclared: boolean;
    contentHash: string;
    rationale: string;
  }): { canPublish: boolean; error?: string } {
    if (!recommendation.conflictDeclared) {
      return { canPublish: false, error: 'SEBI_VIOLATION: Statutory conflict of interest disclosure not declared' };
    }

    // Verify SHA-256 content hash matches rationale
    const computedHash = crypto.createHash('sha256').update(recommendation.rationale.trim()).digest('hex');
    if (computedHash !== recommendation.contentHash) {
      return { canPublish: false, error: 'TAMPER_DETECTED: Cryptographic hash of recommendation content does not match' };
    }

    if (!recommendation.seniorApproverId) {
      return { canPublish: false, error: 'APPROVAL_GATE_HALTED: Missing Senior Research Analyst sign-off' };
    }

    if (!recommendation.complianceOfficerId) {
      return { canPublish: false, error: 'APPROVAL_GATE_HALTED: Missing SEBI Compliance Officer regulatory stamp' };
    }

    // Ensure Junior RA cannot approve their own recommendation
    if (recommendation.juniorAnalystId === recommendation.seniorApproverId) {
      return { canPublish: false, error: 'FOUR_EYES_VIOLATION: Creator cannot act as senior reviewer of their own research' };
    }

    return { canPublish: true };
  }

  /**
   * Enforces Chinese Wall Role Separation
   */
  public static checkRolePermission(role: string, action: string): boolean {
    const CHINESE_WALL_PERMISSIONS: Record<string, string[]> = {
      CRM_AGENT: ['VIEW_ASSIGNED_LEADS', 'LOG_CALLS', 'APPLY_DISCOUNT', 'REQUEST_TRIAL'],
      SENIOR_BA: ['VIEW_ASSIGNED_LEADS', 'LOG_CALLS', 'APPLY_DISCOUNT', 'CREATE_PROPOSAL'],
      TEAM_LEADER: ['VIEW_TEAM_LEADS', 'ASSIGN_LEADS', 'APPROVE_PROPOSALS'],
      ANALYST: ['DRAFT_RECOMMENDATIONS', 'VIEW_PORTAL_RESEARCH'],
      RESEARCH_HEAD: ['DRAFT_RECOMMENDATIONS', 'APPROVE_RESEARCH', 'BROADCAST_RESEARCH'],
      COMPLIANCE_OFFICER: ['REVIEW_COMPLIANCE_GATE', 'AUDIT_CALLS', 'INSPECT_KYC', 'ENFORCE_BLACKOUT'],
      SUPER_ADMIN: ['*']
    };

    const allowed = CHINESE_WALL_PERMISSIONS[role] || [];
    if (allowed.includes('*')) return true;
    return allowed.includes(action);
  }
}

describe('Phase 7: SEBI Regulatory Governance & Chinese Wall Invariance Tests', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
  });

  describe('1. SEBI Blackout Period [T-30, T+5] Enforcement', () => {
    const publishedDate = new Date(); // Published today (T=0)
    const activeRecs = [
      {
        symbol: 'TATASTEEL',
        analystId: 'usr_ra_ananya',
        publishedAt: publishedDate,
        status: 'ACTIVE' as const
      }
    ];

    test('Analyst cannot execute personal trade on covered stock during active blackout window', () => {
      const result = SebiGovernanceEngine.checkBlackoutRestriction({
        userRole: 'ANALYST',
        symbol: 'TATASTEEL',
        activeRecommendations: activeRecs,
        analystId: 'usr_ra_ananya',
        tradeDate: new Date() // T=0
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SEBI_BLACKOUT_RESTRICTION');
    });

    test('Analyst cannot execute personal trade 10 days BEFORE research release (T-10 inside T-30 window)', () => {
      const tenDaysPrior = new Date(publishedDate.getTime() - 10 * 24 * 60 * 60 * 1000);
      const result = SebiGovernanceEngine.checkBlackoutRestriction({
        userRole: 'ANALYST',
        symbol: 'TATASTEEL',
        activeRecommendations: activeRecs,
        analystId: 'usr_ra_ananya',
        tradeDate: tenDaysPrior
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SEBI_BLACKOUT_RESTRICTION');
    });

    test('Analyst CAN execute personal trade AFTER blackout window has expired (T+6 days)', () => {
      const sixDaysAfter = new Date(publishedDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      const result = SebiGovernanceEngine.checkBlackoutRestriction({
        userRole: 'ANALYST',
        symbol: 'TATASTEEL',
        activeRecommendations: activeRecs,
        analystId: 'usr_ra_ananya',
        tradeDate: sixDaysAfter
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('Retail trader is exempt from analyst blackout restriction on the same symbol', () => {
      const result = SebiGovernanceEngine.checkBlackoutRestriction({
        userRole: 'USER',
        symbol: 'TATASTEEL',
        activeRecommendations: activeRecs,
        analystId: 'retail_trader_1',
        tradeDate: new Date()
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('2. Four-Eyes Principle / Dual-Authorization Approval Gate', () => {
    const validRationale = 'Breakout above 200 EMA with 3.4x volume expansion and RSI bullish divergence.';
    const validHash = crypto.createHash('sha256').update(validRationale.trim()).digest('hex');

    test('Draft recommendation is rejected if missing Senior RA approval', () => {
      const gate = SebiGovernanceEngine.validatePublishingGate({
        id: 'REC-001',
        symbol: 'INFY',
        juniorAnalystId: 'ra_junior_01',
        seniorApproverId: null, // Missing
        complianceOfficerId: 'comp_officer_01',
        conflictDeclared: true,
        contentHash: validHash,
        rationale: validRationale
      });

      expect(gate.canPublish).toBe(false);
      expect(gate.error).toContain('APPROVAL_GATE_HALTED');
      expect(gate.error).toContain('Senior Research Analyst');
    });

    test('Draft recommendation is rejected if missing Compliance Officer stamp', () => {
      const gate = SebiGovernanceEngine.validatePublishingGate({
        id: 'REC-002',
        symbol: 'INFY',
        juniorAnalystId: 'ra_junior_01',
        seniorApproverId: 'ra_senior_01',
        complianceOfficerId: null, // Missing
        conflictDeclared: true,
        contentHash: validHash,
        rationale: validRationale
      });

      expect(gate.canPublish).toBe(false);
      expect(gate.error).toContain('APPROVAL_GATE_HALTED');
      expect(gate.error).toContain('SEBI Compliance Officer');
    });

    test('Junior RA attempting to self-approve their own research triggers FOUR_EYES_VIOLATION', () => {
      const gate = SebiGovernanceEngine.validatePublishingGate({
        id: 'REC-003',
        symbol: 'INFY',
        juniorAnalystId: 'ra_junior_01',
        seniorApproverId: 'ra_junior_01', // Self-approval!
        complianceOfficerId: 'comp_officer_01',
        conflictDeclared: true,
        contentHash: validHash,
        rationale: validRationale
      });

      expect(gate.canPublish).toBe(false);
      expect(gate.error).toContain('FOUR_EYES_VIOLATION');
    });

    test('Tampering with rationale text invalidates cryptographic SHA-256 hash', () => {
      const tamperedRationale = validRationale + ' [GUARANTEED 100% PROFIT]';
      const gate = SebiGovernanceEngine.validatePublishingGate({
        id: 'REC-004',
        symbol: 'INFY',
        juniorAnalystId: 'ra_junior_01',
        seniorApproverId: 'ra_senior_01',
        complianceOfficerId: 'comp_officer_01',
        conflictDeclared: true,
        contentHash: validHash, // Hash of original, but rationale was tampered
        rationale: tamperedRationale
      });

      expect(gate.canPublish).toBe(false);
      expect(gate.error).toContain('TAMPER_DETECTED');
    });

    test('Fully signed recommendation with valid hash and disclosures clears publishing gate', () => {
      const gate = SebiGovernanceEngine.validatePublishingGate({
        id: 'REC-005',
        symbol: 'INFY',
        juniorAnalystId: 'ra_junior_01',
        seniorApproverId: 'ra_senior_01',
        complianceOfficerId: 'comp_officer_01',
        conflictDeclared: true,
        contentHash: validHash,
        rationale: validRationale
      });

      expect(gate.canPublish).toBe(true);
      expect(gate.error).toBeUndefined();
    });
  });

  describe('3. Chinese Wall Separation of Duties', () => {
    test('Telecaller / CRM Agent is blocked from broadcasting research recommendations', () => {
      expect(SebiGovernanceEngine.checkRolePermission('CRM_AGENT', 'BROADCAST_RESEARCH')).toBe(false);
      expect(SebiGovernanceEngine.checkRolePermission('SENIOR_BA', 'BROADCAST_RESEARCH')).toBe(false);
    });

    test('Research Analyst is blocked from issuing sales discounts or modifying lead pricing', () => {
      expect(SebiGovernanceEngine.checkRolePermission('ANALYST', 'APPLY_DISCOUNT')).toBe(false);
      expect(SebiGovernanceEngine.checkRolePermission('ANALYST', 'APPROVE_PROPOSALS')).toBe(false);
    });

    test('Only Research Head can broadcast research', () => {
      expect(SebiGovernanceEngine.checkRolePermission('RESEARCH_HEAD', 'BROADCAST_RESEARCH')).toBe(true);
      expect(SebiGovernanceEngine.checkRolePermission('SUPER_ADMIN', 'BROADCAST_RESEARCH')).toBe(true);
    });

    test('Only Compliance Officer can review and clear compliance gates', () => {
      expect(SebiGovernanceEngine.checkRolePermission('COMPLIANCE_OFFICER', 'REVIEW_COMPLIANCE_GATE')).toBe(true);
      expect(SebiGovernanceEngine.checkRolePermission('CRM_AGENT', 'REVIEW_COMPLIANCE_GATE')).toBe(false);
      expect(SebiGovernanceEngine.checkRolePermission('ANALYST', 'REVIEW_COMPLIANCE_GATE')).toBe(false);
    });
  });
});
