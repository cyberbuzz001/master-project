import { ExpiryCalendarService } from '../server/src/services/ExpiryCalendarService';
import { runMigrations } from '../server/src/db/schema';
import { seedDatabase } from '../server/src/db/init';

describe('ExpiryCalendarService Unit Tests', () => {
  let expiryService: ExpiryCalendarService;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
    expiryService = ExpiryCalendarService.getInstance();
  });

  test('1. Resolves Expiry Calendar configurations for index derivatives', async () => {
    const niftyConfig = await expiryService.getCalendarConfig('NIFTY');
    expect(niftyConfig).not.toBeNull();
    expect(niftyConfig?.exchange).toBe('NSE');

    const sensexConfig = await expiryService.getCalendarConfig('SENSEX');
    expect(sensexConfig).not.toBeNull();
    expect(sensexConfig?.exchange).toBe('BSE');
  });

  test('2. Categorizes expiries into Nearest, Next, and Monthly expiries', async () => {
    const niftyExpiries = await expiryService.getValidExpiries('NIFTY');
    expect(niftyExpiries.nearestExpiry).not.toBeNull();
    expect(niftyExpiries.allExpiries.length).toBeGreaterThan(0);
    if (niftyExpiries.nextExpiry) {
      expect(niftyExpiries.nearestExpiry! <= niftyExpiries.nextExpiry!).toBe(true);
    }
  });

  test('3. Rejects expired contract dates', async () => {
    const isValid = await expiryService.isValidExpiry('NIFTY', '2020-01-01');
    expect(isValid).toBe(false);
  });
});
