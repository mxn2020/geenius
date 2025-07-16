// src/services/netlify.ts
import { NetlifyAPI } from 'netlify';

export class NetlifyService {
  private client: NetlifyAPI;

  constructor() {
    this.client = new NetlifyAPI(process.env.NETLIFY_TOKEN);
  }

  async createProject(name: string, repoUrl: string, teamSlug?: string) {
    const site = await this.client.createSite({
      body: {
        name,
        repo: {
          repo: repoUrl,
          branch: 'main',
          provider: 'github'
        },
        build_settings: {
          cmd: 'npm run build',
          dir: 'dist'
        }
      }
    });

    return site;
  }

  async configureBranchDeployments(siteId: string, branchConfig: {
    [branch: string]: { production?: boolean; preview?: boolean };
  }) {
    // Configure branch deploy settings
    await this.client.updateSite({
      siteId,
      body: {
        build_settings: {
          branch_deploy_enabled: true
        }
      }
    });

    // Set up branch-specific configurations
    for (const [branch, config] of Object.entries(branchConfig)) {
      if (config.production) {
        await this.client.updateSite({
          siteId,
          body: {
            build_settings: {
              production_branch: branch
            }
          }
        });
      }
    }
  }

  async getDeployments(siteId: string) {
    const deployments = await this.client.listSiteDeployments({
      siteId
    });

    return deployments;
  }

  async getBranchDeployment(siteId: string, branch: string) {
    const deployments = await this.getDeployments(siteId);
    return deployments.find(d => d.branch === branch);
  }

  async triggerDeploy(siteId: string, branch: string = 'main') {
    const deployment = await this.client.createSiteDeploy({
      siteId,
      body: {
        branch
      }
    });

    return deployment;
  }

  async waitForDeployment(siteId: string, deployId: string, maxWait: number = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const deployment = await this.client.getSiteDeploy({
        siteId,
        deployId
      });

      if (deployment.state === 'ready') {
        return deployment;
      }

      if (deployment.state === 'error') {
        throw new Error(`Deployment failed: ${deployment.error_message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Deployment timeout');
  }

  async getDeploymentUrl(siteId: string, branch: string): Promise<string | undefined> {
    const deployment = await this.getBranchDeployment(siteId, branch);
    return deployment?.deploy_ssl_url;
  }

  async setupEnvironmentVariables(siteId: string, variables: Record<string, string>) {
    for (const [key, value] of Object.entries(variables)) {
      await this.client.createEnvVar({
        siteId,
        body: {
          key,
          value
        }
      });
    }
  }

  async configureBuildHooks(siteId: string, hooks: {
    name: string;
    branch?: string;
    title?: string;
  }[]) {
    const buildHooks = [];
    
    for (const hook of hooks) {
      const buildHook = await this.client.createHookBySiteId({
        siteId,
        body: {
          type: 'github_commit_status',
          event: 'deploy_building',
          data: {
            branch: hook.branch || 'main'
          }
        }
      });
      
      buildHooks.push(buildHook);
    }

    return buildHooks;
  }
}