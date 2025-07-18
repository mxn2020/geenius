// netlify/functions/shared/rate-limiter.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  provider: string;
}

export class RateLimiter {
  private static limits: Map<string, { count: number; resetTime: number }> = new Map();

  static async checkLimit(key: string, config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const limitKey = `${config.provider}:${key}`;
    
    let limitData = this.limits.get(limitKey);
    
    if (!limitData || now > limitData.resetTime) {
      limitData = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    if (limitData.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: limitData.resetTime
      };
    }

    limitData.count++;
    this.limits.set(limitKey, limitData);

    return {
      allowed: true,
      remaining: config.maxRequests - limitData.count,
      resetTime: limitData.resetTime
    };
  }

  static getProviderLimits(): Record<string, RateLimitConfig> {
    return {
      anthropic: { windowMs: 60000, maxRequests: 50, provider: 'anthropic' },
      openai: { windowMs: 60000, maxRequests: 60, provider: 'openai' },
      google: { windowMs: 60000, maxRequests: 40, provider: 'google' },
      grok: { windowMs: 60000, maxRequests: 30, provider: 'grok' }
    };
  }
}

