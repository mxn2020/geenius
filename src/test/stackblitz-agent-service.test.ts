// src/test/stackblitz-agent-service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StackBlitzAgentService } from '../netlify/functions/shared/stackblitz-agent-service';

describe('StackBlitzAgentService', () => {
  let service: StackBlitzAgentService;
  let mockContainer: any;

  beforeEach(() => {
    service = new StackBlitzAgentService();
    
    mockContainer = {
      fs: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        readdir: vi.fn()
      },
      spawn: vi.fn(),
      teardown: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSandbox', () => {
    it('should create a sandbox with correct structure', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      expect(sandbox).toBeDefined();
      expect(sandbox.id).toBeDefined();
      expect(sandbox.url).toContain('stackblitz.com');
      expect(sandbox.url).toContain('github');
      expect(sandbox.url).toContain('test/repo');
    });

    it('should provide all required sandbox methods', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      // Check all required methods exist
      expect(typeof sandbox.readFile).toBe('function');
      expect(typeof sandbox.writeFile).toBe('function');
      expect(typeof sandbox.runCommand).toBe('function');
      expect(typeof sandbox.listFiles).toBe('function');
      expect(typeof sandbox.gitClone).toBe('function');
      expect(typeof sandbox.gitCreateBranch).toBe('function');
      expect(typeof sandbox.gitCommit).toBe('function');
      expect(typeof sandbox.runTests).toBe('function');
      expect(typeof sandbox.createPullRequest).toBe('function');
      expect(typeof sandbox.fileExists).toBe('function');
    });
  });

  describe('File Operations', () => {
    it('should read files correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const content = await sandbox.readFile('test.txt');
      expect(content).toBeDefined();
      expect(typeof content).toBe('string');
    });

    it('should write files correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await sandbox.writeFile('test.txt', 'Hello World');
      
      // Should not throw error
      expect(true).toBe(true);
    });

    it('should list files correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const files = await sandbox.listFiles();
      expect(Array.isArray(files)).toBe(true);
    });

    it('should check file existence', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      // Write a file first
      await sandbox.writeFile('test.txt', 'content');
      
      // Check if it exists
      const exists = await sandbox.fileExists('test.txt');
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('Command Execution', () => {
    it('should execute commands correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const result = await sandbox.runCommand('npm test');
      expect(result).toBeDefined();
      expect(result.exitCode).toBeDefined();
      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle command failures', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      // Mock command failure
      const result = await sandbox.runCommand('invalid-command');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Git Operations', () => {
    it('should clone repository correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await sandbox.gitClone(repoUrl, 'develop');
      // Should not throw error
      expect(true).toBe(true);
    });

    it('should create branches correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await sandbox.gitCreateBranch('feature/test');
      // Should not throw error
      expect(true).toBe(true);
    });

    it('should commit changes correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await sandbox.gitCommit('Test commit message');
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Testing Integration', () => {
    it('should run tests and return results', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const testResult = await sandbox.runTests();
      expect(testResult).toBeDefined();
      expect(testResult.success).toBeDefined();
      expect(testResult.testCount).toBeDefined();
      expect(testResult.output).toBeDefined();
    });

    it('should run specific test files', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const testResult = await sandbox.runTests('src/test/specific.test.ts');
      expect(testResult).toBeDefined();
      expect(testResult.success).toBeDefined();
    });

    it('should parse test output correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const testResult = await sandbox.runTests();
      expect(testResult.testCount).toBeGreaterThanOrEqual(0);
      expect(testResult.passed).toBeGreaterThanOrEqual(0);
      expect(testResult.failed).toBeGreaterThanOrEqual(0);
      expect(testResult.coverage).toBeDefined();
    });
  });

  describe('Pull Request Creation', () => {
    it('should create pull requests with correct data', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const prResult = await sandbox.createPullRequest('Test PR', 'Test description');
      expect(prResult).toBeDefined();
      expect(prResult.success).toBe(true);
      expect(prResult.prUrl).toBeDefined();
      expect(prResult.branchName).toBeDefined();
      expect(prResult.prNumber).toBeDefined();
    });

    it('should generate correct PR URLs', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const prResult = await sandbox.createPullRequest('Test PR', 'Test description');
      expect(prResult.prUrl).toContain('github.com');
      expect(prResult.prUrl).toContain('test/repo');
      expect(prResult.prUrl).toContain('pull');
    });
  });

  describe('Sandbox Management', () => {
    it('should cache sandboxes correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox1 = await service.createSandbox(repoUrl);
      const sandbox2 = await service.createSandbox(repoUrl);
      
      // Should create different sandboxes
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('should retrieve cached sandboxes', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const retrieved = service.getSandbox(sandbox.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(sandbox.id);
    });

    it('should destroy sandboxes correctly', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await service.destroySandbox(sandbox.id);
      const retrieved = service.getSandbox(sandbox.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      await expect(sandbox.readFile('non-existent-file.txt')).rejects.toThrow();
    });

    it('should handle command execution errors', async () => {
      const repoUrl = 'https://github.com/test/repo';
      const sandbox = await service.createSandbox(repoUrl);
      
      const result = await sandbox.runCommand('invalid-command');
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('URL Parsing', () => {
    it('should extract repository path from GitHub URLs', async () => {
      const testCases = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'git@github.com:user/repo.git'
      ];
      
      for (const repoUrl of testCases) {
        const sandbox = await service.createSandbox(repoUrl);
        expect(sandbox.url).toContain('user/repo');
      }
    });

    it('should handle malformed URLs gracefully', async () => {
      const repoUrl = 'invalid-url';
      const sandbox = await service.createSandbox(repoUrl);
      
      // Should not throw error
      expect(sandbox).toBeDefined();
    });
  });
});