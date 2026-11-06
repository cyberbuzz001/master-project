/**
 * Spotware cTrader Open API v2 Protocol Types & Constants
 * Reference: https://help.ctrader.com/open-api/
 */

export enum ProtoPayloadType {
  PROTO_MESSAGE = 5,
  ERROR_RES = 50,
  HEARTBEAT_EVENT = 51,
  PROTO_OA_APPLICATION_AUTH_REQ = 2100,
  PROTO_OA_APPLICATION_AUTH_RES = 2101,
  PROTO_OA_ACCOUNT_AUTH_REQ = 2102,
  PROTO_OA_ACCOUNT_AUTH_RES = 2103,
  PROTO_OA_VERSION_REQ = 2104,
  PROTO_OA_VERSION_RES = 2105,
  PROTO_OA_NEW_ORDER_REQ = 2106,
  PROTO_OA_CANCEL_ORDER_REQ = 2108,
  PROTO_OA_CLOSE_POSITION_REQ = 2110,
  PROTO_OA_SYMBOLS_LIST_REQ = 2114,
  PROTO_OA_SYMBOLS_LIST_RES = 2115,
  PROTO_OA_TRADER_REQ = 2121,
  PROTO_OA_TRADER_RES = 2122,
  PROTO_OA_RECONCILE_REQ = 2124,
  PROTO_OA_RECONCILE_RES = 2125,
  PROTO_OA_EXECUTION_EVENT = 2126,
  PROTO_OA_ORDER_ERROR_EVENT = 2132,
  PROTO_OA_ACCOUNTS_TOKEN_INVALID_EVENT = 2148,
  PROTO_OA_GET_ACCOUNTS_BY_TOKEN_REQ = 2149,
  PROTO_OA_GET_ACCOUNTS_BY_TOKEN_RES = 2150
}

export enum ProtoOATradeSide {
  BUY = 1,
  SELL = 2
}

export enum ProtoOAOrderType {
  MARKET = 1,
  LIMIT = 2,
  STOP = 3,
  STOP_LIMIT = 4,
  MARKET_RANGE = 5,
  STOP_LOSS_TAKE_PROFIT = 6
}

export enum ProtoOAExecutionType {
  ORDER_ACCEPTED = 1,
  ORDER_FILLED = 2,
  ORDER_CANCELLED = 3,
  ORDER_EXPIRED = 4,
  ORDER_AMENDED = 5,
  ORDER_REJECTED = 6,
  SWAP = 7,
  DEPOSIT_WITHDRAW = 8,
  ORDER_PARTIALLY_FILLED = 9
}

export enum ProtoOAOrderStatus {
  ORDER_STATUS_ACCEPTED = 1,
  ORDER_STATUS_FILLED = 2,
  ORDER_STATUS_REJECTED = 3,
  ORDER_STATUS_EXPIRED = 4,
  ORDER_STATUS_CANCELLED = 5
}

export interface ProtoMessage<T = any> {
  payloadType: ProtoPayloadType;
  payload: T;
  clientMsgId?: string;
}

export interface ProtoOAApplicationAuthReq {
  clientId: string;
  clientSecret: string;
}

export interface ProtoOAAccountAuthReq {
  ctidTraderAccountId: number;
  accessToken: string;
}

export interface ProtoOAAccountAuthRes {
  ctidTraderAccountId: number;
}

export interface ProtoOAGetAccountListByAccessTokenReq {
  accessToken: string;
}

export interface ProtoOACtidTraderAccount {
  ctidTraderAccountId: number;
  isLive: boolean;
  traderLogin?: number;
  lastClosingPnL?: number;
  registrationTimestamp?: number;
}

export interface ProtoOAGetAccountListByAccessTokenRes {
  accessToken: string;
  ctidTraderAccount: ProtoOACtidTraderAccount[];
}

export interface ProtoOANewOrderReq {
  ctidTraderAccountId: number;
  symbolId: number;
  orderType: ProtoOAOrderType;
  tradeSide: ProtoOATradeSide;
  volume: number; // Volume in cents (e.g. 1000 = 10 units)
  limitPrice?: number;
  stopPrice?: number;
  timeInForce?: number;
  expirationTimestamp?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  baseSlippagePrice?: number;
  slippageInPoints?: number;
  clientOrderId?: string;
}

export interface ProtoOACancelOrderReq {
  ctidTraderAccountId: number;
  orderId: number;
}

export interface ProtoOAClosePositionReq {
  ctidTraderAccountId: number;
  positionId: number;
  volume: number;
}

export interface ProtoOAOrder {
  orderId: number;
  tradeData: {
    symbolId: number;
    volume: number;
    tradeSide: ProtoOATradeSide;
    openTimestamp?: number;
    closeTimestamp?: number;
    comment?: string;
    clientOrderId?: string;
  };
  orderType: ProtoOAOrderType;
  orderStatus: ProtoOAOrderStatus;
  executionPrice?: number;
  executedVolume?: number;
  utcLastUpdateTimestamp?: number;
  baseSlippagePrice?: number;
  slippageInPoints?: number;
  closingOrder?: boolean;
}

export interface ProtoOAPosition {
  positionId: number;
  tradeData: {
    symbolId: number;
    volume: number;
    tradeSide: ProtoOATradeSide;
    openTimestamp?: number;
    comment?: string;
  };
  positionStatus: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  utcLastUpdateTimestamp?: number;
  commission?: number;
  marginRate?: number;
  swap?: number;
  currentPrice?: number;
}

export interface ProtoOAExecutionEvent {
  ctidTraderAccountId: number;
  executionType: ProtoOAExecutionType;
  order?: ProtoOAOrder;
  position?: ProtoOAPosition;
  errorCode?: string;
}

export interface CTraderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'demo' | 'live';
  wsHost: string;
  wsPort: number;
  authUrl: string;
  tokenUrl: string;
}

