// src/sservices/netlify.ts
import { NetlifyAPI } from './netlify/netlifyAPI';

export class NetlifyService {
  private client: NetlifyAPI | null = null;

  constructor() {
    // Don't initialize client in constructor to avoid import issues
    this.client = null;
  }

  private async getClient(): Promise<NetlifyAPI> {
    if (!this.client) {
      if (!process.env.NETLIFY_TOKEN) {
        throw new Error('NETLIFY_TOKEN environment variable is required for Netlify integration.');
      }
      // Use our custom NetlifyAPI implementation instead of the problematic import
      this.client = new NetlifyAPI(process.env.NETLIFY_TOKEN);
    }
    return this.client;
  }

  /**
   * Update environment variables for a site
   */
  async updateEnvironmentVariables(siteId: string, accountId: string, envVars: Record<string, string>): Promise<void> {
    try {
      const client = await this.getClient();
      
      // Convert envVars to Netlify format
      const netlifyEnvVars = Object.entries(envVars).map(([key, value]) => ({
        key,
        values: [{ context: 'all' as const, value }]
      }));

      await client.createEnvVars({
        accountId,
        siteId,
        body: netlifyEnvVars
      });
    } catch (error: any) {
      console.error(`Failed to update environment variables for site ${siteId}:`, error.message);
      throw error;
    }
  }

  async validateCredentials(onProgress?: (message: string) => void): Promise<{ valid: boolean; error?: string }> {
    try {
      if (onProgress) onProgress('🔍 Validating Netlify credentials...');
      console.log('🔍 Validating Netlify credentials...');

      const client = await this.getClient();
      const sites = await client.listSites({ per_page: 1 });

      console.log(`Found ${sites.length} sites`);
      console.log('✅ Netlify credentials are valid');
      if (onProgress) onProgress('✅ Netlify credentials are valid');
      
      return { valid: true };
    } catch (error: any) {
      console.error('❌ Netlify credentials validation failed:', error.message);
      if (onProgress) onProgress(`❌ Validation failed: ${error.message}`);
      
      if (error.status === 401) {
        return { valid: false, error: 'Invalid Netlify token - check your NETLIFY_TOKEN' };
      } else if (error.status === 403) {
        return { valid: false, error: 'Netlify token access forbidden - check permissions' };
      } else {
        return { valid: false, error: `Netlify API error: ${error.status || 'Unknown'} ${error.message}` };
      }
    }
  }

  async createProject(name: string, repoUrl: string, teamSlug?: string, envVars?: Record<string, string>, onProgress?: (message: string) => void) {
    const availableName = await this.findAvailableNetlifyName(name, onProgress);
    console.log(`🚀 Creating Netlify project: ${availableName}`);
    console.log(`   Repository URL: ${repoUrl}`);
    if (onProgress) onProgress(`🚀 Creating Netlify project: ${availableName}`);

    // Parse the GitHub URL to get owner/repo format
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      const errorMsg = `Invalid GitHub repository URL: ${repoUrl}`;
      console.error(`❌ ${errorMsg}`);
      if (onProgress) onProgress(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const [, owner, repo] = repoMatch;
    const repoPath = `${owner}/${repo.replace(/\.git$/, '')}`; // Remove .git suffix if present
    console.log(`   Parsed repo path: ${repoPath}`);
    console.log(`   GitHub token configured: ${!!process.env.GITHUB_TOKEN}`);

    try {
      // Step 1: Get GitHub repository ID
      if (onProgress) onProgress('🔍 Connecting to GitHub repository...');
      console.log(`🔍 Getting GitHub repository ID...`);
      const repoId = await this.getGitHubRepoId(owner, repo, onProgress);
      console.log(`   ✅ Repository ID: ${repoId}`);

      // Step 2: Create deploy key
      if (onProgress) onProgress('🔑 Creating Netlify deploy key...');
      console.log(`🔑 Creating Netlify deploy key...`);
      const client = await this.getClient();
      const deployKey = await client.createDeployKey();
      console.log(`   ✅ Deploy key created: ${deployKey.id}`);

      // Step 3: Add deploy key to GitHub repository
      if (onProgress) onProgress('🔗 Configuring GitHub repository access...');
      console.log(`🔗 Adding deploy key to GitHub repository...`);
      await this.addDeployKeyToGitHub(owner, repo, deployKey.public_key!, `Netlify Deploy Key - ${availableName}`, onProgress);
      console.log(`   ✅ Deploy key added to GitHub repository`);

      // Step 4: Create site with repository connection
      if (onProgress) onProgress('🏗️ Creating Netlify site and build configuration...');
      const siteData: any = {
        name: availableName,
        repo: {
          provider: 'github',
          deploy_key_id: deployKey.id,
          repo_path: repoPath,
          repo_branch: 'main',
          dir: 'dist',
          functions_dir: 'api',
          cmd: 'pnpm build',
          allowed_branches: ['main'],
          public_repo: true,
          repo_url: repoUrl
        }
      };

      // Add environment variables if provided
      if (envVars && Object.keys(envVars).length > 0) {
        siteData.build_settings = {
          env: envVars
        };
        console.log(`   🔧 Setting ${Object.keys(envVars).length} environment variables during site creation`);
        if (onProgress) onProgress(`🔧 Configuring ${Object.keys(envVars).length} environment variables...`);
      }

      // If teamSlug is provided, create site in team
      let site;
      if (teamSlug) {
        console.log(`   🏢 Creating site in team: ${teamSlug}`);
        site = await client.createSiteInTeam({
          accountSlug: teamSlug,
          body: siteData
        });
      } else {
        site = await client.createSite({
          body: siteData
        });
      }

      console.log(`✅ Successfully created Netlify site: ${site.name}`);
      console.log(`   Site ID: ${site.id}`);
      console.log(`   Site URL: ${site.url}`);
      console.log(`   SSL URL: ${site.ssl_url}`);
      console.log(`   Admin URL: ${site.admin_url}`);
      if (onProgress) onProgress(`✅ Netlify site created: ${site.ssl_url || site.url}`);

      // Step 5: Set environment variables using the dedicated API (more reliable than build_settings)
      if (envVars && Object.keys(envVars).length > 0) {
        try {
          if (onProgress) onProgress('🔧 Setting environment variables...');
          console.log(`🔧 Setting ${Object.keys(envVars).length} environment variables...`);
          
          // Convert envVars to Netlify format
          const netlifyEnvVars = Object.entries(envVars).map(([key, value]) => ({
            key,
            values: [{ context: 'all' as const, value }]
          }));

          await client.createEnvVars({
            accountId: site.account_id,
            siteId: site.id,
            body: netlifyEnvVars
          });

          console.log(`   ✅ Successfully set ${Object.keys(envVars).length} environment variables`);
          if (onProgress) onProgress(`✅ Environment variables configured`);
        } catch (envError: any) {
          console.warn(`⚠️ Failed to set environment variables: ${envError.message}`);
          if (onProgress) onProgress(`⚠️ Environment variable setup failed: ${envError.message}`);
          // Don't throw here - site creation was successful, just env vars failed
        }
      }

      return site;
    } catch (error: any) {
      console.error('❌ Error creating Netlify site:', error);
      if (onProgress) onProgress(`❌ Site creation failed: ${error.message}`);

      // Handle specific error cases with better error messages
      if (error.status === 422 && (error.json?.errors?.name || error.json?.errors?.subdomain)) {
        return await this.handleNameValidationError(error, name, repoUrl, repoPath, teamSlug, envVars, onProgress);
      }

      // Handle repository connection errors
      if (error.status === 404 || error.message?.includes('repository')) {
        throw new Error(`Repository not found or not accessible: ${repoUrl}. Make sure the repository exists and is public.`);
      }

      // Handle authentication errors
      if (error.status === 401) {
        throw new Error('Netlify authentication failed. Please check your NETLIFY_TOKEN.');
      }

      // Handle validation errors with more details
      if (error.status === 422) {
        const errorDetails = error.json?.errors || {};
        const errorMessages = Object.entries(errorDetails).map(([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
        ).join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      throw new Error(`Failed to create Netlify site: ${error.message || 'Unknown error'}`);
    }
  }

  private async handleNameValidationError(
    error: any, 
    name: string, 
    repoUrl: string, 
    repoPath: string, 
    teamSlug?: string, 
    envVars?: Record<string, string>,
    onProgress?: (message: string) => void
  ): Promise<any> {
    const errorDetails = error.json?.errors || {};
    const subdomainErrors = errorDetails.subdomain || [];
    const nameErrors = errorDetails.name || [];

    console.log(`❌ Site name validation failed:`);
    if (subdomainErrors.length > 0) {
      console.log(`   Subdomain errors: ${subdomainErrors.join(', ')}`);
    }
    if (nameErrors.length > 0) {
      console.log(`   Name errors: ${nameErrors.join(', ')}`);
    }

    if (onProgress) onProgress('🔄 Retrying with unique name...');
    console.log(`🔄 Attempting to create site with timestamp fallback...`);

    // If our name detection failed, try with a timestamp fallback
    const timestamp = Date.now().toString(36);
    const fallbackName = `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${timestamp}`;

    try {
      // Get repo info for fallback attempt
      const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) throw new Error('Invalid repository URL');
      
      const [, owner, repo] = repoMatch;
      const repoId = await this.getGitHubRepoId(owner, repo, onProgress);
      const fallbackClient = await this.getClient();
      const deployKey = await fallbackClient.createDeployKey();
      await this.addDeployKeyToGitHub(owner, repo, deployKey.public_key!, `Netlify Deploy Key - ${fallbackName}`, onProgress);

      const fallbackSiteData: any = {
        name: fallbackName,
        repo: {
          provider: 'github',
          deploy_key_id: deployKey.id,
          repo_path: repoPath,
          repo_branch: 'main',
          dir: 'dist',
          functions_dir: 'api',
          cmd: 'pnpm build',
          allowed_branches: ['main'],
          public_repo: true,
          repo_url: repoUrl
        }
      };

      // Add environment variables to fallback site if provided
      if (envVars && Object.keys(envVars).length > 0) {
        fallbackSiteData.build_settings = {
          env: envVars
        };
        if (onProgress) onProgress('🔧 Re-configuring environment variables...');
      }

      let fallbackSite;
      if (teamSlug) {
        fallbackSite = await fallbackClient.createSiteInTeam({
          accountSlug: teamSlug,
          body: fallbackSiteData
        });
      } else {
        fallbackSite = await fallbackClient.createSite({
          body: fallbackSiteData
        });
      }

      console.log(`✅ Successfully created Netlify site with fallback name: ${fallbackSite.name}`);
      if (onProgress) onProgress(`✅ Site created with unique name: ${fallbackSite.name}`);

      // Set environment variables for fallback site using the dedicated API
      if (envVars && Object.keys(envVars).length > 0) {
        try {
          if (onProgress) onProgress('🔧 Setting environment variables for fallback site...');
          console.log(`🔧 Setting ${Object.keys(envVars).length} environment variables for fallback site...`);
          
          const netlifyEnvVars = Object.entries(envVars).map(([key, value]) => ({
            key,
            values: [{ context: 'all' as const, value }]
          }));

          await fallbackClient.createEnvVars({
            accountId: fallbackSite.account_id,
            siteId: fallbackSite.id,
            body: netlifyEnvVars
          });

          console.log(`   ✅ Successfully set ${Object.keys(envVars).length} environment variables for fallback site`);
          if (onProgress) onProgress(`✅ Environment variables configured for fallback site`);
        } catch (envError: any) {
          console.warn(`⚠️ Failed to set environment variables for fallback site: ${envError.message}`);
          if (onProgress) onProgress(`⚠️ Fallback site environment variable setup failed: ${envError.message}`);
        }
      }

      return fallbackSite;
    } catch (fallbackError: any) {
      console.error('❌ Fallback site creation also failed:', fallbackError);
      if (onProgress) onProgress(`❌ Fallback creation failed: ${fallbackError.message}`);

      // Provide more specific error information for the fallback failure
      if (fallbackError.status === 422) {
        const fallbackErrorDetails = fallbackError.json?.errors || {};
        console.error('   Fallback validation errors:', JSON.stringify(fallbackErrorDetails, null, 2));
      }

      throw new Error(`Failed to create Netlify site even with fallback name. Original error: ${error.message}. Fallback error: ${fallbackError.message}`);
    }
  }

  private async getGitHubRepoId(owner: string, repo: string, onProgress?: (message: string) => void): Promise<number> {
    try {
      if (onProgress) onProgress(`🔍 Accessing GitHub repository ${owner}/${repo}...`);
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Netlify-Setup-Tool'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
        } else if (response.status === 401) {
          throw new Error('GitHub authentication failed - check your GITHUB_TOKEN');
        } else if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded or insufficient permissions');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repoData = await response.json();
      if (onProgress) onProgress(`✅ Repository found: ${repoData.full_name}`);
      return repoData.id;
    } catch (error: any) {
      console.error('❌ Error fetching GitHub repository ID:', error.message);
      if (onProgress) onProgress(`❌ GitHub error: ${error.message}`);
      throw new Error(`Failed to get repository ID: ${error.message}`);
    }
  }

  private async addDeployKeyToGitHub(owner: string, repo: string, publicKey: string, title: string, onProgress?: (message: string) => void): Promise<void> {
    try {
      if (onProgress) onProgress('🔑 Adding deploy key to GitHub...');
      
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Netlify-Setup-Tool'
        },
        body: JSON.stringify({
          title,
          key: publicKey,
          read_only: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 422 && errorData.errors?.some((e: any) => e.message?.includes('key is already in use'))) {
          console.log('   ✅ Deploy key already exists, continuing...');
          if (onProgress) onProgress('✅ Deploy key already configured');
          return;
        }

        if (response.status === 404) {
          throw new Error(`Repository ${owner}/${repo} not found or insufficient permissions`);
        } else if (response.status === 401) {
          throw new Error('GitHub authentication failed - check your GITHUB_TOKEN permissions');
        }

        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      console.log('   ✅ Deploy key successfully added to GitHub');
      if (onProgress) onProgress('✅ Deploy key configured successfully');
    } catch (error: any) {
      console.error('❌ Error adding deploy key to GitHub:', error.message);
      if (onProgress) onProgress(`❌ Deploy key error: ${error.message}`);
      throw new Error(`Failed to add deploy key to GitHub: ${error.message}`);
    }
  }

  async setupEnvironmentVariables(siteId: string, variables: Record<string, string>, onProgress?: (message: string) => void): Promise<Record<string, string>> {
    try {
      console.log(`🔧 Setting up environment variables for site ${siteId}`);
      if (onProgress) onProgress('🔧 Configuring environment variables...');

      const client = await this.getClient();
      // Get the site to find the account ID and site details
      const site = await client.getSite({ siteId });
      const accountId = site.account_id;

      if (!accountId) {
        throw new Error('Could not determine account ID for environment variables');
      }

      // Get existing environment variables first to preserve them
      let existingVars: Record<string, string> = {};
      try {
        const existingEnvVars = await client.getEnvVars({ accountId, siteId });
        existingVars = Object.fromEntries(
          existingEnvVars.map(envVar => [
            envVar.key, 
            envVar.values?.[0]?.value || ''
          ])
        );
        console.log(`🔍 Found ${existingEnvVars.length} existing environment variables to preserve`);
      } catch (error: any) {
        console.log(`⚠️ Could not fetch existing environment variables: ${error.message}`);
        // Continue anyway, we'll just set the new variables
      }

      // Add Netlify-specific environment variables
      const siteUrl = site.ssl_url || site.url || `https://${site.name}.netlify.app`;
      const netlifyVars = {
        NETLIFY_FUNCTIONS_URL: `${siteUrl}/api`,
        NETLIFY_SITE_ID: siteId,
        NETLIFY_SITE_URL: siteUrl,
        NETLIFY_SITE_NAME: site.name,
        VITE_API_URL: `${siteUrl}/api`,
        NODE_ENV: 'production'
      };

      // Merge existing variables + provided variables + netlify variables
      // Order: existing vars first, then provided vars (can override), then netlify vars (system overrides)
      const allVariables = { ...existingVars, ...variables, ...netlifyVars };

      // Convert variables to the format expected by the API, filtering out empty values
      const envVars = Object.entries(allVariables)
        .filter(([key, value]) => value && value.trim() !== '')
        .map(([key, value]) => ({
          key,
          values: [{
            value: String(value),
            context: 'all' as const
          }]
        }));

      if (onProgress) onProgress(`🔧 Setting ${envVars.length} environment variables...`);

      // Create environment variables
      await client.createEnvVars({
        accountId,
        siteId,
        body: envVars
      });

      console.log(`✅ Environment variables configured successfully (${envVars.length} variables)`);
      console.log(`🔍 Variables preserved from existing: ${Object.keys(existingVars).length}`);
      console.log(`🔍 Variables added/updated: ${Object.keys(variables).length}`);
      console.log(`🔍 System variables added: ${Object.keys(netlifyVars).length}`);
      if (onProgress) onProgress(`✅ Environment variables configured (${envVars.length} variables)`);

      return netlifyVars;
    } catch (error: any) {
      console.warn('⚠️  Environment variables setup failed:', error.message);
      if (onProgress) onProgress(`⚠️ Environment setup failed: ${error.message}`);
      
      console.log('You can set these environment variables manually in the Netlify dashboard:');

      for (const [key, value] of Object.entries(variables)) {
        console.log(`  - ${key}=${value ? '[CONFIGURED]' : '[EMPTY - SET MANUALLY]'}`);
      }

      console.log(`Visit: https://app.netlify.com/sites/${siteId}/settings/deploys#environment-variables`);
      return {};
    }
  }

  // Alias for compatibility with CLI version
  async setEnvironmentVariables(siteId: string, variables: Record<string, string>, onProgress?: (message: string) => void): Promise<Record<string, string>> {
    return this.setupEnvironmentVariables(siteId, variables, onProgress);
  }

  async configureBranchDeployments(siteId: string, config: Record<string, any>, onProgress?: (message: string) => void): Promise<void> {
    try {
      console.log(`🔧 Configuring branch deployments for site ${siteId}`);
      if (onProgress) onProgress('🔧 Configuring branch deployments...');

      const client = await this.getClient();
      // Get current site settings
      const site = await client.getSite({ siteId });

      // Configure branch deploy settings with PR previews enabled
      const updateData: any = {
        build_settings: {
          ...site.build_settings,
          repo_branch: site.build_settings?.repo_branch || 'main'
        },
        // Enable deploy previews for pull requests
        deploy_preview_settings: {
          deploy_previews: true,
          branch_deploys: true
        }
      };

      // Set up branch-specific configurations
      for (const [branch, branchConfig] of Object.entries(config)) {
        if (branchConfig.production) {
          updateData.build_settings.repo_branch = branch;
          console.log(`   ✅ Set production branch to: ${branch}`);
          if (onProgress) onProgress(`✅ Production branch: ${branch}`);
        }
      }

      // Update site settings
      await client.updateSite({
        siteId,
        body: updateData
      });

      console.log('✅ Branch deployment configuration completed');
      console.log('✅ Pull request previews enabled');
      if (onProgress) onProgress('✅ Branch deployments and PR previews configured');

      // Also set up deploy notifications and webhook settings for better PR integration
      try {
        await this.configurePRSettings(siteId, onProgress);
      } catch (webhookError: any) {
        console.warn('⚠️ PR webhook configuration failed (not critical):', webhookError.message);
      }

    } catch (error: any) {
      console.warn('⚠️  Branch deployment configuration failed:', error.message);
      if (onProgress) onProgress(`⚠️ Branch config failed: ${error.message}`);
      console.log('You can configure branch deployments manually in the Netlify dashboard');
      console.log(`Visit: https://app.netlify.com/sites/${siteId}/settings/deploys`);
    }
  }

  private async configurePRSettings(siteId: string, onProgress?: (message: string) => void): Promise<void> {
    try {
      const client = await this.getClient();
      
      // Configure deploy settings to ensure PR previews work
      const deploySettings = {
        deploy_hook: null, // Let Netlify handle GitHub webhooks automatically
        allowed_branches: ['main'], // Only main branch for production
        context: {
          production: {
            publish_dir: 'dist',
            command: 'pnpm build'
          },
          'deploy-preview': {
            publish_dir: 'dist', 
            command: 'pnpm build'
          },
          'branch-deploy': {
            publish_dir: 'dist',
            command: 'pnpm build'
          }
        }
      };

      // Update deploy settings specifically for previews
      await client.updateSite({
        siteId,
        body: {
          build_settings: deploySettings
        }
      });

      console.log('✅ PR preview settings configured');
      if (onProgress) onProgress('✅ PR preview settings configured');
    } catch (error: any) {
      console.warn('PR settings configuration failed:', error.message);
      if (onProgress) onProgress(`⚠️ PR settings failed: ${error.message}`);
    }
  }

  async waitForInitialDeployment(siteId: string, timeout: number = 180000, onProgress?: (message: string) => void): Promise<any> {
    console.log(`⏳ Waiting for initial deployment to complete...`);
    if (onProgress) onProgress('🚀 Waiting for initial deployment to start...');
    
    const startTime = Date.now();
    const client = await this.getClient();
    let lastState = '';
    let deploymentStarted = false;

    while (Date.now() - startTime < timeout) {
      try {
        const deployments = await client.listSiteDeploys({ siteId });

        if (deployments.length === 0) {
          console.log(`   No deployments found yet, waiting...`);
          if (onProgress && !deploymentStarted) {
            onProgress('⏳ Waiting for build to initialize...');
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Get the latest deployment
        const latestDeployment = deployments[0];
        const currentState = latestDeployment.state;
        
        // Only log and notify on state changes to avoid spam
        if (currentState !== lastState) {
          console.log(`   Deployment state changed: ${lastState} → ${currentState}`);
          lastState = currentState;
          deploymentStarted = true;
          
          if (onProgress) {
            switch (currentState) {
              case 'new':
                onProgress('🔄 Build queued and starting...');
                break;
              case 'building':
                onProgress('🏗️ Building application (installing dependencies, compiling...)');
                break;
              case 'processing':
                onProgress('⚙️ Processing build artifacts...');
                break;
              case 'deploying':
                onProgress('🚀 Deploying to CDN...');
                break;
              case 'ready':
                onProgress('✅ Deployment completed successfully!');
                break;
              case 'error':
                onProgress(`❌ Deployment failed: ${latestDeployment.error_message}`);
                break;
              default:
                onProgress(`🔄 Build status: ${currentState}`);
            }
          }
        }

        if (latestDeployment.state === 'ready') {
          console.log('✅ Initial deployment completed successfully!');
          return latestDeployment;
        }

        if (latestDeployment.state === 'error') {
          console.log(`❌ Initial deployment failed: ${latestDeployment.error_message}`);
          return latestDeployment;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error: any) {
        console.error('❌ Error checking deployment status:', error.message);
        if (onProgress) onProgress(`⚠️ Error checking deployment: ${error.message}`);
        throw new Error(`Failed to check deployment status: ${error.message}`);
      }
    }

    const timeoutMsg = 'Deployment timeout - deployment took longer than expected';
    console.error(`❌ ${timeoutMsg}`);
    if (onProgress) onProgress(`❌ ${timeoutMsg}`);
    throw new Error(timeoutMsg);
  }

  /**
   * Get detailed build logs using WebSocket connection
   */
  async getBuildLogs(siteId: string, deployId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const WebSocket = require('ws');
        const ws = new WebSocket(`wss://socketeer.services.netlify.com/build/logs`);
        let logs: string[] = [];
        
        console.log(`🔌 Connecting to Netlify WebSocket for deploy: ${deployId}`);
        
        ws.on('open', () => {
          console.log('✅ WebSocket connected, requesting logs...');
          ws.send(JSON.stringify({
            access_token: process.env.NETLIFY_TOKEN,
            deploy_id: deployId,
            site_id: siteId
          }));
        });
        
        ws.on('message', (data: any) => {
          try {
            const logEntry = JSON.parse(data.toString());
            if (logEntry.message) {
              logs.push(logEntry.message);
            }
          } catch (parseError) {
            console.warn('Failed to parse log entry:', data.toString());
          }
        });
        
        ws.on('close', () => {
          console.log(`🔒 WebSocket closed, retrieved ${logs.length} log entries`);
          resolve(logs.join('\n'));
        });
        
        ws.on('error', (error: any) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        });
        
        // Set a timeout to close the connection after 15 seconds
        setTimeout(() => {
          console.log('⏰ WebSocket timeout, closing connection...');
          ws.close();
        }, 15000);
        
      } catch (error: any) {
        console.error('❌ Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private async findAvailableNetlifyName(baseName: string, onProgress?: (message: string) => void): Promise<string> {
    const cleanName = baseName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    console.log(`🔍 Generating unique Netlify name from: ${cleanName}`);
    if (onProgress) onProgress('🔍 Generating unique site name...');

    // Since checking global Netlify subdomain availability is complex and unreliable,
    // we'll use a timestamp-based approach to ensure uniqueness
    const timestamp = Date.now().toString(36);
    const uniqueName = `${cleanName}-${timestamp}`;

    console.log(`✅ Generated unique name: ${uniqueName}`);
    if (onProgress) onProgress(`✅ Site name: ${uniqueName}`);
    return uniqueName;
  }

  // Additional methods from CLI version with enhanced patterns

  async listSites(onProgress?: (message: string) => void): Promise<any[]> {
    try {
      if (onProgress) onProgress('📋 Fetching Netlify sites...');
      console.log('📋 Fetching Netlify sites...');

      const client = await this.getClient();
      const sites = await client.listSites();

      console.log(`✅ Found ${sites.length} Netlify sites`);
      if (onProgress) onProgress(`✅ Found ${sites.length} sites`);
      
      return sites;
    } catch (error: any) {
      console.error('❌ List sites error:', error.message);
      if (onProgress) onProgress(`❌ Error: ${error.message}`);
      
      if (error.status === 401) {
        throw new Error('Invalid Netlify token - check your NETLIFY_TOKEN');
      } else if (error.status === 403) {
        throw new Error('Netlify token access forbidden - check permissions');
      }
      
      throw new Error(`Failed to list sites: ${error.message}`);
    }
  }

  async getSite(siteId: string, onProgress?: (message: string) => void): Promise<any> {
    try {
      if (onProgress) onProgress(`🔍 Fetching site details: ${siteId}...`);
      console.log(`🔍 Fetching site details: ${siteId}`);

      const client = await this.getClient();
      const site = await client.getSite({ siteId });

      console.log(`✅ Site found: ${site.name} (${site.url})`);
      if (onProgress) onProgress(`✅ Site: ${site.name}`);
      
      return site;
    } catch (error: any) {
      console.error('❌ Get site error:', error.message);
      if (onProgress) onProgress(`❌ Error: ${error.message}`);
      
      if (error.status === 404) {
        throw new Error('Site not found - check site ID');
      } else if (error.status === 403) {
        throw new Error('Insufficient permissions to access this site');
      }
      
      throw new Error(`Failed to get site: ${error.message}`);
    }
  }

  async deleteSite(siteId: string, onProgress?: (message: string) => void): Promise<void> {
    try {
      if (onProgress) onProgress(`🗑️ Deleting Netlify site: ${siteId}...`);
      console.log(`🗑️ Deleting Netlify site: ${siteId}`);

      const client = await this.getClient();
      await client.deleteSite({ siteId });

      console.log('✅ Site deleted successfully');
      if (onProgress) onProgress('✅ Site deleted successfully');
    } catch (error: any) {
      console.error('❌ Delete site error:', error.message);
      if (onProgress) onProgress(`❌ Error: ${error.message}`);
      
      if (error.status === 404) {
        throw new Error('Site not found - it may have already been deleted');
      } else if (error.status === 403) {
        throw new Error('Insufficient permissions to delete this site');
      }
      
      throw new Error(`Failed to delete site: ${error.message}`);
    }
  }

  async waitForDeployment(siteId: string, deployId: string, onProgress?: (message: string) => void): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
  }> {
    try {
      if (onProgress) onProgress(`⏳ Waiting for deployment ${deployId}...`);
      console.log(`⏳ Waiting for deployment ${deployId} on site ${siteId}`);
      
      // Simulate deployment waiting with actual API calls
      const client = await this.getClient();
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      
      while (attempts < maxAttempts) {
        try {
          const deployment = await client.getDeploy({ deployId });
          
          if (deployment.state === 'ready') {
            const previewUrl = deployment.deploy_ssl_url || deployment.ssl_url || `https://${deployId}--${siteId}.netlify.app`;
            console.log(`✅ Deployment ready: ${previewUrl}`);
            if (onProgress) onProgress(`✅ Deployment ready: ${previewUrl}`);
            
            return {
              success: true,
              previewUrl
            };
          }
          
          if (deployment.state === 'error') {
            const errorMsg = deployment.error_message || 'Deployment failed';
            console.log(`❌ Deployment failed: ${errorMsg}`);
            if (onProgress) onProgress(`❌ Deployment failed: ${errorMsg}`);
            
            return {
              success: false,
              error: errorMsg
            };
          }
          
          // Still building
          if (onProgress) onProgress(`⏳ Building... (${deployment.state})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          
        } catch (deployError: any) {
          console.warn(`⚠️ Error checking deployment status: ${deployError.message}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
        }
      }
      
      // Timeout
      const timeoutMsg = `Deployment timeout after ${maxAttempts * 5} seconds`;
      return {
        success: false,
        error: timeoutMsg
      };
      
    } catch (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
      console.error('❌ Wait for deployment error:', errorMessage);
      if (onProgress) onProgress(`❌ Error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async triggerBuild(siteId: string, branch: string, onProgress?: (message: string) => void): Promise<string> {
    try {
      if (onProgress) onProgress(`🚀 Triggering build for ${branch} branch...`);
      console.log(`🚀 Triggering build for site ${siteId} on branch ${branch}`);

      const client = await this.getClient();
      const build = await client.createSiteDeploy({
        siteId,
        body: {
          branch: branch || 'main'
        }
      });

      const buildId = build.id || `build_${Date.now()}`;
      console.log(`✅ Build triggered: ${buildId}`);
      if (onProgress) onProgress(`✅ Build triggered: ${buildId}`);
      
      return buildId;
    } catch (error: any) {
      console.error('❌ Trigger build error:', error.message);
      if (onProgress) onProgress(`❌ Build trigger failed: ${error.message}`);
      throw new Error(`Failed to trigger build: ${error.message}`);
    }
  }

  async triggerRedeploy(siteId: string, onProgress?: (message: string) => void): Promise<string | null> {
    try {
      if (onProgress) onProgress('🔄 Triggering redeployment with updated code and environment variables...');
      console.log(`🔄 Triggering redeployment for site ${siteId}`);

      const client = await this.getClient();
      
      // Use createSiteBuild to trigger a new build (which creates a deployment)
      const build = await client.createSiteBuild({
        siteId,
        body: {
          clear_cache: false // Don't clear cache unless needed
        }
      });

      const buildId = build.id;
      console.log(`✅ Build triggered: ${buildId}`);
      if (onProgress) onProgress(`✅ Build triggered: ${buildId}`);

      // Wait a moment for the build to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (onProgress) onProgress('⏳ New build in progress - this will use updated code from repository');
      
      return buildId;
      
    } catch (error: any) {
      console.error('❌ Trigger redeploy error:', error.message);
      if (onProgress) onProgress(`⚠️ Failed to trigger redeployment: ${error.message}`);
      // Don't throw here - redeployment is nice-to-have, not critical
      return null;
    }
  }

  async waitForBranchDeployment(branchName: string, timeout: number = 300000, onProgress?: (message: string) => void): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    console.log(`⏳ Waiting for branch deployment: ${branchName}`);
    if (onProgress) onProgress(`⏳ Waiting for ${branchName} branch deployment...`);
    
    const startTime = Date.now();
    const checkInterval = 10000; // Check every 10 seconds

    try {
      // Get the site ID from environment or find it
      const siteId = await this.getCurrentSiteId(onProgress);
      if (!siteId) {
        return {
          success: false,
          error: 'Could not determine site ID for deployment check'
        };
      }

      while (Date.now() - startTime < timeout) {
        try {
          // Get deployments for the site
          const client = await this.getClient();
          const deployments = await client.listSiteDeploys({ siteId, branch: branchName });
          
          if (deployments.length === 0) {
            console.log(`   No deployments found for branch ${branchName}, waiting...`);
            if (onProgress) onProgress(`⏳ No deployments yet for ${branchName}...`);
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            continue;
          }

          // Find the most recent deployment for this branch
          const latestDeployment = deployments[0];
          console.log(`   Deployment state: ${latestDeployment.state} for branch ${branchName}`);

          if (latestDeployment.state === 'ready') {
            const deployUrl = latestDeployment.deploy_ssl_url || latestDeployment.ssl_url;
            console.log(`✅ Branch deployment ready: ${deployUrl}`);
            if (onProgress) onProgress(`✅ Branch deployment ready: ${deployUrl}`);
            
            return {
              success: true,
              url: deployUrl
            };
          }

          if (latestDeployment.state === 'error') {
            const errorMsg = latestDeployment.error_message || 'Deployment failed';
            console.log(`❌ Branch deployment failed: ${errorMsg}`);
            if (onProgress) onProgress(`❌ Branch deployment failed: ${errorMsg}`);
            
            return {
              success: false,
              error: errorMsg
            };
          }

          // Still building/processing, wait and check again
          if (onProgress) onProgress(`🔄 Branch building... (${latestDeployment.state})`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));

        } catch (deployError: any) {
          console.log(`   Error checking deployment: ${deployError.message}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }

      // Timeout reached
      const timeoutMsg = `Deployment timeout after ${timeout}ms - branch may still be deploying`;
      console.log(`❌ ${timeoutMsg}`);
      if (onProgress) onProgress(`❌ ${timeoutMsg}`);
      
      return {
        success: false,
        error: timeoutMsg
      };

    } catch (error: any) {
      console.error('❌ Error waiting for branch deployment:', error.message);
      if (onProgress) onProgress(`❌ Branch deployment error: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async getCurrentSiteId(onProgress?: (message: string) => void): Promise<string | null> {
    try {
      // Try to get site ID from environment variable
      if (process.env.NETLIFY_SITE_ID) {
        if (onProgress) onProgress(`🔍 Using site ID from environment`);
        return process.env.NETLIFY_SITE_ID;
      }

      // If not available, try to find it from existing sites
      if (onProgress) onProgress('🔍 Searching for current site...');
      console.log('🔍 Searching for current site ID...');
      
      const client = await this.getClient();
      const sites = await client.listSites();
      
      // Look for the current project site (you may need to adjust this logic)
      const currentSite = sites.find(site => 
        site.name && (
          site.name.includes('geenius')
          // Add more search criteria as needed
        )
      );

      if (currentSite && currentSite.id) {
        console.log(`✅ Found site: ${currentSite.name} (${currentSite.id})`);
        if (onProgress) onProgress(`✅ Found site: ${currentSite.name}`);
        return currentSite.id;
      }

      console.warn('⚠️ Could not determine site ID. Set NETLIFY_SITE_ID environment variable.');
      if (onProgress) onProgress('⚠️ Could not determine site ID');
      return null;

    } catch (error: any) {
      console.error('❌ Error getting site ID:', error.message);
      if (onProgress) onProgress(`❌ Site ID error: ${error.message}`);
      return null;
    }
  }
}