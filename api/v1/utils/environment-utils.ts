// Environment variable utilities for different template types

import { NetlifyService } from '../../../src/services/netlify';

/**
 * Get environment variables for AI provider
 */
export function getEnvVarsForProvider(provider: string, model?: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
  // Get API key from environment
  const getApiKey = (provider: string): string => {
    const envNames: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      grok: 'XAI_API_KEY'
    };
    return process.env[envNames[provider]] || '';
  };

  const apiKey = getApiKey(provider);
  if (apiKey) {
    switch (provider) {
      case 'anthropic':
        vars['ANTHROPIC_API_KEY'] = apiKey;
        if (model) vars['ANTHROPIC_MODEL'] = model;
        break;
      case 'openai':
        vars['OPENAI_API_KEY'] = apiKey;
        if (model) vars['OPENAI_MODEL'] = model;
        break;
      case 'google':
        vars['GOOGLE_API_KEY'] = apiKey;
        if (model) vars['GOOGLE_MODEL'] = model;
        break;
      case 'grok':
        vars['XAI_API_KEY'] = apiKey;
        if (model) vars['XAI_MODEL'] = model;
        break;
    }
  }

  return vars;
}

/**
 * Generate template-specific environment variables
 */
export function generateTemplateEnvironmentVariables(
  template: any,
  request: any,
  mongodbProject?: any
): Record<string, string> {
  const templateEnvVars: Record<string, string> = {};
  
  // Process each required environment variable for this template
  for (const envVar of template.envVars) {
    switch (envVar) {
      // MongoDB-related variables
      case 'MONGODB_URI':
      case 'DATABASE_URL':
        if (mongodbProject) {
          templateEnvVars[envVar] = mongodbProject.connectionString;
        }
        break;
      case 'MONGODB_DATABASE_NAME':
        if (mongodbProject) {
          templateEnvVars[envVar] = mongodbProject.databaseName;
        }
        break;
      case 'MONGODB_CLUSTER_NAME':
        if (mongodbProject) {
          templateEnvVars[envVar] = mongodbProject.clusterName;
        }
        break;
      case 'MONGODB_USERNAME':
        if (mongodbProject) {
          templateEnvVars[envVar] = mongodbProject.username;
        }
        break;
      case 'MONGODB_PASSWORD':
        if (mongodbProject) {
          templateEnvVars[envVar] = mongodbProject.password;
        }
        break;
      
      // Authentication secrets
      case 'BETTER_AUTH_SECRET':
      case 'NEXTAUTH_SECRET':
      case 'AUTH_SECRET':
      case 'NUXT_SECRET_KEY':
        templateEnvVars[envVar] = require('crypto').randomBytes(32).toString('hex');
        break;
      
      // App URLs and names
      case 'VITE_APP_NAME':
      case 'NEXT_PUBLIC_APP_NAME':
      case 'NUXT_PUBLIC_APP_NAME':
        templateEnvVars[envVar] = request.projectName || 'My App';
        break;
      
      case 'VITE_APP_URL':
      case 'NEXT_PUBLIC_APP_URL':
      case 'NUXT_PUBLIC_API_URL':
      case 'VITE_API_URL':
        // Will be updated after Netlify site creation
        templateEnvVars[envVar] = 'https://placeholder.netlify.app';
        break;
      
      case 'BETTER_AUTH_URL':
      case 'NEXTAUTH_URL':
        // Will be updated after Netlify site creation
        templateEnvVars[envVar] = 'https://placeholder.netlify.app';
        break;
      
      // Supabase variables (need to be configured by user)
      case 'VITE_SUPABASE_URL':
      case 'NEXT_PUBLIC_SUPABASE_URL':
      case 'SUPABASE_URL':
        templateEnvVars[envVar] = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
        break;
      case 'VITE_SUPABASE_ANON_KEY':
      case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      case 'SUPABASE_ANON_KEY':
        templateEnvVars[envVar] = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
        break;
      case 'SUPABASE_SERVICE_KEY':
      case 'SUPABASE_SERVICE_ROLE_KEY':
      case 'NEXT_PUBLIC_SUPABASE_SERVICE_KEY':
        templateEnvVars[envVar] = process.env.SUPABASE_SERVICE_KEY || 'your-supabase-service-key';
        break;
      case 'SUPABASE_PROJECT_ID':
        templateEnvVars[envVar] = process.env.SUPABASE_PROJECT_ID || 'your-supabase-project-id';
        break;
      
      // PlanetScale variables
      case 'PLANETSCALE_TOKEN':
        templateEnvVars[envVar] = process.env.PLANETSCALE_TOKEN || 'your-planetscale-token';
        break;
      
      // Upstash Redis variables
      case 'VITE_UPSTASH_REDIS_REST_URL':
      case 'UPSTASH_REDIS_REST_URL':
        templateEnvVars[envVar] = process.env.UPSTASH_REDIS_REST_URL || 'https://your-redis.upstash.io';
        break;
      case 'VITE_UPSTASH_REDIS_REST_TOKEN':
      case 'UPSTASH_REDIS_REST_TOKEN':
        templateEnvVars[envVar] = process.env.UPSTASH_REDIS_REST_TOKEN || 'your-upstash-token';
        break;
      
      // App version for IndexedDB templates
      case 'VITE_APP_VERSION':
      case 'NEXT_PUBLIC_APP_VERSION':
      case 'NUXT_PUBLIC_APP_VERSION':
        templateEnvVars[envVar] = '1.0.0';
        break;
      
      // Default fallback for any unhandled env vars
      default:
        console.warn(`[ENV-SETUP] Unknown environment variable: ${envVar}, setting as placeholder`);
        templateEnvVars[envVar] = `placeholder-${envVar.toLowerCase()}`;
        break;
    }
  }
  
  // Always set repository URL and base branch (required for web interface)
  templateEnvVars['VITE_REPOSITORY_URL'] = request.repositoryUrl || '';
  templateEnvVars['VITE_BASE_BRANCH'] = 'main';
  
  return templateEnvVars;
}

/**
 * Update URL-based environment variables after Netlify site creation
 */
export async function updateUrlEnvironmentVariables(
  netlifyService: NetlifyService,
  siteId: string,
  accountId: string,
  siteUrl: string,
  template: any
): Promise<void> {
  const urlEnvVars: Record<string, string> = {};
  let needsUpdate = false;
  
  // Check which URL-based env vars this template needs and update them
  for (const envVar of template.envVars) {
    switch (envVar) {
      case 'VITE_APP_URL':
      case 'NEXT_PUBLIC_APP_URL':
      case 'NUXT_PUBLIC_API_URL':
      case 'VITE_API_URL':
      case 'BETTER_AUTH_URL':
      case 'NEXTAUTH_URL':
        urlEnvVars[envVar] = siteUrl;
        needsUpdate = true;
        break;
    }
  }
  
  if (needsUpdate && Object.keys(urlEnvVars).length > 0) {
    try {
      console.log(`[ENV-UPDATE] Updating ${Object.keys(urlEnvVars).length} URL-based environment variables with: ${siteUrl}`);
      
      await netlifyService.updateEnvironmentVariables(siteId, accountId, urlEnvVars);
      
      console.log(`   ✅ Successfully updated URL-based environment variables`);
    } catch (error: any) {
      console.warn(`⚠️ Failed to update URL-based environment variables: ${error.message}`);
    }
  }
}