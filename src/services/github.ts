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

    // Find an available repository name to avoid collisions
    const availableRepoName = await this.findAvailableRepoName(githubOrg, projectName);
    
    if (availableRepoName !== projectName) {
      console.log(`[GITHUB-SERVICE] Repository name collision detected. Using '${availableRepoName}' instead of '${projectName}'`);
    }

    try {
      // Create repository from GitHub template using REST API
      const response = await fetch(`https://api.github.com/repos/${templateOwner}/${cleanRepoName}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner: githubOrg,
          name: availableRepoName,
          description: `Project based on ${templateOwner}/${cleanRepoName}`,
          private: false,
          include_all_branches: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create repository from template: ${error.message || response.statusText}`);
      }

      const repoData = await response.json();
      return repoData.html_url;
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

  /**
   * Find an available repository name by checking for collisions and adding suffixes
   */
  private async findAvailableRepoName(owner: string, baseName: string): Promise<string> {
    const randomWords = [
      'alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
      'xray', 'yankee', 'zulu', 'fire', 'earth', 'water', 'wind', 'storm',
      'cloud', 'star', 'moon', 'sun', 'sky', 'ocean', 'forest', 'mountain'
    ];

    // First try the base name
    if (await this.isRepoNameAvailable(owner, baseName)) {
      return baseName;
    }

    // Try with random words
    for (let i = 0; i < 10; i++) {
      const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
      const newName = `${baseName}-${randomWord}`;
      
      if (await this.isRepoNameAvailable(owner, newName)) {
        console.log(`[GITHUB-SERVICE] Found available name: ${newName}`);
        return newName;
      }
    }

    // Fallback to timestamp
    const timestamp = Date.now().toString(36);
    const fallbackName = `${baseName}-${timestamp}`;
    console.log(`[GITHUB-SERVICE] Using timestamp fallback: ${fallbackName}`);
    return fallbackName;
  }

  /**
   * Check if a repository name is available
   */
  private async isRepoNameAvailable(owner: string, name: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.status === 404) {
        return true; // Repo doesn't exist, name is available
      } else if (response.ok) {
        return false; // Repo exists
      } else {
        // For other errors, assume name is not available to be safe
        console.warn(`[GITHUB-SERVICE] Unexpected response checking repo ${owner}/${name}: ${response.status}`);
        return false;
      }
    } catch (error) {
      // On network errors, assume name is not available to be safe
      console.warn(`[GITHUB-SERVICE] Error checking repo availability for ${owner}/${name}:`, error);
      return false;
    }
  }
}