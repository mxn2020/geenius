// netlify/functions/shared/stackblitz-service.ts
import { WebContainer } from '@webcontainer/api';

interface WebContainerProject {
  id: string;
  url: string;
  container: WebContainer;
}

export class StackBlitzService {
  private containers: Map<string, WebContainer> = new Map();

  async createFromGitHub(repoUrl: string, branch: string = 'develop'): Promise<WebContainerProject> {
    const containerId = `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Boot WebContainer
    const container = await WebContainer.boot();
    this.containers.set(containerId, container);

    // Clone repository
    await this.setupGitRepository(container, repoUrl, branch);

    const project = {
      id: containerId,
      url: `https://stackblitz.com/~/github/${this.extractRepoPath(repoUrl)}`,
      container
    };

    return project;
  }

  private async setupGitRepository(container: WebContainer, repoUrl: string, branch: string): Promise<void> {
    // Install git and clone repository
    const cloneProcess = await container.spawn('git', ['clone', '-b', branch, repoUrl, '.']);
    await cloneProcess.exit;
  }

  async readFile(project: WebContainerProject, filePath: string): Promise<string> {
    try {
      const file = await project.container.fs.readFile(filePath, 'utf8');
      return file;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async writeFile(project: WebContainerProject, filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = filePath.split('/').slice(0, -1).join('/');
      if (dir) {
        await project.container.fs.mkdir(dir, { recursive: true });
      }
      
      await project.container.fs.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async listFiles(project: WebContainerProject, dirPath: string = '.'): Promise<string[]> {
    try {
      const entries = await project.container.fs.readdir(dirPath);
      return entries.map(entry => entry.name);
    } catch (error) {
      throw new Error(`Failed to list files in ${dirPath}: ${error.message}`);
    }
  }

  async runCommand(project: WebContainerProject, command: string, args: string[] = []): Promise<{
    output: string;
    exitCode: number;
  }> {
    try {
      const process = await project.container.spawn(command, args);
      const output = await this.readProcessOutput(process);
      const exitCode = await process.exit;
      
      return { output, exitCode };
    } catch (error) {
      return {
        output: `Error: ${error.message}`,
        exitCode: 1
      };
    }
  }

  private async readProcessOutput(process: any): Promise<string> {
    let output = '';
    
    process.output.pipeTo(new WritableStream({
      write(data) {
        output += data;
      }
    }));

    return output;
  }

  async installDependencies(project: WebContainerProject): Promise<void> {
    const result = await this.runCommand(project, 'npm', ['install']);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to install dependencies: ${result.output}`);
    }
  }

  async switchToBranch(project: WebContainerProject, branch: string): Promise<void> {
    const result = await this.runCommand(project, 'git', ['checkout', branch]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to switch to branch ${branch}: ${result.output}`);
    }
  }

  async createBranch(project: WebContainerProject, branchName: string): Promise<void> {
    const result = await this.runCommand(project, 'git', ['checkout', '-b', branchName]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create branch ${branchName}: ${result.output}`);
    }
  }

  async commitChanges(project: WebContainerProject, message: string): Promise<void> {
    // Stage all changes
    await this.runCommand(project, 'git', ['add', '.']);
    
    // Commit changes
    const result = await this.runCommand(project, 'git', ['commit', '-m', message]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to commit changes: ${result.output}`);
    }
  }

  async runTests(project: WebContainerProject, testPath?: string): Promise<{
    success: boolean;
    output: string;
    testCount: number;
  }> {
    const args = ['test'];
    if (testPath) args.push(testPath);
    
    const result = await this.runCommand(project, 'npm', args);
    
    // Parse test output for statistics
    const testCount = this.parseTestCount(result.output);
    
    return {
      success: result.exitCode === 0,
      output: result.output,
      testCount
    };
  }

  private parseTestCount(output: string): number {
    const match = output.match(/(\d+) tests? passed/);
    return match ? parseInt(match[1]) : 0;
  }

  async startDevServer(project: WebContainerProject): Promise<string> {
    const process = await project.container.spawn('npm', ['run', 'dev']);
    
    // Wait for server to be ready and return URL
    return new Promise((resolve) => {
      process.output.pipeTo(new WritableStream({
        write(data) {
          if (data.includes('Local:') || data.includes('localhost')) {
            const match = data.match(/https?:\/\/[^\s]+/);
            if (match) {
              resolve(match[0]);
            }
          }
        }
      }));
    });
  }

  async cleanup(project: WebContainerProject): Promise<void> {
    try {
      await project.container.teardown();
      this.containers.delete(project.id);
    } catch (error) {
      console.warn(`Failed to cleanup container ${project.id}:`, error);
    }
  }

  private extractRepoPath(repoUrl: string): string {
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : '';
  }
}

