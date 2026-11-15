jest.mock('../db/schema', () => ({ queryOne: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../trading/PortfolioService', () => ({ PortfolioService: { getUserPositions: jest.fn().mockResolvedValue([]) } }));
jest.mock('../trading/MarginMath', () => ({}));
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { queryOne } from '../db/schema';

describe('Signed wallet loss settlement', () => {
  afterEach(() => jest.restoreAllMocks());
  test('loss beyond capital is persisted and ledger records the cash delta', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ cash_balance: '100.0000', realized_pnl: '0.0000' }] })
      .mockResolvedValueOnce({ rows: [{ cash_balance: '-50.0000', realized_pnl: '-150.0000' }] })
      .mockResolvedValue({ rows: [] }) };
    jest.spyOn(VirtualWalletLedger, 'recomputeUsedMarginForUser').mockResolvedValue(0);
    await VirtualWalletLedger.settleTradeExecutionInTransaction(client, 'u1', 'SELL', 500, 100, -150, 'order1');
    expect(client.query.mock.calls[1][0]).toContain('cash_balance = cash_balance + $1::numeric');
    expect(client.query.mock.calls[1][0]).toContain('realized_pnl = realized_pnl + $1::numeric');
    expect(client.query.mock.calls[1][1]).toEqual([-150, 'u1']);
    const ledgerParams = client.query.mock.calls[2][1];
    expect(ledgerParams.slice(3, 6)).toEqual([-150, '100.0000', '-50.0000']);
  });
  test('wallet API exposes a negative available margin', async () => {
    (queryOne as jest.Mock).mockResolvedValue({ cash_balance: '-50', used_margin: '20', realized_pnl: '-150' });
    const wallet = await VirtualWalletLedger.getWallet('u1');
    expect(wallet?.cashBalance).toBe(-50);
    expect(wallet?.buyingPower).toBe(-70);
    expect(wallet?.withdrawableBalance).toBe(0);
  });
  test('missing wallet aborts settlement instead of losing the cash movement', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(VirtualWalletLedger.settleTradeExecutionInTransaction(client, 'missing', 'SELL', 1, 0, -1, 'order1')).rejects.toThrow('Wallet not found');
  });
});
