// netlify/functions/shared/performance-optimizer.ts
export class PerformanceOptimizer {
  private static cache: Map<string, { data: any; expiry: number }> = new Map();
  private static connectionPools: Map<string, any> = new Map();

  static async getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });

    return data;
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static async batchRequests<T>(
    requests: Array<() => Promise<T>>,
    maxConcurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const batch = requests.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map(req => req()));
      results.push(...batchResults);
    }

    return results;
  }

  static optimizeAIPrompt(prompt: string): string {
    // Remove redundant whitespace
    prompt = prompt.replace(/\s+/g, ' ').trim();
    
    // Truncate if too long (adjust based on model limits)
    const maxLength = 4000;
    if (prompt.length > maxLength) {
      prompt = prompt.substring(0, maxLength - 100) + '...[truncated]';
    }

    return prompt;
  }

  static async warmupConnections(): Promise<void> {
    // Pre-establish connections to frequently used services
    const services = ['github', 'anthropic', 'openai', 'stackblitz'];
    
    for (const service of services) {
      try {
        // Perform lightweight health check requests
        await this.healthCheck(service);
      } catch (error) {
        console.warn(`Failed to warm up ${service}:`, error.message);
      }
    }
  }

  private static async healthCheck(service: string): Promise<void> {
    switch (service) {
      case 'github':
        // GitHub API health check
        break;
      case 'anthropic':
        // Anthropic API health check
        break;
      // Add other service health checks
    }
  }
}

