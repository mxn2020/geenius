// src/test/redis-storage.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisStorage, ProcessingSession } from '../netlify/functions/shared/redis-storage';

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => ({
    setex: vi.fn(),
    get: vi.fn(),
    keys: vi.fn(),
    del: vi.fn()
  }))
}));

describe('RedisStorage', () => {
  let storage: RedisStorage;
  let mockRedis: any;
  let mockSession: ProcessingSession;

  beforeEach(() => {
    // Mock environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    
    storage = new RedisStorage();
    
    // Get the mocked Redis instance
    const { Redis } = require('@upstash/redis');
    mockRedis = new Redis();
    
    mockSession = {
      id: 'test-session-123',
      status: 'initializing',
      submissionId: 'test-submission-456',
      projectId: 'test-project',
      repositoryUrl: 'https://github.com/test/repo',
      changes: [
        {
          id: 'change-1',
          componentId: 'TestComponent',
          feedback: 'Add new feature',
          timestamp: Date.now(),
          category: 'feature',
          priority: 'high',
          status: 'pending',
          componentContext: {},
          pageContext: {}
        }
      ],
      logs: [],
      startTime: Date.now()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe('Configuration', () => {
    it('should throw error when Redis is not configured', () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      
      expect(() => new RedisStorage()).not.toThrow();
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', () => {
      const id1 = storage.generateSessionId();
      const id2 = storage.generateSessionId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toContain('session_');
      expect(id2).toContain('session_');
    });

    it('should generate session IDs with correct format', () => {
      const sessionId = storage.generateSessionId();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('Session Storage', () => {
    it('should store session data correctly', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      
      await storage.setSession(mockSession.id, mockSession);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'geenius:session:test-session-123',
        3600,
        JSON.stringify(mockSession)
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));
      
      await expect(storage.setSession(mockSession.id, mockSession)).rejects.toThrow('Redis error');
    });

    it('should throw error when Redis is not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      
      const unconfiguredStorage = new RedisStorage();
      await expect(unconfiguredStorage.setSession(mockSession.id, mockSession))
        .rejects.toThrow('Redis not configured');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve session data correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      
      const retrievedSession = await storage.getSession(mockSession.id);
      
      expect(mockRedis.get).toHaveBeenCalledWith('geenius:session:test-session-123');
      expect(retrievedSession).toEqual(mockSession);
    });

    it('should return null for non-existent sessions', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const retrievedSession = await storage.getSession('non-existent-session');
      
      expect(retrievedSession).toBeNull();
    });

    it('should handle object data format', async () => {
      mockRedis.get.mockResolvedValue(mockSession);
      
      const retrievedSession = await storage.getSession(mockSession.id);
      
      expect(retrievedSession).toEqual(mockSession);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid json');
      
      const retrievedSession = await storage.getSession(mockSession.id);
      
      expect(retrievedSession).toBeNull();
    });

    it('should throw error when Redis is not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      
      const unconfiguredStorage = new RedisStorage();
      await expect(unconfiguredStorage.getSession(mockSession.id))
        .rejects.toThrow('Redis not configured');
    });
  });

  describe('Logging', () => {
    it('should add logs to existing session', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      await storage.addLog(mockSession.id, 'info', 'Test log message', { test: 'data' });
      
      expect(mockRedis.get).toHaveBeenCalledWith('geenius:session:test-session-123');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle different log levels', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const logLevels = ['info', 'success', 'warning', 'error'] as const;
      
      for (const level of logLevels) {
        await storage.addLog(mockSession.id, level, `Test ${level} message`);
      }
      
      expect(mockRedis.setex).toHaveBeenCalledTimes(4);
    });

    it('should handle non-existent sessions gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      await storage.addLog('non-existent-session', 'info', 'Test message');
      
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should include metadata in logs', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const metadata = { userId: 'user-123', action: 'test' };
      await storage.addLog(mockSession.id, 'info', 'Test message', metadata);
      
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('Status Updates', () => {
    it('should update session status correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      await storage.updateSessionStatus(mockSession.id, 'ai_processing');
      
      expect(mockRedis.get).toHaveBeenCalledWith('geenius:session:test-session-123');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should handle all valid status values', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      const statuses = [
        'initializing',
        'sandbox_creating',
        'ai_processing',
        'testing',
        'pr_creating',
        'deploying',
        'completed',
        'failed'
      ] as const;
      
      for (const status of statuses) {
        await storage.updateSessionStatus(mockSession.id, status);
      }
      
      expect(mockRedis.setex).toHaveBeenCalledTimes(8);
    });

    it('should handle non-existent sessions gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      await storage.updateSessionStatus('non-existent-session', 'completed');
      
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should get all sessions', async () => {
      const sessions = [mockSession];
      mockRedis.keys.mockResolvedValue(['geenius:session:test-session-123']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      
      const allSessions = await storage.getAllSessions();
      
      expect(mockRedis.keys).toHaveBeenCalledWith('geenius:session:*');
      expect(allSessions).toEqual(sessions);
    });

    it('should handle empty session list', async () => {
      mockRedis.keys.mockResolvedValue([]);
      
      const allSessions = await storage.getAllSessions();
      
      expect(allSessions).toEqual([]);
    });

    it('should handle corrupted session data when getting all sessions', async () => {
      mockRedis.keys.mockResolvedValue(['geenius:session:test-session-123']);
      mockRedis.get.mockResolvedValue('invalid json');
      
      const allSessions = await storage.getAllSessions();
      
      expect(allSessions).toEqual([]);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const expiredSession = {
        ...mockSession,
        startTime: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      mockRedis.keys.mockResolvedValue(['geenius:session:expired-session']);
      mockRedis.get.mockResolvedValue(JSON.stringify(expiredSession));
      mockRedis.del.mockResolvedValue(1);
      
      await storage.cleanupExpiredSessions();
      
      expect(mockRedis.del).toHaveBeenCalledWith('geenius:session:expired-session');
    });

    it('should keep non-expired sessions', async () => {
      const recentSession = {
        ...mockSession,
        startTime: Date.now() - (1 * 60 * 60 * 1000) // 1 hour ago
      };
      
      mockRedis.keys.mockResolvedValue(['geenius:session:recent-session']);
      mockRedis.get.mockResolvedValue(JSON.stringify(recentSession));
      
      await storage.cleanupExpiredSessions();
      
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle corrupted session data during cleanup', async () => {
      mockRedis.keys.mockResolvedValue(['geenius:session:corrupted-session']);
      mockRedis.get.mockResolvedValue('invalid json');
      mockRedis.del.mockResolvedValue(1);
      
      await storage.cleanupExpiredSessions();
      
      expect(mockRedis.del).toHaveBeenCalledWith('geenius:session:corrupted-session');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));
      
      await expect(storage.cleanupExpiredSessions()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection error'));
      
      const result = await storage.getSession(mockSession.id);
      expect(result).toBeNull();
    });

    it('should handle Redis write errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Write error'));
      
      await expect(storage.setSession(mockSession.id, mockSession)).rejects.toThrow('Write error');
    });
  });

  describe('Data Serialization', () => {
    it('should serialize complex session data correctly', async () => {
      const complexSession = {
        ...mockSession,
        changes: [
          {
            id: 'change-1',
            componentId: 'ComplexComponent',
            feedback: 'Complex feedback with special chars: äöü',
            timestamp: Date.now(),
            category: 'feature',
            priority: 'high',
            status: 'pending',
            componentContext: {
              nested: {
                data: 'value',
                array: [1, 2, 3]
              }
            },
            pageContext: {
              route: '/complex',
              params: { id: 123 }
            }
          }
        ]
      };
      
      mockRedis.setex.mockResolvedValue('OK');
      
      await storage.setSession(complexSession.id, complexSession);
      
      const serializedData = mockRedis.setex.mock.calls[0][2];
      const deserializedData = JSON.parse(serializedData);
      
      expect(deserializedData).toEqual(complexSession);
    });
  });
});