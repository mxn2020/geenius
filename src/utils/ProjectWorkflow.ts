// Project workflow utilities for web app
import { NetlifyService } from '../services/netlify';
import { MongoDBService } from '../services/mongodb';
import { GitHubService } from '../services/github';
import { TemplateRegistry } from '../services/template-registry';
import { randomBytes } from 'crypto';

const netlifyService = new NetlifyService();
const mongodbService = new MongoDBService();

export class ProjectWorkflow {
  private logs: string[];
  private logger?: (level: string, message: string) => void;

  constructor(logger?: (level: string, message: string) => void) {
    this.logs = [];
    this.logger = logger;
  }

  addLog(message: string): void {
    this.logs.push(message);
    console.log(message);
    // Send to external logger if provided
    if (this.logger) {
      const level = message.includes('❌') ? 'error' : 
                   message.includes('⚠️') ? 'warning' :
                   message.includes('✅') ? 'success' : 'info';
      this.logger(level, message);
    }
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
      if (!netlifyService) {
        throw new Error('Netlify service is not available');
      } else {
        this.addLog('✅ Netlify service initialized');
      }

      // Fork template repository
      this.addLog('🍴 Forking template repository...');
      const repoUrl = await github.forkTemplate(
        template.repository,
        options.projectName,
        options.githubOrg
      );

      this.addLog(`✅ Repository forked successfully!`);
      this.addLog(`💻 GitHub Repository: ${repoUrl}`);

      // Use the user-provided project name as the final name
      const finalRepoName = options.projectName;

      // Setup MongoDB database if template requires it
      let mongodbProject = null;
      if (template.envVars.includes('MONGODB_URI') || template.envVars.includes('DATABASE_URL')) {
        if (!process.env.MONGODB_ATLAS_PUBLIC_KEY || !process.env.MONGODB_ATLAS_PRIVATE_KEY) {
          this.addLog('⚠️ MongoDB Atlas API keys not found - skipping database setup');
        } else {
          try {
            this.addLog('🍃 Setting up MongoDB database...');
            
            // Use selected MongoDB organization and project if provided
            let selectedOrg, selectedProjectId, projects = [];
            
            this.addLog(`🔍 MongoDB selection: orgId=${options.mongodbOrgId}, projectId=${options.mongodbProjectId}`);
            
            if (options.mongodbOrgId && options.mongodbProjectId) {
              // Use user-selected organization and project
              const organizations = await mongodbService.getOrganizations();
              selectedOrg = organizations.find(org => org.id === options.mongodbOrgId);
              
              if (!selectedOrg) {
                throw new Error(`Selected MongoDB organization not found: ${options.mongodbOrgId}`);
              }
              
              if (options.mongodbProjectId === 'CREATE_NEW') {
                // Create new project with the current project name
                this.addLog(`📁 Using selected MongoDB organization: ${selectedOrg.name}`);
                this.addLog(`🆕 Creating new MongoDB project: ${options.projectName}`);
                selectedProjectId = null; // Will trigger new project creation
              } else {
                // Use existing project
                selectedProjectId = options.mongodbProjectId;
                this.addLog(`📁 Using selected MongoDB organization: ${selectedOrg.name}`);
                this.addLog(`📦 Using selected MongoDB project: ${options.mongodbProjectId}`);
              }
              
              // Get projects for retry logic
              projects = await mongodbService.getProjects(selectedOrg.id);
            } else {
              // Get first available organization (fallback)
              const organizations = await mongodbService.getOrganizations();
              if (organizations.length === 0) {
                throw new Error('No MongoDB organizations found');
              }

              selectedOrg = organizations[0];
              this.addLog(`📁 Using MongoDB organization: ${selectedOrg.name} - ${selectedOrg.created}`);

              // Get projects for organization
              projects = await mongodbService.getProjects(selectedOrg.id);
              selectedProjectId = projects.length > 0 ? projects[0].id : null;
            }
            
            // Try to create cluster, handling free cluster limit errors
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount < maxRetries) {
              try {
                mongodbProject = await mongodbService.createProjectWithSelection(
                  options.projectName,
                  selectedOrg.id,
                  selectedProjectId,
                  (message: string) => this.addLog(message) // Pass progress callback
                );
                break;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (errorMessage.includes('CANNOT_CREATE_FREE_CLUSTER_VIA_PUBLIC_API') || 
                    errorMessage.includes('reached the limit for the number of free clusters')) {
                  
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
              this.addLog(`🌐 MongoDB connection established successfully`);
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown MongoDB API error';
            this.addLog(`❌ MongoDB setup failed: ${errorMessage}`);
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
        } else if (!netlifyService) {
          this.addLog('⚠️ Netlify service not available - skipping deployment setup');
        } else {
          try {
            this.addLog('🚀 Setting up Netlify project...');
            
            // Prepare environment variables for template
            const templateEnvVars: Record<string, string> = {};

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
            } else {
              // Set placeholder values when MongoDB is not configured
              if (template.envVars.includes('MONGODB_URI')) {
                templateEnvVars['MONGODB_URI'] = 'mongodb://localhost:27017/localdb';
              }
              if (template.envVars.includes('DATABASE_URL')) {
                templateEnvVars['DATABASE_URL'] = 'mongodb://localhost:27017/localdb';
              }
            }

            // Generate secure secrets (always set these if required by template)
            if (template.envVars.includes('BETTER_AUTH_SECRET')) {
              templateEnvVars['BETTER_AUTH_SECRET'] = this.generateSecureSecret();
            }

            if (template.envVars.includes('JWT_SECRET')) {
              templateEnvVars['JWT_SECRET'] = this.generateSecureSecret();
            }

            // Set default app configuration
            if (template.envVars.includes('VITE_APP_NAME')) {
              templateEnvVars['VITE_APP_NAME'] = options.projectName;
            }

            if (template.envVars.includes('VITE_APP_VERSION')) {
              templateEnvVars['VITE_APP_VERSION'] = '1.0.0';
            }

            if (template.envVars.includes('VITE_APP_DESCRIPTION')) {
              templateEnvVars['VITE_APP_DESCRIPTION'] = `${template.description} - ${options.projectName}`;
            }

            // Always set repository URL and base branch (required for web interface)
            templateEnvVars['VITE_REPOSITORY_URL'] = repoUrl;
            templateEnvVars['VITE_BASE_BRANCH'] = 'main';

            // Log which template environment variables are being set
            this.addLog(`🔧 Setting template environment variables: ${template.envVars.join(', ')}`);
            const nonEmptyVars = Object.entries(templateEnvVars).filter(([_, value]) => value !== '').map(([key, _]) => key);
            this.addLog(`✅ Non-empty variables: ${nonEmptyVars.join(', ')}`);

            // Prepare all environment variables before creating Netlify project
            const apiKey = this.getExistingApiKey(options.aiProvider);
            if (!apiKey) {
              throw new Error(`API key for ${options.aiProvider} is required`);
            }
            
            const allEnvVars = {
              ...this.getEnvVarsForProvider(options.aiProvider, apiKey, options.model),
              ...this.getGitHubEnvVars(options.githubOrg, repoUrl),
              ...templateEnvVars
            };

            // Debug: Log all environment variables being passed to Netlify
            const envVarNames = Object.keys(allEnvVars);
            this.addLog(`🔍 All environment variables to be set (${envVarNames.length}): ${envVarNames.join(', ')}`);
            const templateVarNames = template.envVars.filter(varName => allEnvVars[varName] !== '');
            this.addLog(`📋 Template variables with values (${templateVarNames.length}): ${templateVarNames.join(', ')}`);
            
            // Filter out empty environment variables before sending to Netlify
            const filteredEnvVars = Object.entries(allEnvVars)
              .filter(([_, value]) => value !== '')
              .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
            
            this.addLog(`✅ Filtered environment variables (${Object.keys(filteredEnvVars).length}): ${Object.keys(filteredEnvVars).join(', ')}`);

            netlifyProject = await netlifyService.createProject(options.projectName, repoUrl, undefined, filteredEnvVars);

            // Set API URLs and other dynamic values based on the created Netlify project
            if (netlifyProject) {
              const dynamicEnvVars: Record<string, string> = {};
                
                // Helper to ensure URLs start with https://
                const ensureHttps = (url: string) => url.startsWith('https://') ? url : `https://${url.replace(/^http:\/\//, '').replace(/^https:\/\//, '')}`;

                if (template.envVars.includes('BETTER_AUTH_URL')) {
                dynamicEnvVars['BETTER_AUTH_URL'] = ensureHttps(netlifyProject.ssl_url);
                }
                if (template.envVars.includes('VITE_APP_URL')) {
                dynamicEnvVars['VITE_APP_URL'] = ensureHttps(netlifyProject.ssl_url);
                }
                if (template.envVars.includes('VITE_API_URL')) {
                dynamicEnvVars['VITE_API_URL'] = `${ensureHttps(netlifyProject.ssl_url)}/api`;
                }
                if (template.envVars.includes('VITE_API_BASE_URL')) {
                dynamicEnvVars['VITE_API_BASE_URL'] = ensureHttps(netlifyProject.ssl_url);
                }
                if (template.envVars.includes('NETLIFY_FUNCTIONS_URL')) {
                dynamicEnvVars['NETLIFY_FUNCTIONS_URL'] = '/api';
                }
              if (template.envVars.includes('CORS_ORIGIN')) {
                dynamicEnvVars['CORS_ORIGIN'] = netlifyProject.ssl_url;
              }

              // Update environment variables with dynamic values if there are any
              if (Object.keys(dynamicEnvVars).length > 0) {
                await netlifyService.setupEnvironmentVariables(netlifyProject.id, dynamicEnvVars);
              }
            }

            // Configure branch deployments with PR previews
            await netlifyService.configureBranchDeployments(netlifyProject.id, {
              main: { production: true },
              develop: { preview: true },
              'feature/*': { preview: true }
            });

            this.addLog(`✅ Netlify project created successfully!`);
            this.addLog(`🌐 Netlify URL: ${netlifyProject.ssl_url}`);

            // Wait for initial deployment
            try {
              this.addLog('🚀 Waiting for Netlify deployment...');
              const deployment = await netlifyService.waitForInitialDeployment(
                netlifyProject.id, 
                180000,
                (message: string) => this.addLog(message) // Pass progress callback
              );
              
              if (deployment.state === 'ready') {
                this.addLog('✅ Netlify deployment completed successfully!');
                this.addLog(`🚀 Live URL: ${deployment.deploy_ssl_url || netlifyProject.ssl_url}`);
              } else if (deployment.state === 'error') {
                this.addLog('❌ Netlify deployment failed - check logs');
              }
            } catch (error) {
              this.addLog('⚠️ Could not wait for deployment completion');
            }

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown Netlify API error';
            this.addLog(`❌ Netlify setup failed: ${errorMessage}`);
            throw error;
          }
        }
      }

      // Save project configuration to Redis only
      const projectData = {
        template: template.id,
        name: options.projectName,
        repoUrl,
        aiProvider: options.aiProvider,
        agentMode: options.agentMode,
        orchestrationStrategy: options.orchestrationStrategy,
        model: options.model,
        netlifyProject: netlifyProject?.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Add deployment URLs and MongoDB info
        repositoryUrl: repoUrl,
        netlifyUrl: netlifyProject?.ssl_url,
        mongodbOrgId: options.mongodbOrgId,
        mongodbProjectId: mongodbProject?.id,
        mongodbDatabase: mongodbProject?.databaseName
      };

      await this.saveProjectToRedis(projectData);

      this.addLog('💾 Project configuration saved to Redis');
      this.addLog('🎉 Setup complete!');

      return {
        success: true,
        repoUrl,
        netlifyProject,
        mongodbProject,
        logs: this.logs
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addLog(`❌ Setup failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
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

  private async saveProjectToRedis(projectData: any): Promise<void> {
    try {
      // Import storage service
      const { storage } = await import('../services/redis-storage');
      
      // Create project data in the format expected by Redis storage
      // Use the new Redis key format (year-month format)
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = `${year}${month}`;
      const random = Math.random().toString(36).substring(2, 10);
      
      const redisProjectData = {
        id: `proj_${yearMonth}_${random}`,
        name: projectData.name,
        template: projectData.template,
        aiProvider: projectData.aiProvider,
        agentMode: projectData.agentMode,
        orchestrationStrategy: projectData.orchestrationStrategy,
        githubOrg: process.env.GITHUB_USERNAME || 'unknown',
        repositoryUrl: projectData.repositoryUrl,
        netlifyUrl: projectData.netlifyUrl,
        mongodbOrgId: projectData.mongodbOrgId,
        mongodbProjectId: projectData.mongodbProjectId,
        mongodbDatabase: projectData.mongodbDatabase,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active' as const
      };

      await storage.storeProject(redisProjectData.id, redisProjectData);
      
      this.addLog(`💾 Project data saved to Redis with ID: ${redisProjectData.id}`);
    } catch (error: any) {
      console.warn('Failed to save project to Redis:', error.message);
      this.addLog(`⚠️ Warning: Could not save project to Redis: ${error.message}`);
      // Don't throw here, just log warning since Redis saving is not critical for initialization
    }
  }
}