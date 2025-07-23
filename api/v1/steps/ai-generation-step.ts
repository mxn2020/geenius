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

      // Process each template file with AI
      for (const templateFile of template.files) {
        console.log(`[AI-GENERATION-STEP] Processing: ${templateFile.path}`);
        
        const prompt = this.createGenerationPrompt(
          templateFile,
          userRequirements,
          request.businessDomain,
          request.projectName
        );

        const generatedContent = await customAgent.processRequest(prompt);
        
        if (generatedContent && generatedContent.trim()) {
          generatedFiles.push({
            path: templateFile.path,
            content: generatedContent.trim(),
            encoding: 'utf-8'
          });
          
          console.log(`[AI-GENERATION-STEP] ✅ Generated: ${templateFile.path}`);
        } else {
          console.warn(`[AI-GENERATION-STEP] ⚠️ No content generated for: ${templateFile.path}`);
        }
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

  private createGenerationPrompt(
    templateFile: any,
    userRequirements: string,
    businessDomain?: string,
    projectName?: string
  ): string {
    return `
You are an expert React/TypeScript developer. Create a customized version of this file based on the user requirements.

FILE: ${templateFile.path}
PURPOSE: ${templateFile.purpose}

ORIGINAL TEMPLATE:
\`\`\`typescript
${templateFile.content}
\`\`\`

USER REQUIREMENTS: ${userRequirements}
${businessDomain ? `BUSINESS DOMAIN: ${businessDomain}` : ''}
${projectName ? `PROJECT NAME: ${projectName}` : ''}

INSTRUCTIONS:
1. Customize the file content to match the user requirements
2. Keep the same structure and component patterns
3. Update text, branding, and functionality to fit the business domain
4. Maintain all existing imports and exports
5. Ensure TypeScript compatibility
6. Keep the same file structure and component architecture
7. Return ONLY the complete file content, no explanations

Generate the customized file content:`;
  }
}