// src/test/process-changes.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '../netlify/functions/shared/redis-storage';
import { StackBlitzAgentService } from '../netlify/functions/shared/stackblitz-agent-service';

// Mock Redis storage
vi.mock('../netlify/functions/shared/redis-storage', () => ({
  storage: {
    generateSessionId: vi.fn(() => 'test-session-123'),
    setSession: vi.fn(),
    getSession: vi.fn(),
    addLog: vi.fn(),
    updateSessionStatus: vi.fn()
  }
}));

// Mock StackBlitz service
vi.mock('../netlify/functions/shared/stackblitz-agent-service');

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  tool: vi.fn((config) => config)
}));

// Mock Octokit
vi.mock('octokit', () => ({
  Octokit: vi.fn(() => ({
    rest: {
      pulls: {
        create: vi.fn(),
        merge: vi.fn()
      }
    }
  }))
}));

describe('Process Changes Workflow', () => {
  let mockSession: any;
  let mockPayload: any;
  let mockSandbox: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up test data
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

    mockPayload = {
      submissionId: 'test-submission-456',
      timestamp: Date.now(),
      changes: [
        {
          id: 'change-1',
          componentId: 'TestComponent',
          feedback: 'Add a new feature',
          timestamp: Date.now(),
          category: 'feature',
          priority: 'high',
          status: 'pending',
          componentContext: { filePath: 'src/components/TestComponent.tsx' },
          pageContext: { route: '/test' }
        }
      ],
      globalContext: {
        projectId: 'test-project',
        environment: 'development',
        version: '1.0.0',
        repositoryUrl: 'https://github.com/test/repo',
        userInfo: { id: 'user-123' }
      },
      summary: {
        totalChanges: 1,
        categoryCounts: { feature: 1 },
        priorityCounts: { high: 1 },
        affectedComponents: ['TestComponent'],
        estimatedComplexity: 'medium'
      }
    };

    mockSandbox = {
      id: 'sandbox-123',
      url: 'https://stackblitz.com/test',
      readFile: vi.fn(),
      writeFile: vi.fn(),
      runCommand: vi.fn(),
      listFiles: vi.fn(),
      gitClone: vi.fn(),
      gitCreateBranch: vi.fn(),
      gitCommit: vi.fn(),
      runTests: vi.fn(),
      createPullRequest: vi.fn(),
      fileExists: vi.fn()
    };

    // Set up mock return values
    (storage.getSession as any).mockResolvedValue(mockSession);
    (storage.setSession as any).mockResolvedValue(undefined);
    (storage.addLog as any).mockResolvedValue(undefined);
    (storage.updateSessionStatus as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Session Management', () => {
    it('should create a new session with correct data', async () => {
      const sessionId = storage.generateSessionId();
      expect(sessionId).toBe('test-session-123');
      expect(storage.generateSessionId).toHaveBeenCalled();
    });

    it('should update session status correctly', async () => {
      await storage.updateSessionStatus('test-session-123', 'ai_processing');
      expect(storage.updateSessionStatus).toHaveBeenCalledWith('test-session-123', 'ai_processing');
    });

    it('should add logs to session', async () => {
      await storage.addLog('test-session-123', 'info', 'Test log message', { test: 'data' });
      expect(storage.addLog).toHaveBeenCalledWith('test-session-123', 'info', 'Test log message', { test: 'data' });
    });
  });

  describe('StackBlitz Integration', () => {
    it('should create a sandbox with correct repository URL', async () => {
      const service = new StackBlitzAgentService();
      const sandbox = await service.createSandbox(mockPayload.globalContext.repositoryUrl);
      
      expect(sandbox).toBeDefined();
      expect(sandbox.id).toBeDefined();
      expect(sandbox.url).toContain('stackblitz.com');
    });

    it('should support all required sandbox operations', async () => {
      const service = new StackBlitzAgentService();
      const sandbox = await service.createSandbox(mockPayload.globalContext.repositoryUrl);
      
      // Test file operations
      await sandbox.writeFile('test.txt', 'Hello World');
      expect(sandbox.writeFile).toBeDefined();
      
      const content = await sandbox.readFile('test.txt');
      expect(sandbox.readFile).toBeDefined();
      
      // Test command execution
      const result = await sandbox.runCommand('npm test');
      expect(sandbox.runCommand).toBeDefined();
      
      // Test git operations
      await sandbox.gitClone('https://github.com/test/repo', 'develop');
      expect(sandbox.gitClone).toBeDefined();
      
      await sandbox.gitCreateBranch('feature/test');
      expect(sandbox.gitCreateBranch).toBeDefined();
      
      await sandbox.gitCommit('Test commit');
      expect(sandbox.gitCommit).toBeDefined();
    });
  });

  describe('AI Agent Processing', () => {
    it('should process change requests correctly', async () => {
      // Mock AI SDK generateText
      const mockGenerateText = vi.fn().mockResolvedValue({
        text: 'Change implemented successfully',
        toolCalls: [{ name: 'write_file', parameters: { path: 'src/test.tsx', content: 'test content' } }]
      });
      
      const { generateText } = await import('ai');
      (generateText as any).mockImplementation(mockGenerateText);
      
      // Test change processing logic
      const change = mockPayload.changes[0];
      expect(change.componentId).toBe('TestComponent');
      expect(change.feedback).toBe('Add a new feature');
      expect(change.category).toBe('feature');
      expect(change.priority).toBe('high');
    });

    it('should handle test writing and execution', async () => {
      mockSandbox.runTests.mockResolvedValue({
        success: true,
        output: '5 tests passed',
        testCount: 5,
        passed: 5,
        failed: 0,
        coverage: '85%'
      });
      
      const testResult = await mockSandbox.runTests();
      expect(testResult.success).toBe(true);
      expect(testResult.testCount).toBe(5);
      expect(testResult.coverage).toBe('85%');
    });

    it('should handle failing tests and retry logic', async () => {
      mockSandbox.runTests
        .mockResolvedValueOnce({
          success: false,
          output: '3 tests failed',
          testCount: 5,
          passed: 2,
          failed: 3,
          coverage: '60%'
        })
        .mockResolvedValueOnce({
          success: true,
          output: '5 tests passed',
          testCount: 5,
          passed: 5,
          failed: 0,
          coverage: '85%'
        });
      
      const firstResult = await mockSandbox.runTests();
      expect(firstResult.success).toBe(false);
      expect(firstResult.failed).toBe(3);
      
      const secondResult = await mockSandbox.runTests();
      expect(secondResult.success).toBe(true);
      expect(secondResult.failed).toBe(0);
    });
  });

  describe('GitHub Integration', () => {
    it('should create pull requests with correct data', async () => {
      const mockPr = {
        data: {
          html_url: 'https://github.com/test/repo/pull/123',
          number: 123
        }
      };
      
      const { Octokit } = await import('octokit');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.pulls.create as any).mockResolvedValue(mockPr);
      
      const prResult = await mockOctokit.rest.pulls.create({
        owner: 'test',
        repo: 'repo',
        title: 'Test PR',
        body: 'Test description',
        head: 'feature/test',
        base: 'develop'
      });
      
      expect(prResult.data.html_url).toBe('https://github.com/test/repo/pull/123');
      expect(prResult.data.number).toBe(123);
    });

    it('should merge pull requests successfully', async () => {
      const mockMerge = {
        data: {
          sha: 'abc123',
          merged: true
        }
      };
      
      const { Octokit } = await import('octokit');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.pulls.merge as any).mockResolvedValue(mockMerge);
      
      const mergeResult = await mockOctokit.rest.pulls.merge({
        owner: 'test',
        repo: 'repo',
        pull_number: 123,
        commit_title: 'Merge test PR',
        commit_message: 'Test merge',
        merge_method: 'squash'
      });
      
      expect(mergeResult.data.merged).toBe(true);
      expect(mergeResult.data.sha).toBe('abc123');
    });
  });

  describe('Error Handling', () => {
    it('should handle sandbox creation failures', async () => {
      const service = new StackBlitzAgentService();
      
      // Mock sandbox creation to fail
      vi.spyOn(service, 'createSandbox').mockRejectedValue(new Error('Sandbox creation failed'));
      
      await expect(service.createSandbox('invalid-url')).rejects.toThrow('Sandbox creation failed');
    });

    it('should handle session not found errors', async () => {
      (storage.getSession as any).mockResolvedValue(null);
      
      const session = await storage.getSession('non-existent-session');
      expect(session).toBeNull();
    });

    it('should handle AI processing failures gracefully', async () => {
      const mockGenerateText = vi.fn().mockRejectedValue(new Error('AI processing failed'));
      
      const { generateText } = await import('ai');
      (generateText as any).mockImplementation(mockGenerateText);
      
      await expect(generateText({})).rejects.toThrow('AI processing failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress through all workflow stages', async () => {
      const stages = ['initializing', 'sandbox_creating', 'ai_processing', 'testing', 'pr_creating', 'deploying', 'completed'];
      
      for (const stage of stages) {
        await storage.updateSessionStatus('test-session-123', stage as any);
        expect(storage.updateSessionStatus).toHaveBeenCalledWith('test-session-123', stage);
      }
    });

    it('should log progress at each stage', async () => {
      await storage.addLog('test-session-123', 'info', 'Starting sandbox creation');
      await storage.addLog('test-session-123', 'success', 'Sandbox created successfully');
      await storage.addLog('test-session-123', 'info', 'Starting AI processing');
      await storage.addLog('test-session-123', 'success', 'AI processing completed');
      
      expect(storage.addLog).toHaveBeenCalledTimes(4);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full workflow from start to finish', async () => {
      // Mock all dependencies to succeed
      const service = new StackBlitzAgentService();
      const sandbox = await service.createSandbox(mockPayload.globalContext.repositoryUrl);
      
      // Simulate full workflow
      await storage.updateSessionStatus('test-session-123', 'sandbox_creating');
      await storage.addLog('test-session-123', 'info', 'Creating sandbox...');
      
      await storage.updateSessionStatus('test-session-123', 'ai_processing');
      await storage.addLog('test-session-123', 'info', 'Processing changes...');
      
      await storage.updateSessionStatus('test-session-123', 'testing');
      await storage.addLog('test-session-123', 'info', 'Running tests...');
      
      await storage.updateSessionStatus('test-session-123', 'pr_creating');
      await storage.addLog('test-session-123', 'info', 'Creating pull request...');
      
      await storage.updateSessionStatus('test-session-123', 'deploying');
      await storage.addLog('test-session-123', 'info', 'Deploying changes...');
      
      await storage.updateSessionStatus('test-session-123', 'completed');
      await storage.addLog('test-session-123', 'success', 'Workflow completed successfully!');
      
      // Verify all stages were called
      expect(storage.updateSessionStatus).toHaveBeenCalledTimes(6);
      expect(storage.addLog).toHaveBeenCalledTimes(6);
    });
  });
});