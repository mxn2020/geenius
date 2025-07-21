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
  'prisma/schema.prisma'
];

interface ProjectInitRequest {
  userRequirements: string;        // "doctor website with client and appointment management"
  businessDomain: string;          // "medical", "legal", "restaurant", etc.
  projectId: string;               // Unique identifier for the project
  repositoryUrl: string;           // Target template repository
  aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
  baseBranch?: string;             // Usually 'main' or 'develop'
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

### Business Domain Guidelines:
- **Medical/Healthcare**: Focus on appointments, patient management, HIPAA considerations
- **Legal**: Focus on client management, case tracking, document management
- **Restaurant**: Focus on reservations, menu management, ordering
- **Retail**: Focus on products, inventory, customer management
- **Service**: Focus on bookings, service management, client tracking

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
 * Generate branch name for project initialization
 */
function generateInitBranchName(projectId: string, businessDomain: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const domain = businessDomain.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `init/${domain}-project-${projectId}-${timestamp}`;
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

    // Phase 1: Template Analysis
    await sessionManager.updateSessionStatus(sessionId, 'analyzing', 10, 'Analyzing template structure...');
    await logInitialization(sessionId, 'info', '🔍 Retrieving template files for analysis');
    
    const templateFiles = await retrieveTemplateFiles(request.repositoryUrl, request.baseBranch || 'main');
    await logInitialization(sessionId, 'success', `📁 Retrieved ${templateFiles.length} template files`, {
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

    // Phase 4: Create Feature Branch
    await sessionManager.updateSessionStatus(sessionId, 'creating_branch', 60, 'Creating project branch...');
    
    const branchName = generateInitBranchName(request.projectId, request.businessDomain);
    await logInitialization(sessionId, 'info', `🌿 Creating branch: ${branchName}`);
    
    try {
      const branchInfo = await githubService.createFeatureBranch(
        request.repositoryUrl,
        branchName,
        session.baseBranch
      );
      await sessionManager.setBranchInfo(sessionId, branchName, `project-init-${request.businessDomain}`);
      await logInitialization(sessionId, 'success', `🌿 Created branch: ${branchName}`);
    } catch (branchError) {
      if (branchError.message.includes('Reference already exists')) {
        await logInitialization(sessionId, 'info', `Branch already exists, continuing: ${branchName}`);
      } else {
        throw branchError;
      }
    }

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

    // Phase 6: Commit Generated Files
    await sessionManager.updateSessionStatus(sessionId, 'committing', 80, 'Committing generated project...');
    
    const commits = await githubService.commitChanges(
      request.repositoryUrl,
      branchName,
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
      `📝 Committed ${commits.length} files to ${branchName}`,
      { commitCount: commits.length }
    );

    // Phase 7: Create Pull Request
    await sessionManager.updateSessionStatus(sessionId, 'pr_creating', 90, 'Creating pull request...');
    
    const prTitle = `🚀 Initialize ${request.businessDomain} project: ${request.projectId}`;
    const prBody = generateProjectPRBody(request, parseResult.metadata, commits);
    
    const prInfo = await githubService.createPullRequest(
      request.repositoryUrl,
      branchName,
      prTitle,
      prBody,
      session.baseBranch
    );
    
    await sessionManager.setPullRequestInfo(sessionId, prInfo.htmlUrl, prInfo.number);
    await logInitialization(sessionId, 'success', `🔀 Pull Request created: #${prInfo.number}`, {
      prUrl: prInfo.htmlUrl
    });

    // Phase 8: Wait for Deployment
    await sessionManager.updateSessionStatus(sessionId, 'deploying', 95, 'Waiting for preview deployment...');
    
    try {
      const deploymentResult = await netlifyService.waitForBranchDeployment(branchName, 300000);
      if (deploymentResult.success && deploymentResult.url) {
        await sessionManager.setPreviewUrl(sessionId, deploymentResult.url);
        await logInitialization(sessionId, 'success', '🌐 Preview deployment ready!', {
          previewUrl: deploymentResult.url
        });
        await sessionManager.updateSessionStatus(sessionId, 'preview_ready', 98, 'Project preview ready for review');
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
        branchName: branchName,
        prUrl: session.prUrl,
        previewUrl: session.previewUrl
      }
    );

  } catch (error) {
    console.error('[PROJECT-INIT] Processing error:', error);
    await sessionManager.setError(sessionId, `Project initialization failed: ${error.message}`);
    await logInitialization(sessionId, 'error', `❌ ${error.message}`);
  }
}

/**
 * Generate PR body for project initialization
 */
function generateProjectPRBody(
  request: ProjectInitRequest,
  metadata: any,
  commits: any[]
): string {
  return `## 🚀 AI-Generated Project Initialization

This pull request contains a complete project initialization based on user requirements.

### Project Details
- **Business Domain**: ${request.businessDomain}
- **Requirements**: ${request.userRequirements}
- **Generated Files**: ${metadata.generatedFiles?.length || 0}

### Features Implemented
${(metadata.businessFocus || []).map((feature: string) => `- ${feature}`).join('\n')}

### Database Models
${(metadata.databaseModels || []).map((model: string) => `- ${model}`).join('\n')}

### Files Modified
${(metadata.generatedFiles || []).map((file: string) => `- \`${file}\``).join('\n')}

### Additional Features
${(metadata.additionalFeatures || []).map((feature: string) => `- ${feature}`).join('\n')}

### Implementation Notes
${metadata.explanation || 'Complete project generated based on template patterns'}

### Commits
${commits.map(commit => `- \`${commit.sha.substring(0, 7)}\`: ${commit.message.split('\n')[0]}`).join('\n')}

### Testing Checklist
- [ ] Landing page displays correctly with business-appropriate content
- [ ] Dashboard navigation includes relevant sections
- [ ] Database models compile and migrate successfully
- [ ] All components use dev-container system properly
- [ ] TypeScript compilation passes
- [ ] Preview deployment works

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
`;
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

      // Validate request
      if (!request.userRequirements || !request.businessDomain || !request.repositoryUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing required fields: userRequirements, businessDomain, repositoryUrl' 
          })
        };
      }

      // Create initialization session
      const session = await sessionManager.createSession(
        request.projectId || `init-${Date.now()}`,
        request.projectId,
        request.repositoryUrl,
        [], // No specific change requests for initialization
        {
          aiProvider: request.aiProvider || 'anthropic',
          baseBranch: request.baseBranch || 'main',
          autoTest: false,
          sessionType: 'INIT'
        }
      );

      // Start processing asynchronously
      processProjectInitialization(session.id, request).catch(error => {
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