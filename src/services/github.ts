// web/services/github.ts - Web-friendly GitHub service using REST API
export class GitHubService {
  private token: string;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required for GitHub integration.');
    }
    this.token = process.env.GITHUB_TOKEN;
  }

  /**
   * Get the authenticated user's information
   */
  async getCurrentUser(): Promise<{ login: string; name: string; avatar_url: string }> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`GitHub API error: ${errorMessage}`);
    }
  }

  /**
   * Get organizations that the authenticated user belongs to
   */
  async getUserOrganizations(): Promise<Array<{ login: string; avatar_url: string; description?: string }>> {
    try {
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get organizations: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`GitHub API error: ${errorMessage}`);
    }
  }

  /**
   * Get available GitHub accounts (user + organizations)
   */
  async getAvailableAccounts(): Promise<Array<{ login: string; type: 'user' | 'organization'; avatar_url: string; description?: string }>> {
    try {
      const [user, orgs] = await Promise.all([
        this.getCurrentUser(),
        this.getUserOrganizations()
      ]);

      const accounts = [
        {
          login: user.login,
          type: 'user' as const,
          avatar_url: user.avatar_url,
          description: user.name
        },
        ...orgs.map(org => ({
          login: org.login,
          type: 'organization' as const,
          avatar_url: org.avatar_url,
          description: org.description
        }))
      ];

      return accounts;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`Failed to get GitHub accounts: ${errorMessage}`);
    }
  }

  async forkTemplate(templateRepoUrl: string, projectName: string, githubOrg: string): Promise<string> {
    // Parse the template repository URL
    const match = templateRepoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${templateRepoUrl}`);
    }

    const [, templateOwner, templateRepo] = match;
    const cleanRepoName = templateRepo.replace(/\.git$/, '');

    try {
      // Fork the repository using GitHub REST API
      const response = await fetch(`https://api.github.com/repos/${templateOwner}/${cleanRepoName}/forks`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization: githubOrg !== process.env.GITHUB_USERNAME ? githubOrg : undefined,
          name: projectName,
          default_branch_only: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fork repository: ${error.message || response.statusText}`);
      }

      const forkData = await response.json();
      return forkData.html_url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`GitHub API error: ${errorMessage}`);
    }
  }

  async createBranch(repoUrl: string, branchName: string, baseBranch: string = 'main'): Promise<void> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const cleanRepoName = repo.replace(/\.git$/, '');

    try {
      // Get the SHA of the base branch
      const baseResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}/git/refs/heads/${baseBranch}`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!baseResponse.ok) {
        throw new Error(`Failed to get base branch: ${baseResponse.statusText}`);
      }

      const baseData = await baseResponse.json();
      const baseSha = baseData.object.sha;

      // Create new branch
      const createResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}/git/refs`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(`Failed to create branch: ${error.message || createResponse.statusText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`GitHub API error: ${errorMessage}`);
    }
  }

  async getRepositoryInfo(repoUrl: string): Promise<any> {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }

    const [, owner, repo] = match;
    const cleanRepoName = repo.replace(/\.git$/, '');

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${cleanRepoName}`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get repository info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown GitHub API error';
      throw new Error(`GitHub API error: ${errorMessage}`);
    }
  }
}