// src/services/template-fetcher.ts - Web-friendly template fetcher using REST APIs
import type { ProjectTemplate } from '../types/template';

export class TemplateFetcher {
  private token?: string;
  private registryUrl: string;

  constructor(githubToken?: string, registryUrl?: string) {
    this.token = githubToken;
    this.registryUrl = registryUrl || 
      process.env.TEMPLATE_REGISTRY_URL || 
      'https://raw.githubusercontent.com/mxn2020/geenius/main/registry/main/template-registry.json';
  }

  async fetchTemplateRegistry(): Promise<any> {
    const response = await fetch(this.registryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template registry: ${response.statusText}`);
    }
    return await response.json();
  }


  async getTemplateInfo(repoUrl: string): Promise<{
    name: string;
    description: string;
    lastUpdated: string;
    stars: number;
    forks: number;
    openIssues: number;
  }> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        name: data.name,
        description: data.description || '',
        lastUpdated: data.updated_at,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count
      };
    } catch (error) {
      // Return default info if API call fails
      return {
        name: repo,
        description: 'Template repository',
        lastUpdated: new Date().toISOString(),
        stars: 0,
        forks: 0,
        openIssues: 0
      };
    }
  }

  async validateTemplate(repoUrl: string): Promise<{
    valid: boolean;
    issues: string[];
    score: number;
  }> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const issues: string[] = [];
    let score = 100;

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      // Check if repo exists and is accessible
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers
      });

      if (!repoResponse.ok) {
        issues.push('Repository not found or not accessible');
        return { valid: false, issues, score: 0 };
      }

      // Check required files
      const requiredFiles = [
        'package.json',
        'README.md',
        '.env.example',
        'tsconfig.json'
      ];

      for (const file of requiredFiles) {
        try {
          const fileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file}`, {
            headers
          });

          if (!fileResponse.ok) {
            issues.push(`Missing required file: ${file}`);
            score -= 20;
          }
        } catch (error) {
          issues.push(`Missing required file: ${file}`);
          score -= 20;
        }
      }

      // Check package.json structure
      try {
        const packageResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
          headers
        });

        if (packageResponse.ok) {
          const packageData = await packageResponse.json();
          
          if (packageData.content) {
            const packageJson = JSON.parse(
              atob(packageData.content.replace(/\s/g, ''))
            );

            if (!packageJson.scripts?.dev) {
              issues.push('Missing dev script in package.json');
              score -= 10;
            }
            if (!packageJson.scripts?.build) {
              issues.push('Missing build script in package.json');
              score -= 10;
            }
            if (!packageJson.scripts?.test) {
              issues.push('Missing test script in package.json');
              score -= 10;
            }
          }
        }
      } catch (error) {
        issues.push('Cannot parse package.json');
        score -= 30;
      }

      return {
        valid: score >= 60,
        issues,
        score
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      return {
        valid: false,
        issues: [`Validation error: ${errorMessage}`],
        score: 0
      };
    }
  }

  async getTemplateReadme(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/README.md`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          return atob(data.content.replace(/\s/g, ''));
        }
      }
    } catch (error) {
      console.warn('Failed to fetch README:', error);
    }
    
    return '';
  }

  async searchTemplates(query: string, filters: {
    stack?: string[];
    aiProvider?: string;
    difficulty?: string;
    tags?: string[];
  } = {}): Promise<ProjectTemplate[]> {
    const registry = await this.fetchTemplateRegistry();
    let templates = registry.templates;

    // Apply filters
    if (filters.stack?.length) {
      templates = templates.filter((t: any) => 
        filters.stack!.some((stack: string) => t.stack.includes(stack))
      );
    }

    if (filters.aiProvider) {
      templates = templates.filter((t: any) => t.aiProvider === filters.aiProvider);
    }

    if (filters.difficulty) {
      templates = templates.filter((t: any) => t.difficulty === filters.difficulty);
    }

    if (filters.tags?.length) {
      templates = templates.filter((t: any) => 
        filters.tags!.some((tag: string) => t.tags.includes(tag))
      );
    }

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      templates = templates.filter((t: any) => 
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm) ||
        t.stack.some((s: any) => s.toLowerCase().includes(searchTerm)) ||
        t.tags.some((tag: any) => tag.toLowerCase().includes(searchTerm))
      );
    }

    return templates;
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
}