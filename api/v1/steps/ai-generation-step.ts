// AI file generation step

import { CustomAIAgent } from '../../shared/custom-ai-agent';
import { EnhancedGitHubService, FileChange } from '../../../src/services/enhanced-github-service';
import { DevIdRegistryScanner } from '../../shared/devid-registry-scanner';
import { WorkflowContext } from '../types/project-types';

export class AIGenerationStep {
  private githubService: EnhancedGitHubService;
  private registryScanner: DevIdRegistryScanner;

  constructor() {
    this.githubService = new EnhancedGitHubService();
    this.registryScanner = new DevIdRegistryScanner();
  }

  async execute(context: WorkflowContext, onProgress?: (message: string) => void): Promise<WorkflowContext> {
    const { sessionId, request, template } = context;
    
    if (!request.userRequirements && !request.projectRequirements) {
      throw new Error('No user requirements provided for AI generation');
    }

    if (!template || !template.files) {
      throw new Error('No template files available for AI generation');
    }

    console.log('[AI-GENERATION-STEP] Starting AI file generation...');
    if (onProgress) onProgress('🤖 Generating complete project with AI agent');

    try {
      // Initialize AI agent
      const customAgent = new CustomAIAgent({
        sessionId,
        sandbox: null,
        repositoryUrl: request.repositoryUrl!,
        provider: (request.aiProvider as 'anthropic' | 'openai' | 'google' | 'grok') || 'anthropic',
        model: request.model || 'claude-sonnet-4-20250514',
        projectContext: {
          componentRegistry: {},
          dependencies: {},
          framework: 'react',
          structure: 'standard'
        }
      });

      const userRequirements = request.userRequirements || request.projectRequirements!;
      const generatedFiles: FileChange[] = [];

      // Process ALL template files in a single comprehensive AI request
      console.log(`[AI-GENERATION-STEP] Processing all ${template.files.length} files in one comprehensive request`);
      if (onProgress) onProgress(`🤖 Generating complete project with all ${template.files.length} files...`);
      
      try {
        const prompt = this.createComprehensivePrompt(
          template.files,
          userRequirements,
          request.businessDomain,
          request.projectName
        );

        console.log(`[AI-GENERATION-STEP] Comprehensive prompt length: ${prompt.length} characters`);
        const aiResponse = await customAgent.processRequest(prompt);
        
        if (aiResponse && aiResponse.trim()) {
          // Parse the AI response to extract individual files
          const parsedFiles = this.parseAIResponse(aiResponse, template.files);
          
          if (parsedFiles.length > 0) {
            generatedFiles.push(...parsedFiles);
            console.log(`[AI-GENERATION-STEP] ✅ Generated ${parsedFiles.length} files from comprehensive request`);
            if (onProgress) onProgress(`✅ Generated ${parsedFiles.length} files from comprehensive AI request`);
          } else {
            console.warn(`[AI-GENERATION-STEP] ⚠️ No files parsed from AI response`);
            if (onProgress) onProgress(`⚠️ Failed to parse files from AI response`);
          }
        } else {
          console.warn(`[AI-GENERATION-STEP] ⚠️ No response from AI`);
          if (onProgress) onProgress(`⚠️ AI returned empty response`);
        }
      } catch (error: any) {
        console.error(`[AI-GENERATION-STEP] ❌ Error in comprehensive generation:`, error.message);
        if (onProgress) onProgress(`❌ Error in comprehensive generation: ${error.message}`);
        throw error;
      }

      if (generatedFiles.length === 0) {
        throw new Error('AI failed to generate any files');
      }

      console.log(`[AI-GENERATION-STEP] ✅ Generated ${generatedFiles.length} files`);
      if (onProgress) onProgress(`✅ AI generated ${generatedFiles.length} project files`);

      return {
        ...context,
        generatedFiles
      };

    } catch (error: any) {
      console.error('[AI-GENERATION-STEP] ❌ AI generation failed:', error.message);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  async commitFiles(context: WorkflowContext, onProgress?: (message: string) => void): Promise<WorkflowContext> {
    const { sessionId, request, generatedFiles } = context;
    
    if (!generatedFiles || generatedFiles.length === 0) {
      throw new Error('No generated files to commit');
    }

    console.log('[AI-GENERATION-STEP] Committing generated files...');
    if (onProgress) onProgress('📝 Preparing to commit directly to main branch');

    try {
      // Auto-register component usages
      const registeredUsages = await this.registryScanner.autoRegisterFromFiles(generatedFiles);
      console.log(`[AI-GENERATION-STEP] 📋 Auto-registered ${registeredUsages.length} new component usages`);
      if (onProgress) onProgress(`📋 Auto-registered ${registeredUsages.length} new component usages`);

      // Commit each file individually for better tracking
      for (const file of generatedFiles) {
        await this.githubService.commitChanges(
          request.repositoryUrl!,
          'main',
          [file],
          `AI-generated: ${file.path} for ${request.projectName}`
        );
        
        console.log(`[AI-GENERATION-STEP] ✅ Committed: ${file.path}`);
        if (onProgress) onProgress(`Committed changes to ${file.path}`);
      }

      console.log(`[AI-GENERATION-STEP] ✅ Committed ${generatedFiles.length} files directly to main branch`);
      if (onProgress) onProgress(`📝 Committed ${generatedFiles.length} files directly to main branch`);

      return context;

    } catch (error: any) {
      console.error('[AI-GENERATION-STEP] ❌ File commit failed:', error.message);
      throw new Error(`File commit failed: ${error.message}`);
    }
  }

  private createComprehensivePrompt(
    templateFiles: any[],
    userRequirements: string,
    businessDomain?: string,
    projectName?: string
  ): string {
    const filesSection = templateFiles.map(file => `
### FILE: ${file.path}
PURPOSE: ${file.purpose}
ORIGINAL CONTENT:
\`\`\`typescript
${file.content}
\`\`\`
`).join('\n');

    return `
You are an expert React/TypeScript developer. You need to customize ALL provided template files to create a complete, functional application based on the user requirements.

## PROJECT REQUIREMENTS
USER REQUIREMENTS: ${userRequirements}
${businessDomain ? `BUSINESS DOMAIN: ${businessDomain}` : ''}
${projectName ? `PROJECT NAME: ${projectName}` : ''}

## TEMPLATE FILES TO CUSTOMIZE
${filesSection}

## CRITICAL INSTRUCTIONS

**YOU MUST UPDATE ALL 5 FILES** - Do not skip any files. Each file serves a specific purpose:

### 1. DATABASE & FEATURE DISTRIBUTION (MANDATORY):
- **Landing Page (src/pages/Landing.tsx)**: Add public-facing features (hero section, contact forms, booking forms, service info for visitors)
- **Dashboard (src/components/auth/Dashboard.tsx)**: Add admin/management features (data tables, forms, business logic, user management) 
- **App.tsx**: Add routing for new pages/features
- **Prisma Schema (prisma/schema.prisma)**: Add database models for ALL business features with proper relationships
- **Tailwind Config**: Update with project-specific styling if needed

### 2. COMPREHENSIVE FEATURE IMPLEMENTATION:
- **For ANY business features requiring data storage** → UPDATE the Dashboard with management interfaces
- **For ANY public-facing features** → UPDATE the Landing page with visitor-friendly interfaces  
- **For ANY data models needed** → UPDATE the Prisma schema with proper models and relationships
- **For ANY new pages/routes needed** → UPDATE App.tsx routing

### 3. DATABASE CONNECTION REQUIREMENTS:
- **MongoDB + Prisma Template**: You MUST update schema.prisma with ALL required business models
- Prisma auto-generates the client on build, so focus on complete schema design
- Include proper relationships between models (User, business-specific entities)
- Use appropriate field types and constraints

### 4. QUALITY REQUIREMENTS:
- Maintain all existing imports and exports
- Keep TypeScript compatibility
- Follow existing code patterns and structure
- Create functional, production-ready components
- Add meaningful content, not placeholder text

## RESPONSE FORMAT

Provide your response in this EXACT format for each file you're updating:

===FILE: [filepath]===
[complete file content]
===END FILE===

**IMPORTANT**: You must include ALL 5 files in your response, even if some files only need minor changes. Do not skip any files.

Generate the complete customized project:`;
  }

  private parseAIResponse(aiResponse: string, originalFiles: any[]): FileChange[] {
    const files: FileChange[] = [];
    const fileRegex = /===FILE:\s*([^=]+)===\n([\s\S]*?)(?====END FILE===|$)/g;
    
    let match;
    while ((match = fileRegex.exec(aiResponse)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      
      if (content) {
        files.push({
          path: filePath,
          content: content,
          encoding: 'utf-8'
        });
        console.log(`[AI-GENERATION-STEP] Parsed file: ${filePath} (${content.length} chars)`);
      }
    }
    
    // Log which original files were not updated
    const updatedPaths = files.map(f => f.path);
    const missedFiles = originalFiles.filter(f => !updatedPaths.includes(f.path));
    if (missedFiles.length > 0) {
      console.warn(`[AI-GENERATION-STEP] ⚠️ AI did not update these files: ${missedFiles.map(f => f.path).join(', ')}`);
    }
    
    return files;
  }
}