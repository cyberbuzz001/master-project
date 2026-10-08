import crypto from 'crypto';

export interface WebhookDeliveryOptions {
  url: string;
  secret: string;
  event: string;
  payload: any;
  retries?: number;
  timeoutMs?: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  status?: number;
  error?: string;
  attemptsMade?: number;
}

export class WebhookBridge {
  private static instance: WebhookBridge;

  public static getInstance(): WebhookBridge {
    if (!WebhookBridge.instance) {
      WebhookBridge.instance = new WebhookBridge();
    }
    return WebhookBridge.instance;
  }

  /**
   * Generates HMAC-SHA256 hex digest for webhook payload
   */
  public generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Constant-time verification of an incoming webhook HMAC-SHA256 signature
   */
  public verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expected = this.generateSignature(payload, secret);
      const signatureBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expected);
      if (signatureBuf.length !== expectedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(signatureBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Delivers a webhook event with exponential backoff retry logic
   */
  public async deliverEvent(options: WebhookDeliveryOptions): Promise<WebhookDeliveryResult> {
    const payloadString = JSON.stringify(options.payload);
    const signature = this.generateSignature(payloadString, options.secret);
    const maxRetries = options.retries || 3;
    const timeoutMs = options.timeoutMs || 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(options.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-TradeGrow-Signature': signature,
            'X-TradeGrow-Event': options.event,
            'X-Attempt': String(attempt),
            'User-Agent': 'TradeGrow-WebhookBridge/2.0'
          },
          body: payloadString,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          return { success: true, status: response.status, attemptsMade: attempt };
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 400));
        }
      } catch (err: any) {
        if (attempt === maxRetries) {
          return { success: false, error: err.message, attemptsMade: attempt };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 400));
      }
    }

    return { success: false, error: 'Max retries exhausted', attemptsMade: maxRetries };
  }
}
