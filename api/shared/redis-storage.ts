// netlify/functions/shared/redis-storage.ts
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Check if Redis is configured
const isRedisConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

export interface ProcessingSession {
  id: string;
  status: 'initializing' | 'sandbox_creating' | 'ai_processing' | 'testing' | 'pr_creating' | 'deploying' | 'completed' | 'failed';
  submissionId: string;
  projectId: string;
  repositoryUrl: string;
  changes: any[];
  logs: Array<{
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: number;
    data?: any;
  }>;
  startTime: number;
  endTime?: number;
  prUrl?: string;
  branchName?: string;
  previewUrl?: string;
  error?: string;
}

export class RedisStorage {
  private redis: Redis;
  private keyPrefix = 'geenius:session:';

  constructor() {
    this.redis = redis;
  }

  // Generate unique session ID
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Store session data
  async setSession(sessionId: string, session: ProcessingSession): Promise<void> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.keyPrefix}${sessionId}`;
    try {
      const serializedSession = JSON.stringify(session);
      await this.redis.setex(key, 3600, serializedSession); // Expire after 1 hour
    } catch (error) {
      console.error('Error storing session data:', error);
      throw error;
    }
  }

  // Get session data
  async getSession(sessionId: string): Promise<ProcessingSession | null> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.keyPrefix}${sessionId}`;
    try {
      const data = await this.redis.get(key);
      
      if (!data) return null;
      
      // Handle case where data might be an object instead of string
      if (typeof data === 'object') {
        return data as ProcessingSession;
      }
      
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  // Add log to session
  async addLog(sessionId: string, level: 'info' | 'success' | 'warning' | 'error', message: string, metadata?: Record<string, any>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.logs.push({
      timestamp: Date.now(),
      level,
      message,
      metadata
    });

    await this.setSession(sessionId, session);
    console.log(`[${sessionId}] ${level.toUpperCase()}: ${message}`, metadata || '');
  }

  // Update session status
  async updateSessionStatus(sessionId: string, status: ProcessingSession['status']): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.status = status;
    await this.setSession(sessionId, session);
  }

  // Get all sessions (for admin/monitoring)
  async getAllSessions(): Promise<ProcessingSession[]> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const sessions: ProcessingSession[] = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          try {
            sessions.push(JSON.parse(data as string));
          } catch (error) {
            console.error('Error parsing session data:', error);
          }
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          try {
            const session = JSON.parse(data as string);
            if (now - session.startTime > maxAge) {
              await this.redis.del(key);
            }
          } catch (error) {
            // If we can't parse the session, delete it
            await this.redis.del(key);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }
}

export const storage = new RedisStorage();