/**
 * Spotware cTrader Open API Gateway
 * Manages WebSocket connection, application/account authorization, order transmission,
 * heartbeat management, and real-time execution event streaming.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  ProtoPayloadType,
  ProtoMessage,
  ProtoOAApplicationAuthReq,
  ProtoOAAccountAuthReq,
  ProtoOANewOrderReq,
  ProtoOACancelOrderReq,
  ProtoOAClosePositionReq,
  ProtoOAExecutionEvent,
  CTraderConfig
} from './cTraderTypes';
import { CTraderOrderMapper } from './cTraderOrderMapper';
import { query, execute } from '../../../db/schema';
import { redis } from '../../../db/redis';

export class CTraderGateway extends EventEmitter {
  private static instance: CTraderGateway | null = null;

  private ws: WebSocket | null = null;
  private config: CTraderConfig;
  private isConnected = false;
  private isAppAuthorized = false;
  private authorizedAccounts = new Set<number>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();

  private constructor() {
    super();
    const env = (process.env.CTRADER_ENV || 'demo').toLowerCase() as 'demo' | 'live';
    const isLive = env === 'live';

    this.config = {
      clientId: process.env.CTRADER_CLIENT_ID || 'mock_ctrader_client_id',
      clientSecret: process.env.CTRADER_CLIENT_SECRET || 'mock_ctrader_client_secret',
      redirectUri: process.env.CTRADER_REDIRECT_URI || 'https://tradegrowx.in/api/v1/integrations/ctrader/oauth/callback',
      environment: env,
      wsHost: isLive ? 'live.ctraderapi.com' : 'demo.ctraderapi.com',
      wsPort: 5036,
      authUrl: 'https://openapi.ctrader.com/apps/auth',
      tokenUrl: 'https://openapi.ctrader.com/apps/token'
    };
  }

  public static getInstance(): CTraderGateway {
    if (!CTraderGateway.instance) {
      CTraderGateway.instance = new CTraderGateway();
    }
    return CTraderGateway.instance;
  }

  public getConfig(): CTraderConfig {
    return this.config;
  }

  public getStatus(): { isConnected: boolean; isAppAuthorized: boolean; authorizedAccounts: number[]; environment: string } {
    return {
      isConnected: this.isConnected,
      isAppAuthorized: this.isAppAuthorized,
      authorizedAccounts: Array.from(this.authorizedAccounts),
      environment: this.config.environment
    };
  }

  /**
   * Initializes WebSocket connection to cTrader Open API
   */
  public async initialize(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const endpoint = `wss://${this.config.wsHost}:${this.config.wsPort}`;
    console.log(`[cTraderGateway] Connecting to Spotware Open API: ${endpoint}`);

    try {
      this.ws = new WebSocket(endpoint, {
        handshakeTimeout: 10000
      });

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
      this.ws.on('error', (err: Error) => this.handleError(err));
      this.ws.on('close', (code: number, reason: string) => this.handleClose(code, reason));
    } catch (err: any) {
      console.error(`[cTraderGateway] Failed to instantiate WebSocket:`, err.message);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    console.log(`[cTraderGateway] ✅ WebSocket Connected to cTrader Open API (${this.config.environment})`);
    this.isConnected = true;
    this.startHeartbeat();

    // Authenticate application
    this.authenticateApplication().catch(err => {
      console.warn(`[cTraderGateway] Application authentication error:`, err.message);
    });
  }

  private async authenticateApplication(): Promise<void> {
    const payload: ProtoOAApplicationAuthReq = {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret
    };

    console.log(`[cTraderGateway] Sending Application Auth for clientId: ${this.config.clientId.slice(0, 8)}...`);
    const res = await this.sendRequest(ProtoPayloadType.PROTO_OA_APPLICATION_AUTH_REQ, payload);
    this.isAppAuthorized = true;
    console.log(`[cTraderGateway] ✅ Application Authenticated Successfully with Spotware.`);
    this.emit('app_authorized', res);

    // Re-authorize known active accounts from DB
    await this.restoreActiveAccounts();
  }

  /**
   * Restores active accounts from the database and sends ProtoOAAccountAuthReq
   */
  private async restoreActiveAccounts(): Promise<void> {
    try {
      const accounts = await query<{ ctid_trader_account_id: string; access_token: string }>(
        `SELECT ctid_trader_account_id, access_token 
         FROM ctrader_accounts 
         WHERE account_status = 'ACTIVE' 
         AND token_expires_at > NOW()`
      );

      for (const acc of accounts) {
        const ctid = parseInt(acc.ctid_trader_account_id, 10);
        if (ctid && acc.access_token) {
          await this.authorizeAccount(ctid, acc.access_token).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn(`[cTraderGateway] Could not restore accounts from DB:`, err.message);
    }
  }

  /**
   * Authorizes an individual trader account using their OAuth access token
   */
  public async authorizeAccount(ctidTraderAccountId: number, accessToken: string): Promise<boolean> {
    if (!this.isConnected || !this.isAppAuthorized) {
      throw new Error('cTrader Gateway is not connected or app is not authorized yet');
    }

    const payload: ProtoOAAccountAuthReq = {
      ctidTraderAccountId,
      accessToken
    };

    try {
      await this.sendRequest(ProtoPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ, payload);
      this.authorizedAccounts.add(ctidTraderAccountId);
      console.log(`[cTraderGateway] ✅ Account ${ctidTraderAccountId} authorized.`);
      return true;
    } catch (err: any) {
      console.error(`[cTraderGateway] Failed to authorize account ${ctidTraderAccountId}:`, err.message);
      throw err;
    }
  }

  /**
   * Submits a new order to cTrader
   */
  public async submitOrder(req: ProtoOANewOrderReq): Promise<any> {
    if (!this.authorizedAccounts.has(req.ctidTraderAccountId)) {
      // Attempt auto-auth from DB if not currently authorized
      const account = await query<{ access_token: string }>(
        `SELECT access_token FROM ctrader_accounts WHERE ctid_trader_account_id = $1 LIMIT 1`,
        [req.ctidTraderAccountId]
      );
      if (account.length > 0 && account[0].access_token) {
        await this.authorizeAccount(req.ctidTraderAccountId, account[0].access_token);
      } else {
        throw new Error(`cTrader Account ${req.ctidTraderAccountId} is not authorized`);
      }
    }

    return await this.sendRequest(ProtoPayloadType.PROTO_OA_NEW_ORDER_REQ, req);
  }

  /**
   * Cancels a pending order in cTrader
   */
  public async cancelOrder(ctidTraderAccountId: number, orderId: number): Promise<any> {
    const payload: ProtoOACancelOrderReq = {
      ctidTraderAccountId,
      orderId
    };
    return await this.sendRequest(ProtoPayloadType.PROTO_OA_CANCEL_ORDER_REQ, payload);
  }

  /**
   * Closes an existing position in cTrader
   */
  public async closePosition(ctidTraderAccountId: number, positionId: number, volume: number): Promise<any> {
    const payload: ProtoOAClosePositionReq = {
      ctidTraderAccountId,
      positionId,
      volume
    };
    return await this.sendRequest(ProtoPayloadType.PROTO_OA_CLOSE_POSITION_REQ, payload);
  }

  /**
   * Core request/response dispatcher with clientMsgId correlation
   */
  public sendRequest<T = any>(payloadType: ProtoPayloadType, payload: any, timeoutMs = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('cTrader WebSocket is not connected'));
      }

      const clientMsgId = `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(clientMsgId);
        reject(new Error(`cTrader request timed out after ${timeoutMs}ms (type=${payloadType})`));
      }, timeoutMs);

      this.pendingRequests.set(clientMsgId, { resolve, reject, timeout });

      const message: ProtoMessage = {
        payloadType,
        payload,
        clientMsgId
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err: any) {
        clearTimeout(timeout);
        this.pendingRequests.delete(clientMsgId);
        reject(err);
      }
    });
  }

  private handleMessage(raw: WebSocket.Data): void {
    try {
      const msgStr = typeof raw === 'string' ? raw : raw.toString('utf8');
      const message: ProtoMessage = JSON.parse(msgStr);

      // Handle heartbeat response
      if (message.payloadType === ProtoPayloadType.HEARTBEAT_EVENT) {
        return;
      }

      // Correlate with pending request
      if (message.clientMsgId && this.pendingRequests.has(message.clientMsgId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(message.clientMsgId)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(message.clientMsgId);

        if (message.payloadType === ProtoPayloadType.ERROR_RES || message.payloadType === ProtoPayloadType.PROTO_OA_ORDER_ERROR_EVENT) {
          return reject(new Error(message.payload?.description || message.payload?.errorCode || 'cTrader Error'));
        }
        return resolve(message.payload);
      }

      // Handle Push Execution Event from cTrader
      if (message.payloadType === ProtoPayloadType.PROTO_OA_EXECUTION_EVENT) {
        this.processExecutionEvent(message.payload as ProtoOAExecutionEvent);
      }
    } catch (err: any) {
      console.error(`[cTraderGateway] Error parsing incoming message:`, err.message);
    }
  }

  /**
   * Process execution events from cTrader app/server (fills, cancels, rejections)
   */
  private async processExecutionEvent(event: ProtoOAExecutionEvent): Promise<void> {
    try {
      console.log(`[cTraderGateway] ⚡ Execution Event received: type=${event.executionType}, account=${event.ctidTraderAccountId}`);

      // 1. Update mapping table
      const updateRes = await CTraderOrderMapper.updateExecutionMapping(event);

      // 2. Broadcast via Redis for real-time portfolio & terminal sync
      await redis.publish(
        'stream:trading',
        JSON.stringify({
          event: 'ctrader.execution',
          account: String(event.ctidTraderAccountId),
          internalOrderId: updateRes.internalOrderId || '',
          status: updateRes.status,
          payload: event
        })
      ).catch(() => {});

      // 3. Emit local event for connected subscribers
      this.emit('execution', { event, updateRes });
    } catch (err: any) {
      console.error(`[cTraderGateway] Failed to process execution event:`, err.message);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const ping: ProtoMessage = {
          payloadType: ProtoPayloadType.HEARTBEAT_EVENT,
          payload: {}
        };
        try {
          this.ws.send(JSON.stringify(ping));
        } catch (_) {}
      }
    }, 15000);
  }

  private handleError(err: Error): void {
    console.error(`[cTraderGateway] WebSocket error:`, err.message);
  }

  private handleClose(code: number, reason: string): void {
    console.warn(`[cTraderGateway] WebSocket closed (code=${code}, reason=${reason})`);
    this.isConnected = false;
    this.isAppAuthorized = false;
    this.authorizedAccounts.clear();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initialize().catch(() => {});
    }, 5000);
  }

  public shutdown(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isAppAuthorized = false;
  }
}
