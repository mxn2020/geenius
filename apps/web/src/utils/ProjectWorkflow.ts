// Project workflow utilities for web app
import { NetlifyService } from '../../../../api/shared/netlify-service';
import { MongoDBService } from '../services/mongodb';
import { GitHubService } from '../services/github';
import { TemplateRegistry } from '../services/template-registry';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export class ProjectWorkflow {
  private logs: string[];

  constructor() {
    this.logs = [];
  }

  addLog(message: string): void {
    this.logs.push(message);
    console.log(message);
  }

  async initializeProject(options: any): Promise<any> {
    this.logs = [];
    
    try {
      this.addLog('🚀 Starting AI Development Agent initialization...');

      // Check environment setup
      const envStatus = {
        github: !!process.env.GITHUB_TOKEN,
        netlify: !!process.env.NETLIFY_TOKEN,
        mongodb: !!(process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY)
      };

      this.addLog(`📋 Environment Status: GitHub: ${envStatus.github ? '✅' : '❌'}, Netlify: ${envStatus.netlify ? '✅' : '⚠️'}, MongoDB: ${envStatus.mongodb ? '✅' : '⚠️'}`);

      // Validate API key is available
      if (!this.getExistingApiKey(options.aiProvider)) {
        throw new Error(`No API key found for ${options.aiProvider}. Please set ${this.getApiKeyEnvName(options.aiProvider)} in your environment.`);
      }

      this.addLog(`✅ Found API key for ${options.aiProvider.toUpperCase()}`);

      // Validate required GitHub token
      if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is required for repository operations');
      }

      // Get template registry
      this.addLog('📚 Loading template registry...');
      const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN);
      const templates = await templateRegistry.getAllTemplates();
      const template = templates.find(t => t.id === options.templateId);

      if (!template) {
        throw new Error(`Template ${options.templateId} not found`);
      }

      this.addLog(`📋 Using template: ${template.name}`);

      // Initialize services
      this.addLog('🔧 Initializing services...');
      const github = new GitHubService();
      
      // Initialize Netlify service with error handling
      let netlify = null;
      try {
        netlify = new NetlifyService();
        this.addLog('✅ Netlify service initialized');
      } catch (error) {
        this.addLog(`⚠️ Netlify service initialization failed: ${error.message}`);
        this.addLog('🔧 Netlify operations will be skipped');
      }

      // Fork template repository
      this.addLog('🍴 Forking template repository...');
      const repoUrl = await github.forkTemplate(
        template.repository,
        options.projectName,
        options.githubOrg
      );

      this.addLog(`✅ Repository forked: ${repoUrl}`);

      // Extract the final repository name from the URL
      const repoMatch = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
      const finalRepoName = repoMatch ? repoMatch[1] : options.projectName;

      // Setup MongoDB database if template requires it
      let mongodbProject = null;
      if (template.envVars.includes('MONGODB_URI') || template.envVars.includes('DATABASE_URL')) {
        if (!process.env.MONGODB_ATLAS_PUBLIC_KEY || !process.env.MONGODB_ATLAS_PRIVATE_KEY) {
          this.addLog('⚠️ MongoDB Atlas API keys not found - skipping database setup');
        } else {
          try {
            this.addLog('🍃 Setting up MongoDB database...');
            const mongodb = new MongoDBService();
            
            // Get first available organization
            const organizations = await mongodb.getOrganizations();
            if (organizations.length === 0) {
              throw new Error('No MongoDB organizations found');
            }

            const selectedOrg = organizations[0];
            this.addLog(`📁 Using MongoDB organization: ${selectedOrg.name}`);

            // Get projects for organization
            const projects = await mongodb.getProjects(selectedOrg.id);
            
            // Try to create cluster, handling free cluster limit errors
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount < maxRetries) {
              try {
                mongodbProject = await mongodb.createProjectWithSelection(
                  finalRepoName,
                  selectedOrg.id,
                  projects.length > 0 ? projects[0].id : null
                );
                break;
              } catch (error) {
                if (error.message.includes('CANNOT_CREATE_FREE_CLUSTER_VIA_PUBLIC_API') || 
                    error.message.includes('reached the limit for the number of free clusters')) {
                  
                  if (retryCount === 0 && projects.length > 0) {
                    retryCount++;
                    this.addLog('🔄 Retrying with different project due to free cluster limit...');
                    continue;
                  } else {
                    this.addLog('⚠️ Cannot create MongoDB cluster: free tier limit reached. Skipping MongoDB setup.');
                    mongodbProject = null;
                    break;
                  }
                } else {
                  throw error;
                }
              }
            }

            if (mongodbProject) {
              this.addLog(`✅ MongoDB database created: ${mongodbProject.databaseName}`);
              this.addLog(`🔗 Cluster: ${mongodbProject.clusterName}`);
            }

          } catch (error) {
            this.addLog(`❌ MongoDB setup failed: ${error.message}`);
            this.addLog('💡 You can create a MongoDB database manually later');
            mongodbProject = null;
          }
        }
      }

      // Setup Netlify project
      let netlifyProject = null;
      if (options.autoSetup) {
        if (!process.env.NETLIFY_TOKEN) {
          this.addLog('⚠️ NETLIFY_TOKEN not found - skipping deployment setup');
        } else if (!netlify) {
          this.addLog('⚠️ Netlify service not available - skipping deployment setup');
        } else {
          try {
            this.addLog('🚀 Setting up Netlify project...');
            netlifyProject = await netlify.createProject(finalRepoName, repoUrl);

            // Prepare environment variables
            const templateEnvVars = template.envVars.reduce((acc, envVar) => ({ ...acc, [envVar]: '' }), {});

            // Add MongoDB connection details if database was created
            if (mongodbProject) {
              if (template.envVars.includes('MONGODB_URI')) {
                templateEnvVars['MONGODB_URI'] = mongodbProject.connectionString;
              }
              if (template.envVars.includes('DATABASE_URL')) {
                templateEnvVars['DATABASE_URL'] = mongodbProject.connectionString;
              }
              templateEnvVars['MONGODB_DATABASE_NAME'] = mongodbProject.databaseName;
              templateEnvVars['MONGODB_CLUSTER_NAME'] = mongodbProject.clusterName;
              templateEnvVars['MONGODB_USERNAME'] = mongodbProject.username;
              templateEnvVars['MONGODB_PASSWORD'] = mongodbProject.password;
            }

            // Generate secure secrets
            if (template.envVars.includes('BETTER_AUTH_SECRET')) {
              templateEnvVars['BETTER_AUTH_SECRET'] = this.generateSecureSecret();
            }

            if (template.envVars.includes('BETTER_AUTH_URL')) {
              templateEnvVars['BETTER_AUTH_URL'] = netlifyProject ? netlifyProject.ssl_url : 'http://localhost:5176';
            }

            if (template.envVars.includes('JWT_SECRET')) {
              templateEnvVars['JWT_SECRET'] = this.generateSecureSecret();
            }

            // Set default app configuration
            if (template.envVars.includes('VITE_APP_NAME')) {
              templateEnvVars['VITE_APP_NAME'] = finalRepoName;
            }

            if (template.envVars.includes('VITE_APP_VERSION')) {
              templateEnvVars['VITE_APP_VERSION'] = '1.0.0';
            }

            if (template.envVars.includes('VITE_APP_DESCRIPTION')) {
              templateEnvVars['VITE_APP_DESCRIPTION'] = `${template.description} - ${finalRepoName}`;
            }

            // Set API URLs based on Netlify project
            if (netlifyProject) {
              if (template.envVars.includes('VITE_APP_URL')) {
                templateEnvVars['VITE_APP_URL'] = netlifyProject.ssl_url;
              }
              if (template.envVars.includes('VITE_API_URL')) {
                templateEnvVars['VITE_API_URL'] = `${netlifyProject.ssl_url}/api`;
              }
              if (template.envVars.includes('VITE_API_BASE_URL')) {
                templateEnvVars['VITE_API_BASE_URL'] = netlifyProject.ssl_url;
              }
              if (template.envVars.includes('NETLIFY_FUNCTIONS_URL')) {
                templateEnvVars['NETLIFY_FUNCTIONS_URL'] = '/api';
              }
              if (template.envVars.includes('CORS_ORIGIN')) {
                templateEnvVars['CORS_ORIGIN'] = netlifyProject.ssl_url;
              }
            }

            // Set environment variables
            await netlify.setupEnvironmentVariables(netlifyProject.id, {
              ...this.getEnvVarsForProvider(options.aiProvider, this.getExistingApiKey(options.aiProvider), options.model),
              ...this.getGitHubEnvVars(options.githubOrg, repoUrl),
              ...templateEnvVars
            });

            // Configure branch deployments
            await netlify.configureBranchDeployments(netlifyProject.id, {
              main: { production: true },
              develop: { preview: true },
              'feature/*': { preview: true }
            });

            this.addLog(`✅ Netlify project created: ${netlifyProject.ssl_url}`);

            // Wait for initial deployment
            try {
              this.addLog('🚀 Waiting for Netlify deployment...');
              const deployment = await netlify.waitForInitialDeployment(netlifyProject.id, 180000);
              
              if (deployment.state === 'ready') {
                this.addLog('✅ Netlify deployment completed successfully!');
              } else if (deployment.state === 'error') {
                this.addLog('❌ Netlify deployment failed - check logs');
              }
            } catch (error) {
              this.addLog('⚠️ Could not wait for deployment completion');
            }

          } catch (error) {
            this.addLog(`❌ Netlify setup failed: ${error.message}`);
            throw error;
          }
        }
      }

      // Save project configuration
      await this.saveProjectConfig({
        template: template.id,
        name: finalRepoName,
        repoUrl,
        aiProvider: options.aiProvider,
        agentMode: options.agentMode,
        orchestrationStrategy: options.orchestrationStrategy,
        model: options.model,
        netlifyProject: netlifyProject?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      this.addLog('💾 Project configuration saved');
      this.addLog('🎉 Setup complete!');

      return {
        success: true,
        repoUrl,
        netlifyProject,
        mongodbProject,
        logs: this.logs
      };

    } catch (error) {
      this.addLog(`❌ Setup failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        logs: this.logs
      };
    }
  }

  getExistingApiKey(provider: string): string | null {
    const envVarName = this.getApiKeyEnvName(provider);
    return process.env[envVarName] || null;
  }

  getApiKeyEnvName(provider: string): string {
    const envNames: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      grok: 'GROK_API_KEY'
    };

    return envNames[provider] || 'API_KEY';
  }

  generateSecureSecret(): string {
    return randomBytes(32).toString('hex');
  }

  getEnvVarsForProvider(provider: string, apiKey: string, model?: string): Record<string, string> {
    const vars: Record<string, string> = {};

    switch (provider) {
      case 'anthropic':
        vars.ANTHROPIC_API_KEY = apiKey;
        if (model) vars.CLAUDE_MODEL = model;
        break;
      case 'openai':
        vars.OPENAI_API_KEY = apiKey;
        if (model) vars.OPENAI_MODEL = model;
        break;
      case 'google':
        vars.GOOGLE_API_KEY = apiKey;
        if (model) vars.GEMINI_MODEL = model;
        break;
      case 'grok':
        vars.GROK_API_KEY = apiKey;
        if (model) vars.GROK_MODEL = model;
        break;
    }

    return vars;
  }

  getGitHubEnvVars(githubOrg: string, repoUrl: string): Record<string, string> {
    const vars: Record<string, string> = {};

    if (process.env.GITHUB_TOKEN) {
      vars.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    }

    vars.GITHUB_ORG = githubOrg;
    vars.GITHUB_USERNAME = githubOrg;

    const repoMatch = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
    if (repoMatch) {
      vars.GITHUB_REPO = repoMatch[1];
      vars.GITHUB_REPOSITORY = `${githubOrg}/${repoMatch[1]}`;
    }

    vars.GITHUB_REPO_URL = repoUrl;

    return vars;
  }

  private async saveProjectConfig(config: any): Promise<void> {
    try {
      const configPath = join(process.cwd(), '.dev-agent.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error: any) {
      console.warn('Failed to save project config:', error.message);
      // Don't throw here, just log warning since config saving is not critical
    }
  }
}