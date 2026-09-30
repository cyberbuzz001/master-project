const { query, execute } = require('./server/dist/db/schema');

async function fix() {
  const userId = 'usr_d076ef3e-2754-4567-84b2-38a86533ce6c';

  // 1. Reset all SENSEX open positions to closed
  await execute(`
    UPDATE positions 
    SET net_qty = 0, buy_qty = 0, sell_qty = 0, average_price = 0, realized_pnl = 0, unrealized_pnl = 0, updated_at = NOW()
    WHERE user_id = $1 AND (symbol LIKE '%77200%' OR symbol LIKE '%77300%')
  `, [userId]);

  // 2. Set clean cash_balance = 5000.00, used_margin = 0.00
  await execute(`
    UPDATE virtual_wallets
    SET cash_balance = 5000.00, used_margin = 0.00, updated_at = NOW()
    WHERE user_id = $1
  `, [userId]);

  // 3. Clear pending orders for AmanSahu if any
  await execute(`
    UPDATE orders
    SET status = 'CANCELLED', rejection_reason = 'Admin squared off / Reconciled'
    WHERE user_id = $1 AND status IN ('PENDING', 'ACCEPTED', 'TRIGGER_PENDING')
  `, [userId]);

  const updatedWallet = await query('SELECT * FROM virtual_wallets WHERE user_id = $1', [userId]);
  console.log('Wallet after:', updatedWallet[0]);

  const updatedPos = await query('SELECT symbol, net_qty, average_price, realized_pnl, unrealized_pnl FROM positions WHERE user_id = $1', [userId]);
  console.log('Updated positions for AmanSahu:', updatedPos);
}

fix().then(() => process.exit(0)).catch(console.error);
