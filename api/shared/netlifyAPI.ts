// Custom Netlify API implementation for use within Netlify Functions
// This replaces the problematic NetlifyAPI client with direct HTTP requests

export interface NetlifyDeployKey {
  id: string;
  public_key: string;
}

export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  account_id: string;
  build_settings?: any;
}

export interface NetlifyDeployment {
  id: string;
  state: 'building' | 'ready' | 'error' | 'processing';
  branch: string;
  deploy_ssl_url?: string;
  ssl_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface NetlifyEnvVar {
  key: string;
  values: Array<{
    value: string;
    context: 'all' | 'production' | 'deploy-preview' | 'branch-deploy';
  }>;
}

export class NetlifyAPI {
  private baseUrl = 'https://api.netlify.com/api/v1';
  private token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error('Netlify API token is required');
    }
    this.token = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Netlify-Functions-API',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      
      const error = new Error(`Netlify API Error: ${response.status} ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).json = errorData;
      throw error;
    }

    return response.json();
  }

  /**
   * Create a deploy key for repository access
   */
  async createDeployKey(): Promise<NetlifyDeployKey> {
    return this.makeRequest('/deploy_keys', {
      method: 'POST',
    });
  }

  /**
   * Create a new site
   */
  async createSite(params: { body: any }): Promise<NetlifySite> {
    return this.makeRequest('/sites', {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  /**
   * Create a site in a specific team
   */
  async createSiteInTeam(params: { accountSlug: string; body: any }): Promise<NetlifySite> {
    return this.makeRequest(`/accounts/${params.accountSlug}/sites`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  /**
   * Get site information
   */
  async getSite(params: { siteId: string }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}`);
  }

  /**
   * Update site settings
   */
  async updateSite(params: { siteId: string; body: any }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(params.body),
    });
  }

  /**
   * List all sites
   */
  async listSites(): Promise<NetlifySite[]> {
    return this.makeRequest('/sites');
  }

  /**
   * List deployments for a site
   */
  async listSiteDeploys(params: { siteId: string; branch?: string }): Promise<NetlifyDeployment[]> {
    let endpoint = `/sites/${params.siteId}/deploys`;
    
    if (params.branch) {
      endpoint += `?branch=${encodeURIComponent(params.branch)}`;
    }
    
    return this.makeRequest(endpoint);
  }

/**
   * Create environment variables for a site
   * Updated to use the new environment variables API to avoid deprecation warnings
   */
  async createEnvVars(params: { 
    accountId: string; 
    siteId: string; 
    body: NetlifyEnvVar[] 
  }): Promise<NetlifyEnvVar[]> {
    console.log('Setting environment variables:', params.body.map(env => env.key));

    try {
      // Convert to the new API format
      const envVarsPayload = params.body.map(envVar => ({
        key: envVar.key,
        values: envVar.values.map(val => ({
          context: val.context || 'all',
          value: val.value
        })),
        scopes: ['builds', 'functions'], // Default scopes
        is_secret: false
      }));

      const result = await this.makeRequest(`/accounts/${params.accountId}/env?site_id=${params.siteId}`, {
        method: 'POST',
        body: JSON.stringify(envVarsPayload),
      });
      
      return result;
    } catch (error: any) {
      console.error('Failed to create environment variables:', {
        message: error.message,
        status: error.status,
        json: error.json
      });
      
      // Try the fallback method using the old build_settings API if new API fails
      if (error.status === 400 || error.status === 422) {
        console.log('Falling back to build_settings API...');
        try {
          const envVarsPayload = params.body.reduce((acc, envVar) => {
            const value = envVar.values && envVar.values.length > 0 ? envVar.values[0].value : '';
            if (value && value.trim() !== '') {
              acc[envVar.key] = value;
            }
            return acc;
          }, {});

          const currentSite = await this.makeRequest(`/sites/${params.siteId}`);
          
          await this.makeRequest(`/sites/${params.siteId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              build_settings: {
                ...currentSite.build_settings,
                env: {
                  ...currentSite.build_settings?.env,
                  ...envVarsPayload
                }
              }
            }),
          });
          
          console.log('Successfully set environment variables using fallback method');
          return params.body;
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError);
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

/**
 * Get environment variables for a site
 */
async getEnvVars(params: { accountId: string; siteId: string }): Promise<NetlifyEnvVar[]> {
  return this.makeRequest(`/accounts/${params.accountId}/env?site_id=${params.siteId}`);
}

/**
 * Update environment variables for a site
 */
async updateEnvVar(params: { 
  accountId: string; 
  siteId: string; 
  key: string; 
  body: { values: NetlifyEnvVar['values'] } 
}): Promise<NetlifyEnvVar> {
  return this.makeRequest(`/accounts/${params.accountId}/env/${params.key}?site_id=${params.siteId}`, {
    method: 'PUT',
    body: JSON.stringify(params.body),
  });
}

/**
 * Delete environment variable
 */
async deleteEnvVar(params: { 
  accountId: string; 
  siteId: string; 
  key: string; 
}): Promise<void> {
  await this.makeRequest(`/accounts/${params.accountId}/env/${params.key}?site_id=${params.siteId}`, {
    method: 'DELETE',
  });
}

  /**
   * Create a new deployment
   */
  async createSiteDeploy(params: { 
    siteId: string; 
    body: {
      branch?: string;
      title?: string;
      files?: Record<string, string>;
    }
  }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/sites/${params.siteId}/deploys`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  /**
   * Get deployment information
   */
  async getDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}`);
  }

  /**
   * Cancel a deployment
   */
  async cancelSiteDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Get build hooks for a site
   */
  async listHooksBySiteId(params: { siteId: string }): Promise<any[]> {
    return this.makeRequest(`/sites/${params.siteId}/build_hooks`);
  }

  /**
   * Create a build hook
   */
  async createHookBySiteId(params: { 
    siteId: string; 
    body: { title: string; branch?: string } 
  }): Promise<any> {
    return this.makeRequest(`/sites/${params.siteId}/build_hooks`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  /**
   * Trigger a build via build hook
   */
  async triggerBuild(buildHookUrl: string): Promise<any> {
    const response = await fetch(buildHookUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Netlify-Functions-API',
      },
    });

    if (!response.ok) {
      throw new Error(`Build trigger failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get account information
   */
  async getCurrentUser(): Promise<any> {
    return this.makeRequest('/user');
  }

  /**
   * List accounts/teams
   */
  async listAccountsForUser(): Promise<any[]> {
    return this.makeRequest('/accounts');
  }
}