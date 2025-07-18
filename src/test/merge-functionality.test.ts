// src/test/merge-functionality.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeHandler } from '../netlify/functions/process-changes';

// Mock all dependencies
vi.mock('../netlify/functions/shared/redis-storage');
vi.mock('octokit');

describe('Merge Functionality', () => {
  let mockEvent: any;
  let mockContext: any;
  let mockStorage: any;
  let mockOctokit: any;

  beforeEach(() => {
    // Set up environment variables
    process.env.GITHUB_TOKEN = 'test-github-token';

    // Mock storage
    const { storage } = require('../netlify/functions/shared/redis-storage');
    mockStorage = storage;
    
    // Mock Octokit
    const { Octokit } = require('octokit');
    mockOctokit = {
      rest: {
        pulls: {
          merge: vi.fn()
        }
      }
    };
    Octokit.mockImplementation(() => mockOctokit);

    // Mock event structure
    mockEvent = {
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        prNumber: 456
      })
    };

    mockContext = {
      functionName: 'merge-pull-request',
      functionVersion: '1',
      awsRequestId: 'test-request-id',
      getRemainingTimeInMillis: () => 30000
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  describe('Merge Handler', () => {
    it('should handle CORS preflight requests', async () => {
      const corsEvent = {
        ...mockEvent,
        httpMethod: 'OPTIONS'
      };
      
      const result = await mergeHandler(corsEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
      expect(result.body).toBe('');
    });

    it('should handle unsupported HTTP methods', async () => {
      const invalidEvent = {
        ...mockEvent,
        httpMethod: 'GET'
      };
      
      const result = await mergeHandler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(405);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('should validate required parameters', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({
          sessionId: 'test-session-123'
          // Missing prNumber
        })
      };
      
      const result = await mergeHandler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBe('sessionId and prNumber are required');
    });

    it('should merge pull request successfully', async () => {
      // Mock session data
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        status: 'completed',
        repositoryUrl: 'https://github.com/test/repo',
        submissionId: 'test-submission-456',
        projectId: 'test-project-123',
        changes: [],
        logs: [],
        startTime: Date.now() - 60000
      });

      // Mock successful merge
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          sha: 'abc123def456',
          merged: true
        }
      });

      mockStorage.setSession.mockResolvedValue(undefined);
      mockStorage.addLog.mockResolvedValue(undefined);
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.mergeCommitSha).toBe('abc123def456');
      expect(body.merged).toBe(true);
      
      // Verify GitHub API was called correctly
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test',
        repo: 'repo',
        pull_number: 456,
        commit_title: 'Merge AI-generated improvements',
        commit_message: 'Merging AI-generated improvements from session test-session-123',
        merge_method: 'squash'
      });
      
      // Verify session was updated
      expect(mockStorage.setSession).toHaveBeenCalled();
      expect(mockStorage.addLog).toHaveBeenCalledWith(
        'test-session-123',
        'success',
        'Pull request merged successfully',
        expect.objectContaining({
          mergeCommitSha: 'abc123def456',
          merged: true
        })
      );
    });

    it('should handle session not found', async () => {
      mockStorage.getSession.mockResolvedValue(null);
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Session not found');
    });

    it('should handle missing GitHub token', async () => {
      delete process.env.GITHUB_TOKEN;
      
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('GitHub token not configured');
    });

    it('should handle GitHub API errors', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('GitHub API error'));
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('GitHub API error');
    });

    it('should handle invalid JSON in request body', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: 'invalid json'
      };
      
      const result = await mergeHandler(invalidEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
    });

    it('should handle different repository URL formats', async () => {
      const testCases = [
        {
          url: 'https://github.com/user/repo',
          expectedOwner: 'user',
          expectedRepo: 'repo'
        },
        {
          url: 'https://github.com/user/repo.git',
          expectedOwner: 'user',
          expectedRepo: 'repo'
        },
        {
          url: 'git@github.com:user/repo.git',
          expectedOwner: 'user',
          expectedRepo: 'repo'
        }
      ];
      
      for (const testCase of testCases) {
        mockStorage.getSession.mockResolvedValue({
          id: 'test-session-123',
          repositoryUrl: testCase.url
        });
        
        mockOctokit.rest.pulls.merge.mockResolvedValue({
          data: {
            sha: 'abc123',
            merged: true
          }
        });
        
        mockStorage.setSession.mockResolvedValue(undefined);
        mockStorage.addLog.mockResolvedValue(undefined);
        
        const result = await mergeHandler(mockEvent, mockContext);
        
        expect(result.statusCode).toBe(200);
        expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith(
          expect.objectContaining({
            owner: testCase.expectedOwner,
            repo: testCase.expectedRepo
          })
        );
        
        vi.clearAllMocks();
        mockStorage.getSession.mockReset();
        mockOctokit.rest.pulls.merge.mockReset();
        mockStorage.setSession.mockReset();
        mockStorage.addLog.mockReset();
      }
    });

    it('should handle merge conflicts', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Merge conflict'));
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Merge conflict');
    });

    it('should handle pull request not found', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Pull request not found'));
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Pull request not found');
    });

    it('should update session status after successful merge', async () => {
      const mockSession = {
        id: 'test-session-123',
        status: 'completed',
        repositoryUrl: 'https://github.com/test/repo',
        submissionId: 'test-submission-456',
        projectId: 'test-project-123',
        changes: [],
        logs: [],
        startTime: Date.now() - 60000
      };
      
      mockStorage.getSession.mockResolvedValue(mockSession);
      
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          sha: 'abc123def456',
          merged: true
        }
      });
      
      mockStorage.setSession.mockResolvedValue(undefined);
      mockStorage.addLog.mockResolvedValue(undefined);
      
      await mergeHandler(mockEvent, mockContext);
      
      expect(mockStorage.setSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          ...mockSession,
          status: 'completed',
          endTime: expect.any(Number)
        })
      );
    });

    it('should handle storage errors during merge', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          sha: 'abc123',
          merged: true
        }
      });
      
      mockStorage.setSession.mockRejectedValue(new Error('Storage error'));
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Storage error');
    });

    it('should handle partial merge success', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          sha: 'abc123',
          merged: false // Merge was not successful
        }
      });
      
      mockStorage.setSession.mockResolvedValue(undefined);
      mockStorage.addLog.mockResolvedValue(undefined);
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.merged).toBe(false);
    });
  });

  describe('URL Parsing', () => {
    it('should handle malformed repository URLs', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'invalid-url'
      });
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should handle URLs with different protocols', async () => {
      const testUrls = [
        'https://github.com/user/repo',
        'http://github.com/user/repo',
        'git@github.com:user/repo.git'
      ];
      
      for (const url of testUrls) {
        mockStorage.getSession.mockResolvedValue({
          id: 'test-session-123',
          repositoryUrl: url
        });
        
        mockOctokit.rest.pulls.merge.mockResolvedValue({
          data: {
            sha: 'abc123',
            merged: true
          }
        });
        
        mockStorage.setSession.mockResolvedValue(undefined);
        mockStorage.addLog.mockResolvedValue(undefined);
        
        const result = await mergeHandler(mockEvent, mockContext);
        
        expect(result.statusCode).toBe(200);
        
        vi.clearAllMocks();
        mockStorage.getSession.mockReset();
        mockOctokit.rest.pulls.merge.mockReset();
        mockStorage.setSession.mockReset();
        mockStorage.addLog.mockReset();
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle transient GitHub API errors', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      // First call fails, second succeeds
      mockOctokit.rest.pulls.merge
        .mockRejectedValueOnce(new Error('Temporary API error'))
        .mockResolvedValueOnce({
          data: {
            sha: 'abc123',
            merged: true
          }
        });
      
      const result = await mergeHandler(mockEvent, mockContext);
      
      expect(result.statusCode).toBe(500);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Temporary API error');
    });

    it('should handle concurrent merge attempts', async () => {
      mockStorage.getSession.mockResolvedValue({
        id: 'test-session-123',
        repositoryUrl: 'https://github.com/test/repo'
      });
      
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          sha: 'abc123',
          merged: true
        }
      });
      
      mockStorage.setSession.mockResolvedValue(undefined);
      mockStorage.addLog.mockResolvedValue(undefined);
      
      const requests = Array(3).fill(null).map(() => mergeHandler(mockEvent, mockContext));
      
      const results = await Promise.all(requests);
      
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });
    });
  });
});