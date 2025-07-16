// src/types/service.ts
export interface GitHubServiceConfig {
  token: string;
  baseUrl?: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
}

export interface GitHubFileContent {
  content: string;
  sha: string;
  path: string;
  size: number;
}

export interface NetlifyServiceConfig {
  token: string;
  teamSlug?: string;
}

export interface NetlifyProject {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  repository_url: string;
  build_settings: {
    cmd: string;
    dir: string;
    branch: string;
  };
}

export interface NetlifyDeployment {
  id: string;
  url: string;
  deploy_ssl_url: string;
  state: 'ready' | 'building' | 'error' | 'processing';
  branch: string;
  commit_ref: string;
  created_at: string;
  updated_at: string;
}

export interface StackBlitzProject {
  id: string;
  url: string;
  vm: any;
}

export interface StackBlitzProjectInfo {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  framework: string;
}

export interface CommandResult {
  output: string;
  exitCode: number;
}

export interface TestResult {
  success: boolean;
  output: string;
  coverage?: number;
  failedTests?: string[];
}

