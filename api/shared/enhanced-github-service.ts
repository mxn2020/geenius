// Enhanced GitHub Service for Agentic AI System
import { Octokit } from 'octokit';

export interface FileContent {
  path: string;
  content: string;
  sha?: string;
  encoding?: string;
}

export interface FileChange {
  path: string;
  content: string;
  message: string;
  previousSha?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  url: string;
}

export interface PullRequestInfo {
  number: number;
  url: string;
  htmlUrl: string;
  branchName: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  url: string;
}

export class EnhancedGitHubService {
  private octokit: Octokit;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }

  /**
   * Parse repository URL to extract owner and repo name
   */
  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    return { owner: match[1], repo: match[2].replace('.git', '') };
  }

  /**
   * Generate AI-suggested feature branch name
   */
  async generateFeatureBranchName(changes: any[]): Promise<string> {
    // Simple AI-like logic for now, can be enhanced with actual AI
    const categories = changes.map(c => c.category).filter((v, i, a) => a.indexOf(v) === i);
    const components = changes.map(c => c.componentId).filter((v, i, a) => a.indexOf(v) === i);
    
    if (components.length === 1) {
      return `feature/update-${components[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    } else if (categories.length === 1) {
      return `feature/improve-${categories[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    } else {
      return `feature/multiple-ui-updates-${Date.now()}`;
    }
  }

  /**
   * Retrieve multiple files from repository
   */
  async retrieveFiles(repoUrl: string, filePaths: string[], branch: string = 'develop'): Promise<FileContent[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const files: FileContent[] = [];

    for (const filePath of filePaths) {
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: branch
        });

        if ('content' in data && data.type === 'file') {
          files.push({
            path: filePath,
            content: Buffer.from(data.content, 'base64').toString('utf-8'),
            sha: data.sha,
            encoding: data.encoding
          });
        }
      } catch (error) {
        console.error(`Failed to retrieve file ${filePath}:`, error);
        // Continue with other files
      }
    }

    return files;
  }

  /**
   * Create feature branch from develop
   */
  async createFeatureBranch(repoUrl: string, branchName: string, baseBranch: string = 'develop'): Promise<BranchInfo> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // First validate that the base branch exists
    const baseBranchExists = await this.branchExists(repoUrl, baseBranch);
    if (!baseBranchExists) {
      throw new Error(`Base branch '${baseBranch}' does not exist in repository ${owner}/${repo}. Please check the repository configuration or create the branch first.`);
    }

    // Get base branch SHA
    const { data: baseBranchData } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: baseBranch
    });

    // Create new branch
    const { data: newBranch } = await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseBranchData.commit.sha
    });

    return {
      name: branchName,
      sha: baseBranchData.commit.sha,
      url: newBranch.url
    };
  }

  /**
   * Commit changes to branch with detailed commit messages
   */
  async commitChanges(
    repoUrl: string, 
    branchName: string, 
    changes: FileChange[]
  ): Promise<CommitInfo[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const commits: CommitInfo[] = [];

    for (const change of changes) {
      try {
        // Get current file to get its SHA
        let currentSha: string | undefined;
        try {
          const { data: currentFile } = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: change.path,
            ref: branchName
          });
          if ('sha' in currentFile) {
            currentSha = currentFile.sha;
          }
        } catch (error) {
          // File might not exist, that's okay for new files
        }

        // Create or update file
        const { data: commit } = await this.octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: change.path,
          message: change.message,
          content: Buffer.from(change.content).toString('base64'),
          branch: branchName,
          sha: currentSha
        });

        commits.push({
          sha: commit.commit.sha!,
          message: change.message,
          url: commit.commit.html_url!
        });

        console.log(`Committed changes to ${change.path}: ${change.message}`);
      } catch (error) {
        console.error(`Failed to commit changes to ${change.path}:`, error);
        throw error;
      }
    }

    return commits;
  }

  /**
   * Create pull request with detailed description
   */
  async createPullRequest(
    repoUrl: string,
    branchName: string,
    title: string,
    body: string,
    baseBranch: string = 'develop'
  ): Promise<PullRequestInfo> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data: pr } = await this.octokit.rest.pulls.create({
      owner,
      repo,
      head: branchName,
      base: baseBranch,
      title,
      body
    });

    return {
      number: pr.number,
      url: pr.url,
      htmlUrl: pr.html_url,
      branchName
    };
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(
    repoUrl: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'
  ): Promise<void> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    await this.octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: mergeMethod
    });
  }

  /**
   * Delete feature branch after merge
   */
  async deleteBranch(repoUrl: string, branchName: string): Promise<void> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    await this.octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`
    });
  }

  /**
   * Check if branch exists
   */
  async branchExists(repoUrl: string, branchName: string): Promise<boolean> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: branchName
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get repository information
   */
  async getRepositoryInfo(repoUrl: string) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.get({
      owner,
      repo
    });

    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      language: data.language,
      topics: data.topics
    };
  }

  /**
   * List files in repository
   */
  async listFiles(repoUrl: string, path: string = '', branch: string = 'develop'): Promise<string[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    });

    if (Array.isArray(data)) {
      return data
        .filter(item => item.type === 'file')
        .map(item => item.path);
    }

    return [];
  }

  /**
   * Get content of a single file from repository
   */
  async getFileContent(repoUrl: string, filePath: string, branch: string = 'develop'): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });

      if ('content' in data && data.content) {
        return Buffer.from(data.content, data.encoding as BufferEncoding || 'base64').toString('utf-8');
      } else {
        throw new Error(`File ${filePath} is not a regular file or has no content`);
      }
    } catch (error) {
      console.error(`Failed to retrieve file ${filePath}:`, error);
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
      throw new Error(`Could not retrieve file ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Analyze file dependencies by parsing imports
   */
  async analyzeFileDependencies(content: string, filePath: string): Promise<{
    imports: string[];
    exports: string[];
    relatedFiles: string[];
  }> {
    const imports: string[] = [];
    const exports: string[] = [];
    const relatedFiles: string[] = [];

    // Parse import statements
    const importRegex = /import\s+(?:.*?\s+from\s+)?['"](.*?)['"];?/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      imports.push(importPath);
      
      // If it's a relative import, add to related files
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        relatedFiles.push(importPath);
      }
    }

    // Parse export statements
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return {
      imports,
      exports,
      relatedFiles
    };
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    repoUrl: string, 
    prNumber: number, 
    mergeOptions: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: 'merge' | 'squash' | 'rebase';
    } = {}
  ): Promise<{ success: boolean; sha?: string; error?: string }> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      // First check if PR is mergeable
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      if (pr.state !== 'open') {
        return {
          success: false,
          error: `Pull request #${prNumber} is ${pr.state}, not open for merging`
        };
      }

      if (pr.mergeable === false) {
        return {
          success: false,
          error: 'Pull request has merge conflicts and cannot be automatically merged'
        };
      }

      // Perform the merge
      const { data: mergeResult } = await this.octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        commit_title: mergeOptions.commit_title,
        commit_message: mergeOptions.commit_message,
        merge_method: mergeOptions.merge_method || 'squash'
      });

      if (mergeResult.merged) {
        return {
          success: true,
          sha: mergeResult.sha
        };
      } else {
        return {
          success: false,
          error: mergeResult.message || 'Merge failed without specific reason'
        };
      }

    } catch (error) {
      console.error(`Failed to merge PR #${prNumber}:`, error);
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
        ? (error as { message: string }).message 
        : String(error);
      
      return {
        success: false,
        error: `Failed to merge pull request: ${errorMessage}`
      };
    }
  }
}