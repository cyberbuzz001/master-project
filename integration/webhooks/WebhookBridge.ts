import crypto from 'crypto';

export interface WebhookDeliveryOptions {
  url: string;
  secret: string;
  event: string;
  payload: any;
  retries?: number;
  timeoutMs?: number;
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
   * Generates HMAC-SHA256 signature for webhook payload
   */
  public generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verifies an incoming webhook HMAC-SHA256 signature
   */
  public verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Delivers a webhook event with retry logic
   */
  public async deliverEvent(options: WebhookDeliveryOptions): Promise<{ success: boolean; status?: number; error?: string }> {
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
            'X-Attempt': String(attempt)
          },
          body: payloadString,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          return { success: true, status: response.status };
        }

        // Wait with backoff before next attempt
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      } catch (err: any) {
        if (attempt === maxRetries) {
          return { success: false, error: err.message };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }

    return { success: false, error: 'Max retries exhausted' };
  }
}
