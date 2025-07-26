// AI-Driven Project Initialization - Complete template generation
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';
import { EnhancedGitHubService, FileChange } from '../src/services/enhanced-github-service';
import { NetlifyService } from '../src/services/netlify';
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

interface ParsedError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  type: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown';
}

interface FileFix {
  file: string;
  oldContent: string;
  newContent: string;
  description: string;
}

interface DeploymentErrorInfo {
  errorType: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown';
  errors: ParsedError[];
  buildLog: string;
  canFix: boolean;
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
 * Add development prefix to service names for easier identification and cleanup
 */
function addDevPrefix(name: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `dev-${name}`;
  }
  return name;
}

/**
 * Update URL-based environment variables after Netlify site creation
 */
async function updateUrlEnvironmentVariables(
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
      
      // Use the same Netlify service instance to update env vars
      const netlifyEnvVars: Record<string, string> = {};
      Object.entries(urlEnvVars).forEach(([key, value]) => {
        netlifyEnvVars[key] = value;
      });

      // Call the update method that we'll add to NetlifyService
      await netlifyService.updateEnvironmentVariables(siteId, accountId, netlifyEnvVars);
      
      console.log(`   ✅ Successfully updated URL-based environment variables`);
    } catch (error: any) {
      console.warn(`⚠️ Failed to update URL-based environment variables: ${error.message}`);
    }
  }
}

/**
 * Clean markdown code blocks and language identifiers from AI-generated code
 */
function cleanMarkdownFromCode(content: string): string {
  // Remove markdown code blocks with language identifiers
  let cleaned = content
    // Remove opening code blocks: ```typescript, ```javascript, ```tsx, etc.
    .replace(/^```\w*\s*\n?/gm, '')
    // Remove closing code blocks: ```
    .replace(/^```\s*$/gm, '')
    // Remove any remaining backticks at start/end of lines
    .replace(/^`{1,3}/gm, '')
    .replace(/`{1,3}$/gm, '');
  
  // Clean up extra whitespace but preserve intentional spacing
  cleaned = cleaned.trim();
  
  // If the content looks like it has markdown artifacts, try additional cleaning
  if (cleaned.includes('```') || cleaned.match(/^(typescript|javascript|tsx|jsx|ts|js)\s*$/m)) {
    cleaned = cleaned
      .replace(/^(typescript|javascript|tsx|jsx|ts|js)\s*$/gm, '')
      .replace(/```/g, '')
      .trim();
  }
  
  return cleaned;
}

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
      grok: 'XAI_API_KEY'
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
      if (apiKey) vars.XAI_API_KEY = apiKey;
      if (model) vars.GROK_MODEL = model;
      break;
  }

  // Add GitHub token if available
  if (process.env.GITHUB_TOKEN) {
    vars.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }

  // Add Pexels API key if available
  if (process.env.PEXELS_API_KEY) {
    vars.PEXELS_API_KEY = process.env.PEXELS_API_KEY;
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

#### **Database & Feature Implementation**:
- **Database Features**: For ANY features requiring data storage/management → UPDATE THE DASHBOARD with new pages, forms, and functionality
- **Data Features**: If the user requested features that need additional database models or relationships, add them depending on the given tech stack to the app (for example by adding them to the Prisma schema for MongoDB or create additional migrations files for Supabase)
- **Navigation Structure**: Use the dashboard's existing navigation structure (sidebar, header menu) to add new routes/pages. If none exists, create a simple header menu for the different new features

#### **Template-Specific Database Handling**:
- **MongoDB + Prisma Templates**: Update the Prisma schema file (schema.prisma) with new models. Prisma will auto-generate the client during build
- **Supabase Templates**: Design the database structure but focus on client-side queries and components since Supabase handles the backend
- **Other Database Templates**: Follow the template's specific database patterns and conventions

#### **Page Structure Updates**:
- **Landing Page**: Create new landing page sections that serve the business domain with relevant information. The given sections are only an example of coding pattern. But you can generate various section designs and types, static, dynamic and interactive.
- **Dashboard**: Add navigation items, child components, and functionality specific to the database-driven business requirements
- **Database Schema**: Add appropriate Prisma models or Migrations files for business data with proper relationships
- **App Structure**: Update routing, authentication flow, and component organization as needed
- **Tailwind Config**: Customize colors, fonts, and design tokens to match business domain theme

#### **Media Assets (IMPORTANT)**:
- **NEVER use placeholder images**: Do NOT use services like placeholder.com, placehold.it, lorem picsum, or via.placeholder.com
- **Use Pexels API**: The project has access to Pexels API with key configured. Use real image URLs from Pexels
- **Search for relevant images**: Use search terms related to the business domain (e.g., for a doctor website, search "medical", "healthcare", "doctor", "hospital")
- **Image URLs**: Use Pexels image URLs directly, for example:
  - Hero images: https://images.pexels.com/photos/[id]/pexels-photo-[id].jpeg?auto=compress&cs=tinysrgb&w=1920
  - Thumbnails: https://images.pexels.com/photos/[id]/pexels-photo-[id].jpeg?auto=compress&cs=tinysrgb&w=400
- **Popular image IDs by domain**:
  - Healthcare/Medical: 4021258, 4173251, 5722164, 7089392
  - Technology: 1181244, 1181677, 3861964, 546819
  - Business/Office: 3184292, 3184339, 3183197, 416320
  - Food/Restaurant: 1640777, 1565982, 1279330, 262978
  - Education: 1181519, 5212320, 5905857, 3401403
  - Fitness: 4164531, 416809, 3768912, 1954524
- **Videos**: For video backgrounds, use Pexels video URLs like: https://player.vimeo.com/external/[id].sd.mp4?s=[hash]&profile_id=165

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
    
    // Log response structure for debugging
    console.log(`[PROJECT-INIT] Response contains:`);
    console.log(`  - "---METADATA---": ${response.includes('---METADATA---')}`);
    console.log(`  - "---FILES---": ${response.includes('---FILES---')}`);
    console.log(`  - "---END---": ${response.includes('---END---')}`);
    
    // Extract metadata
    const metadataMatch = response.match(/---METADATA---\s*([\s\S]*?)\s*---(?:FILES|END)---/);
    if (!metadataMatch) {
      console.error(`[PROJECT-INIT] Metadata regex failed to match`);
      console.log(`[PROJECT-INIT] First 1000 chars of response: ${response.substring(0, 1000)}`);
      throw new Error('No metadata section found in AI response');
    }
    
    console.log(`[PROJECT-INIT] Metadata match found, extracting...`);
    const metadataText = metadataMatch[1].trim();
    console.log(`[PROJECT-INIT] Metadata text (first 500 chars): ${metadataText.substring(0, 500)}`);
    
    const metadata = JSON.parse(metadataText);
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
    
    // First, let's see all file markers in the response
    const allFileMarkers = response.match(/---FILE:([^-]+)---/g) || [];
    console.log(`[PROJECT-INIT] Found file markers: ${allFileMarkers.join(', ')}`);
    
    for (const filePath of CORE_TEMPLATE_FILES) {
      console.log(`[PROJECT-INIT] Looking for file: ${filePath}`);
      
      // Create a more flexible regex that handles potential whitespace/newline issues
      const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileRegex = new RegExp(`---FILE:${escapedPath}---\\s*([\\s\\S]*?)\\s*---END:${escapedPath}---`, 'm');
      
      console.log(`[PROJECT-INIT] Using regex: ${fileRegex.source}`);
      
      const fileMatch = response.match(fileRegex);
      
      if (fileMatch) {
        const content = fileMatch[1].trim();
        files.push({
          path: filePath,
          content
        });
        console.log(`[PROJECT-INIT] ✓ Extracted file: ${filePath} (${content.length} chars)`);
        console.log(`[PROJECT-INIT]   Content preview: ${content.substring(0, 100)}...`);
      } else {
        console.warn(`[PROJECT-INIT] ✗ File not found in response: ${filePath}`);
        
        // Try to find partial matches to debug
        const partialStartMatch = response.includes(`---FILE:${filePath}---`);
        const partialEndMatch = response.includes(`---END:${filePath}---`);
        console.log(`[PROJECT-INIT]   Has start marker: ${partialStartMatch}`);
        console.log(`[PROJECT-INIT]   Has end marker: ${partialEndMatch}`);
        
        if (partialStartMatch && !partialEndMatch) {
          console.log(`[PROJECT-INIT]   WARNING: File ${filePath} has start marker but no end marker - response might be truncated`);
        }
      }
    }
    
    // Also check for any unexpected files
    const unexpectedFiles = allFileMarkers.filter(marker => {
      const path = marker.match(/---FILE:([^-]+)---/)?.[1];
      return path && !CORE_TEMPLATE_FILES.includes(path);
    });
    
    if (unexpectedFiles.length > 0) {
      console.log(`[PROJECT-INIT] WARNING: Found unexpected files in response: ${unexpectedFiles.join(', ')}`);
    }
    
    console.log(`[PROJECT-INIT] Total files extracted: ${files.length}/${CORE_TEMPLATE_FILES.length}`);
    
    if (files.length === 0) {
      console.error(`[PROJECT-INIT] No files were extracted from AI response`);
      console.log(`[PROJECT-INIT] Last 1000 chars of response: ${response.substring(response.length - 1000)}`);
      throw new Error('No files were extracted from AI response');
    }
    
    return {
      success: true,
      metadata,
      files
    };
    
  } catch (error) {
    console.error(`[PROJECT-INIT] Error parsing AI response:`, error);
    console.error(`[PROJECT-INIT] Error stack:`, error.stack);
    return {
      success: false,
      metadata: {},
      files: [],
      error: `Failed to parse AI response: ${error.message}`
    };
  }
}

/**
 * Parse deployment error logs to extract specific error information
 */
async function parseDeploymentError(deployment: any): Promise<DeploymentErrorInfo> {
  // Try to get detailed build logs from WebSocket first
  let buildLog = '';
  
  console.log(`[ERROR-PARSER] Analyzing deployment error...`);
  console.log(`[ERROR-PARSER] Available deployment keys:`, Object.keys(deployment));
  
  if (deployment.site_id && deployment.id) {
    try {
      console.log(`[ERROR-PARSER] Fetching detailed logs via WebSocket...`);
      buildLog = await netlifyService.getBuildLogs(deployment.site_id, deployment.id);
      console.log(`[ERROR-PARSER] Retrieved ${buildLog.length} chars from WebSocket`);
    } catch (error: any) {
      console.warn(`[ERROR-PARSER] Failed to get WebSocket logs:`, error.message);
    }
  }
  
  // Fallback to error_message if WebSocket fails
  if (!buildLog) {
    buildLog = deployment.error_message || '';
    console.log(`[ERROR-PARSER] Using error_message fallback: ${buildLog.length} chars`);
  }
  
  const errors: ParsedError[] = [];
  let errorType: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown' = 'unknown';
  let canFix = false;

  console.log(`[ERROR-PARSER] First 500 chars of logs:`, buildLog.substring(0, 500));
  
  // TypeScript unused variable/import errors (TS6133) - improved pattern
  const ts6133Regex = /src\/([^(]+)\((\d+),(\d+)\): error TS6133: '([^']+)' is declared but its value is never read\.?/g;
  let match: RegExpExecArray | null;
  
  while ((match = ts6133Regex.exec(buildLog)) !== null) {
    const [, file, line, column, variable] = match;
    errors.push({
      file: `src/${file}`,
      line: parseInt(line),
      column: parseInt(column),
      message: `'${variable}' is declared but its value is never read`,
      code: 'TS6133',
      type: 'typescript'
    });
    errorType = 'typescript';
    canFix = true;
  }

  // TypeScript type errors (TS2345, TS2322, etc.) - improved pattern
  const tsErrorRegex = /src\/([^(]+)\((\d+),(\d+)\): error (TS\d+): (.+?)(?=\n|\r|$)/g;
  while ((match = tsErrorRegex.exec(buildLog)) !== null) {
    const [, file, line, column, code, message] = match;
    errors.push({
      file: `src/${file}`,
      line: parseInt(line),
      column: parseInt(column),
      message: message.trim(),
      code,
      type: 'typescript'
    });
    errorType = 'typescript';
    canFix = true;
  }

  // Build command errors
  if (buildLog.includes('Command failed with exit code')) {
    errorType = 'build';
    if (errors.length > 0) {
      canFix = true; // Can fix if we identified specific issues
    }
  }

  // Dependency errors
  if (buildLog.includes('npm ERR!') || buildLog.includes('pnpm ERR!') || buildLog.includes('Cannot resolve')) {
    errorType = 'dependency';
    canFix = false; // Usually need manual intervention
  }

  console.log(`[ERROR-PARSER] Found ${errors.length} errors of type: ${errorType}, canFix: ${canFix}`);
  
  return {
    errorType,
    errors,
    buildLog,
    canFix
  };
}

/**
 * Fix code errors using AI agent
 */
async function fixCodeWithAI(
  sessionId: string,
  errorInfo: DeploymentErrorInfo, 
  repoUrl: string,
  aiProvider: string = 'anthropic'
): Promise<{ success: boolean; fixes: FileFix[]; explanation: string }> {
  
  console.log(`[AI-FIXER] Starting AI fix for ${errorInfo.errors.length} errors`);
  await logInitialization(sessionId, 'info', `🤖 AI analyzing ${errorInfo.errors.length} deployment errors...`);

  try {
    const customAgent = new CustomAIAgent({
      sessionId,
      sandbox: null,
      repositoryUrl: repoUrl,
      provider: aiProvider as 'anthropic' | 'openai' | 'google' | 'grok',
      model: 'claude-sonnet-4-20250514',
      projectContext: {
        componentRegistry: {},
        dependencies: {},
        framework: 'react',
        structure: 'standard'
      }
    });
    const fixes: FileFix[] = [];
    
    // Group errors by file for efficient processing
    const fileErrors = new Map<string, ParsedError[]>();
    for (const error of errorInfo.errors) {
      if (!fileErrors.has(error.file)) {
        fileErrors.set(error.file, []);
      }
      fileErrors.get(error.file)!.push(error);
    }

    // Process each file with errors
    for (const [filePath, fileErrorList] of fileErrors) {
      await logInitialization(sessionId, 'info', `🔧 Fixing errors in ${filePath}...`);
      
      // Get current file content
      const currentContent = await githubService.getFileContent(repoUrl, filePath, 'main');
      
      // Create fix prompt for this file
      const fixPrompt = `
You are a TypeScript/React code fixer. Fix the following errors in this file:

FILE: ${filePath}
CURRENT CONTENT:
\`\`\`typescript
${currentContent}
\`\`\`

ERRORS TO FIX:
${fileErrorList.map(error => 
  `- Line ${error.line}: ${error.message} (${error.code})`
).join('\n')}

CRITICAL INSTRUCTIONS:
1. For TS6133 errors (unused variables/imports): Remove the unused imports or variables
2. For syntax errors (TS1443, TS1005, TS1434, etc.): Fix the syntax issues carefully
3. For other TypeScript errors: Fix the type issues while preserving functionality
4. DO NOT change the overall structure or functionality of the code
5. IMPORTANT: Return ONLY the raw TypeScript/React code - NO markdown code blocks, NO language identifiers, NO explanations
6. Do NOT wrap your response in \`\`\`typescript or \`\`\` blocks
7. Preserve all existing imports that are actually used
8. Maintain the same code style and formatting
9. Remove any markdown formatting artifacts like \`\`\`typescript or \`\`\`

Return the complete fixed file content as raw code:`;

      const fixResult = await customAgent.processRequest(fixPrompt);
      
      if (fixResult && fixResult.trim()) {
        // Clean any markdown formatting from the AI response
        const cleanedContent = cleanMarkdownFromCode(fixResult);
        
        fixes.push({
          file: filePath,
          oldContent: currentContent,
          newContent: cleanedContent,
          description: `Fixed ${fileErrorList.length} errors: ${fileErrorList.map(e => e.code).join(', ')}`
        });
        
        console.log(`[AI-FIXER] Fixed ${fileErrorList.length} errors in ${filePath}`);
      } else {
        console.warn(`[AI-FIXER] Failed to fix errors in ${filePath}: No content returned`);
      }
    }

    const explanation = `AI successfully fixed ${fixes.length} files with TypeScript errors. Removed unused imports and variables.`;
    
    return {
      success: fixes.length > 0,
      fixes,
      explanation
    };

  } catch (error: any) {
    console.error(`[AI-FIXER] Error during AI fixing:`, error);
    return {
      success: false,
      fixes: [],
      explanation: `AI fixing failed: ${error.message}`
    };
  }
}

/**
 * Apply fixes to the repository
 */
async function applyFixesToRepository(
  sessionId: string,
  repoUrl: string,
  fixes: FileFix[]
): Promise<boolean> {
  console.log(`[REPO-FIXER] Applying ${fixes.length} fixes to repository`);
  await logInitialization(sessionId, 'info', `📝 Applying ${fixes.length} code fixes to repository...`);

  try {
    // Prepare file changes for commitChanges method
    const fileChanges = fixes.map(fix => ({
      path: fix.file,
      content: fix.newContent,
      message: `AI fix: ${fix.description}`
    }));

    // Apply all fixes in a single commit
    const commits = await githubService.commitChanges(
      repoUrl,
      'main',
      fileChanges
    );
    
    if (commits.length > 0) {
      console.log(`[REPO-FIXER] Applied ${fixes.length} fixes in ${commits.length} commits`);
      await logInitialization(sessionId, 'success', `✅ Applied ${fixes.length} fixes to repository`);
      return true;
    } else {
      console.warn(`[REPO-FIXER] No commits were created`);
      return false;
    }
  } catch (error: any) {
    console.error(`[REPO-FIXER] Error applying fixes:`, error);
    await logInitialization(sessionId, 'error', `❌ Failed to apply fixes: ${error.message}`);
    return false;
  }
}

/**
 * Attempt to fix deployment errors using AI
 */
async function attemptAIErrorFix(
  sessionId: string,
  deployment: any,
  repoUrl: string,
  session: any
): Promise<{ success: boolean; message: string }> {
  
  try {
    // Parse the deployment error
    const errorInfo = await parseDeploymentError(deployment);
    
    if (!errorInfo.canFix) {
      await logInitialization(sessionId, 'warning', `⚠️ Error type '${errorInfo.errorType}' cannot be automatically fixed`);
      return {
        success: false,
        message: `Cannot automatically fix ${errorInfo.errorType} errors`
      };
    }

    await logInitialization(sessionId, 'info', `🔍 Found ${errorInfo.errors.length} fixable ${errorInfo.errorType} errors`);

    // Use AI to generate fixes
    const aiProvider = session.aiProvider || 'anthropic';
    const fixResult = await fixCodeWithAI(sessionId, errorInfo, repoUrl, aiProvider);
    
    if (!fixResult.success) {
      return {
        success: false,
        message: `AI could not generate fixes: ${fixResult.explanation}`
      };
    }

    // Apply fixes to repository
    const applySuccess = await applyFixesToRepository(sessionId, repoUrl, fixResult.fixes);
    
    if (applySuccess) {
      await logInitialization(sessionId, 'success', `🎉 Successfully applied ${fixResult.fixes.length} AI-generated fixes`);
      return {
        success: true,
        message: fixResult.explanation
      };
    } else {
      return {
        success: false,
        message: 'Failed to apply fixes to repository'
      };
    }

  } catch (error: any) {
    console.error(`[AI-ERROR-FIX] Error during AI error fixing:`, error);
    await logInitialization(sessionId, 'error', `❌ AI error fixing failed: ${error.message}`);
    return {
      success: false,
      message: `AI error fixing failed: ${error.message}`
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
            addDevPrefix(request.projectName),
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
        
        // Get template and setup environment variables
        const { TemplateRegistry } = await import('../src/services/template-registry');
        const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
        const templates = await templateRegistry.getAllTemplates();
        const template = templates.find(t => t.id === request.templateId);
        
        if (template) {
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
              
              // Pexels API variables
              case 'PEXELS_API_KEY':
              case 'VITE_PEXELS_API_KEY':
              case 'NEXT_PUBLIC_PEXELS_API_KEY':
              case 'NUXT_PUBLIC_PEXELS_API_KEY':
                templateEnvVars[envVar] = process.env.PEXELS_API_KEY || 'your-pexels-api-key';
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
          
          const aiProviderVars = getEnvVarsForProvider(request.aiProvider || 'anthropic', request.model);
          
          // Prepare all environment variables before creating Netlify project
          const allEnvVars = {
            ...aiProviderVars,
            ...templateEnvVars
          };
          
          console.log(`[ENV-SETUP] Setting ${Object.keys(allEnvVars).length} environment variables:`, Object.keys(allEnvVars));
          await logInitialization(sessionId, 'info', `🔧 Configuring ${Object.keys(allEnvVars).length} environment variables...`);
          
          netlifyProject = await netlifyService.createProject(addDevPrefix(request.projectName), request.repositoryUrl, undefined, allEnvVars);
          
          await netlifyService.configureBranchDeployments(netlifyProject.id, {
            main: { production: true },
            develop: { preview: true },
            'feature/*': { preview: true }
          });
          
          // Update URL-based environment variables with actual site URL
          await updateUrlEnvironmentVariables(
            netlifyProject.id,
            netlifyProject.account_id,
            netlifyProject.ssl_url || netlifyProject.url,
            template
          );
          
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
    
    // Save prompt to file for debugging
    const debugDir = 'debug-output';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      const fs = require('fs').promises;
      const path = require('path');
      await fs.mkdir(debugDir, { recursive: true });
      await fs.writeFile(path.join(debugDir, `prompt-${timestamp}.txt`), prompt);
      console.log(`[PROJECT-INIT] Saved prompt to debug-output/prompt-${timestamp}.txt`);
    } catch (debugError) {
      console.error(`[PROJECT-INIT] Failed to save prompt to file:`, debugError);
    }
    
    const aiResponse = await aiAgent.processRequest(prompt);
    console.log(`[PROJECT-INIT] AI response received (${aiResponse.length} chars)`);
    
    // Save AI response to file for debugging
    try {
      const fs = require('fs').promises;
      const path = require('path');
      await fs.writeFile(path.join(debugDir, `response-${timestamp}.txt`), aiResponse);
      console.log(`[PROJECT-INIT] Saved AI response to debug-output/response-${timestamp}.txt`);
    } catch (debugError) {
      console.error(`[PROJECT-INIT] Failed to save response to file:`, debugError);
    }
    
    // Log first 500 chars of response to see structure
    console.log(`[PROJECT-INIT] AI response preview: ${aiResponse.substring(0, 500)}...`);
    
    // Check for expected markers in response
    const hasMetadata = aiResponse.includes('---METADATA---');
    const hasFiles = aiResponse.includes('---FILES---');
    const hasEnd = aiResponse.includes('---END---');
    console.log(`[PROJECT-INIT] Response markers - Metadata: ${hasMetadata}, Files: ${hasFiles}, End: ${hasEnd}`);
    
    // Count potential file markers
    const fileMatches = aiResponse.match(/---FILE:/g);
    const fileCount = fileMatches ? fileMatches.length : 0;
    console.log(`[PROJECT-INIT] Found ${fileCount} potential file markers in response`);
    
    // Phase 3: Parse and Validate Response
    await sessionManager.updateSessionStatus(sessionId, 'processing', 50, 'Processing AI-generated files...');
    await logInitialization(sessionId, 'info', `🔍 Parsing AI response with ${fileCount} potential files...`);
    
    const parseResult = parseAIResponse(aiResponse);
    
    // Log detailed parsing results
    console.log(`[PROJECT-INIT] Parse result - Success: ${parseResult.success}, Files extracted: ${parseResult.files.length}`);
    if (parseResult.files.length > 0) {
      parseResult.files.forEach((file, index) => {
        console.log(`[PROJECT-INIT] File ${index + 1}: ${file.path} (${file.content.length} chars)`);
      });
    } else {
      console.log(`[PROJECT-INIT] WARNING: No files were extracted from AI response`);
    }
    
    // Log expected vs actual files
    console.log(`[PROJECT-INIT] Expected files: ${CORE_TEMPLATE_FILES.join(', ')}`);
    console.log(`[PROJECT-INIT] Extracted files: ${parseResult.files.map(f => f.path).join(', ')}`);
    
    if (!parseResult.success) {
      throw new Error(parseResult.error || 'Failed to generate project files');
    }
    
    await logInitialization(sessionId, 'success', 
      `✅ AI generated ${parseResult.files.length} project files`,
      { 
        businessFocus: parseResult.metadata.businessFocus,
        databaseModels: parseResult.metadata.databaseModels,
        generatedFiles: parseResult.metadata.generatedFiles,
        extractedFiles: parseResult.files.map(f => f.path)
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

    // Phase 6: Commit Generated Files to Repository First
    await sessionManager.updateSessionStatus(sessionId, 'committing', 75, 'Committing project files to main branch...');
    
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

    // Phase 7: Setup Infrastructure (MongoDB & Netlify) with Updated Repository
    await sessionManager.updateSessionStatus(sessionId, 'setting_up_infrastructure', 80, 'Setting up database and deployment...');
    
    let mongodbProject = null;
    let netlifyProject = null;
    
    try {
      await logInitialization(sessionId, 'info', '🏗️ Setting up database and deployment infrastructure with updated repository...');
      
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
          
          // Get template information for environment variables
          const { TemplateRegistry } = await import('../src/services/template-registry');
          const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
          const templates = await templateRegistry.getAllTemplates();
          const template = templates.find(t => t.id === request.templateId);
          
          if (template) {
            // Prepare environment variables (same logic as non-AI mode)
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
                
                // Pexels API variables
                case 'PEXELS_API_KEY':
                case 'VITE_PEXELS_API_KEY':
                case 'NEXT_PUBLIC_PEXELS_API_KEY':
                case 'NUXT_PUBLIC_PEXELS_API_KEY':
                  templateEnvVars[envVar] = process.env.PEXELS_API_KEY || 'your-pexels-api-key';
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
            
            // Get AI provider env vars
            const aiProviderVars = getEnvVarsForProvider(request.aiProvider || 'anthropic', request.model);
            
            // Prepare all environment variables before creating Netlify project
            const allEnvVars = {
              ...aiProviderVars,
              ...templateEnvVars
            };
            
            console.log(`[ENV-SETUP] Setting ${Object.keys(allEnvVars).length} environment variables:`, Object.keys(allEnvVars));
            await logInitialization(sessionId, 'info', `🔧 Configuring ${Object.keys(allEnvVars).length} environment variables...`);
            
            netlifyProject = await netlifyService.createProject(addDevPrefix(request.projectName), request.repositoryUrl, undefined, allEnvVars);
            
            // Configure branch deployments with PR previews
            await netlifyService.configureBranchDeployments(netlifyProject.id, {
              main: { production: true },
              develop: { preview: true },
              'feature/*': { preview: true }
            });
            
            // Update URL-based environment variables with actual site URL
            await updateUrlEnvironmentVariables(
              netlifyProject.id,
              netlifyProject.account_id,
              netlifyProject.ssl_url || netlifyProject.url,
              template
            );
            
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
          await logInitialization(sessionId, 'success', '🌐 Deployment ready with customized project!', {
            deploymentUrl: deployUrl
          });

          await sessionManager.updateSessionStatus(sessionId, 'deployed', 98, 'Project successfully deployed');
        } else if (deployment.state === 'error') {
          await logInitialization(sessionId, 'warning', '❌ Netlify deployment failed - attempting AI fix...');
          
          // NEW: AI Error Fixing Loop with retries
          let retryAttempt = 0;
          const maxRetries = 3;
          let currentDeployment = deployment;
          let finalDeployUrl = null;
          
          while (retryAttempt < maxRetries && currentDeployment.state === 'error') {
            retryAttempt++;
            await logInitialization(sessionId, 'info', `🔄 AI Fix Attempt ${retryAttempt}/${maxRetries}...`);
            
            try {
              const fixResult = await attemptAIErrorFix(
                sessionId, 
                currentDeployment, 
                request.repositoryUrl || '', 
                session
              );
              
              if (fixResult.success) {
                await logInitialization(sessionId, 'info', '🔄 Triggering redeployment after AI fixes...');
                
                // Trigger a new deployment after fixes
                const buildId = await netlifyService.triggerRedeploy(
                  netlifyProject.id,
                  (message: string) => logInitialization(sessionId, 'info', message)
                );
                
                if (buildId) {
                  // Wait for retry deployment
                  const retryDeployment = await netlifyService.waitForInitialDeployment(
                    netlifyProject.id, 
                    300000,
                    (message: string) => logInitialization(sessionId, 'info', message)
                  );
                  
                  currentDeployment = retryDeployment;
                  
                  if (retryDeployment.state === 'ready') {
                    finalDeployUrl = retryDeployment.deploy_ssl_url || netlifyProject.ssl_url;
                    await sessionManager.setPreviewUrl(sessionId, finalDeployUrl);
                    await logInitialization(sessionId, 'success', `🎉 AI successfully fixed deployment errors on attempt ${retryAttempt}!`, {
                      deploymentUrl: finalDeployUrl
                    });
                    await sessionManager.updateSessionStatus(sessionId, 'deployed', 98, 'Project successfully deployed after AI fixes');
                    break; // Success! Exit the retry loop
                  } else if (retryDeployment.state === 'error') {
                    await logInitialization(sessionId, 'warning', `⚠️ Attempt ${retryAttempt} failed, deployment still has errors`);
                    if (retryAttempt < maxRetries) {
                      await logInitialization(sessionId, 'info', '🔄 Analyzing new errors for next retry...');
                    }
                  }
                } else {
                  await logInitialization(sessionId, 'warning', `⚠️ Failed to trigger redeployment on attempt ${retryAttempt}`);
                  break;
                }
              } else {
                await logInitialization(sessionId, 'warning', `⚠️ AI could not generate fixes on attempt ${retryAttempt}: ${fixResult.message}`);
                break;
              }
            } catch (retryError: any) {
              await logInitialization(sessionId, 'warning', `❌ Error during retry attempt ${retryAttempt}: ${retryError.message}`);
              break;
            }
          }
          
          // Final result handling
          if (currentDeployment.state === 'error') {
            await logInitialization(sessionId, 'error', `❌ Deployment failed after ${retryAttempt} AI fix attempts`);
            await logInitialization(sessionId, 'info', '💡 Manual intervention may be required');
          }
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

  } catch (error: any) {
    console.error('[PROJECT-INIT] Processing error:', error);
    
    // Check if this is a retry exhaustion error from AI overload
    if (error.isRetryExhausted) {
      const retryMessage = `AI service is currently overloaded. Tried ${error.attemptCount} times over several minutes. Please try again in a few minutes or use the manual retry button.`;
      await sessionManager.setError(sessionId, retryMessage, { 
        canRetry: true, 
        retryExhausted: true,
        attemptCount: error.attemptCount 
      });
      await logInitialization(sessionId, 'error', `⚠️ AI Overloaded - Retry Available`);
      await logInitialization(sessionId, 'warning', `🔄 Attempted ${error.attemptCount} times with exponential backoff`);
      await logInitialization(sessionId, 'info', `💡 Use "Retry Deployment" button to try again`);
    } else {
      await sessionManager.setError(sessionId, `Project initialization failed: ${error.message}`);
      await logInitialization(sessionId, 'error', `❌ ${error.message}`);
    }
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
          const { EnhancedGitHubService } = await import('../src/services/enhanced-github-service');
          
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
            addDevPrefix(normalizedRequest.projectName),
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