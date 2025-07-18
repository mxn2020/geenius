// netlify/functions/shared/github-service.ts
import { Octokit } from 'octokit';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
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

  async createBranch(repoUrl: string, branchName: string, baseBranch: string = 'develop'): Promise<void> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data: baseBranchData } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: baseBranch
    });

    await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseBranchData.commit.sha
    });
  }

  async getFileContent(repoUrl: string, filePath: string, branch: string = 'develop'): Promise<string> {
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
        return '';
      }
      throw error;
    }
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    const repo = match[2].replace(/\.git$/, '');
    return { owner: match[1], repo };
  }
}

