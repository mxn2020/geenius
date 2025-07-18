// netlify/functions/shared/analytics.ts
export class AnalyticsService {
  static async trackEvent(event: string, properties: Record<string, any>): Promise<void> {
    try {
      const analyticsData = {
        event,
        properties: {
          ...properties,
          timestamp: Date.now(),
          environment: process.env.NODE_ENV,
          version: process.env.npm_package_version
        }
      };

      // In production, send to your analytics service
      console.log('Analytics:', analyticsData);

      // Store locally for dashboard
      MonitoringService.recordMetric('analytics_event', 1, {
        event_type: event,
        ...properties
      });
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  static async trackSession(sessionId: string, event: 'started' | 'completed' | 'failed', data?: any): Promise<void> {
    await this.trackEvent('session_event', {
      sessionId,
      event,
      ...data
    });
  }

  static async trackPerformance(operation: string, duration: number, success: boolean): Promise<void> {
    await this.trackEvent('performance_metric', {
      operation,
      duration,
      success
    });
  }

  static async generateReport(timeframe: '1h' | '24h' | '7d' | '30d'): Promise<any> {
    const metrics = MonitoringService.getMetrics();
    
    // Process metrics into report format
    return {
      timeframe,
      summary: {
        totalSessions: metrics.filter(m => m.name === 'session_started').length,
        successRate: this.calculateSuccessRate(metrics),
        averageDuration: this.calculateAverageDuration(metrics),
        topErrors: this.getTopErrors(metrics)
      },
      charts: {
        sessionTrend: this.generateSessionTrend(metrics),
        providerUsage: this.generateProviderUsage(metrics),
        errorDistribution: this.generateErrorDistribution(metrics)
      }
    };
  }

  private static calculateSuccessRate(metrics: any[]): number {
    const total = metrics.filter(m => m.name === 'session_completed').length;
    const successful = metrics.filter(m => m.name === 'session_completed' && m.tags?.success === 'true').length;
    return total > 0 ? successful / total : 0;
  }

  private static calculateAverageDuration(metrics: any[]): number {
    const durations = metrics.filter(m => m.name === 'session_duration').map(m => m.value);
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  }

  private static getTopErrors(metrics: any[]): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>();
    
    metrics.filter(m => m.name === 'error_count').forEach(m => {
      const error = m.tags?.error_message || 'Unknown';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private static generateSessionTrend(metrics: any[]): Array<{ time: number; count: number }> {
    // Group sessions by hour
    const hourlyData = new Map<number, number>();
    
    metrics.filter(m => m.name === 'session_started').forEach(m => {
      const hour = Math.floor(m.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
    });

    return Array.from(hourlyData.entries())
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => a.time - b.time);
  }

  private static generateProviderUsage(metrics: any[]): Array<{ provider: string; usage: number }> {
    const providerCounts = new Map<string, number>();
    
    metrics.filter(m => m.tags?.provider).forEach(m => {
      const provider = m.tags.provider;
      providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    });

    return Array.from(providerCounts.entries())
      .map(([provider, usage]) => ({ provider, usage }));
  }

  private static generateErrorDistribution(metrics: any[]): Array<{ category: string; count: number }> {
    const categoryCounts = new Map<string, number>();
    
    metrics.filter(m => m.name === 'error_count').forEach(m => {
      const category = m.tags?.error_type || 'Unknown';
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    return Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }));
  }
}

