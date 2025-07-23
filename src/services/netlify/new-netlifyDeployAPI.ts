import { NetlifyAPI } from './netlify-api-enhanced';

interface BaseDeploymentConfig {
  name: string;
  repoUrl: string;
  branch?: string;
  buildCommand?: string;
  publishDirectory?: string;
  functionsDirectory?: string;
  baseDirectory?: string;
  accountSlug?: string;
  deployKeyId?: string;
}

interface DeploymentConfig extends BaseDeploymentConfig {
  environmentVariables?: Array<{
    key: string;
    value: string;
    context?: 'all' | 'production' | 'deploy-preview' | 'branch-deploy' | 'dev';
    scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
    isSecret?: boolean;
  }>;
}

interface ContextualDeploymentConfig extends BaseDeploymentConfig {
  environmentVariables?: Array<{
    key: string;
    productionValue?: string;
    stagingValue?: string;
    previewValue?: string;
    devValue?: string;
    scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
    isSecret?: boolean;
  }>;
}

export class NetlifyGitHubDeployer {
  private api: NetlifyAPI;

  constructor(token: string) {
    this.api = new NetlifyAPI(token);
  }

  /**
   * Deploy a GitHub repository with environment variables
   * This uses the modern 2-step approach: create site, then set environment variables
   */
  async deployRepoWithEnvs(config: DeploymentConfig): Promise<{
    site: any;
    envVars: any[];
    deployKey?: any;
  }> {
    let deployKey;
    
    try {
      // Step 1: Create deploy key if needed (for private repos)
      if (config.deployKeyId) {
        console.log('Using existing deploy key:', config.deployKeyId);
      } else {
        console.log('Creating new deploy key...');
        deployKey = await this.api.createDeployKey();
        console.log('Deploy key created:', deployKey.id);
      }

      // Step 2: Create the site with repository configuration
      console.log('Creating site...');
      const sitePayload = {
        name: config.name,
        repo: {
          provider: 'github',
          repo_path: this.extractRepoPath(config.repoUrl),
          repo_branch: config.branch || 'main',
          cmd: config.buildCommand || '',
          dir: config.publishDirectory || '',
          functions_dir: config.functionsDirectory || '',
          base: config.baseDirectory || '',
          deploy_key_id: config.deployKeyId || deployKey?.id,
          private_logs: true,
          // NOTE: Do NOT include env here - it's deprecated
        },
        build_settings: {
          provider: 'github',
          repo_path: this.extractRepoPath(config.repoUrl),
          repo_branch: config.branch || 'main',
          cmd: config.buildCommand || '',
          dir: config.publishDirectory || '',
          functions_dir: config.functionsDirectory || '',
          base: config.baseDirectory || '',
          deploy_key_id: config.deployKeyId || deployKey?.id,
          // NOTE: Do NOT include env here - it's deprecated
        }
      };

      let site;
      if (config.accountSlug) {
        site = await this.api.createSiteInTeam({
          accountSlug: config.accountSlug,
          body: sitePayload
        });
      } else {
        site = await this.api.createSite({ body: sitePayload });
      }

      console.log('Site created:', site.id, site.url);

      // Step 3: Set environment variables using the new API
      let envVars = [];
      if (config.environmentVariables && config.environmentVariables.length > 0) {
        console.log('Setting environment variables...');
        
        // Get account ID (required for new env vars API)
        const accounts = await this.api.listAccountsForUser();
        const accountId = config.accountSlug 
          ? accounts.find(acc => acc.slug === config.accountSlug)?.id
          : accounts[0]?.id;

        if (!accountId) {
          throw new Error('Could not find account ID for environment variables');
        }

        // Transform environment variables to the new API format
        const envVarsPayload = config.environmentVariables.map(envVar => ({
          key: envVar.key,
          scopes: envVar.scopes || ['builds', 'functions'],
          values: [{
            value: envVar.value,
            context: envVar.context || 'all'
          }],
          is_secret: envVar.isSecret || false
        }));

        envVars = await this.api.createEnvVars({
          accountId: accountId,
          siteId: site.id,
          body: envVarsPayload
        });

        console.log(`Set ${envVars.length} environment variables`);
      }

      // Step 4: Trigger initial build
      console.log('Triggering initial build...');
      const deployment = await this.api.triggerSiteBuild({
        siteId: site.id,
        body: { clear_cache: true }
      });

      console.log('Initial build triggered:', deployment.id);

      return {
        site,
        envVars,
        deployKey,
        deployment
      };

    } catch (error) {
      console.error('Deployment failed:', error);
      throw error;
    }
  }

  /**
   * Update environment variables for an existing site
   */
  async updateSiteEnvVars(siteId: string, envVars: Array<{
    key: string;
    value: string;
    context?: 'all' | 'production' | 'deploy-preview' | 'branch-deploy' | 'dev';
    scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
    isSecret?: boolean;
  }>): Promise<any[]> {
    // Get the site to find the account
    const site = await this.api.getSite({ siteId });
    
    const envVarsPayload = envVars.map(envVar => ({
      key: envVar.key,
      scopes: envVar.scopes || ['builds', 'functions'],
      values: [{
        value: envVar.value,
        context: envVar.context || 'all'
      }],
      is_secret: envVar.isSecret || false
    }));

    return await this.api.createEnvVars({
      accountId: site.account_id,
      siteId: siteId,
      body: envVarsPayload
    });
  }

  /**
   * Deploy with different environment variables for different contexts
   */
  async deployWithContextualEnvs(config: ContextualDeploymentConfig): Promise<any> {
    // Transform contextual env vars to the new format
    const transformedEnvVars: Array<{
      key: string;
      value: string;
      context?: 'all' | 'production' | 'deploy-preview' | 'branch-deploy' | 'dev';
      scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
      isSecret?: boolean;
    }> = [];

    if (config.environmentVariables) {
      for (const envVar of config.environmentVariables) {
        // Create separate entries for each context
        if (envVar.productionValue) {
          transformedEnvVars.push({
            key: envVar.key,
            value: envVar.productionValue,
            context: 'production',
            scopes: envVar.scopes || ['builds', 'functions'],
            isSecret: envVar.isSecret || false
          });
        }
        
        if (envVar.previewValue) {
          transformedEnvVars.push({
            key: envVar.key,
            value: envVar.previewValue,
            context: 'deploy-preview',
            scopes: envVar.scopes || ['builds', 'functions'],
            isSecret: envVar.isSecret || false
          });
        }
        
        if (envVar.stagingValue) {
          transformedEnvVars.push({
            key: envVar.key,
            value: envVar.stagingValue,
            context: 'branch-deploy',
            scopes: envVar.scopes || ['builds', 'functions'],
            isSecret: envVar.isSecret || false
          });
        }
        
        if (envVar.devValue) {
          transformedEnvVars.push({
            key: envVar.key,
            value: envVar.devValue,
            context: 'dev',
            scopes: envVar.scopes || ['builds', 'functions'],
            isSecret: envVar.isSecret || false
          });
        }
      }
    }

    // Use the regular deployment method with transformed env vars
    const deploymentConfig: DeploymentConfig = {
      ...config,
      environmentVariables: transformedEnvVars
    };

    return await this.deployRepoWithEnvs(deploymentConfig);
  }

  /**
   * Bulk import environment variables from a .env file format
   */
  async importEnvFile(siteId: string, envFileContent: string, options?: {
    context?: 'all' | 'production' | 'deploy-preview' | 'branch-deploy' | 'dev';
    scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
    markAsSecret?: boolean;
  }): Promise<any[]> {
    // Parse .env file content
    const envVars = this.parseEnvFile(envFileContent);
    
    // Get the site to find the account
    const site = await this.api.getSite({ siteId });
    
    const envVarsPayload = envVars.map(({ key, value }) => ({
      key,
      scopes: options?.scopes || ['builds', 'functions'],
      values: [{
        value,
        context: options?.context || 'all'
      }],
      is_secret: options?.markAsSecret || false
    }));

    return await this.api.createEnvVars({
      accountId: site.account_id,
      siteId: siteId,
      body: envVarsPayload
    });
  }

  /**
   * Helper method to extract repository path from URL
   */
  private extractRepoPath(repoUrl: string): string {
    // Handle different GitHub URL formats
    const githubUrlPattern = /github\.com[\/:]([^\/]+\/[^\/]+?)(?:\.git)?(?:\/.*)?$/;
    const match = repoUrl.match(githubUrlPattern);
    
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    
    return match[1];
  }

  /**
   * Helper method to parse .env file content
   */
  private parseEnvFile(content: string): Array<{ key: string; value: string }> {
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        
        return { key: key.trim(), value: cleanValue };
      })
      .filter(({ key, value }) => key && value);
  }
}

// Example usage
export async function exampleDeployment() {
  const deployer = new NetlifyGitHubDeployer('your-netlify-token');

  try {
    // Simple deployment with environment variables
    const result = await deployer.deployRepoWithEnvs({
      name: 'my-awesome-app',
      repoUrl: 'https://github.com/username/my-repo',
      branch: 'main',
      buildCommand: 'npm run build',
      publishDirectory: 'dist',
      functionsDirectory: 'netlify/functions',
      accountSlug: 'my-team',
      environmentVariables: [
        {
          key: 'API_KEY',
          value: 'your-api-key',
          context: 'production',
          scopes: ['functions'],
          isSecret: true
        },
        {
          key: 'DATABASE_URL',
          value: 'postgresql://...',
          context: 'all',
          scopes: ['builds', 'functions'],
          isSecret: true
        },
        {
          key: 'NODE_ENV',
          value: 'production',
          context: 'production',
          scopes: ['builds']
        }
      ]
    });

    console.log('Deployment successful!');
    console.log('Site URL:', result.site.url);
    console.log('Admin URL:', result.site.admin_url);
    
    return result;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

// Example with contextual environment variables
export async function exampleContextualDeployment() {
  const deployer = new NetlifyGitHubDeployer('your-netlify-token');

  const result = await deployer.deployWithContextualEnvs({
    name: 'my-app-with-contexts',
    repoUrl: 'https://github.com/username/my-repo',
    environmentVariables: [
      {
        key: 'API_URL',
        productionValue: 'https://api.myapp.com',
        previewValue: 'https://staging-api.myapp.com',
        devValue: 'http://localhost:3001',
        scopes: ['builds', 'functions'],
        isSecret: false
      },
      {
        key: 'DATABASE_URL',
        productionValue: 'postgresql://prod-db...',
        previewValue: 'postgresql://staging-db...',
        devValue: 'postgresql://local-db...',
        scopes: ['functions'],
        isSecret: true
      }
    ]
  });

  return result;
}

// Example importing from .env file
export async function exampleEnvFileImport() {
  const deployer = new NetlifyGitHubDeployer('your-netlify-token');

  const envFileContent = `
# Production environment variables
API_KEY=your-production-api-key
DATABASE_URL=postgresql://prod-db...
REDIS_URL=redis://prod-redis...
NODE_ENV=production
  `;

  await deployer.importEnvFile('site-id', envFileContent, {
    context: 'production',
    scopes: ['builds', 'functions'],
    markAsSecret: true
  });
}