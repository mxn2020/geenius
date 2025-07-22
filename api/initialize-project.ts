// AI-Driven Project Initialization - Complete template generation
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';
import { EnhancedGitHubService, FileChange } from './shared/enhanced-github-service';
import { AIFileProcessor } from './shared/ai-file-processor';
import { NetlifyService } from './shared/netlify-service';
import { DevIdRegistryScanner, RegistryContext } from './shared/devid-registry-scanner';
import { CustomAIAgent } from './shared/custom-ai-agent';

// Core template files for project initialization
const CORE_TEMPLATE_FILES = [
  'src/App.tsx',
  'src/pages/Landing.tsx',
  'src/components/auth/Dashboard.tsx',
  'prisma/schema.prisma',
  'tailwind.config.js'
];

interface ProjectInitRequest {
  // Support both new and legacy parameter formats
  userRequirements?: string;        // "doctor website with client and appointment management"
  projectRequirements?: string;     // Legacy parameter name (same as userRequirements)
  businessDomain?: string;          // "medical", "legal", "restaurant", etc.
  projectId?: string;               // Unique identifier for the project
  repositoryUrl?: string;           // Target template repository
  aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
  baseBranch?: string;             // Usually 'main' or 'develop'
  
  // Web UI compatibility parameters
  projectName?: string;             // Project name from web UI
  templateId?: string;              // Template ID from web UI
  githubOrg?: string;               // GitHub organization from web UI
  agentMode?: string;               // Agent mode from web UI
  orchestrationStrategy?: string;   // Orchestration strategy from web UI
  model?: string;                   // AI model from web UI
  autoSetup?: boolean;              // Auto setup flag from web UI
  mongodbOrgId?: string;            // MongoDB org ID from web UI
  mongodbProjectId?: string;        // MongoDB project ID from web UI
}

interface ProjectInitResponse {
  success: boolean;
  sessionId: string;
  message: string;
  statusUrl: string;
  generatedFiles: string[];
  estimatedProcessingTime: number;
  error?: string;
}

interface TemplateFileContent {
  path: string;
  content: string;
  purpose: string; // Description of what this file does
}

// Initialize services
const sessionManager = new EnhancedSessionManager();
const githubService = new EnhancedGitHubService();
const netlifyService = new NetlifyService();

/**
 * Get environment variables for AI provider
 */
function getEnvVarsForProvider(provider: string, model?: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
  // Get API key from environment
  const getApiKey = (provider: string): string => {
    const envNames: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      grok: 'GROK_API_KEY'
    };
    return process.env[envNames[provider]] || '';
  };

  const apiKey = getApiKey(provider);
  
  switch (provider) {
    case 'anthropic':
      if (apiKey) vars.ANTHROPIC_API_KEY = apiKey;
      if (model) vars.CLAUDE_MODEL = model;
      break;
    case 'openai':
      if (apiKey) vars.OPENAI_API_KEY = apiKey;
      if (model) vars.OPENAI_MODEL = model;
      break;
    case 'google':
      if (apiKey) vars.GOOGLE_API_KEY = apiKey;
      if (model) vars.GEMINI_MODEL = model;
      break;
    case 'grok':
      if (apiKey) vars.GROK_API_KEY = apiKey;
      if (model) vars.GROK_MODEL = model;
      break;
  }

  // Add GitHub token if available
  if (process.env.GITHUB_TOKEN) {
    vars.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }

  return vars;
}

/**
 * Helper function to log to enhanced session manager
 */
async function logInitialization(sessionId: string, level: 'info' | 'success' | 'warning' | 'error', message: string, metadata?: Record<string, any>): Promise<void> {
  await sessionManager.addLog(sessionId, level, message, metadata);
}

/**
 * Retrieve template files from repository
 */
async function retrieveTemplateFiles(repoUrl: string, baseBranch: string): Promise<TemplateFileContent[]> {
  const templateFiles: TemplateFileContent[] = [];
  
  for (const filePath of CORE_TEMPLATE_FILES) {
    try {
      const content = await githubService.getFileContent(repoUrl, filePath, baseBranch);
      
      // Add purpose description based on file
      let purpose = '';
      switch (filePath) {
        case 'src/App.tsx':
          purpose = 'Main application component with routing and authentication setup';
          break;
        case 'src/pages/Landing.tsx':
          purpose = 'Landing page template with hero section, features, and call-to-action areas';
          break;
        case 'src/components/auth/Dashboard.tsx':
          purpose = 'Dashboard component for authenticated users with navigation and content areas';
          break;
        case 'prisma/schema.prisma':
          purpose = 'Database schema defining data models and relationships';
          break;
        case 'tailwind.config.js':
          purpose = 'Tailwind CSS configuration for styling, colors, and design system';
          break;
        default:
          purpose = `Template file for ${filePath}`;
      }
      
      templateFiles.push({
        path: filePath,
        content,
        purpose
      });
      
      console.log(`[PROJECT-INIT] Retrieved template file: ${filePath} (${content.length} chars)`);
      
    } catch (error) {
      console.error(`[PROJECT-INIT] Failed to retrieve ${filePath}:`, error);
      throw new Error(`Could not retrieve required template file: ${filePath}`);
    }
  }
  
  return templateFiles;
}

/**
 * Generate comprehensive AI prompt for project initialization
 */
function generateProjectInitPrompt(
  userRequirements: string,
  businessDomain: string,
  templateFiles: TemplateFileContent[]
): string {
  return `
You are a senior full-stack developer tasked with creating a complete new project based on user requirements and existing template files.

## User Requirements
**Business Domain**: ${businessDomain}
**Requirements**: ${userRequirements}

## Template Files Analysis
You have access to these template files that show the coding patterns, structure, and conventions:

${templateFiles.map(file => `
### ${file.path}
**Purpose**: ${file.purpose}
**Current Content**:
\`\`\`${file.path.endsWith('.prisma') ? 'prisma' : 'typescript'}
${file.content}
\`\`\`
`).join('\n')}

## Your Task
Create a complete new project that fulfills the user requirements while following the EXACT same coding patterns, structure, and conventions as the template files.

### Requirements:
1. **Maintain Template Structure**: Follow the same component architecture, import patterns, and file organization
2. **Use Dev-Container System**: All UI components MUST use the dev-container wrapper system with devId props
3. **Component Registration**: Use appropriate componentIds that follow the template's naming conventions
4. **Simple State Management**: Keep state management simple, avoid complex patterns
5. **Database Design**: Create appropriate Prisma models for the business requirements
6. **Business Logic**: Implement the specific functionality requested by the user
7. **UI/UX Consistency**: Maintain the same styling approach and component usage patterns

### Specific Instructions:
- **Landing Page**: Create a new landing page that serves the business domain with relevant sections
- **Dashboard**: Update the dashboard with navigation items specific to the business requirements  
- **Database Schema**: Add appropriate models for the business data (clients, appointments, etc.)
- **App Structure**: Update routing and authentication flow as needed
- **Tailwind Config**: Customize colors, fonts, and design tokens to match the business domain theme

### Business Domain Guidelines:
- **Medical/Healthcare**: Focus on appointments, patient management, HIPAA considerations. Colors: blues, greens (trust, health)
- **Legal**: Focus on client management, case tracking, document management. Colors: navy, gold (professionalism, authority)
- **Restaurant**: Focus on reservations, menu management, ordering. Colors: warm reds, oranges (appetite, warmth)
- **Retail**: Focus on products, inventory, customer management. Colors: brand-appropriate, vibrant (engagement, sales)
- **Service**: Focus on bookings, service management, client tracking. Colors: blues, teals (reliability, service)
- **Finance**: Focus on accounts, transactions, reporting. Colors: greens, blues (money, trust)
- **Education**: Focus on courses, students, assignments. Colors: blues, purples (learning, growth)
- **Technology**: Focus on products, features, documentation. Colors: modern grays, blues (innovation, tech)
- **Other**: Adapt colors and styling to match the specific business needs described

## Response Format
Provide your complete response in this exact format:

---METADATA---
{
  "success": true,
  "explanation": "Detailed explanation of what was created and the approach taken",
  "businessFocus": ["list of main business features implemented"],
  "databaseModels": ["list of new Prisma models created"],
  "generatedFiles": ["${CORE_TEMPLATE_FILES.join('", "')}"],
  "additionalFeatures": ["any extra features or components created"]
}
---FILES---
${CORE_TEMPLATE_FILES.map(file => `
---FILE:${file}---
[Complete file content here following the template patterns]
---END:${file}---
`).join('')}
---END---

## Important Notes:
- Generate COMPLETE files, not partial code snippets
- Ensure all imports, exports, and dependencies are correct
- Follow TypeScript best practices
- Maintain component dev-container integration
- Use semantic and meaningful component IDs
- Keep the same styling approach (Tailwind CSS classes)
- Ensure database relationships are properly defined
- Test that the generated code would compile and run

If you cannot complete the generation safely, use this error format:
---METADATA---
{
  "success": false,
  "error": "Detailed explanation of why generation cannot be completed",
  "suggestions": ["alternative approaches or requirements needed"]
}
---END---
`;
}

/**
 * Parse AI response into structured file changes
 */
function parseAIResponse(response: string): {
  success: boolean;
  metadata: any;
  files: { path: string; content: string }[];
  error?: string;
} {
  try {
    console.log(`[PROJECT-INIT] Parsing AI response (${response.length} chars)`);
    
    // Extract metadata
    const metadataMatch = response.match(/---METADATA---\s*([\s\S]*?)\s*---(?:FILES|END)---/);
    if (!metadataMatch) {
      throw new Error('No metadata section found in AI response');
    }
    
    const metadata = JSON.parse(metadataMatch[1].trim());
    console.log(`[PROJECT-INIT] Parsed metadata:`, metadata);
    
    if (!metadata.success) {
      return {
        success: false,
        metadata,
        files: [],
        error: metadata.error || 'AI generation failed'
      };
    }
    
    // Extract files
    const files: { path: string; content: string }[] = [];
    
    for (const filePath of CORE_TEMPLATE_FILES) {
      const fileRegex = new RegExp(`---FILE:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}---\\s*([\\s\\S]*?)\\s*---END:${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}---`, 'm');
      const fileMatch = response.match(fileRegex);
      
      if (fileMatch) {
        const content = fileMatch[1].trim();
        files.push({
          path: filePath,
          content
        });
        console.log(`[PROJECT-INIT] Extracted file: ${filePath} (${content.length} chars)`);
      } else {
        console.warn(`[PROJECT-INIT] File not found in response: ${filePath}`);
      }
    }
    
    if (files.length === 0) {
      throw new Error('No files were extracted from AI response');
    }
    
    return {
      success: true,
      metadata,
      files
    };
    
  } catch (error) {
    console.error(`[PROJECT-INIT] Error parsing AI response:`, error);
    return {
      success: false,
      metadata: {},
      files: [],
      error: `Failed to parse AI response: ${error.message}`
    };
  }
}


/**
 * Process standard deployment without AI customization
 */
async function processStandardDeployment(sessionId: string, request: ProjectInitRequest): Promise<void> {
  // Phase 1: Prepare for Standard Deployment
  await sessionManager.updateSessionStatus(sessionId, 'preparing', 20, 'Preparing standard deployment...');
  
  const session = await sessionManager.getSession(sessionId);
  if (!session) throw new Error('Session not found');
  
  await logInitialization(sessionId, 'info', '📋 Using standard template without AI customization - repository is already created');

  // Phase 2: Setup Infrastructure (same as AI mode but without file generation)
  await sessionManager.updateSessionStatus(sessionId, 'setting_up_infrastructure', 40, 'Setting up database and deployment...');
  
  let mongodbProject = null;
  let netlifyProject = null;
  
  try {
    await logInitialization(sessionId, 'info', '🏗️ Setting up database and deployment infrastructure...');
    
    // MongoDB setup (same logic as AI mode)
    if (request.autoSetup !== false && process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY) {
      try {
        await logInitialization(sessionId, 'info', '🍃 Setting up MongoDB database...');
        
        const { MongoDBService } = await import('../src/services/mongodb');
        const mongodbService = new MongoDBService();
        
        let selectedOrgId = request.mongodbOrgId;
        let selectedProjectId = request.mongodbProjectId;
        
        if (!selectedOrgId) {
          const organizations = await mongodbService.getOrganizations();
          if (organizations.length > 0) {
            selectedOrgId = organizations[0].id;
            await logInitialization(sessionId, 'info', `📁 Using MongoDB organization: ${organizations[0].name}`);
          }
        }
        
        if (!selectedProjectId && selectedOrgId) {
          selectedProjectId = 'CREATE_NEW';
        }
        
        if (selectedOrgId && selectedProjectId) {
          mongodbProject = await mongodbService.createProjectWithSelection(
            request.projectName,
            selectedOrgId,
            selectedProjectId,
            (message: string) => logInitialization(sessionId, 'info', message)
          );
          
          await logInitialization(sessionId, 'success', `✅ MongoDB database created: ${mongodbProject.databaseName}`);
        }
      } catch (mongoError) {
        await logInitialization(sessionId, 'warning', `⚠️ MongoDB setup failed: ${mongoError.message}`);
      }
    }
    
    // Netlify setup (same logic as AI mode)
    if (request.autoSetup !== false && process.env.NETLIFY_TOKEN) {
      try {
        await logInitialization(sessionId, 'info', '🚀 Setting up Netlify project...');
        
        netlifyProject = await netlifyService.createProject(request.projectName, request.repositoryUrl);
        
        // Get template and setup environment variables
        const { TemplateRegistry } = await import('../src/services/template-registry');
        const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
        const templates = await templateRegistry.getAllTemplates();
        const template = templates.find(t => t.id === request.templateId);
        
        if (template) {
          const templateEnvVars = template.envVars.reduce((acc, envVar) => ({ ...acc, [envVar]: '' }), {});
          
          // Add MongoDB connection if available
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
          
          // Add standard env vars
          if (template.envVars.includes('VITE_APP_NAME')) {
            templateEnvVars['VITE_APP_NAME'] = request.projectName;
          }
          if (template.envVars.includes('VITE_REPOSITORY_URL')) {
            templateEnvVars['VITE_REPOSITORY_URL'] = request.repositoryUrl;
          }
          if (template.envVars.includes('VITE_BASE_BRANCH')) {
            templateEnvVars['VITE_BASE_BRANCH'] = 'main';
          }
          
          const aiProviderVars = getEnvVarsForProvider(request.aiProvider || 'anthropic', request.model);
          
          await netlifyService.setupEnvironmentVariables(netlifyProject.id, {
            ...aiProviderVars,
            ...templateEnvVars
          });
          
          await netlifyService.configureBranchDeployments(netlifyProject.id, {
            main: { production: true },
            develop: { preview: true },
            'feature/*': { preview: true }
          });
          
          await logInitialization(sessionId, 'success', `✅ Netlify project created: ${netlifyProject.ssl_url}`);
        }
      } catch (netlifyError) {
        await logInitialization(sessionId, 'warning', `⚠️ Netlify setup failed: ${netlifyError.message}`);
      }
    }
    
    // Store infrastructure results in session
    if (session) {
      if (netlifyProject) {
        session.netlifyUrl = netlifyProject.ssl_url;
        session.netlifyProjectId = netlifyProject.id;
      }
      
      if (mongodbProject) {
        session.mongodbDatabase = mongodbProject.databaseName;
        session.mongodbCluster = mongodbProject.clusterName;
        session.mongodbConnectionString = mongodbProject.connectionString;
      }
      
      await sessionManager.setSession(sessionId, session);
    }
    
  } catch (infraError) {
    await logInitialization(sessionId, 'warning', `⚠️ Infrastructure setup failed: ${infraError.message}`);
  }

  // Phase 3: Wait for Deployment
  await sessionManager.updateSessionStatus(sessionId, 'deploying', 80, 'Deploying standard template...');
  
  try {
    if (netlifyProject) {
      await logInitialization(sessionId, 'info', '🚀 Waiting for Netlify deployment...');
      const deployment = await netlifyService.waitForInitialDeployment(
        netlifyProject.id, 
        300000,
        (message: string) => logInitialization(sessionId, 'info', message)
      );
      
      if (deployment.state === 'ready') {
        const deployUrl = deployment.deploy_ssl_url || netlifyProject.ssl_url;
        await sessionManager.setPreviewUrl(sessionId, deployUrl);
        await logInitialization(sessionId, 'success', '🌐 Standard deployment ready!', {
          deploymentUrl: deployUrl
        });
        await sessionManager.updateSessionStatus(sessionId, 'deployed', 98, 'Standard deployment ready');
      }
    }
  } catch (deployError) {
    await logInitialization(sessionId, 'warning', 
      `⚠️ Deployment check failed: ${deployError.message}`
    );
  }

  // Phase 4: Complete
  await sessionManager.updateSessionStatus(sessionId, 'completed', 100, 'Standard deployment completed!');
  await sessionManager.setCompleted(sessionId);
  
  await logInitialization(sessionId, 'success', 
    `🎉 Standard deployment completed successfully!`,
    { 
      businessDomain: request.businessDomain,
      repositoryUrl: request.repositoryUrl,
      deploymentUrl: session.previewUrl,
      netlifyUrl: netlifyProject?.ssl_url,
      mongodbDatabase: mongodbProject?.databaseName,
      deploymentType: 'standard',
      infrastructureSetup: {
        mongodb: !!mongodbProject,
        netlify: !!netlifyProject,
        environmentVariables: !!(netlifyProject && mongodbProject)
      }
    }
  );

  // Log infrastructure URLs for visibility
  if (netlifyProject) {
    await logInitialization(sessionId, 'success', `🌐 Netlify URL: ${netlifyProject.ssl_url}`);
  }
  if (mongodbProject) {
    await logInitialization(sessionId, 'success', `🍃 MongoDB Database: ${mongodbProject.databaseName}`);
    await logInitialization(sessionId, 'success', `🔗 MongoDB Connection: ${mongodbProject.connectionString}`);
  }
}

/**
 * Main project initialization processing function
 */
async function processProjectInitialization(sessionId: string, request: ProjectInitRequest): Promise<void> {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if we should use AI customization or standard deployment
    const userRequirements = request.userRequirements || request.projectRequirements || '';
    const hasProjectRequirements = userRequirements.trim().length > 0;
    
    if (!hasProjectRequirements) {
      await logInitialization(sessionId, 'info', '📋 No project requirements provided - proceeding with standard template deployment (no AI)');
      return await processStandardDeployment(sessionId, request);
    }
    
    await logInitialization(sessionId, 'info', '🤖 Project requirements provided - proceeding with AI-powered customization');
    // Update the request with the unified requirements
    request.userRequirements = userRequirements;

    // Phase 1: Template Analysis (AI customization path)
    await sessionManager.updateSessionStatus(sessionId, 'analyzing', 10, 'Analyzing template structure...');
    await logInitialization(sessionId, 'info', '🔍 Retrieving template files for AI customization');
    
    const templateFiles = await retrieveTemplateFiles(request.repositoryUrl, request.baseBranch || 'main');
    await logInitialization(sessionId, 'success', `📁 Retrieved ${templateFiles.length} template files for customization`, {
      files: templateFiles.map(f => ({ path: f.path, size: f.content.length }))
    });

    // Phase 2: AI Generation
    await sessionManager.updateSessionStatus(sessionId, 'processing', 30, 'Generating project with AI...');
    await logInitialization(sessionId, 'info', '🤖 Generating complete project with AI agent');
    
    // Create AI agent for project generation
    const mockSandbox = {
      readFile: async (path: string) => '',
      writeFile: async (path: string, content: string) => { },
      listFiles: async (path: string) => [],
      gitClone: async (url: string, branch: string) => 'Cloned successfully',
      gitCreateBranch: async (name: string) => 'Branch created',
      gitCommit: async (message: string) => 'Committed',
      runTests: async (path?: string) => 'Tests passed',
      runCommand: async (command: string, options?: any) => 'Command executed',
      createPullRequest: async (title: string, description: string) => ({ url: 'https://github.com/mock/pr' })
    };

    const aiAgent = new CustomAIAgent({
      sessionId: 'project-init',
      sandbox: mockSandbox,
      repositoryUrl: request.repositoryUrl,
      provider: request.aiProvider || 'anthropic',
      model: 'default',
      projectContext: {
        componentRegistry: {},
        dependencies: {},
        framework: 'react',
        structure: 'typescript'
      }
    });
    
    const prompt = generateProjectInitPrompt(request.userRequirements, request.businessDomain, templateFiles);
    console.log(`[PROJECT-INIT] Generated prompt (${prompt.length} chars)`);
    
    const aiResponse = await aiAgent.processRequest(prompt);
    console.log(`[PROJECT-INIT] AI response received (${aiResponse.length} chars)`);
    
    // Phase 3: Parse and Validate Response
    await sessionManager.updateSessionStatus(sessionId, 'processing', 50, 'Processing AI-generated files...');
    
    const parseResult = parseAIResponse(aiResponse);
    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Failed to generate project files');
    }
    
    await logInitialization(sessionId, 'success', 
      `✅ AI generated ${parseResult.files.length} project files`,
      { 
        businessFocus: parseResult.metadata.businessFocus,
        databaseModels: parseResult.metadata.databaseModels,
        generatedFiles: parseResult.metadata.generatedFiles
      }
    );

    // Phase 4: Prepare for Direct Main Branch Commits  
    await sessionManager.updateSessionStatus(sessionId, 'preparing_commits', 60, 'Preparing to update main branch...');
    await logInitialization(sessionId, 'info', '📝 Preparing to commit directly to main branch');

    // Phase 5: Process Files with DevId Registration
    await sessionManager.updateSessionStatus(sessionId, 'processing', 70, 'Processing and registering components...');
    
    const fileChanges: FileChange[] = parseResult.files.map(file => ({
      path: file.path,
      content: file.content,
      message: `init: create ${file.path} for ${request.businessDomain} project\n\n${parseResult.metadata.explanation}`
    }));
    
    // Run DevId scanner on generated files
    try {
      const registryContext: RegistryContext = {
        templatePath: '',
        registryDataPath: '',
        repositoryUrl: request.repositoryUrl
      };
      
      const registryScanner = new DevIdRegistryScanner(registryContext);
      const scanResults = await registryScanner.scanAndRegisterDevIds(
        fileChanges.map(fc => ({ path: fc.path, content: fc.content }))
      );
      
      if (scanResults.newDevIds.length > 0) {
        await logInitialization(sessionId, 'success', 
          `📋 Auto-registered ${scanResults.registeredCount} new component usages`,
          { newDevIds: scanResults.newDevIds.map(d => d.id) }
        );
      }
    } catch (registryError) {
      await logInitialization(sessionId, 'warning', 
        `⚠️ Component registry scanning failed: ${registryError.message}`
      );
    }

    // Phase 6: Setup Infrastructure (MongoDB & Netlify)
    await sessionManager.updateSessionStatus(sessionId, 'setting_up_infrastructure', 75, 'Setting up database and deployment...');
    
    let mongodbProject = null;
    let netlifyProject = null;
    
    try {
      await logInitialization(sessionId, 'info', '🏗️ Setting up database and deployment infrastructure...');
      
      // Setup MongoDB database if template requires it and credentials are available
      if (request.autoSetup !== false && process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY) {
        try {
          await logInitialization(sessionId, 'info', '🍃 Setting up MongoDB database...');
          
          const { MongoDBService } = await import('../src/services/mongodb');
          const mongodbService = new MongoDBService();
          
          // Use the same logic as non-AI mode for MongoDB setup
          let selectedOrgId = request.mongodbOrgId;
          let selectedProjectId = request.mongodbProjectId;
          
          if (!selectedOrgId) {
            const organizations = await mongodbService.getOrganizations();
            if (organizations.length > 0) {
              selectedOrgId = organizations[0].id;
              await logInitialization(sessionId, 'info', `📁 Using MongoDB organization: ${organizations[0].name}`);
            }
          }
          
          if (!selectedProjectId && selectedOrgId) {
            selectedProjectId = 'CREATE_NEW';
          }
          
          if (selectedOrgId && selectedProjectId) {
            mongodbProject = await mongodbService.createProjectWithSelection(
              request.projectName,
              selectedOrgId,
              selectedProjectId,
              (message: string) => logInitialization(sessionId, 'info', message)
            );
            
            await logInitialization(sessionId, 'success', `✅ MongoDB database created: ${mongodbProject.databaseName}`);
          }
        } catch (mongoError) {
          await logInitialization(sessionId, 'warning', `⚠️ MongoDB setup failed: ${mongoError.message}`);
        }
      }
      
      // Setup Netlify project if enabled
      if (request.autoSetup !== false && process.env.NETLIFY_TOKEN) {
        try {
          await logInitialization(sessionId, 'info', '🚀 Setting up Netlify project...');
          
          netlifyProject = await netlifyService.createProject(request.projectName, request.repositoryUrl);
          
          // Get template information for environment variables
          const { TemplateRegistry } = await import('../src/services/template-registry');
          const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
          const templates = await templateRegistry.getAllTemplates();
          const template = templates.find(t => t.id === request.templateId);
          
          if (template) {
            // Prepare environment variables (same logic as non-AI mode)
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
            
            // Add other environment variables
            if (template.envVars.includes('VITE_APP_NAME')) {
              templateEnvVars['VITE_APP_NAME'] = request.projectName;
            }
            if (template.envVars.includes('VITE_REPOSITORY_URL')) {
              templateEnvVars['VITE_REPOSITORY_URL'] = request.repositoryUrl;
            }
            if (template.envVars.includes('VITE_BASE_BRANCH')) {
              templateEnvVars['VITE_BASE_BRANCH'] = 'main';
            }
            
            // Get AI provider env vars
            const aiProviderVars = getEnvVarsForProvider(request.aiProvider || 'anthropic', request.model);
            
            // Set environment variables
            await netlifyService.setupEnvironmentVariables(netlifyProject.id, {
              ...aiProviderVars,
              ...templateEnvVars
            });
            
            // Configure branch deployments with PR previews
            await netlifyService.configureBranchDeployments(netlifyProject.id, {
              main: { production: true },
              develop: { preview: true },
              'feature/*': { preview: true }
            });
            
            await logInitialization(sessionId, 'success', `✅ Netlify project created: ${netlifyProject.ssl_url}`);
          }
          
        } catch (netlifyError) {
          await logInitialization(sessionId, 'warning', `⚠️ Netlify setup failed: ${netlifyError.message}`);
        }
      }
      
      // Store infrastructure results in session
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        if (netlifyProject) {
          session.netlifyUrl = netlifyProject.ssl_url;
          session.netlifyProjectId = netlifyProject.id;
        }
        
        if (mongodbProject) {
          session.mongodbDatabase = mongodbProject.databaseName;
          session.mongodbCluster = mongodbProject.clusterName;
          session.mongodbConnectionString = mongodbProject.connectionString;
        }
        
        await sessionManager.setSession(sessionId, session);
      }
      
      await logInitialization(sessionId, 'success', '✅ Infrastructure setup completed');
      
    } catch (infraError) {
      await logInitialization(sessionId, 'warning', 
        `⚠️ Infrastructure setup failed: ${infraError.message}`
      );
    }

    // Phase 7: Commit Generated Files to Main Branch
    await sessionManager.updateSessionStatus(sessionId, 'committing', 80, 'Committing project files to main branch...');
    
    const commits = await githubService.commitChanges(
      request.repositoryUrl,
      session.baseBranch, // Commit directly to main branch
      fileChanges
    );
    
    for (const commit of commits) {
      await sessionManager.addCommit(sessionId, {
        sha: commit.sha,
        message: commit.message,
        url: commit.url,
        filePath: fileChanges.find(fc => fc.message === commit.message)?.path || 'unknown'
      });
    }
    
    await logInitialization(sessionId, 'success', 
      `📝 Committed ${commits.length} files directly to ${session.baseBranch} branch`,
      { commitCount: commits.length, branch: session.baseBranch }
    );

    // Phase 8: Wait for Deployment 
    await sessionManager.updateSessionStatus(sessionId, 'deploying', 90, 'Waiting for deployment...');
    
    try {
      if (netlifyProject) {
        // Wait for the initial deployment of our Netlify project
        await logInitialization(sessionId, 'info', '🚀 Waiting for Netlify deployment...');
        const deployment = await netlifyService.waitForInitialDeployment(
          netlifyProject.id, 
          300000,
          (message: string) => logInitialization(sessionId, 'info', message)
        );
        
        if (deployment.state === 'ready') {
          const deployUrl = deployment.deploy_ssl_url || netlifyProject.ssl_url;
          await sessionManager.setPreviewUrl(sessionId, deployUrl);
          await logInitialization(sessionId, 'success', '🌐 Project deployment ready!', {
            deploymentUrl: deployUrl
          });
          await sessionManager.updateSessionStatus(sessionId, 'deployed', 98, 'Project successfully deployed');
        } else if (deployment.state === 'error') {
          await logInitialization(sessionId, 'warning', '❌ Netlify deployment failed - check logs');
        }
      } else {
        await logInitialization(sessionId, 'info', '⚠️ No Netlify project - skipping deployment wait');
      }
    } catch (deployError) {
      await logInitialization(sessionId, 'warning', 
        `⚠️ Deployment check failed: ${deployError.message}`
      );
    }

    // Phase 9: Complete
    await sessionManager.updateSessionStatus(sessionId, 'completed', 100, 'Project initialization completed!');
    await sessionManager.setCompleted(sessionId);
    
    await logInitialization(sessionId, 'success', 
      `🎉 Project initialization completed successfully!`,
      { 
        businessDomain: request.businessDomain,
        generatedFiles: parseResult.files.length,
        repositoryUrl: request.repositoryUrl,
        deploymentUrl: session.previewUrl,
        netlifyUrl: netlifyProject?.ssl_url,
        mongodbDatabase: mongodbProject?.databaseName,
        mongodbCluster: mongodbProject?.clusterName,
        infrastructureSetup: {
          mongodb: !!mongodbProject,
          netlify: !!netlifyProject,
          environmentVariables: !!(netlifyProject && mongodbProject)
        }
      }
    );

    // Log individual infrastructure components for better visibility
    if (netlifyProject) {
      await logInitialization(sessionId, 'success', `🌐 Netlify URL: ${netlifyProject.ssl_url}`);
    }
    if (mongodbProject) {
      await logInitialization(sessionId, 'success', `🍃 MongoDB Database: ${mongodbProject.databaseName}`);
      await logInitialization(sessionId, 'success', `🔗 MongoDB Connection: ${mongodbProject.connectionString}`);
    }

  } catch (error) {
    console.error('[PROJECT-INIT] Processing error:', error);
    await sessionManager.setError(sessionId, `Project initialization failed: ${error.message}`);
    await logInitialization(sessionId, 'error', `❌ ${error.message}`);
  }
}


/**
 * Main handler function
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Handle GET request for session status
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/');
      const sessionId = pathParts[pathParts.length - 1];

      if (!sessionId || sessionId === 'initialize-project') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Session ID required' })
        };
      }

      const sessionSummary = await sessionManager.getSessionSummary(sessionId);
      if (!sessionSummary) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(sessionSummary)
      };
    }

    // Handle POST request for project initialization
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }

      const request: ProjectInitRequest = JSON.parse(event.body);

      // Transform web UI parameters to initialize-project format
      const normalizedRequest = {
        userRequirements: request.userRequirements || request.projectRequirements || '',
        businessDomain: request.businessDomain || 'general',
        projectId: request.projectId || request.projectName || `project-${Date.now()}`,
        repositoryUrl: request.repositoryUrl || '', // Will be resolved from template
        aiProvider: request.aiProvider || 'anthropic',
        baseBranch: request.baseBranch || 'main',
        
        // Pass through web UI parameters for processing
        projectName: request.projectName,
        templateId: request.templateId,
        githubOrg: request.githubOrg,
        agentMode: request.agentMode,
        orchestrationStrategy: request.orchestrationStrategy,
        model: request.model,
        autoSetup: request.autoSetup,
        mongodbOrgId: request.mongodbOrgId,
        mongodbProjectId: request.mongodbProjectId
      };

      // Validate essential fields for web UI compatibility
      if (!normalizedRequest.projectName || !normalizedRequest.templateId || !normalizedRequest.githubOrg) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing required fields: projectName, templateId, githubOrg' 
          })
        };
      }

      // Resolve template repository URL and CREATE NEW USER REPOSITORY
      if (!normalizedRequest.repositoryUrl && normalizedRequest.templateId) {
        try {
          const { TemplateRegistry } = await import('../src/services/template-registry');
          // Use the web API GitHub service, not the CLI one
          const { EnhancedGitHubService } = await import('./shared/enhanced-github-service');
          
          const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
          const templates = await templateRegistry.getAllTemplates();
          const template = templates.find(t => t.id === normalizedRequest.templateId);
          
          if (!template) {
            throw new Error(`Template not found: ${normalizedRequest.templateId}`);
          }
          
          // Create new repository from template for the user
          const github = new EnhancedGitHubService();
          const newRepoUrl = await github.createFromTemplate(
            template.repository,
            normalizedRequest.projectName,
            normalizedRequest.githubOrg
          );
          
          normalizedRequest.repositoryUrl = newRepoUrl;
          console.log(`[PROJECT-INIT] Created new repository: ${newRepoUrl}`);
          
        } catch (error) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Repository creation error: ${error.message}` })
          };
        }
      }

      // Create initialization session
      const session = await sessionManager.createSession(
        normalizedRequest.projectId || `init-${Date.now()}`,
        normalizedRequest.projectId,
        normalizedRequest.repositoryUrl,
        [], // No specific change requests for initialization
        {
          aiProvider: normalizedRequest.aiProvider || 'anthropic',
          baseBranch: normalizedRequest.baseBranch || 'main',
          autoTest: false,
          sessionType: 'INIT'
        }
      );

      // Start processing asynchronously
      processProjectInitialization(session.id, normalizedRequest).catch(error => {
        console.error('[PROJECT-INIT] Processing error:', error);
      });

      const response: ProjectInitResponse = {
        success: true,
        sessionId: session.id,
        message: 'Project initialization started successfully.',
        statusUrl: `${process.env.URL}/api/initialize-project/${session.id}`,
        generatedFiles: CORE_TEMPLATE_FILES,
        estimatedProcessingTime: session.estimatedCompletionTime! - session.startTime
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('[PROJECT-INIT] Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};