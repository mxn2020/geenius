// Enhanced Custom Netlify API implementation for use within Netlify Functions
// Updated with latest 2025 API endpoints and comprehensive type safety

export interface NetlifyDeployKey {
  id: string;
  public_key: string;
}

export interface NetlifyUser {
  id: string;
  uid: string;
  full_name: string;
  avatar_url: string;
  email: string;
  affiliate_id: string;
  site_count: number;
  created_at: string;
  last_login: string;
  login_providers: string[];
  onboarding_progress: {
    slides: string;
  };
}

export interface NetlifyAccount {
  id: string;
  name: string;
  slug: string;
  type: string;
  capabilities: {
    sites: {
      included: number;
      used: number;
    };
    collaborators: {
      included: number;
      used: number;
    };
  };
  billing_name: string;
  billing_email: string;
  billing_details: string;
  billing_period: string;
  payment_method_id: string;
  type_name: string;
  type_id: string;
  owner_ids: string[];
  roles_allowed: string[];
  created_at: string;
  updated_at: string;
}

export interface NetlifyBuildSettings {
  id: number;
  provider: string;
  deploy_key_id: string;
  repo_path: string;
  repo_branch: string;
  dir: string;
  functions_dir: string;
  cmd: string;
  allowed_branches: string[];
  public_repo: boolean;
  private_logs: boolean;
  repo_url: string;
  env: Record<string, string>; // Deprecated - use environment variables API
  installation_id: number;
  stop_builds: boolean;
}

export interface NetlifyProcessingSettings {
  html: {
    pretty_urls: boolean;
  };
}

export interface NetlifyCapabilities {
  [key: string]: any;
}

export interface NetlifyDefaultHooksData {
  access_token: string;
}

export interface NetlifyFunctionSchedule {
  name: string;
  cron: string;
}

export interface NetlifyDeployment {
  id: string;
  site_id: string;
  user_id: string;
  build_id: string;
  state: 'new' | 'pending_review' | 'accepted' | 'rejected' | 'enqueued' | 'building' | 'uploading' | 'uploaded' | 'preparing' | 'prepared' | 'processing' | 'processed' | 'ready' | 'error' | 'retrying';
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  screenshot_url: string;
  review_id: number;
  draft: boolean;
  required: string[];
  required_functions: string[];
  error_message: string;
  branch: string;
  commit_ref: string;
  commit_url: string;
  skipped: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  title: string;
  context: string;
  locked: boolean;
  review_url: string;
  framework: string;
  function_schedules: NetlifyFunctionSchedule[];
}

export interface NetlifySite {
  id: string;
  state: string;
  plan: string;
  name: string;
  custom_domain: string;
  domain_aliases: string[];
  branch_deploy_custom_domain: string;
  deploy_preview_custom_domain: string;
  password: string;
  notification_email: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  screenshot_url: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  session_id: string;
  ssl: boolean;
  force_ssl: boolean;
  managed_dns: boolean;
  deploy_url: string;
  published_deploy?: NetlifyDeployment;
  account_id: string;
  account_name: string;
  account_slug: string;
  git_provider: string;
  deploy_hook: string;
  capabilities: NetlifyCapabilities;
  processing_settings: NetlifyProcessingSettings;
  build_settings: NetlifyBuildSettings;
  id_domain: string;
  default_hooks_data: NetlifyDefaultHooksData;
  build_image: string;
  prerender: string;
  functions_region: string;
  repo?: NetlifyBuildSettings;
}

// New Environment Variables API types (2025)
export interface NetlifyEnvVarValue {
  id: string;
  value: string;
  context: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production' | 'branch';
  context_parameter?: string;
}

export interface NetlifyUpdatedBy {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

export interface NetlifyEnvVar {
  key: string;
  scopes: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
  values: NetlifyEnvVarValue[];
  is_secret: boolean;
  updated_at?: string;
  updated_by?: NetlifyUpdatedBy;
}

export interface NetlifyBuildHook {
  id: string;
  title: string;
  branch: string;
  url: string;
  site_id: string;
  created_at: string;
  type?: 'new_dev_server' | 'content_refresh';
}

export interface NetlifyDNSZone {
  id: string;
  name: string;
  errors: string[];
  supported_record_types: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
  records: NetlifyDNSRecord[];
  dns_servers: string[];
  account_id: string;
  site_id: string;
  account_slug: string;
  account_name: string;
  domain: string;
  ipv6_enabled: boolean;
  dedicated: boolean;
}

export interface NetlifyDNSRecord {
  id: string;
  hostname: string;
  type: string;
  value: string;
  ttl: number;
  priority: number;
  dns_zone_id: string;
  site_id: string;
  flag: number;
  tag: string;
  managed: boolean;
}

export interface NetlifyFormSubmission {
  id: string;
  number: number;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  company: string;
  summary: string;
  body: string;
  data: Record<string, any>;
  created_at: string;
  site_url: string;
}

export interface NetlifyAsset {
  id: string;
  site_id: string;
  creator_id: string;
  name: string;
  state: string;
  content_type: string;
  url: string;
  key: string;
  visibility: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface NetlifySnippet {
  id: number;
  site_id: string;
  title: string;
  general: string;
  general_position: string;
  goal: string;
  goal_position: string;
}

export interface NetlifyMember {
  id: string;
  full_name: string;
  email: string;
  avatar: string;
  role: string;
}

export interface NetlifyHook {
  id: string;
  site_id: string;
  type: string;
  event: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  disabled: boolean;
}

export interface NetlifyFunction {
  id: string;
  name: string;
  sha: string;
}

export interface NetlifySplitTest {
  id: string;
  site_id: string;
  name: string;
  path: string;
  branches: any[];
  active: boolean;
  created_at: string;
  updated_at: string;
  unpublished_at: string;
}

export interface NetlifyFile {
  id: string;
  path: string;
  sha: string;
  mime_type: string;
  size: number;
}

export interface NetlifyBuildStatus {
  active: number;
  pending_concurrency: number;
  enqueued: number;
  build_count: number;
  minutes: {
    current: number;
    current_average_sec: number;
    previous: number;
    period_start_date: string;
    period_end_date: string;
    last_updated_at: string;
    included_minutes: string;
    included_minutes_with_packs: string;
  };
}

export interface NetlifyDevServer {
  id: string;
  site_id: string;
  branch: string;
  url: string;
  state: string;
  created_at: string;
  updated_at: string;
  starting_at: string;
  error_at: string;
  live_at: string;
  done_at: string;
  title: string;
}

export interface NetlifyAuditLog {
  id: string;
  account_id: string;
  payload: {
    actor_id: string;
    actor_name: string;
    actor_email: string;
    action: string;
    timestamp: string;
    log_type: string;
    [key: string]: any;
  };
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

  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Netlify-Functions-API-Enhanced',
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

  // User and Account Management
  async getCurrentUser(): Promise<NetlifyUser> {
    return this.makeRequest('/user');
  }

  async listAccountsForUser(): Promise<NetlifyAccount[]> {
    return this.makeRequest('/accounts');
  }

  async getAccount(params: { accountSlug: string }): Promise<NetlifyAccount> {
    return this.makeRequest(`/accounts/${params.accountSlug}`);
  }

  async updateAccount(params: { 
    accountSlug: string; 
    body: Partial<NetlifyAccount> 
  }): Promise<NetlifyAccount> {
    return this.makeRequest(`/accounts/${params.accountSlug}`, {
      method: 'PATCH',
      body: JSON.stringify(params.body),
    });
  }

  async getAuditLog(params: {
    accountId: string;
    query?: string;
    log_type?: string;
    page?: number;
    per_page?: number;
  }): Promise<NetlifyAuditLog[]> {
    let endpoint = `/accounts/${params.accountId}/audit`;
    const searchParams = new URLSearchParams();
    
    if (params.query) searchParams.append('query', params.query);
    if (params.log_type) searchParams.append('log_type', params.log_type);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  // Account Members
  async listAccountMembers(params: { accountSlug: string }): Promise<NetlifyMember[]> {
    return this.makeRequest(`/accounts/${params.accountSlug}/members`);
  }

  async addAccountMember(params: {
    accountSlug: string;
    body: { role: string; email: string };
  }): Promise<NetlifyMember[]> {
    return this.makeRequest(`/accounts/${params.accountSlug}/members`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async updateAccountMember(params: {
    accountSlug: string;
    memberId: string;
    body: { 
      role?: string; 
      site_access?: 'all' | 'none' | 'selected';
      site_ids?: string[];
    };
  }): Promise<NetlifyMember> {
    return this.makeRequest(`/accounts/${params.accountSlug}/members/${params.memberId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async removeAccountMember(params: {
    accountSlug: string;
    memberId: string;
  }): Promise<void> {
    await this.makeRequest(`/accounts/${params.accountSlug}/members/${params.memberId}`, {
      method: 'DELETE',
    });
  }

  // Deploy Keys
  async createDeployKey(): Promise<NetlifyDeployKey> {
    return this.makeRequest('/deploy_keys', {
      method: 'POST',
    });
  }

  async getDeployKey(params: { keyId: string }): Promise<NetlifyDeployKey> {
    return this.makeRequest(`/deploy_keys/${params.keyId}`);
  }

  async deleteDeployKey(params: { keyId: string }): Promise<void> {
    await this.makeRequest(`/deploy_keys/${params.keyId}`, {
      method: 'DELETE',
    });
  }

  // Site Management
  async createSite(params: { body: Partial<NetlifySite> }): Promise<NetlifySite> {
    return this.makeRequest('/sites', {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async createSiteInTeam(params: { 
    accountSlug: string; 
    body: Partial<NetlifySite> 
  }): Promise<NetlifySite> {
    return this.makeRequest(`/accounts/${params.accountSlug}/sites`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getSite(params: { siteId: string }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}`);
  }

  async updateSite(params: { 
    siteId: string; 
    body: Partial<NetlifySite> 
  }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(params.body),
    });
  }

  async deleteSite(params: { siteId: string }): Promise<void> {
    await this.makeRequest(`/sites/${params.siteId}`, {
      method: 'DELETE',
    });
  }

  async listSites(params?: {
    name?: string;
    filter?: 'all' | 'owner' | 'guest';
    page?: number;
    per_page?: number;
  }): Promise<NetlifySite[]> {
    let endpoint = '/sites';
    const searchParams = new URLSearchParams();
    
    if (params?.name) searchParams.append('name', params.name);
    if (params?.filter) searchParams.append('filter', params.filter);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.per_page) searchParams.append('per_page', params.per_page.toString());
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async listSitesForAccount(params: {
    accountSlug: string;
    name?: string;
    page?: number;
    per_page?: number;
  }): Promise<NetlifySite[]> {
    let endpoint = `/accounts/${params.accountSlug}/sites`;
    const searchParams = new URLSearchParams();
    
    if (params.name) searchParams.append('name', params.name);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async unlinkSiteRepo(params: { siteId: string }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}/unlink_repo`, {
      method: 'PUT',
    });
  }

  async refreshSiteRepo(params: { siteId: string }): Promise<NetlifySite> {
    return this.makeRequest(`/sites/${params.siteId}/builds/status`, {
      method: 'POST',
    });
  }

  // Environment Variables (New 2025 API)
  async createEnvVars(params: { 
    accountId: string; 
    siteId?: string;
    body: Array<{
      key: string;
      scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
      values: Array<{
        value: string;
        context?: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production' | 'branch';
        context_parameter?: string;
      }>;
      is_secret?: boolean;
    }>
  }): Promise<NetlifyEnvVar[]> {
    let endpoint = `/accounts/${params.accountId}/env`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getEnvVars(params: { 
    accountId: string; 
    siteId?: string;
    context_name?: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production';
    scope?: 'builds' | 'functions' | 'runtime' | 'post-processing';
  }): Promise<NetlifyEnvVar[]> {
    let endpoint = `/accounts/${params.accountId}/env`;
    const searchParams = new URLSearchParams();
    
    if (params.siteId) searchParams.append('site_id', params.siteId);
    if (params.context_name) searchParams.append('context_name', params.context_name);
    if (params.scope) searchParams.append('scope', params.scope);
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async getEnvVar(params: { 
    accountId: string; 
    key: string;
    siteId?: string;
  }): Promise<NetlifyEnvVar> {
    let endpoint = `/accounts/${params.accountId}/env/${params.key}`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async updateEnvVar(params: { 
    accountId: string; 
    key: string;
    siteId?: string;
    body: {
      key?: string;
      scopes?: Array<'builds' | 'functions' | 'runtime' | 'post-processing'>;
      values: Array<{
        value: string;
        context?: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production' | 'branch';
        context_parameter?: string;
      }>;
      is_secret?: boolean;
    }
  }): Promise<NetlifyEnvVar> {
    let endpoint = `/accounts/${params.accountId}/env/${params.key}`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async updateEnvVarValue(params: {
    accountId: string;
    key: string;
    siteId?: string;
    body: {
      context?: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production' | 'branch';
      context_parameter?: string;
      value: string;
    }
  }): Promise<NetlifyEnvVar> {
    let endpoint = `/accounts/${params.accountId}/env/${params.key}/value`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async deleteEnvVar(params: { 
    accountId: string; 
    key: string;
    siteId?: string;
  }): Promise<void> {
    let endpoint = `/accounts/${params.accountId}/env/${params.key}`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    await this.makeRequest(endpoint, {
      method: 'DELETE',
    });
  }

  async deleteEnvVarValue(params: {
    accountId: string;
    key: string;
    id: string;
    siteId?: string;
  }): Promise<void> {
    let endpoint = `/accounts/${params.accountId}/env/${params.key}/value/${params.id}`;
    if (params.siteId) {
      endpoint += `?site_id=${params.siteId}`;
    }
    
    await this.makeRequest(endpoint, {
      method: 'DELETE',
    });
  }

  // Convenience method for site-specific env vars
  async getSiteEnvVars(params: {
    siteId: string;
    context_name?: 'all' | 'dev' | 'branch-deploy' | 'deploy-preview' | 'production';
    scope?: 'builds' | 'functions' | 'runtime' | 'post_processing';
  }): Promise<NetlifyEnvVar[]> {
    let endpoint = `/sites/${params.siteId}/env`;
    const searchParams = new URLSearchParams();
    
    if (params.context_name) searchParams.append('context_name', params.context_name);
    if (params.scope) searchParams.append('scope', params.scope);
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  // Deployment Management
  async createSiteDeploy(params: { 
    siteId: string; 
    body: {
      files?: Record<string, string>;
      draft?: boolean;
      async?: boolean;
      functions?: Record<string, any>;
      function_schedules?: NetlifyFunctionSchedule[];
      functions_config?: Record<string, any>;
      branch?: string;
      framework?: string;
      framework_version?: string;
      title?: string;
    }
  }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/sites/${params.siteId}/deploys`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}`);
  }

  async updateSiteDeploy(params: {
    siteId: string;
    deployId: string;
    body: Partial<NetlifyDeployment>;
  }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/sites/${params.siteId}/deploys/${params.deployId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async restoreSiteDeploy(params: { siteId: string; deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/sites/${params.siteId}/deploys/${params.deployId}/restore`, {
      method: 'POST',
    });
  }

  async cancelSiteDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}/cancel`, {
      method: 'POST',
    });
  }

  async lockSiteDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}/lock`, {
      method: 'POST',
    });
  }

  async unlockSiteDeploy(params: { deployId: string }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/deploys/${params.deployId}/unlock`, {
      method: 'POST',
    });
  }

  async listSiteDeploys(params: { 
    siteId: string; 
    page?: number;
    per_page?: number;
    state?: string;
    branch?: string;
  }): Promise<NetlifyDeployment[]> {
    let endpoint = `/sites/${params.siteId}/deploys`;
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    if (params.state) searchParams.append('state', params.state);
    if (params.branch) searchParams.append('branch', params.branch);
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  // Build Management
  async triggerSiteBuild(params: { siteId: string; body?: { clear_cache?: boolean } }): Promise<NetlifyDeployment> {
    return this.makeRequest(`/sites/${params.siteId}/builds`, {
      method: 'POST',
      body: JSON.stringify(params.body || {}),
    });
  }

  async getBuildStatus(params: { siteId: string }): Promise<NetlifyBuildStatus[]> {
    return this.makeRequest(`/sites/${params.siteId}/builds/status`);
  }

  // Build Hooks
  async triggerBuild(buildHookUrl: string): Promise<any> {
    const response = await fetch(buildHookUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Netlify-Functions-API-Enhanced',
      },
    });

    if (!response.ok) {
      throw new Error(`Build trigger failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Functions
  async uploadFunction(params: {
    deployId: string;
    name: string;
    functionBody: string | Uint8Array;
    runtime?: string;
    invocation_mode?: string;
    timeout?: number;
    size?: number;
  }): Promise<NetlifyFunction> {
    return this.makeRequest(`/deploys/${params.deployId}/functions/${params.name}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(params.runtime && { 'X-Nf-Runtime': params.runtime }),
        ...(params.invocation_mode && { 'X-Nf-Invocation-Mode': params.invocation_mode }),
        ...(params.timeout && { 'X-Nf-Timeout': params.timeout.toString() }),
        ...(params.size && { 'X-Nf-Size': params.size.toString() }),
      },
      body: params.functionBody,
    });
  }

  // DNS Management
  async listDnsZones(): Promise<NetlifyDNSZone[]> {
    return this.makeRequest('/dns_zones');
  }

  async createDnsZone(params: {
    accountSlug?: string;
    siteId?: string;
    name: string;
  }): Promise<NetlifyDNSZone> {
    return this.makeRequest('/dns_zones', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getDnsZone(params: { zoneId: string }): Promise<NetlifyDNSZone> {
    return this.makeRequest(`/dns_zones/${params.zoneId}`);
  }

  async deleteDnsZone(params: { zoneId: string }): Promise<void> {
    await this.makeRequest(`/dns_zones/${params.zoneId}`, {
      method: 'DELETE',
    });
  }

  async getDnsRecords(params: { zoneId: string }): Promise<NetlifyDNSRecord[]> {
    return this.makeRequest(`/dns_zones/${params.zoneId}/dns_records`);
  }

  async createDnsRecord(params: {
    zoneId: string;
    body: {
      type: string;
      hostname: string;
      value: string;
      ttl?: number;
      priority?: number;
      weight?: number;
      port?: number;
      flag?: number;
      tag?: string;
    };
  }): Promise<NetlifyDNSRecord> {
    return this.makeRequest(`/dns_zones/${params.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getDnsRecord(params: { zoneId: string; recordId: string }): Promise<NetlifyDNSRecord> {
    return this.makeRequest(`/dns_zones/${params.zoneId}/dns_records/${params.recordId}`);
  }

  async updateDnsRecord(params: {
    zoneId: string;
    recordId: string;
    body: Partial<NetlifyDNSRecord>;
  }): Promise<NetlifyDNSRecord> {
    return this.makeRequest(`/dns_zones/${params.zoneId}/dns_records/${params.recordId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async deleteDnsRecord(params: { zoneId: string; recordId: string }): Promise<void> {
    await this.makeRequest(`/dns_zones/${params.zoneId}/dns_records/${params.recordId}`, {
      method: 'DELETE',
    });
  }

  // Forms and Submissions
  async listFormSubmissions(params: {
    formId: string;
    page?: number;
    per_page?: number;
  }): Promise<NetlifyFormSubmission[]> {
    let endpoint = `/forms/${params.formId}/submissions`;
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.append('per_page', params.per_page.toString());
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async listSiteSubmissions(params: {
    siteId: string;
    page?: number;
    per_page?: number;
  }): Promise<NetlifyFormSubmission[]> {
    let endpoint = `/sites/${params.siteId}/submissions`;
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.per_page) searchParams.per_page.append('per_page', params.per_page.toString());
    
    if (searchParams.toString()) {
      endpoint += `?${searchParams.toString()}`;
    }
    
    return this.makeRequest(endpoint);
  }

  // Assets
  async createSiteAsset(params: {
    siteId: string;
    name: string;
    size: number;
    content_type: string;
    visibility?: string;
  }): Promise<{ form: any; asset: NetlifyAsset }> {
    return this.makeRequest(`/sites/${params.siteId}/assets`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getSiteAsset(params: { siteId: string; assetId: string }): Promise<NetlifyAsset> {
    return this.makeRequest(`/sites/${params.siteId}/assets/${params.assetId}`);
  }

  async listSiteAssets(params: { siteId: string }): Promise<NetlifyAsset[]> {
    return this.makeRequest(`/sites/${params.siteId}/assets`);
  }

  async updateSiteAsset(params: {
    siteId: string;
    assetId: string;
    state: string;
  }): Promise<NetlifyAsset> {
    return this.makeRequest(`/sites/${params.siteId}/assets/${params.assetId}`, {
      method: 'PUT',
      body: JSON.stringify({ state: params.state }),
    });
  }

  async deleteSiteAsset(params: { siteId: string; assetId: string }): Promise<void> {
    await this.makeRequest(`/sites/${params.siteId}/assets/${params.assetId}`, {
      method: 'DELETE',
    });
  }

  // Snippets
  async createSiteSnippet(params: {
    siteId: string;
    body: Omit<NetlifySnippet, 'id'>;
  }): Promise<NetlifySnippet> {
    return this.makeRequest(`/sites/${params.siteId}/snippets`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getSiteSnippet(params: { siteId: string; snippetId: string }): Promise<NetlifySnippet> {
    return this.makeRequest(`/sites/${params.siteId}/snippets/${params.snippetId}`);
  }

  async updateSiteSnippet(params: {
    siteId: string;
    snippetId: string;
    body: Partial<NetlifySnippet>;
  }): Promise<NetlifySnippet> {
    return this.makeRequest(`/sites/${params.siteId}/snippets/${params.snippetId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async deleteSiteSnippet(params: { siteId: string; snippetId: string }): Promise<void> {
    await this.makeRequest(`/sites/${params.siteId}/snippets/${params.snippetId}`, {
      method: 'DELETE',
    });
  }

  // Site Metadata
  async getSiteMetadata(params: { siteId: string }): Promise<Record<string, any>> {
    return this.makeRequest(`/sites/${params.siteId}/metadata`);
  }

  async updateSiteMetadata(params: {
    siteId: string;
    body: Record<string, any>;
  }): Promise<Record<string, any>> {
    return this.makeRequest(`/sites/${params.siteId}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  // Split Testing
  async createSplitTest(params: {
    siteId: string;
    body: { branch_tests: Record<string, any> };
  }): Promise<NetlifySplitTest> {
    return this.makeRequest(`/sites/${params.siteId}/traffic_splits`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getSplitTest(params: { siteId: string; splitTestId: string }): Promise<NetlifySplitTest> {
    return this.makeRequest(`/sites/${params.siteId}/traffic_splits/${params.splitTestId}`);
  }

  async listSplitTests(params: { siteId: string }): Promise<NetlifySplitTest[]> {
    return this.makeRequest(`/sites/${params.siteId}/traffic_splits`);
  }

  async updateSplitTest(params: {
    siteId: string;
    splitTestId: string;
    body: { branch_tests: Record<string, any> };
  }): Promise<NetlifySplitTest> {
    return this.makeRequest(`/sites/${params.siteId}/traffic_splits/${params.splitTestId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async unpublishSplitTest(params: { siteId: string; splitTestId: string }): Promise<void> {
    await this.makeRequest(`/sites/${params.siteId}/traffic_splits/${params.splitTestId}/unpublish`, {
      method: 'PUT',
    });
  }

  // Dev Servers
  async createDevServer(params: {
    siteId: string;
    body: {
      branch: string;
      url: string;
      title?: string;
    };
  }): Promise<NetlifyDevServer> {
    return this.makeRequest(`/sites/${params.siteId}/dev_servers`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async getDevServer(params: { siteId: string; devServerId: string }): Promise<NetlifyDevServer> {
    return this.makeRequest(`/sites/${params.siteId}/dev_servers/${params.devServerId}`);
  }

  async listDevServers(params: {
    siteId: string;
    branch?: string;
  }): Promise<NetlifyDevServer[]> {
    let endpoint = `/sites/${params.siteId}/dev_servers`;
    if (params.branch) {
      endpoint += `?branch=${encodeURIComponent(params.branch)}`;
    }
    
    return this.makeRequest(endpoint);
  }

  async deleteDevServer(params: { siteId: string; devServerId: string }): Promise<void> {
    await this.makeRequest(`/sites/${params.siteId}/dev_servers/${params.devServerId}`, {
      method: 'DELETE',
    });
  }

  // Files
  async getDeployFile(params: {
    deployId: string;
    path: string;
    size?: number;
  }): Promise<NetlifyFile> {
    let endpoint = `/deploys/${params.deployId}/files/${params.path}`;
    if (params.size) {
      endpoint += `?size=${params.size}`;
    }
    
    return this.makeRequest(endpoint);
  }

  // Cache Management
  async purgeCache(params: {
    siteId?: string;
    siteSlug?: string;
    cache_tags?: string[];
  }): Promise<void> {
    await this.makeRequest('/purge', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // SSL Certificate Management
  async provisionSiteTLSCertificate(params: {
    siteId: string;
    certificate?: string;
    key?: string;
    ca_certificates?: string;
  }): Promise<{ state: string; domains: string[]; created_at: string; updated_at: string; expires_at: string }> {
    return this.makeRequest(`/sites/${params.siteId}/ssl`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async showSiteTLSCertificate(params: { siteId: string }): Promise<any> {
    return this.makeRequest(`/sites/${params.siteId}/ssl`);
  }

  // Webhooks
  async createHookBySiteId(params: {
    siteId: string;
    body: Omit<NetlifyHook, 'id' | 'created_at' | 'updated_at'>;
  }): Promise<NetlifyHook> {
    return this.makeRequest(`/sites/${params.siteId}/hooks`, {
      method: 'POST',
      body: JSON.stringify(params.body),
    });
  }

  async listHooksBySiteId(params: { siteId: string }): Promise<NetlifyHook[]> {
    return this.makeRequest(`/sites/${params.siteId}/hooks`);
  }

  async getHook(params: { hookId: string }): Promise<NetlifyHook> {
    return this.makeRequest(`/hooks/${params.hookId}`);
  }

  async updateHook(params: {
    hookId: string;
    body: Partial<NetlifyHook>;
  }): Promise<NetlifyHook> {
    return this.makeRequest(`/hooks/${params.hookId}`, {
      method: 'PUT',
      body: JSON.stringify(params.body),
    });
  }

  async deleteHook(params: { hookId: string }): Promise<void> {
    await this.makeRequest(`/hooks/${params.hookId}`, {
      method: 'DELETE',
    });
  }

  async enableHook(params: { hookId: string }): Promise<NetlifyHook> {
    return this.makeRequest(`/hooks/${params.hookId}/enable`, {
      method: 'POST',
    });
  }

  async disableHook(params: { hookId: string }): Promise<NetlifyHook> {
    return this.makeRequest(`/hooks/${params.hookId}/disable`, {
      method: 'POST',
    });
  }
}