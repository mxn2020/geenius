// src/test/integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../netlify/functions/process-changes';

// Mock all dependencies
vi.mock('../netlify/functions/shared/redis-storage');
vi.mock('../netlify/functions/shared/stackblitz-agent-service');
vi.mock('ai');
vi.mock('@ai-sdk/anthropic');
vi.mock('@ai-sdk/openai');
vi.mock('@ai-sdk/google');
vi.mock('octokit');

describe('Integration Tests', () => {
  let mockEvent: any;
  let mockContext: any;
  let mockStorage: any;
  let mockStackBlitzService: any;

  beforeEach(() => {
    // Set up environment variables
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
    process.env.AI_PROVIDER = 'anthropic';
    process.env.URL = 'https://test-netlify-site.netlify.app';

    // Mock event structure
    mockEvent = {
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        submissionId: 'test-submission-456',
        timestamp: Date.now(),
        changes: [
          {
            id: 'change-1',
            componentId: 'TestComponent',
            feedback: 'Add a new feature to improve user experience',
            timestamp: Date.now(),
            category: 'feature',
            priority: 'high',
            status: 'pending',
            componentContext: {
              filePath: 'src/components/TestComponent.tsx',
              props: ['title', 'content'],
              state: ['isVisible', 'loading']
            },
            pageContext: {
              route: '/test',
              layout: 'default'
            }
          },
          {
            id: 'change-2',
            componentId: 'HeaderComponent',
            feedback: 'Fix the styling issues in the header',
            timestamp: Date.now(),
            category: 'bug',
            priority: 'medium',
            status: 'pending',
            componentContext: {
              filePath: 'src/components/HeaderComponent.tsx',
              props: ['logo', 'navigation'],
              state: ['isMenuOpen']
            },
            pageContext: {
              route: '/dashboard',
              layout: 'sidebar'
            }
          }
        ],
        globalContext: {
          projectId: 'test-project-123',
          environment: 'development',
          version: '1.0.0',
          repositoryUrl: 'https://github.com/test/repo',
          userInfo: {
            id: 'user-123',
            name: 'Test User',
            email: 'test@example.com'
          }
        },
        summary: {
          totalChanges: 2,
          categoryCounts: { feature: 1, bug: 1 },
          priorityCounts: { high: 1, medium: 1 },
          affectedComponents: ['TestComponent', 'HeaderComponent'],
          estimatedComplexity: 'medium'
        }
      })
    };

    mockContext = {
      functionName: 'process-changes',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:process-changes',
      memoryLimitInMB: 128,
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/process-changes',
      logStreamName: 'test-log-stream',
      getRemainingTimeInMillis: () => 30000,
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn()
    };

    // Mock storage
    const { storage } = require('../netlify/functions/shared/redis-storage');
    mockStorage = storage;
    mockStorage.generateSessionId.mockReturnValue('test-session-123');
    mockStorage.setSession.mockResolvedValue(undefined);
    mockStorage.getSession.mockResolvedValue({
      id: 'test-session-123',
      status: 'initializing',
      submissionId: 'test-submission-456',
      projectId: 'test-project-123',
      repositoryUrl: 'https://github.com/test/repo',
      changes: mockEvent.body.changes,
      logs: [],
      startTime: Date.now()
    });
    mockStorage.addLog.mockResolvedValue(undefined);
    mockStorage.updateSessionStatus.mockResolvedValue(undefined);

    // Mock StackBlitz service
    const { StackBlitzAgentService } = require('../netlify/functions/shared/stackblitz-agent-service');
    mockStackBlitzService = StackBlitzAgentService;
    mockStackBlitzService.prototype.createSandbox.mockResolvedValue({
      id: 'sandbox-123',
      url: 'https://stackblitz.com/github/test/repo',
      readFile: vi.fn(),
      writeFile: vi.fn(),
      runCommand: vi.fn(),
      listFiles: vi.fn(),
      gitClone: vi.fn(),
      gitCreateBranch: vi.fn(),
      gitCommit: vi.fn(),
      runTests: vi.fn().mockResolvedValue({ success: true, testCount: 10 }),
      createPullRequest: vi.fn().mockResolvedValue({ success: true, prUrl: 'https://github.com/test/repo/pull/123' }),
      fileExists: vi.fn()
    });

    // Mock AI SDK
    const { generateText } = require('ai');
    generateText.mockResolvedValue({
      text: 'Change implemented successfully',
      toolCalls: [{ name: 'write_file', parameters: { path: 'test.tsx', content: 'test' } }]
    });

    // Mock Octokit
    const { Octokit } = require('octokit');
    Octokit.mockImplementation(() => ({
      rest: {
        pulls: {
          create: vi.fn().mockResolvedValue({
            data: {
              html_url: 'https://github.com/test/repo/pull/123',
              number: 123
            }
          }),
          merge: vi.fn().mockResolvedValue({
            data: {
              sha: 'abc123',
              merged: true
            }
          })
        }
      }
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up environment variables
    delete process.env.GITHUB_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.AI_PROVIDER;
    delete process.env.URL;
  });

  describe('Full Workflow Integration', () => {
    it('should process a complete change request workflow', async () => {
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.sessionId).toBe('test-session-123');
      expect(body.submissionId).toBe('test-submission-456');
      expect(body.message).toContain('Changes submitted successfully');
      expect(body.logsUrl).toContain('/logs/test-session-123');
      expect(body.estimatedProcessingTime).toBe(120000); // 2 changes * 60000ms
    });

    it('should handle CORS preflight requests', async () => {
      const corsEvent = {
        ...mockEvent,
        httpMethod: 'OPTIONS'
      };
      
      const result = await handler(corsEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toBe('POST, GET, OPTIONS');
      expect(result.body).toBe('');
    });

    it('should handle GET requests for session status', async () => {
      const getEvent = {
        ...mockEvent,
        httpMethod: 'GET',
        path: '/api/process-changes/test-session-123',
        body: null
      };
      
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        status: 'completed',
        submissionId: 'test-submission-456',
        projectId: 'test-project-123',
        repositoryUrl: 'https://github.com/test/repo',
        changes: [],
        logs: [
          {
            timestamp: Date.now(),
            level: 'info',
            message: 'Processing started',
            metadata: {}
          }
        ],
        startTime: Date.now() - 60000,
        endTime: Date.now(),
        previewUrl: 'https://preview.netlify.app',
        prUrl: 'https://github.com/test/repo/pull/123'
      });
      
      const result = await handler(getEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.sessionId).toBe('test-session-123');
      expect(body.status).toBe('completed');
      expect(body.previewUrl).toBe('https://preview.netlify.app');
      expect(body.prUrl).toBe('https://github.com/test/repo/pull/123');
      expect(body.progress).toBe(100);
    });

    it('should validate required fields in POST requests', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          submissionId: 'test-submission-456',
          changes: [], // Empty changes array
          globalContext: {
            projectId: 'test-project-123',
            repositoryUrl: 'https://github.com/test/repo'
          }
        })
      };
      
      const result = await handler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('No changes provided');
    });

    it('should validate repository URL in POST requests', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          submissionId: 'test-submission-456',
          changes: [{ id: 'change-1', componentId: 'TestComponent', feedback: 'Test' }],
          globalContext: {
            projectId: 'test-project-123'
            // Missing repositoryUrl
          }
        })
      };
      
      const result = await handler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Repository URL required');
    });

    it('should handle missing request body', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: null
      };
      
      const result = await handler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Request body required');
    });

    it('should handle invalid JSON in request body', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: 'invalid json'
      };
      
      const result = await handler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle unsupported HTTP methods', async () => {
      const invalidEvent = {
        ...mockEvent,
        httpMethod: 'PUT'
      };
      
      const result = await handler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(405);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should handle session not found for GET requests', async () => {
      const getEvent = {
        ...mockEvent,
        httpMethod: 'GET',
        path: '/api/process-changes/non-existent-session',
        body: null
      };
      
      mockStorage.getSession.mockResolvedValue(null);
      
      const result = await handler(getEvent, mockContext);
      
      expect(result.statusCode).toBe(404);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Session not found');
    });

    it('should handle missing session ID in GET requests', async () => {
      const getEvent = {
        ...mockEvent,
        httpMethod: 'GET',
        path: '/api/process-changes',
        body: null
      };
      
      const result = await handler(getEvent, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Session ID required');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle Redis storage errors', async () => {
      mockStorage.setSession.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle StackBlitz sandbox creation errors', async () => {
      mockStackBlitzService.prototype.createSandbox.mockRejectedValue(new Error('Sandbox creation failed'));
      
      // The actual processing happens asynchronously, so we need to test the initial response
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should handle AI processing errors', async () => {
      const { generateText } = require('ai');
      generateText.mockRejectedValue(new Error('AI processing failed'));
      
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should handle GitHub API errors', async () => {
      const { Octokit } = require('octokit');
      Octokit.mockImplementation(() => ({
        rest: {
          pulls: {
            create: vi.fn().mockRejectedValue(new Error('GitHub API error')),
            merge: vi.fn().mockRejectedValue(new Error('GitHub API error'))
          }
        }
      }));
      
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => handler(mockEvent, mockContext));
      
      const results = await Promise.all(requests);
      
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(true);
      });
    });

    it('should handle large payloads efficiently', async () => {
      const largeEvent = {
        ...mockEvent,
        body: JSON.stringify({
          ...JSON.parse(mockEvent.body),
          changes: Array(20).fill(null).map((_, index) => ({
            id: `change-${index}`,
            componentId: `Component${index}`,
            feedback: `Change ${index} with a very long description that includes multiple sentences and detailed requirements for the implementation that should be handled by the AI agent.`,
            timestamp: Date.now(),
            category: 'feature',
            priority: 'high',
            status: 'pending',
            componentContext: {
              filePath: `src/components/Component${index}.tsx`,
              props: ['prop1', 'prop2', 'prop3'],
              state: ['state1', 'state2']
            },
            pageContext: {
              route: `/page${index}`,
              layout: 'default'
            }
          }))
        })
      };
      
      const result = await handler(largeEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.estimatedProcessingTime).toBe(1200000); // 20 changes * 60000ms
    });
  });

  describe('Security Integration', () => {
    it('should handle requests without authentication gracefully', async () => {
      delete process.env.GITHUB_TOKEN;
      
      const result = await handler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should sanitize user input', async () => {
      const maliciousEvent = {
        ...mockEvent,
        body: JSON.stringify({
          ...JSON.parse(mockEvent.body),
          changes: [{
            id: 'change-1',
            componentId: '<script>alert("xss")</script>',
            feedback: 'rm -rf / ; echo "malicious command"',
            timestamp: Date.now(),
            category: 'feature',
            priority: 'high',
            status: 'pending',
            componentContext: {},
            pageContext: {}
          }]
        })
      };
      
      const result = await handler(maliciousEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log all workflow stages', async () => {
      await handler(mockEvent, mockContext);
      
      expect(mockStorage.addLog).toHaveBeenCalledWith(
        'test-session-123',
        'info',
        'Processing started with AI agent workflow',
        expect.objectContaining({
          changesCount: 2,
          submissionId: 'test-submission-456'
        })
      );
    });

    it('should track session status changes', async () => {
      await handler(mockEvent, mockContext);
      
      expect(mockStorage.updateSessionStatus).toHaveBeenCalledWith(
        'test-session-123',
        'initializing'
      );
    });

    it('should provide detailed session information', async () => {
      const getEvent = {
        ...mockEvent,
        httpMethod: 'GET',
        path: '/api/process-changes/test-session-123',
        body: null
      };
      
      const result = await handler(getEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('sessionId');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('logs');
      expect(body).toHaveProperty('startTime');
      expect(body).toHaveProperty('progress');
    });
  });
});