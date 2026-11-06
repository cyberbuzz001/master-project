/**
 * cTrader Order Mapping & Normalization Engine
 * Maps internal TradeGrow OMS orders to Spotware cTrader Open API Protobuf payloads and vice versa.
 */

import { query, queryOne, execute } from '../../../db/schema';
import { SubmitOrderDTO } from '../../OMS';
import {
  ProtoOANewOrderReq,
  ProtoOAOrderType,
  ProtoOATradeSide,
  ProtoOAExecutionEvent,
  ProtoOAExecutionType
} from './cTraderTypes';

export interface MappedOrderPayload {
  newOrderReq: ProtoOANewOrderReq;
  clientOrderId: string;
  ctraderSymbolId: number;
  mappedVolume: number;
}

export interface SymbolMapping {
  symbolId: number;
  symbolName: string;
  lotSize: number;
  digits: number;
}

// Fallback catalog for standard assets
const DEFAULT_SYMBOL_CATALOG: Record<string, SymbolMapping> = {
  'EURUSD': { symbolId: 1, symbolName: 'EURUSD', lotSize: 100000, digits: 5 },
  'GBPUSD': { symbolId: 2, symbolName: 'GBPUSD', lotSize: 100000, digits: 5 },
  'USDJPY': { symbolId: 3, symbolName: 'USDJPY', lotSize: 100000, digits: 3 },
  'XAUUSD': { symbolId: 4, symbolName: 'XAUUSD', lotSize: 100, digits: 2 },
  'BTCUSD': { symbolId: 5, symbolName: 'BTCUSD', lotSize: 1, digits: 2 },
  'US500':  { symbolId: 6, symbolName: 'US500', lotSize: 1, digits: 2 },
  'NIFTY':  { symbolId: 1001, symbolName: 'NIFTY', lotSize: 50, digits: 2 },
  'BANKNIFTY': { symbolId: 1002, symbolName: 'BANKNIFTY', lotSize: 15, digits: 2 },
  'FINNIFTY': { symbolId: 1003, symbolName: 'FINNIFTY', lotSize: 25, digits: 2 },
  'RELIANCE': { symbolId: 2001, symbolName: 'RELIANCE', lotSize: 1, digits: 2 }
};

export class CTraderOrderMapper {
  /**
   * Resolves cTrader symbol ID and contract characteristics from DB or defaults
   */
  public static async resolveSymbol(tradegrowSymbol: string): Promise<SymbolMapping> {
    const cleanSym = (tradegrowSymbol || '').trim().toUpperCase().replace(/^NSE:|^BSE:|^NFO:/, '');

    try {
      const dbRow = await queryOne<{
        symbol_id: string;
        symbol_name: string;
        lot_size: string;
        digits: number;
      }>(
        `SELECT symbol_id, symbol_name, lot_size, digits 
         FROM ctrader_symbols 
         WHERE UPPER(tradegrow_symbol) = $1 OR UPPER(symbol_name) = $1 
         LIMIT 1`,
        [cleanSym]
      );

      if (dbRow) {
        return {
          symbolId: parseInt(dbRow.symbol_id, 10),
          symbolName: dbRow.symbol_name,
          lotSize: parseFloat(dbRow.lot_size) || 1,
          digits: dbRow.digits || 2
        };
      }
    } catch (err: any) {
      console.warn(`[cTraderMapper] DB symbol lookup failed, falling back to static map:`, err.message);
    }

    // Check defaults
    if (DEFAULT_SYMBOL_CATALOG[cleanSym]) {
      return DEFAULT_SYMBOL_CATALOG[cleanSym];
    }

    // Generic fallback: generate deterministic symbolId if unknown
    const hash = cleanSym.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 100000, 3000);
    return {
      symbolId: hash,
      symbolName: cleanSym,
      lotSize: 1,
      digits: 2
    };
  }

  /**
   * Maps TradeGrow SubmitOrderDTO to cTrader ProtoOANewOrderReq
   */
  public static async mapTradeGrowToCTrader(
    dto: SubmitOrderDTO,
    ctidTraderAccountId: number
  ): Promise<MappedOrderPayload> {
    const symbolInfo = await this.resolveSymbol(dto.symbol);

    // TradeGrow quantity (units/shares/lots) -> cTrader volume in cents (1 unit = 100 cents)
    // For standard FX: 1 lot = 100,000 units = 10,000,000 cents.
    // For equity/derivatives: quantity * 100 cents.
    const mappedVolume = Math.max(100, Math.round(dto.quantity * 100));

    // Map Order Side
    const tradeSide = dto.side === 'BUY' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL;

    // Map Order Type
    let orderType = ProtoOAOrderType.MARKET;
    if (dto.orderType === 'LIMIT') {
      orderType = ProtoOAOrderType.LIMIT;
    } else if (dto.orderType === 'SL' || dto.orderType === 'SL_M') {
      orderType = ProtoOAOrderType.STOP;
    }

    // Unique client order ID for idempotency & anti-duplicate tracking
    const shortUser = (dto.userId || 'TG').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    const clientOrderId = dto.idempotencyKey || `TG_${shortUser}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Format price according to digits
    const roundedPrice = Number(dto.price.toFixed(symbolInfo.digits));
    const roundedTrigger = dto.triggerPrice ? Number(dto.triggerPrice.toFixed(symbolInfo.digits)) : undefined;

    const newOrderReq: ProtoOANewOrderReq = {
      ctidTraderAccountId,
      symbolId: symbolInfo.symbolId,
      orderType,
      tradeSide,
      volume: mappedVolume,
      clientOrderId,
      comment: dto.reason || 'TradeGrow Sync'
    };

    if (orderType === ProtoOAOrderType.LIMIT) {
      newOrderReq.limitPrice = roundedPrice;
    } else if (orderType === ProtoOAOrderType.STOP) {
      newOrderReq.stopPrice = roundedTrigger || roundedPrice;
    }

    return {
      newOrderReq,
      clientOrderId,
      ctraderSymbolId: symbolInfo.symbolId,
      mappedVolume
    };
  }

  /**
   * Persists an order mapping in the database
   */
  public static async recordOrderMapping(params: {
    internalOrderId: string;
    ctidTraderAccountId: number;
    clientOrderId: string;
    brokerSymbol: string;
    ctraderSymbolId: number;
    mappedSide: 'BUY' | 'SELL';
    mappedVolume: number;
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    externalOrderId?: number;
    externalPositionId?: number;
  }): Promise<void> {
    await execute(
      `INSERT INTO order_mappings (
        internal_order_id,
        external_order_id,
        external_position_id,
        ctid_trader_account_id,
        client_order_id,
        broker_symbol,
        ctrader_symbol_id,
        mapped_side,
        mapped_volume,
        order_type,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SUBMITTED', NOW(), NOW())
      ON CONFLICT (client_order_id) DO UPDATE SET
        external_order_id = COALESCE(EXCLUDED.external_order_id, order_mappings.external_order_id),
        external_position_id = COALESCE(EXCLUDED.external_position_id, order_mappings.external_position_id),
        updated_at = NOW()`,
      [
        params.internalOrderId,
        params.externalOrderId || null,
        params.externalPositionId || null,
        params.ctidTraderAccountId,
        params.clientOrderId,
        params.brokerSymbol,
        params.ctraderSymbolId,
        params.mappedSide,
        params.mappedVolume,
        params.orderType
      ]
    );
  }

  /**
   * Updates an order mapping based on an incoming cTrader execution event
   */
  public static async updateExecutionMapping(event: ProtoOAExecutionEvent): Promise<{
    internalOrderId?: string;
    status: string;
    matched: boolean;
  }> {
    const clientOrderId = event.order?.tradeData?.clientOrderId;
    const externalOrderId = event.order?.orderId;
    const externalPositionId = event.position?.positionId;

    let mappedStatus = 'SUBMITTED';
    switch (event.executionType) {
      case ProtoOAExecutionType.ORDER_ACCEPTED:
        mappedStatus = 'ACCEPTED';
        break;
      case ProtoOAExecutionType.ORDER_FILLED:
        mappedStatus = 'FILLED';
        break;
      case ProtoOAExecutionType.ORDER_PARTIALLY_FILLED:
        mappedStatus = 'PARTIALLY_FILLED';
        break;
      case ProtoOAExecutionType.ORDER_CANCELLED:
        mappedStatus = 'CANCELLED';
        break;
      case ProtoOAExecutionType.ORDER_EXPIRED:
        mappedStatus = 'EXPIRED';
        break;
      case ProtoOAExecutionType.ORDER_REJECTED:
        mappedStatus = 'REJECTED';
        break;
      default:
        mappedStatus = 'ACCEPTED';
    }

    const execPrice = event.order?.executionPrice || event.position?.price || null;

    let mappingRow: any = null;
    try {
      if (clientOrderId) {
        mappingRow = await queryOne<{ id: string; internal_order_id: string }>(
          `SELECT id, internal_order_id FROM order_mappings WHERE client_order_id = $1 LIMIT 1`,
          [clientOrderId]
        );
      }

      if (!mappingRow && externalOrderId) {
        mappingRow = await queryOne<{ id: string; internal_order_id: string }>(
          `SELECT id, internal_order_id FROM order_mappings WHERE external_order_id = $1 LIMIT 1`,
          [externalOrderId]
        );
      }

      if (!mappingRow && externalPositionId) {
        mappingRow = await queryOne<{ id: string; internal_order_id: string }>(
          `SELECT id, internal_order_id FROM order_mappings WHERE external_position_id = $1 LIMIT 1`,
          [externalPositionId]
        );
      }

      if (mappingRow) {
        await execute(
          `UPDATE order_mappings SET
            external_order_id = COALESCE($1, external_order_id),
            external_position_id = COALESCE($2, external_position_id),
            status = $3,
            execution_price = COALESCE($4, execution_price),
            raw_execution_event = $5,
            rejection_reason = $6,
            updated_at = NOW()
          WHERE id = $7`,
          [
            externalOrderId || null,
            externalPositionId || null,
            mappedStatus,
            execPrice,
            JSON.stringify(event),
            event.errorCode || null,
            mappingRow.id
          ]
        );

        return {
          internalOrderId: mappingRow.internal_order_id,
          status: mappedStatus,
          matched: true
        };
      }
    } catch (dbErr: any) {
      console.warn(`[cTraderMapper] DB mapping update notice:`, dbErr.message);
    }

    return {
      status: mappedStatus,
      matched: false
    };
  }

  /**
   * Look up mapping by TradeGrow internal order ID
   */
  public static async getMappingByInternalId(internalOrderId: string): Promise<any> {
    return await queryOne(
      `SELECT * FROM order_mappings WHERE internal_order_id = $1 LIMIT 1`,
      [internalOrderId]
    );
  }
}
