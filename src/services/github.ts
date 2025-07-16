// src/services/github.ts
import { Octokit } from 'octokit';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }

  async forkTemplate(templateRepo: string, projectName: string, org: string): Promise<string> {
    const [templateOwner, templateName] = templateRepo.split('/');
    
    // Fork the template repository
    const { data: fork } = await this.octokit.rest.repos.createFork({
      owner: templateOwner,
      repo: templateName,
      organization: org,
      name: projectName
    });

    // Wait for fork to be ready
    await this.waitForRepo(org, projectName);

    // Set up branch protection and default branches
    await this.setupBranches(org, projectName);

    return fork.html_url;
  }

  async setupBranches(owner: string, repo: string) {
    // Create develop branch from main
    const { data: mainBranch } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: 'main'
    });

    await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/develop',
      sha: mainBranch.commit.sha
    });

    // Set up branch protection for main
    await this.octokit.rest.repos.updateBranchProtection({
      owner,
      repo,
      branch: 'main',
      required_status_checks: {
        strict: true,
        contexts: ['netlify/build']
      },
      enforce_admins: false,
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        dismiss_stale_reviews: true
      },
      restrictions: null
    });
  }

  async createBranch(repoUrl: string, branchName: string, baseBranch: string = 'main'): Promise<void> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // Get base branch SHA
    const { data: baseBranchData } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: baseBranch
    });

    // Create new branch
    await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseBranchData.commit.sha
    });
  }

  async createPullRequest(repoUrl: string, options: {
    head: string;
    base: string;
    title: string;
    body: string;
  }) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data: pr } = await this.octokit.rest.pulls.create({
      owner,
      repo,
      head: options.head,
      base: options.base,
      title: options.title,
      body: options.body
    });

    return pr;
  }

  async commitFiles(repoUrl: string, branch: string, files: Array<{
    path: string;
    content: string;
  }>, message: string) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // Get current branch reference
    const { data: ref } = await this.octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });

    // Get current commit
    const { data: commit } = await this.octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: ref.object.sha
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await this.octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64'
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        };
      })
    );

    // Create tree
    const { data: tree } = await this.octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: commit.tree.sha,
      tree: blobs
    });

    // Create commit
    const { data: newCommit } = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [commit.sha]
    });

    // Update reference
    await this.octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });

    return newCommit;
  }

  async getFileContent(repoUrl: string, filePath: string, branch: string = 'main'): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString();
      }
      throw new Error('File not found or is a directory');
    } catch (error) {
      if (error.status === 404) {
        return ''; // File doesn't exist
      }
      throw error;
    }
  }

  async listFiles(repoUrl: string, path: string = '', branch: string = 'main'): Promise<string[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    });

    if (Array.isArray(data)) {
      return data.map(item => item.name);
    }
    return [];
  }

  async getBranches(repoUrl: string): Promise<string[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.listBranches({
      owner,
      repo
    });

    return data.map(branch => branch.name);
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2] };
  }

  private async waitForRepo(owner: string, repo: string, maxAttempts: number = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.octokit.rest.repos.get({ owner, repo });
        return; // Repo is ready
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}