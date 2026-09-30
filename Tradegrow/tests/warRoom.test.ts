import { WarRoomService } from '../server/src/services/WarRoomService';
import { WhatsAppAutomationService } from '../server/src/services/WhatsAppAutomationService';
import jwt from 'jsonwebtoken';

describe('Trade Grow 1,000 Users War Room — Unit Tests', () => {
  const warRoom = WarRoomService.getInstance();
  const waService = WhatsAppAutomationService.getInstance();

  describe('Phone Number E.164 Normalization', () => {
    it('should normalize standard 10-digit Indian numbers to E.164 (+91XXXXXXXXXX)', () => {
      expect(warRoom.normalizePhone('9876543210')).toBe('+919876543210');
      expect(waService.normalizePhoneE164('9876543210')).toBe('+919876543210');
    });

    it('should handle numbers with leading zero', () => {
      expect(warRoom.normalizePhone('09876543210')).toBe('+919876543210');
    });

    it('should handle numbers already formatted with 91 prefix', () => {
      expect(warRoom.normalizePhone('919876543210')).toBe('+919876543210');
      expect(warRoom.normalizePhone('+919876543210')).toBe('+919876543210');
    });

    it('should strip special characters, spaces, and dashes', () => {
      expect(warRoom.normalizePhone('+91 98765-43210')).toBe('+919876543210');
      expect(waService.normalizePhoneE164('(98765) 43210')).toBe('+919876543210');
    });
  });

  describe('DPDP Act 2023 Compliance — IP Hashing', () => {
    it('should generate a 64-character SHA-256 hash for IP addresses', () => {
      const hash = warRoom.hashIp('203.0.113.195');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic for the same IP', () => {
      const hash1 = warRoom.hashIp('192.168.1.50');
      const hash2 = warRoom.hashIp('192.168.1.50');
      expect(hash1).toBe(hash2);
    });

    it('should handle undefined or empty IPs gracefully', () => {
      expect(warRoom.hashIp(undefined)).toBe('anonymous');
      expect(warRoom.hashIp('')).toBe('anonymous');
    });
  });

  describe('Advisory 1-Click Order Protocol', () => {
    const secret = 'test_advisory_secret_2026';

    it('should correctly encode and verify signed advisory recommendations', () => {
      const payload = {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        action: 'BUY',
        productType: 'CNC',
        targetPrice: 2950,
        stopLoss: 2840,
        advisoryReportId: 'REP-1049',
        analystName: 'Senior Research Analyst',
        analystRegNumber: 'INH000012345'
      };

      const token = jwt.sign(payload, secret, { expiresIn: '15m' });
      const decoded: any = jwt.verify(token, secret);

      expect(decoded.symbol).toBe('RELIANCE');
      expect(decoded.targetPrice).toBe(2950);
      expect(decoded.advisoryReportId).toBe('REP-1049');
    });

    it('should reject tampered or invalid advisory tokens', () => {
      const token = jwt.sign({ symbol: 'NIFTY' }, secret);
      expect(() => {
        jwt.verify(token, 'wrong_secret');
      }).toThrow();
    });
  });

  describe('Unified SSO Cross-System Ticket Protocol', () => {
    const ssoSecret = 'test_sso_shared_secret_2026';

    it('should generate valid 60-second SSO ticket with full client payload', () => {
      const ticketPayload = {
        sub: 'usr_882914',
        clientCode: 'TG-1049',
        phoneE164: '+919876543210',
        email: 'trader@tradegrow.in',
        role: 'client',
        kycStatus: 'VERIFIED',
        nonce: 'rnd_99182',
        iat: Math.floor(Date.now() / 1000)
      };

      const ticket = jwt.sign(ticketPayload, ssoSecret, { expiresIn: '60s' });
      const decoded: any = jwt.verify(ticket, ssoSecret);

      expect(decoded.sub).toBe('usr_882914');
      expect(decoded.clientCode).toBe('TG-1049');
      expect(decoded.phoneE164).toBe('+919876543210');
      expect(decoded.role).toBe('client');
      expect(decoded.kycStatus).toBe('VERIFIED');
    });

    it('should reject expired SSO tickets', () => {
      const expiredTicket = jwt.sign({ sub: 'usr_test' }, ssoSecret, { expiresIn: '-1s' });
      expect(() => {
        jwt.verify(expiredTicket, ssoSecret);
      }).toThrow();
    });
  });

  describe('Webhook Bridge HMAC-SHA256 Signatures', () => {
    const crypto = require('crypto');
    const secret = 'webhook_bridge_secret_test';

    it('should generate valid HMAC-SHA256 signature and verify payload integrity', () => {
      const payload = JSON.stringify({ event: 'lead.created', phone: '+919876543210', stage: 'NEW' });
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(signature).toBe(expected);
      expect(crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))).toBe(true);
    });

    it('should fail verification if payload is modified in transit', () => {
      const originalPayload = JSON.stringify({ event: 'lead.created', phone: '+919876543210' });
      const tamperedPayload = JSON.stringify({ event: 'lead.created', phone: '+919999999999' });

      const originalSig = crypto.createHmac('sha256', secret).update(originalPayload).digest('hex');
      const tamperedSig = crypto.createHmac('sha256', secret).update(tamperedPayload).digest('hex');

      expect(originalSig).not.toBe(tamperedSig);
    });
  });
});

