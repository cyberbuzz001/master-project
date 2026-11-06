/**
 * cTrader Order Mapping & Protocol Translation Test Suite
 * Verifies symbol translation, volume scaling, order types, client order IDs, and execution event lifecycle.
 */

import { CTraderOrderMapper } from '../trading/integrations/ctrader/cTraderOrderMapper';
import {
  ProtoOAOrderType,
  ProtoOATradeSide,
  ProtoOAExecutionType,
  ProtoOAExecutionEvent
} from '../trading/integrations/ctrader/cTraderTypes';
import { SubmitOrderDTO } from '../trading/OMS';

describe('cTrader Order Mapping Engine', () => {
  describe('Symbol Resolution', () => {
    it('should correctly resolve standard FX symbols to their cTrader defaults', async () => {
      const eurusd = await CTraderOrderMapper.resolveSymbol('EURUSD');
      expect(eurusd.symbolId).toBe(1);
      expect(eurusd.digits).toBe(5);

      const gold = await CTraderOrderMapper.resolveSymbol('XAUUSD');
      expect(gold.symbolId).toBe(4);
      expect(gold.digits).toBe(2);
    });

    it('should correctly resolve Indian index symbols with exchange prefixes', async () => {
      const nifty = await CTraderOrderMapper.resolveSymbol('NSE:NIFTY');
      expect(nifty.symbolId).toBe(1001);
      expect(nifty.symbolName).toBe('NIFTY');

      const banknifty = await CTraderOrderMapper.resolveSymbol('BANKNIFTY');
      expect(banknifty.symbolId).toBe(1002);
    });

    it('should deterministically generate symbolId for unknown symbols', async () => {
      const unknown = await CTraderOrderMapper.resolveSymbol('UNKNOWN_ASSET');
      expect(unknown.symbolId).toBeGreaterThan(0);
      expect(unknown.symbolName).toBe('UNKNOWN_ASSET');
    });
  });

  describe('TradeGrow to cTrader Order Translation', () => {
    it('should map MARKET BUY order with proper volume in cents', async () => {
      const dto: SubmitOrderDTO = {
        userId: 'usr_abc123456',
        instrumentToken: 'EURUSD',
        exchange: 'NSE',
        symbol: 'EURUSD',
        side: 'BUY',
        quantity: 10,
        price: 1.0850,
        orderType: 'MARKET',
        productType: 'MIS'
      };

      const mapped = await CTraderOrderMapper.mapTradeGrowToCTrader(dto, 9876543);

      expect(mapped.newOrderReq.ctidTraderAccountId).toBe(9876543);
      expect(mapped.newOrderReq.symbolId).toBe(1);
      expect(mapped.newOrderReq.tradeSide).toBe(ProtoOATradeSide.BUY);
      expect(mapped.newOrderReq.orderType).toBe(ProtoOAOrderType.MARKET);
      // 10 units * 100 cents = 1000 cents
      expect(mapped.mappedVolume).toBe(1000);
      expect(mapped.clientOrderId).toMatch(/^TG_/);
    });

    it('should map LIMIT SELL order with rounded price limit', async () => {
      const dto: SubmitOrderDTO = {
        userId: 'usr_xyz789',
        instrumentToken: 'XAUUSD',
        exchange: 'NSE',
        symbol: 'XAUUSD',
        side: 'SELL',
        quantity: 2,
        price: 2650.4567, // Should round to 2 digits for XAUUSD
        orderType: 'LIMIT',
        productType: 'MIS',
        idempotencyKey: 'IDEMP_GOLD_001'
      };

      const mapped = await CTraderOrderMapper.mapTradeGrowToCTrader(dto, 9876543);

      expect(mapped.newOrderReq.tradeSide).toBe(ProtoOATradeSide.SELL);
      expect(mapped.newOrderReq.orderType).toBe(ProtoOAOrderType.LIMIT);
      expect(mapped.newOrderReq.limitPrice).toBe(2650.46);
      expect(mapped.clientOrderId).toBe('IDEMP_GOLD_001');
    });

    it('should map STOP-LOSS (SL) order with trigger price', async () => {
      const dto: SubmitOrderDTO = {
        userId: 'usr_test',
        instrumentToken: 'NIFTY',
        exchange: 'NSE',
        symbol: 'NIFTY',
        side: 'BUY',
        quantity: 50,
        price: 25000,
        triggerPrice: 24980.50,
        orderType: 'SL',
        productType: 'MIS'
      };

      const mapped = await CTraderOrderMapper.mapTradeGrowToCTrader(dto, 1122334);

      expect(mapped.newOrderReq.orderType).toBe(ProtoOAOrderType.STOP);
      expect(mapped.newOrderReq.stopPrice).toBe(24980.50);
    });
  });

  describe('Execution Event State Mapping', () => {
    it('should correctly translate execution event types to database statuses', async () => {
      const filledEvent: ProtoOAExecutionEvent = {
        ctidTraderAccountId: 9876543,
        executionType: ProtoOAExecutionType.ORDER_FILLED,
        order: {
          orderId: 55501,
          tradeData: {
            symbolId: 1,
            volume: 1000,
            tradeSide: ProtoOATradeSide.BUY,
            clientOrderId: 'NON_EXISTENT_MOCK_CLIENT_ID'
          },
          orderType: ProtoOAOrderType.MARKET,
          orderStatus: 2,
          executionPrice: 1.0855
        }
      };

      const updateRes = await CTraderOrderMapper.updateExecutionMapping(filledEvent);
      expect(updateRes.status).toBe('FILLED');
      expect(updateRes.matched).toBe(false); // Because NON_EXISTENT isn't in DB
    });

    it('should translate rejection and cancellation event types', async () => {
      const rejectEvent: ProtoOAExecutionEvent = {
        ctidTraderAccountId: 9876543,
        executionType: ProtoOAExecutionType.ORDER_REJECTED,
        errorCode: 'NOT_ENOUGH_MONEY'
      };

      const cancelEvent: ProtoOAExecutionEvent = {
        ctidTraderAccountId: 9876543,
        executionType: ProtoOAExecutionType.ORDER_CANCELLED
      };

      const resReject = await CTraderOrderMapper.updateExecutionMapping(rejectEvent);
      expect(resReject.status).toBe('REJECTED');

      const resCancel = await CTraderOrderMapper.updateExecutionMapping(cancelEvent);
      expect(resCancel.status).toBe('CANCELLED');
    });
  });
});

