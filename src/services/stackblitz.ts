// src/services/stackblitz.ts
import sdk from '@stackblitz/sdk';

interface StackBlitzProject {
  id: string;
  url: string;
  vm: any;
}

interface CommandResult {
  output: string;
  exitCode: number;
}

export class StackBlitzService {
  async createFromGitHub(repoUrl: string, branch: string = 'main'): Promise<StackBlitzProject> {
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = repoMatch;
    const projectId = `${owner}-${repo}-${branch}-${Date.now()}`;

    try {
      // Create StackBlitz project from GitHub repository
      const vm = await sdk.embedGithubProject('sb-container', `${owner}/${repo}`, {
        openFile: 'README.md',
        view: 'editor',
        hideNavigation: true,
        hideDevTools: false,
        theme: 'dark',
        height: 500,
        width: '100%'
      });

      // Switch to the specified branch if not main
      if (branch !== 'main') {
        await this.switchToBranch({ id: projectId, url: '', vm }, branch);
      }

      return {
        id: projectId,
        url: `https://stackblitz.com/github/${owner}/${repo}`,
        vm
      };
    } catch (error) {
      throw new Error(`Failed to create StackBlitz project: ${error.message}`);
    }
  }

  async switchToBranch(project: StackBlitzProject, branch: string): Promise<void> {
    try {
      // Use WebContainer API to switch branches
      await project.vm.fs.exec('git', ['checkout', branch]);
    } catch (error) {
      // If branch doesn't exist, create it
      await project.vm.fs.exec('git', ['checkout', '-b', branch]);
    }
  }

  async runCommand(project: StackBlitzProject, command: string): Promise<CommandResult> {
    try {
      const [cmd, ...args] = command.split(' ');
      const result = await project.vm.fs.exec(cmd, args);
      
      return {
        output: result.stdout || result.stderr || '',
        exitCode: result.code || 0
      };
    } catch (error) {
      return {
        output: `Command failed: ${error.message}`,
        exitCode: 1
      };
    }
  }

  async installDependencies(project: StackBlitzProject): Promise<CommandResult> {
    return this.runCommand(project, 'npm install');
  }

  async readFile(project: StackBlitzProject, filePath: string): Promise<string> {
    try {
      const content = await project.vm.fs.readFile(filePath);
      return content;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async writeFile(project: StackBlitzProject, filePath: string, content: string): Promise<void> {
    try {
      await project.vm.fs.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async deleteFile(project: StackBlitzProject, filePath: string): Promise<void> {
    try {
      await project.vm.fs.remove(filePath);
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  async listFiles(project: StackBlitzProject, dirPath: string = '.'): Promise<string[]> {
    try {
      const files = await project.vm.fs.readdir(dirPath);
      return files;
    } catch (error) {
      throw new Error(`Failed to list files in ${dirPath}: ${error.message}`);
    }
  }

  async getProjectInfo(project: StackBlitzProject): Promise<{
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
    framework: string;
  }> {
    try {
      const packageJson = await this.readFile(project, 'package.json');
      const pkg = JSON.parse(packageJson);
      
      // Detect framework
      let framework = 'unknown';
      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        framework = 'nextjs';
      } else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        framework = 'vue';
      } else if (pkg.dependencies?.svelte || pkg.devDependencies?.svelte) {
        framework = 'svelte';
      } else if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        framework = 'react';
      } else if (pkg.dependencies?.astro || pkg.devDependencies?.astro) {
        framework = 'astro';
      }

      return {
        dependencies: { ...pkg.dependencies, ...pkg.devDependencies },
        scripts: pkg.scripts || {},
        framework
      };
    } catch (error) {
      throw new Error(`Failed to get project info: ${error.message}`);
    }
  }

  async startDevServer(project: StackBlitzProject): Promise<string> {
    try {
      const projectInfo = await this.getProjectInfo(project);
      const devCommand = projectInfo.scripts.dev || projectInfo.scripts.start || 'npm run dev';
      
      // Start the development server
      const result = await this.runCommand(project, devCommand);
      
      // Extract the local URL from the output
      const urlMatch = result.output.match(/Local:\s+(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
      
      // Default StackBlitz preview URL
      return `https://${project.id}.stackblitz.io`;
    } catch (error) {
      throw new Error(`Failed to start dev server: ${error.message}`);
    }
  }

  async loadProject(projectId: string): Promise<StackBlitzProject> {
    try {
      // This would typically load an existing project
      // For now, we'll create a mock implementation
      const vm = await sdk.connect(projectId);
      
      return {
        id: projectId,
        url: `https://stackblitz.com/edit/${projectId}`,
        vm
      };
    } catch (error) {
      throw new Error(`Failed to load project ${projectId}: ${error.message}`);
    }
  }

  async createSnapshot(project: StackBlitzProject): Promise<string> {
    try {
      // Create a snapshot of the current state
      const snapshot = await project.vm.snapshot();
      return snapshot.id;
    } catch (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  async restoreSnapshot(project: StackBlitzProject, snapshotId: string): Promise<void> {
    try {
      await project.vm.restore(snapshotId);
    } catch (error) {
      throw new Error(`Failed to restore snapshot ${snapshotId}: ${error.message}`);
    }
  }
}