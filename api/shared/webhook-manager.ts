// netlify/functions/shared/webhook-manager.ts
interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: number;
  lastTriggered?: number;
  failureCount: number;
}

export class WebhookManager {
  private static subscriptions: Map<string, WebhookSubscription> = new Map();

  static async subscribe(url: string, events: string[], secret?: string): Promise<string> {
    const id = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: WebhookSubscription = {
      id,
      url,
      events,
      secret: secret || this.generateSecret(),
      active: true,
      createdAt: Date.now(),
      failureCount: 0
    };

    this.subscriptions.set(id, subscription);
    return id;
  }

  static async unsubscribe(id: string): Promise<boolean> {
    return this.subscriptions.delete(id);
  }

  static async trigger(event: string, payload: any): Promise<void> {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.active && sub.events.includes(event));

    const webhookPromises = relevantSubscriptions.map(subscription => 
      this.sendWebhook(subscription, event, payload)
    );

    await Promise.allSettled(webhookPromises);
  }

  private static async sendWebhook(
    subscription: WebhookSubscription, 
    event: string, 
    payload: any
  ): Promise<void> {
    try {
      const webhookPayload = {
        event,
        timestamp: Date.now(),
        data: payload,
        signature: this.generateSignature(payload, subscription.secret)
      };

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': webhookPayload.signature,
          'User-Agent': 'AI-Agent-System/1.0'
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      subscription.lastTriggered = Date.now();
      subscription.failureCount = 0;

    } catch (error) {
      subscription.failureCount++;
      
      // Disable webhook after 5 consecutive failures
      if (subscription.failureCount >= 5) {
        subscription.active = false;
      }

      console.error(`Webhook delivery failed for ${subscription.url}:`, error);
    }
  }

  private static generateSignature(payload: any, secret: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private static generateSecret(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  static getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  static getSubscription(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id);
  }
}

