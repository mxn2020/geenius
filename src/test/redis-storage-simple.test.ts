// src/test/redis-storage-simple.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Upstash Redis
vi.mock('@upstash/redis', () => {
  const mockRedis = {
    setex: vi.fn(),
    get: vi.fn(),
    keys: vi.fn(),
    del: vi.fn()
  };
  
  return {
    Redis: vi.fn(() => mockRedis)
  };
});

// Import after mocking
import { RedisStorage } from '../../api/shared/redis-storage';

describe('RedisStorage', () => {
  let storage: RedisStorage;
  let mockSession: any;
  let mockRedis: any;

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
      changes: [],
      logs: [],
      startTime: Date.now()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
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
  });

  describe('Status Updates', () => {
    it('should update session status correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockSession));
      mockRedis.setex.mockResolvedValue('OK');
      
      await storage.updateSessionStatus(mockSession.id, 'ai_processing');
      
      expect(mockRedis.get).toHaveBeenCalledWith('geenius:session:test-session-123');
      expect(mockRedis.setex).toHaveBeenCalled();
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
});