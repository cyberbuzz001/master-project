jest.mock('../db/schema', () => ({ queryOne: jest.fn(), query: jest.fn(), execute: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../marketData/MarketDataEngine', () => ({ MarketDataEngine: {} }));
jest.mock('../trading/VirtualWalletLedger', () => ({ VirtualWalletLedger: { settleTradeExecutionInTransaction: jest.fn() } }));
jest.mock('../trading/PortfolioService', () => ({ PortfolioService: { recordExecutionInTransaction: jest.fn() } }));
jest.mock('../marketData/GreeksEngine', () => ({}));
jest.mock('../trading/GttEngine', () => ({ gttEngine: {} }));
jest.mock('../trading/PriceAlertEngine', () => ({ priceAlertEngine: {} }));
jest.mock('../utils/adminEventBus', () => ({}));
import { ExecutionEngine } from '../trading/ExecutionEngine';
import { queryOne, withTransaction } from '../db/schema';
import { PortfolioService } from '../trading/PortfolioService';

test('execution skips a matching snapshot superseded by a committed amendment', async () => {
  (queryOne as jest.Mock).mockResolvedValue(null);
  // Database state no longer matches quantity/limit/trigger in the snapshot.
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  (withTransaction as jest.Mock).mockImplementation(fn => fn(client));
  await ExecutionEngine.executeOrder({ id: 'order-1', order_id: 'ORD1', quantity: 65, price: 100, trigger_price: 0 }, 100);
  expect(client.query.mock.calls[0][0]).toContain('quantity = $3 AND price = $4');
  expect(client.query.mock.calls[0][1]).toEqual([100, 'order-1', 65, 100, 0]);
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(PortfolioService.recordExecutionInTransaction).not.toHaveBeenCalled();
});
