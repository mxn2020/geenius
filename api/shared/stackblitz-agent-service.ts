// netlify/functions/shared/stackblitz-agent-service.ts

// Note: In a real implementation, you would install @webcontainer/api
// For now, we'll use a mock implementation that provides the same interface
type WebContainer = any;
const WebContainer = {
  boot: async () => ({
    fs: {
      readFile: async (path: string, encoding: string) => `// Mock content for ${path}`,
      writeFile: async (path: string, content: string) => {},
      readdir: async (path: string, options: any) => [
        { name: 'src', isDirectory: () => true },
        { name: 'package.json', isDirectory: () => false },
        { name: 'README.md', isDirectory: () => false }
      ]
    },
    spawn: async (command: string, args: string[], options: any) => ({
      output: {
        pipeTo: (stream: any) => {}
      },
      exit: Promise.resolve(0)
    }),
    teardown: async () => {}
  })
};

interface SandboxFile {
  path: string;
  content: string;
  lastModified: number;
}

interface SandboxInterface {
  id: string;
  url: string;
  container: WebContainer;
  files: Map<string, SandboxFile>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  runCommand: (command: string, options?: any) => Promise<any>;
  listFiles: (path?: string) => Promise<string[]>;
  gitClone: (repoUrl: string, branch: string) => Promise<void>;
  gitCreateBranch: (branchName: string) => Promise<void>;
  gitCommit: (message: string) => Promise<void>;
  runTests: (testPath?: string) => Promise<any>;
  createPullRequest: (title: string, description: string) => Promise<any>;
  fileExists: (path: string) => Promise<boolean>;
}

export class StackBlitzAgentService {
  private containers: Map<string, SandboxInterface> = new Map();

  async createSandbox(repoUrl: string): Promise<SandboxInterface> {
    const projectId = `geenius-${Date.now()}`;
    const projectUrl = `https://stackblitz.com/github/${this.extractRepoPath(repoUrl)}`;
    
    // Initialize WebContainer (in a real implementation)
    const container = await WebContainer.boot();
    const files = new Map<string, SandboxFile>();
    
    const sandbox: SandboxInterface = {
      id: projectId,
      url: projectUrl,
      container,
      files,
      
      async readFile(path: string): Promise<string> {
        try {
          // Read from WebContainer filesystem
          const file = await container.fs.readFile(path, 'utf8');
          return file;
        } catch (error) {
          // Fallback to cached files
          const cachedFile = files.get(path);
          if (cachedFile) {
            return cachedFile.content;
          }
          throw new Error(`File not found: ${path}`);
        }
      },
      
      async writeFile(path: string, content: string): Promise<void> {
        try {
          // Write to WebContainer filesystem
          await container.fs.writeFile(path, content);
          
          // Update cache
          files.set(path, {
            path,
            content,
            lastModified: Date.now()
          });
        } catch (error) {
          throw new Error(`Failed to write file ${path}: ${error.message}`);
        }
      },
      
      async runCommand(command: string, options: any = {}): Promise<any> {
        try {
          const args = command.split(' ');
          const cmd = args[0];
          const cmdArgs = args.slice(1);
          
          const process = await container.spawn(cmd, cmdArgs, {
            cwd: options.cwd || '/',
            env: options.env || {}
          });
          
          let output = '';
          let error = '';
          
          process.output.pipeTo(new WritableStream({
            write(data) {
              output += data;
            }
          }));
          
          const exitCode = await process.exit;
          
          return {
            output,
            error,
            exitCode,
            success: exitCode === 0
          };
        } catch (error) {
          return {
            output: '',
            error: error.message,
            exitCode: 1,
            success: false
          };
        }
      },
      
      async listFiles(path: string = '.'): Promise<string[]> {
        try {
          const entries = await container.fs.readdir(path, { withFileTypes: true });
          return entries.map(entry => {
            const name = entry.name;
            return entry.isDirectory() ? `${name}/` : name;
          });
        } catch (error) {
          return [];
        }
      },
      
      async gitClone(repoUrl: string, branch: string): Promise<void> {
        // Initialize git repository
        await this.runCommand('git init');
        await this.runCommand(`git remote add origin ${repoUrl}`);
        await this.runCommand(`git fetch origin ${branch}`);
        await this.runCommand(`git checkout -b ${branch} origin/${branch}`);
        
        // Install dependencies after cloning
        const packageJsonExists = await this.fileExists('package.json');
        if (packageJsonExists) {
          await this.runCommand('npm install');
        }
      },
      
      async gitCreateBranch(branchName: string): Promise<void> {
        await this.runCommand(`git checkout -b ${branchName}`);
      },
      
      async gitCommit(message: string): Promise<void> {
        await this.runCommand('git add .');
        await this.runCommand(`git commit -m "${message}"`);
      },
      
      async runTests(testPath?: string): Promise<any> {
        const command = testPath ? `npm test -- ${testPath}` : 'npm test';
        const result = await this.runCommand(command);
        
        // Parse test results using the service methods
        const testCount = service.parseTestCount(result.output);
        const passed = service.parsePassedTests(result.output);
        const failed = service.parseFailedTests(result.output);
        
        return {
          success: result.exitCode === 0,
          output: result.output,
          testCount,
          passed,
          failed,
          coverage: service.parseCoverage(result.output)
        };
      },
      
      async createPullRequest(title: string, description: string): Promise<any> {
        // This would integrate with GitHub API
        // For now, returning mock data
        return {
          success: true,
          prUrl: `https://github.com/${service.extractRepoPath(repoUrl)}/pull/123`,
          branchName: 'feature/ai-changes',
          prNumber: 123
        };
      },
      
      async fileExists(path: string): Promise<boolean> {
        try {
          await this.readFile(path);
          return true;
        } catch {
          return false;
        }
      }
    };
    
    // Cache the sandbox
    this.containers.set(projectId, sandbox);
    
    return sandbox;
  }

  getSandbox(id: string): SandboxInterface | undefined {
    return this.containers.get(id);
  }

  async destroySandbox(id: string): Promise<void> {
    const sandbox = this.containers.get(id);
    if (sandbox) {
      await sandbox.container.teardown();
      this.containers.delete(id);
    }
  }

  extractRepoPath(repoUrl: string): string {
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : '';
  }

  parseTestCount(output: string): number {
    const match = output.match(/(\d+) tests?/i);
    return match ? parseInt(match[1]) : 0;
  }

  parsePassedTests(output: string): number {
    const match = output.match(/(\d+) passed/i);
    return match ? parseInt(match[1]) : 0;
  }

  parseFailedTests(output: string): number {
    const match = output.match(/(\d+) failed/i);
    return match ? parseInt(match[1]) : 0;
  }

  parseCoverage(output: string): string {
    const match = output.match(/All files[^\d]*(\d+(?:\.\d+)?)%/i);
    return match ? `${match[1]}%` : 'Unknown';
  }
}