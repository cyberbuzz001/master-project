jest.mock('../db/schema', () => ({
  queryOne: jest.fn(), query: jest.fn(), execute: jest.fn(), withTransaction: jest.fn(),
}));
jest.mock('../trading/ExecutionEngine', () => ({ ExecutionEngine: {
  unregisterPendingOrder: jest.fn(), registerPendingOrder: jest.fn(),
} }));
jest.mock('../trading/VirtualWalletLedger', () => ({ VirtualWalletLedger: { recomputeUsedMarginForUser: jest.fn() } }));
jest.mock('../trading/RMS', () => ({ RMS: {} }));
jest.mock('../db/redis', () => ({ redis: {} }));
jest.mock('../middleware/audit', () => ({ logAuditAction: jest.fn() }));
jest.mock('../utils/adminEventBus', () => ({ emitAdminOrderEvent: jest.fn() }));
import { OMS } from '../trading/OMS';
import { queryOne, withTransaction } from '../db/schema';
import { ExecutionEngine } from '../trading/ExecutionEngine';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';

describe('Order mutation versus committed fill', () => {
  let client: { query: jest.Mock };
  beforeEach(() => {
    jest.clearAllMocks();
    // The initial read sees ACCEPTED; the fill wins before the mutation.
    (queryOne as jest.Mock).mockResolvedValue({ id: 'order-1', status: 'ACCEPTED', price: '100', quantity: 65 });
    client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    (withTransaction as jest.Mock).mockImplementation(fn => fn(client));
  });
  test('cancel loses to fill without changing margin or unregistering the order', async () => {
    expect((await OMS.cancelOrder('order-1', 'user-1')).success).toBe(false);
    expect(client.query.mock.calls[0][0]).toContain("status IN ('ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING')");
    expect(client.query.mock.calls[0][1]).toEqual(['order-1', 'user-1']);
    expect(VirtualWalletLedger.recomputeUsedMarginForUser).not.toHaveBeenCalled();
    expect(ExecutionEngine.unregisterPendingOrder).not.toHaveBeenCalled();
  });
  test('modify loses to fill without re-registering stale quantity', async () => {
    expect((await OMS.modifyOrder('order-1', 'user-1', 110, 130)).success).toBe(false);
    expect(client.query.mock.calls[0][0]).toContain("status IN ('ACCEPTED', 'PENDING')");
    expect(client.query.mock.calls[0][1]).toEqual([110, 130, 'order-1', 'user-1']);
    expect(VirtualWalletLedger.recomputeUsedMarginForUser).not.toHaveBeenCalled();
    expect(ExecutionEngine.registerPendingOrder).not.toHaveBeenCalled();
  });
});
