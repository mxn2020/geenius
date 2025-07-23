// Infrastructure setup step (MongoDB, Netlify)

import { NetlifyService } from '../../../src/services/netlify';
import { WorkflowContext } from '../types/project-types';
import { generateTemplateEnvironmentVariables, getEnvVarsForProvider, updateUrlEnvironmentVariables } from '../utils/environment-utils';

export class InfrastructureStep {
  private netlifyService: NetlifyService;

  constructor() {
    this.netlifyService = new NetlifyService();
  }

  async execute(context: WorkflowContext, onProgress?: (message: string) => void): Promise<WorkflowContext> {
    const { sessionId, request, template } = context;
    
    console.log('[INFRASTRUCTURE-STEP] Setting up infrastructure...');
    if (onProgress) onProgress('🏗️ Setting up database and deployment infrastructure...');

    let mongodbProject = null;
    let netlifyProject = null;

    try {
      // MongoDB setup
      if (request.autoSetup !== false && process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY) {
        mongodbProject = await this.setupMongoDB(request, onProgress);
      }

      // Netlify setup
      if (request.autoSetup !== false && process.env.NETLIFY_TOKEN && template) {
        netlifyProject = await this.setupNetlify(request, template, mongodbProject, onProgress);
      }

      console.log('[INFRASTRUCTURE-STEP] ✅ Infrastructure setup completed');
      if (onProgress) onProgress('✅ Infrastructure setup completed');

      return {
        ...context,
        infrastructure: {
          mongodbProject,
          netlifyProject
        }
      };

    } catch (error: any) {
      console.error('[INFRASTRUCTURE-STEP] ❌ Infrastructure setup failed:', error.message);
      if (onProgress) onProgress(`⚠️ Infrastructure setup failed: ${error.message}`);
      
      // Don't throw - continue with partial setup
      return {
        ...context,
        infrastructure: {
          mongodbProject,
          netlifyProject
        }
      };
    }
  }

  private async setupMongoDB(request: any, onProgress?: (message: string) => void): Promise<any> {
    try {
      console.log('[INFRASTRUCTURE-STEP] 🍃 Setting up MongoDB database...');
      if (onProgress) onProgress('🍃 Setting up MongoDB database...');

      const { MongoDBService } = await import('../../../src/services/mongodb');
      const mongodbService = new MongoDBService();

      let selectedOrgId = request.mongodbOrgId;
      let selectedProjectId = request.mongodbProjectId;

      if (!selectedOrgId) {
        const organizations = await mongodbService.getOrganizations();
        if (organizations.length > 0) {
          selectedOrgId = organizations[0].id;
          console.log(`[INFRASTRUCTURE-STEP] 📁 Using MongoDB organization: ${organizations[0].name}`);
          if (onProgress) onProgress(`📁 Using MongoDB organization: ${organizations[0].name}`);
        }
      }

      if (!selectedProjectId && selectedOrgId) {
        selectedProjectId = 'CREATE_NEW';
      }

      if (selectedOrgId && selectedProjectId) {
        const mongodbProject = await mongodbService.createProjectWithSelection(
          request.projectName,
          selectedOrgId,
          selectedProjectId,
          (message: string) => {
            console.log(`[INFRASTRUCTURE-STEP] ${message}`);
            if (onProgress) onProgress(message);
          }
        );

        console.log(`[INFRASTRUCTURE-STEP] ✅ MongoDB database created: ${mongodbProject.databaseName}`);
        if (onProgress) onProgress(`✅ MongoDB database created: ${mongodbProject.databaseName}`);
        
        return mongodbProject;
      }

      return null;
    } catch (error: any) {
      console.error('[INFRASTRUCTURE-STEP] ❌ MongoDB setup failed:', error.message);
      if (onProgress) onProgress(`⚠️ MongoDB setup failed: ${error.message}`);
      return null;
    }
  }

  private async setupNetlify(request: any, template: any, mongodbProject: any, onProgress?: (message: string) => void): Promise<any> {
    try {
      console.log('[INFRASTRUCTURE-STEP] 🚀 Setting up Netlify project...');
      if (onProgress) onProgress('🚀 Setting up Netlify project...');

      // Generate environment variables
      const templateEnvVars = generateTemplateEnvironmentVariables(template, request, mongodbProject);
      const aiProviderVars = getEnvVarsForProvider(request.aiProvider || 'anthropic', request.model);
      
      // Prepare all environment variables
      const allEnvVars = {
        ...aiProviderVars,
        ...templateEnvVars
      };

      console.log(`[INFRASTRUCTURE-STEP] Setting ${Object.keys(allEnvVars).length} environment variables:`, Object.keys(allEnvVars));
      if (onProgress) onProgress(`🔧 Configuring ${Object.keys(allEnvVars).length} environment variables...`);

      // Create Netlify project
      const netlifyProject = await this.netlifyService.createProject(
        request.projectName,
        request.repositoryUrl,
        undefined,
        allEnvVars
      );

      // Configure branch deployments
      await this.netlifyService.configureBranchDeployments(netlifyProject.id, {
        main: { production: true },
        develop: { preview: true },
        'feature/*': { preview: true }
      });

      // Update URL-based environment variables with actual site URL
      await updateUrlEnvironmentVariables(
        this.netlifyService,
        netlifyProject.id,
        netlifyProject.account_id,
        netlifyProject.ssl_url || netlifyProject.url,
        template
      );

      console.log(`[INFRASTRUCTURE-STEP] ✅ Netlify project created: ${netlifyProject.ssl_url}`);
      if (onProgress) onProgress(`✅ Netlify project created: ${netlifyProject.ssl_url}`);

      return netlifyProject;

    } catch (error: any) {
      console.error('[INFRASTRUCTURE-STEP] ❌ Netlify setup failed:', error.message);
      if (onProgress) onProgress(`⚠️ Netlify setup failed: ${error.message}`);
      return null;
    }
  }
}