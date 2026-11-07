const { ClientCreationService } = require('/app/server/dist/services/ClientCreationService');
const { query, queryOne } = require('/app/server/dist/db/schema');

async function main() {
  console.log('Attempting to create or fetch demo account for cTrader review...');

  const email = 'ctrader.demo@tradegrowx.in';
  const username = 'ctrader_demo';
  const password = 'TradeGrow@cTrader2026';

  // Check if user already exists
  const existingUser = await queryOne('SELECT id, client_id, username, email, role, status FROM users WHERE email = $1 OR username = $2', [email, username]);

  if (existingUser) {
    console.log('Existing user found:', existingUser);
    
    // Update password, KYC completed, onboarding completed, and ensure active
    const argon2 = require('argon2');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    
    await query(`
      UPDATE users 
      SET password_hash = $1, 
          is_kyc_completed = true, 
          onboarding_completed = true, 
          status = 'ACTIVE',
          role = 'USER',
          updated_at = NOW() 
      WHERE id = $2
    `, [passwordHash, existingUser.id]);

    // Ensure wallet has virtual funds
    await query(`
      UPDATE virtual_wallets 
      SET cash_balance = 1000000.0, 
          status = 'ACTIVE', 
          updated_at = NOW() 
      WHERE user_id = $1
    `, [existingUser.id]);

    console.log('User password and demo status reset successfully!');
    console.log(JSON.stringify({
      loginUrl: 'https://tradegrowx.in',
      directIntegrationsUrl: 'https://tradegrowx.in/profile/integrations',
      email: existingUser.email,
      username: existingUser.username,
      clientId: existingUser.client_id,
      password: password,
      role: 'USER',
      virtualBalance: '₹10,00,000 (Simulated Demo Funds)'
    }, null, 2));
    return;
  }

  const result = await ClientCreationService.createClient({
    username: username,
    email: email,
    password: password,
    fullName: 'Spotware cTrader Reviewer',
    phoneNumber: '+919876543210',
    initialCapital: 1000000.0,
    role: 'USER',
    city: 'Mumbai',
    address: 'cTrader Review Dept, Spotware Systems'
  });

  if (!result.success || !result.user) {
    console.error('Failed to create client:', result.error);
    process.exit(1);
  }

  // Set KYC and onboarding completed
  await query(`
    UPDATE users 
    SET is_kyc_completed = true, 
        onboarding_completed = true 
    WHERE id = $1
  `, [result.user.id]);

  console.log('Demo user successfully created!');
  console.log(JSON.stringify({
    loginUrl: 'https://tradegrowx.in',
    directIntegrationsUrl: 'https://tradegrowx.in/profile/integrations',
    email: result.user.email,
    username: result.user.username,
    clientId: result.user.clientId,
    password: password,
    role: result.user.role,
    virtualBalance: '₹10,00,000 (Simulated Demo Funds)'
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during demo user creation:', err);
    process.exit(1);
  });
