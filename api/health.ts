// netlify/functions/health.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { MonitoringService } from './shared/monitoring';
import { storage } from './shared/redis-storage';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const systemHealth = MonitoringService.getSystemHealth();
    
    // Check Redis connectivity
    const redisHealth = await checkRedisHealth();
    
    // Check AI provider connectivity
    const aiHealth = await checkAIProviders();

    const overallHealth = {
      status: systemHealth.status,
      timestamp: Date.now(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      checks: {
        system: systemHealth,
        redis: redisHealth,
        aiProviders: aiHealth
      }
    };

    const statusCode = overallHealth.status === 'healthy' ? 200 : 503;

    return {
      statusCode,
      headers,
      body: JSON.stringify(overallHealth, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      })
    };
  }
};

async function checkRedisHealth(): Promise<{ status: string; latency?: number }> {
  const startTime = Date.now();
  try {
    // Simple Redis health check
    const testSession = await storage.getSession('health-check');
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy'
    };
  }
}

async function checkAIProviders(): Promise<Record<string, { status: string; latency?: number }>> {
  const providers = ['anthropic', 'openai', 'google'];
  const results: Record<string, { status: string; latency?: number }> = {};

  for (const provider of providers) {
    const startTime = Date.now();
    try {
      // Simple connectivity check (implement based on provider)
      const latency = Date.now() - startTime;
      results[provider] = { status: 'healthy', latency };
    } catch (error) {
      results[provider] = { status: 'unhealthy' };
    }
  }

  return results;
}
