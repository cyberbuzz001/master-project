import { WhatsAppAutomationService } from '../server/src/services/WhatsAppAutomationService';

describe('WhatsApp Automation & Anti-Ban Engine Tests', () => {
  const wa = WhatsAppAutomationService.getInstance();

  describe('E.164 Phone Number Formatting', () => {
    it('should format 10-digit Indian numbers with +91 prefix', () => {
      expect(wa.normalizePhoneE164('9876543210')).toBe('+919876543210');
      expect(wa.normalizePhoneE164(' 98765 43210 ')).toBe('+919876543210');
      expect(wa.normalizePhoneE164('98765-43210')).toBe('+919876543210');
    });

    it('should format 12-digit Indian numbers with 91 prefix', () => {
      expect(wa.normalizePhoneE164('919876543210')).toBe('+919876543210');
    });

    it('should preserve already formatted +91 numbers', () => {
      expect(wa.normalizePhoneE164('+919876543210')).toBe('+919876543210');
    });
  });

  describe('Anti-Ban Spintax & Fingerprint Randomization', () => {
    it('should resolve {A|B|C} choices to one of the options', () => {
      const template = '{Namaste|Hello|Hi} trader!';
      const result = wa.parseSpintax(template);
      expect(result).toMatch(/^(Namaste|Hello|Hi) trader!/);
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
    });

    it('should produce variations across multiple iterations', () => {
      const template = '{Namaste|Hello|Hi} {friend|trader|partner}';
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        // Strip trailing zero-width space for string comparison
        results.add(wa.parseSpintax(template).replace(/\u200B/g, ''));
      }
      // Out of 9 possible combinations, at least 3 distinct variations should appear across 50 iterations
      expect(results.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Inbound Opt-Out Auto-Unsubscribe Handling', () => {
    it('should recognize standard opt-out keywords', async () => {
      const testPhone = '+919999900001';
      
      const resStop = await wa.handleInboundMessage(testPhone, 'STOP', 'msg_test_stop');
      expect(resStop.acknowledged).toBe(true);
      expect(resStop.optOutTriggered).toBe(true);

      const resUnsub = await wa.handleInboundMessage(testPhone, ' unsubscribe ', 'msg_test_unsub');
      expect(resUnsub.acknowledged).toBe(true);
      expect(resUnsub.optOutTriggered).toBe(true);

      const resQuit = await wa.handleInboundMessage(testPhone, 'QUIT', 'msg_test_quit');
      expect(resQuit.acknowledged).toBe(true);
      expect(resQuit.optOutTriggered).toBe(true);
    });

    it('should not mark regular inquiries as opt-out', async () => {
      const testPhone = '+919999900002';
      const res = await wa.handleInboundMessage(testPhone, 'How do I complete KYC?', 'msg_test_inq');
      expect(res.acknowledged).toBe(true);
      expect(res.optOutTriggered).toBeUndefined();
    });
  });

  describe('Business Hours Guard', () => {
    it('should return a boolean indicating IST business hours compliance', () => {
      const isAllowed = wa.isWithinBusinessHours();
      expect(typeof isAllowed).toBe('boolean');
    });
  });
});
