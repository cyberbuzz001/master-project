// NOTE: this suite imported describe/it/expect from 'vitest', which is not a dependency of
// this project — the whole file failed to compile and never ran. The runner is Jest, which
// provides these as globals.
import { ClientCreationService } from '../server/src/services/ClientCreationService';
import { query, execute } from '../server/src/db/schema';

describe('Brokerage Client Duplicate Account Prevention & Unique Identity Suite', () => {
  const testEmail1 = 'uniquetrader991@example.com';
  const testEmail2 = 'uniquetrader992@example.com';
  const testUsername1 = 'uniquetrader991';
  const testUsername2 = 'uniquetrader992';

  beforeAll(async () => {
    // Clean up test data if left over
    await execute("DELETE FROM users WHERE email LIKE '%@example.com'");
  });

  afterAll(async () => {
    await execute("DELETE FROM users WHERE email LIKE '%@example.com'");
  });

  it('Test 1: Normal client creation with valid email and generated Client ID succeeds', async () => {
    const result = await ClientCreationService.createClient({
      username: testUsername1,
      email: testEmail1,
      password: 'TestPassword123!',
      role: 'USER',
      initialCapital: 50000
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(testEmail1.toLowerCase());
    expect(result.user?.clientId).toMatch(/^TG-USR-[A-Z0-9]{4,6}$/);

    // Verify wallet created with initial capital
    const wallet = await query<any>('SELECT * FROM virtual_wallets WHERE user_id = $1', [result.user!.id]);
    expect(wallet.length).toBe(1);
    expect(parseFloat(wallet[0].cash_balance)).toBe(50000);
  });

  it('Test 2: Creating another client with the exact same email is rejected with DUPLICATE_EMAIL', async () => {
    const result = await ClientCreationService.createClient({
      username: 'different_user_name',
      email: testEmail1,
      password: 'AnotherPassword123!'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_EMAIL');
    expect(result.error?.field).toBe('email');
  });

  it('Test 3: Case variation (Test@Example.COM) is rejected due to normalized email comparison', async () => {
    const result = await ClientCreationService.createClient({
      username: 'case_variation_user',
      email: testEmail1.toUpperCase(),
      password: 'AnotherPassword123!'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_EMAIL');
  });

  it('Test 4: Whitespace variations ("  uniquetrader991@example.com  ") are normalized and rejected', async () => {
    const result = await ClientCreationService.createClient({
      username: 'spaces_user',
      email: `   ${testEmail1}   `,
      password: 'AnotherPassword123!'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_EMAIL');
  });

  it('Test 5: Explicit duplicate Client ID is rejected with DUPLICATE_CLIENT_ID', async () => {
    // Get existing client's ID
    const existing = await query<any>('SELECT client_id FROM users WHERE email = $1', [testEmail1]);
    const existingClientId = existing[0].client_id;

    const result = await ClientCreationService.createClient({
      username: testUsername2,
      email: testEmail2,
      clientId: existingClientId,
      password: 'Password123!'
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_CLIENT_ID');
    expect(result.error?.field).toBe('clientId');
  });

  it('Test 6: Real-time duplicate check endpoint returns isDuplicate: true with existing customer details', async () => {
    const check = await ClientCreationService.checkDuplicate({ email: testEmail1.toUpperCase() });
    expect(check.isDuplicate).toBe(true);
    expect(check.field).toBe('email');
    expect(check.existingCustomer).toBeDefined();
    expect(check.existingCustomer.username).toBe(testUsername1);
  });

  it('Test 7: Race conditions - 2 simultaneous requests with same email allow only 1 success', async () => {
    const simultaneousEmail = 'race_condition_test@example.com';
    const req1 = ClientCreationService.createClient({
      username: 'race_user_1',
      email: simultaneousEmail,
      password: 'Password123!'
    });

    const req2 = ClientCreationService.createClient({
      username: 'race_user_2',
      email: simultaneousEmail,
      password: 'Password123!'
    });

    const [res1, res2] = await Promise.all([req1, req2]);

    const successes = [res1, res2].filter(r => r.success);
    const failures = [res1, res2].filter(r => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].error?.code).toBe('DUPLICATE_EMAIL');
  });
});
