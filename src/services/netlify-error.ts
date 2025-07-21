// web/services/netlify.ts
import { NetlifyAPI } from 'netlify';

export class NetlifyService {
  private client: any;

  constructor() {
    if (!process.env.NETLIFY_TOKEN) {
      throw new Error('NETLIFY_TOKEN environment variable is required for Netlify integration.');
    }
    this.client = new NetlifyAPI(process.env.NETLIFY_TOKEN);
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
      console.log(`🔍 Getting GitHub repository ID via web services...`);
      const repoId = await this.getGitHubRepoId(owner, repo);
      console.log(`   Repository ID: ${repoId}`);

      // Step 2: Create deploy key
      console.log(`🔑 Creating Netlify deploy key...`);
      const deployKey = await this.client.createDeployKey();
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
        site = await this.client.createSiteInTeam({
          accountSlug: teamSlug,
          body: siteData
        });
      } else {
        site = await this.client.createSite({
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
          const deployKey = await this.client.createDeployKey();
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
            fallbackSite = await this.client.createSiteInTeam({
              accountSlug: teamSlug,
              body: fallbackSiteData
            });
          } else {
            fallbackSite = await this.client.createSite({
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

      // Get the site to find the account ID and site details
      const site = await this.client.getSite({ siteId });
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

      // Convert variables to the format expected by the API
      const envVars = Object.entries(allVariables).map(([key, value]) => ({
        key,
        values: [{
          value,
          context: 'all' as const
        }]
      }));

      // Create environment variables
      await this.client.createEnvVars({
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

  async configureBranchDeployments(siteId: string, config: Record<string, any>): Promise<void> {
    try {
      console.log(`🔧 Configuring branch deployments for site ${siteId}`);

      // Get current site settings
      const site = await this.client.getSite({ siteId });

      // Configure branch deploy settings
      const updateData: any = {
        build_settings: {
          ...site.build_settings,
          repo_branch: site.build_settings?.repo_branch || 'main'
        }
      };

      // Set up branch-specific configurations
      for (const [branch, branchConfig] of Object.entries(config)) {
        if (branchConfig.production) {
          updateData.build_settings.repo_branch = branch;
          console.log(`   Set production branch to: ${branch}`);
        }
      }

      await this.client.updateSite({
        siteId,
        body: updateData
      });

      console.log('✅ Branch deployment configuration completed');
    } catch (error: any) {
      console.warn('⚠️  Branch deployment configuration failed:', error.message);
      console.log('You can configure branch deployments manually in the Netlify dashboard');
    }
  }

  async waitForInitialDeployment(siteId: string, timeout: number = 180000): Promise<any> {
    console.log(`⏳ Waiting for initial deployment to complete...`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const deployments = await this.client.listSiteDeploys({ siteId });

        if (deployments.length === 0) {
          console.log(`   No deployments found yet, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        // Get the latest deployment
        const latestDeployment = deployments[0];
        console.log(`   Deployment state: ${latestDeployment.state}, waiting...`);

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
}