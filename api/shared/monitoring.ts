// netlify/functions/shared/monitoring.ts
interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export class MonitoringService {
  private static metrics: MetricData[] = [];

  static recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags
    });

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  static recordDuration(name: string, startTime: number, tags?: Record<string, string>): void {
    const duration = Date.now() - startTime;
    this.recordMetric(name, duration, tags);
  }

  static recordError(error: Error, context?: Record<string, any>): void {
    this.recordMetric('error_count', 1, {
      error_type: error.constructor.name,
      error_message: error.message.slice(0, 100),
      ...context
    });
  }

  static getMetrics(since?: number): MetricData[] {
    if (since) {
      return this.metrics.filter(m => m.timestamp >= since);
    }
    return this.metrics;
  }

  static getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, any>;
  } {
    const recentMetrics = this.getMetrics(Date.now() - 300000); // Last 5 minutes
    const errorCount = recentMetrics.filter(m => m.name === 'error_count').length;
    const totalRequests = recentMetrics.filter(m => m.name === 'request_count').length;
    
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.1) status = 'degraded';
    if (errorRate > 0.25) status = 'unhealthy';

    return {
      status,
      metrics: {
        errorRate,
        totalRequests,
        errorCount,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };
  }
}

