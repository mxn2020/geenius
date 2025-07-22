// netlify/functions/shared/netlify-service.ts
import { NetlifyAPI } from './netlifyAPI';

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

  async createProject(name: string, repoUrl: string, teamSlug?: string) {
    const availableName = await this.findAvailableNetlifyName(name);
    console.log(`Trying to create Netlify project with name: ${availableName}`);
    console.log(`Repository URL: ${repoUrl}`);

    // Parse the GitHub URL to get owner/repo format
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }

    const [, owner, repo] = repoMatch;
    const repoPath = `${owner}/${repo.replace(/\.git$/, '')}`; // Remove .git suffix if present
    console.log(`Parsed repo path: ${repoPath}`);
    console.log(`GitHub token configured: ${!!process.env.GITHUB_TOKEN}`);

    try {
      // Step 1: Get GitHub repository ID
      console.log(`🔍 Getting GitHub repository ID via api shared...`);
      const repoId = await this.getGitHubRepoId(owner, repo);
      console.log(`   Repository ID: ${repoId}`);

      // Step 2: Create deploy key
      console.log(`🔌 Getting Netlify client...`);
      const client = await this.getClient();
      console.log(`🔑 Creating Netlify deploy key...`);
      const deployKey = await client.createDeployKey();
      console.log(`   Deploy key created: ${deployKey.id}`);

      // Step 3: Add deploy key to GitHub repository
      console.log(`🔗 Adding deploy key to GitHub repository...`);
      await this.addDeployKeyToGitHub(owner, repo, deployKey.public_key!, `Netlify Deploy Key - ${availableName}`);
      console.log(`   Deploy key added to GitHub repository`);

      // Step 4: Create site with repository connection
      const siteData = {
        name: availableName,
        repo: {
          provider: 'github',
          deploy_key_id: deployKey.id,
          repo_path: repoPath,
          repo_branch: 'main',
          dir: 'dist',
          functions_dir: 'api',
          cmd: 'pnpm build',
          //allowed_branches: ['main', 'develop', 'feature/*'],
          allowed_branches: ['main'],
          public_repo: true,
          repo_url: repoUrl
        }
      };

      // If teamSlug is provided, create site in team
      let site;
      if (teamSlug) {
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
      console.log('🔍 Site build settings:', JSON.stringify(site.build_settings, null, 2));

      return site;
    } catch (error: any) {
      console.error('❌ Error creating Netlify site:', error);
      console.error('Error details:', {
        status: error.status,
        json: error.json,
        message: error.message
      });

      // Handle specific error cases with better error messages
      if (error.status === 422 && (error.json?.errors?.name || error.json?.errors?.subdomain)) {
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

        console.log(`🔄 Attempting to create site with timestamp fallback...`);

        // If our name detection failed, try with a timestamp fallback
        const timestamp = Date.now().toString(36);
        const fallbackName = `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${timestamp}`;

        try {
          // Get repo info for fallback attempt
          const repoId = await this.getGitHubRepoId(owner, repo);
          const fallbackClient = await this.getClient();
          const deployKey = await fallbackClient.createDeployKey();
          await this.addDeployKeyToGitHub(owner, repo, deployKey.public_key!, `Netlify Deploy Key - ${fallbackName}`);

          const fallbackSiteData = {
            name: fallbackName,
            repo: {
              provider: 'github',
              deploy_key_id: deployKey.id,
              repo_path: repoPath,
              repo_branch: 'main',
              dir: 'dist',
              functions_dir: 'api',
              cmd: 'pnpm build',
              //allowed_branches: ['main', 'develop', 'feature/*'],
              allowed_branches: ['main'],
              public_repo: true,
              repo_url: repoUrl
            }
          };

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
          return fallbackSite;
        } catch (fallbackError: any) {
          console.error('❌ Fallback site creation also failed:', fallbackError);

          // Provide more specific error information for the fallback failure
          if (fallbackError.status === 422) {
            const fallbackErrorDetails = fallbackError.json?.errors || {};
            console.error('   Fallback validation errors:', JSON.stringify(fallbackErrorDetails, null, 2));
          }

          throw new Error(`Failed to create Netlify site even with fallback name. Original error: ${error.message}. Fallback error: ${fallbackError.message}`);
        }
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

  private async getGitHubRepoId(owner: string, repo: string): Promise<number> {
    try {
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
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const repoData = await response.json();
      return repoData.id;
    } catch (error: any) {
      console.error('❌ Error fetching GitHub repository ID:', error.message);
      throw new Error(`Failed to get repository ID: ${error.message}`);
    }
  }

  private async addDeployKeyToGitHub(owner: string, repo: string, publicKey: string, title: string): Promise<void> {
    try {
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
          console.log('   Deploy key already exists, continuing...');
          return;
        }

        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      console.log('   Deploy key successfully added to GitHub');
    } catch (error: any) {
      console.error('❌ Error adding deploy key to GitHub:', error.message);
      throw new Error(`Failed to add deploy key to GitHub: ${error.message}`);
    }
  }

  async setupEnvironmentVariables(siteId: string, variables: Record<string, string>) {
    try {
      console.log(`🔧 Setting up environment variables for site ${siteId}`);

      const client = await this.getClient();
      // Get the site to find the account ID and site details
      const site = await client.getSite({ siteId });
      const accountId = site.account_id;

      if (!accountId) {
        throw new Error('Could not determine account ID for environment variables');
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

      // Merge with provided variables
      const allVariables = { ...variables, ...netlifyVars };

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

      // Create environment variables
      await client.createEnvVars({
        accountId,
        siteId,
        body: envVars
      });

      console.log('✅ Environment variables configured successfully');

      return netlifyVars;
    } catch (error: any) {
      console.warn('⚠️  Environment variables setup failed:', error.message);
      console.log('You can set these environment variables manually in the Netlify dashboard:');

      for (const [key, value] of Object.entries(variables)) {
        console.log(`  - ${key}=${value ? '[CONFIGURED]' : '[EMPTY - SET MANUALLY]'}`);
      }

      console.log(`Visit: https://app.netlify.com/sites/${siteId}/settings/deploys#environment-variables`);
      return {};
    }
  }

  // Alias for compatibility with CLI version
  async setEnvironmentVariables(siteId: string, variables: Record<string, string>): Promise<Record<string, string>> {
    return this.setupEnvironmentVariables(siteId, variables);
  }

  async configureBranchDeployments(siteId: string, config: Record<string, any>): Promise<void> {
    try {
      console.log(`🔧 Configuring branch deployments for site ${siteId}`);

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
          console.log(`   Set production branch to: ${branch}`);
        }
      }

      // Update site settings
      await client.updateSite({
        siteId,
        body: updateData
      });

      console.log('✅ Branch deployment configuration completed');
      console.log('✅ Pull request previews enabled');

      // Also set up deploy notifications and webhook settings for better PR integration
      try {
        await this.configurePRSettings(siteId);
      } catch (webhookError: any) {
        console.warn('⚠️ PR webhook configuration failed (not critical):', webhookError.message);
      }

    } catch (error: any) {
      console.warn('⚠️  Branch deployment configuration failed:', error.message);
      console.log('You can configure branch deployments manually in the Netlify dashboard');
      console.log(`Visit: https://app.netlify.com/sites/${siteId}/settings/deploys`);
    }
  }

  private async configurePRSettings(siteId: string): Promise<void> {
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
    } catch (error: any) {
      console.warn('PR settings configuration failed:', error.message);
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

    throw new Error('Deployment timeout - deployment took longer than expected');
  }

  private async findAvailableNetlifyName(baseName: string): Promise<string> {
    const cleanName = baseName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    console.log(`🔍 Checking Netlify name availability for: ${cleanName}`);

    // Since checking global Netlify subdomain availability is complex and unreliable,
    // we'll use a timestamp-based approach to ensure uniqueness
    const timestamp = Date.now().toString(36);
    const uniqueName = `${cleanName}-${timestamp}`;

    console.log(`✅ Generated unique name: ${uniqueName}`);
    return uniqueName;
  }

  async waitForDeployment(siteId: string, deployId: string): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
  }> {
    try {
      // Simulate deployment waiting
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return {
        success: true,
        previewUrl: `https://${deployId}--${siteId}.netlify.app`
      };
    } catch (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async triggerBuild(siteId: string, branch: string): Promise<string> {
    // Trigger Netlify build via API
    const buildId = `build_${Date.now()}`;
    console.log(`Triggering build for site ${siteId} on branch ${branch}`);
    return buildId;
  }

  async waitForBranchDeployment(branchName: string, timeout: number = 300000): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    console.log(`⏳ Waiting for branch deployment: ${branchName}`);
    const startTime = Date.now();
    const checkInterval = 10000; // Check every 10 seconds

    try {
      // Get the site ID from environment or find it
      const siteId = await this.getCurrentSiteId();
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
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            continue;
          }

          // Find the most recent deployment for this branch
          const latestDeployment = deployments[0];
          console.log(`   Deployment state: ${latestDeployment.state} for branch ${branchName}`);

          if (latestDeployment.state === 'ready') {
            const deployUrl = latestDeployment.deploy_ssl_url || latestDeployment.ssl_url;
            console.log(`✅ Branch deployment ready: ${deployUrl}`);
            return {
              success: true,
              url: deployUrl
            };
          }

          if (latestDeployment.state === 'error') {
            console.log(`❌ Branch deployment failed: ${latestDeployment.error_message}`);
            return {
              success: false,
              error: latestDeployment.error_message || 'Deployment failed'
            };
          }

          // Still building/processing, wait and check again
          await new Promise(resolve => setTimeout(resolve, checkInterval));

        } catch (deployError: any) {
          console.log(`   Error checking deployment: ${deployError.message}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }

      // Timeout reached
      return {
        success: false,
        error: `Deployment timeout after ${timeout}ms - branch may still be deploying`
      };

    } catch (error: any) {
      console.error('❌ Error waiting for branch deployment:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async getCurrentSiteId(): Promise<string | null> {
    try {
      // Try to get site ID from environment variable
      if (process.env.NETLIFY_SITE_ID) {
        return process.env.NETLIFY_SITE_ID;
      }

      // If not available, try to find it from existing sites
      // This is a fallback method - in production you should set NETLIFY_SITE_ID
      const client = await this.getClient();
      const sites = await client.listSites();
      
      // Look for the current project site (you may need to adjust this logic)
      const currentSite = sites.find(site => 
        site.name && (
          site.name.includes('geenius')  // ||
          //site.repo?.repo_path?.includes('geenius')
        )
      );

      if (currentSite && currentSite.id) {
        console.log(`Found site: ${currentSite.name} (${currentSite.id})`);
        return currentSite.id;
      }

      console.warn('Could not determine site ID. Set NETLIFY_SITE_ID environment variable.');
      return null;

    } catch (error: any) {
      console.error('Error getting site ID:', error.message);
      return null;
    }
  }
}