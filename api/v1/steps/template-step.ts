// Template retrieval and processing step

import { TemplateRegistry } from '../../../src/services/template-registry';
import { AIFileProcessor } from '../../shared/ai-file-processor';
import { WorkflowContext, TemplateFileContent } from '../types/project-types';

export class TemplateStep {
  private templateRegistry: TemplateRegistry;
  private aiFileProcessor: AIFileProcessor;

  constructor() {
    this.templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN!);
    this.aiFileProcessor = new AIFileProcessor();
  }

  async execute(context: WorkflowContext, onProgress?: (message: string) => void): Promise<WorkflowContext> {
    const { sessionId, request } = context;
    
    console.log('[TEMPLATE-STEP] Retrieving template files...');
    if (onProgress) onProgress('🔍 Retrieving template files for AI customization');

    // Core template files for project initialization
    const CORE_TEMPLATE_FILES = [
      'src/App.tsx',
      'src/pages/Landing.tsx',
      'src/components/auth/Dashboard.tsx',
      'prisma/schema.prisma',
      'tailwind.config.js'
    ];

    try {
      // Get template information
      const templates = await this.templateRegistry.getAllTemplates();
      const template = templates.find(t => t.id === request.templateId);
      
      if (!template) {
        throw new Error(`Template not found: ${request.templateId}`);
      }

      console.log(`[TEMPLATE-STEP] Using template: ${template.name}`);
      if (onProgress) onProgress(`📋 Using template: ${template.name}`);

      // Retrieve template files
      const templateFiles: TemplateFileContent[] = [];
      
      for (const filePath of CORE_TEMPLATE_FILES) {
        try {
          const content = await this.aiFileProcessor.getFileFromTemplate(
            template.repository,
            filePath,
            template.branch || 'main'
          );
          
          templateFiles.push({
            path: filePath,
            content,
            purpose: this.getFilePurpose(filePath)
          });
          
          console.log(`[TEMPLATE-STEP] ✅ Retrieved: ${filePath}`);
        } catch (error: any) {
          console.warn(`[TEMPLATE-STEP] ⚠️ Failed to retrieve ${filePath}: ${error.message}`);
        }
      }

      if (templateFiles.length === 0) {
        throw new Error('No template files could be retrieved');
      }

      console.log(`[TEMPLATE-STEP] ✅ Retrieved ${templateFiles.length} template files`);
      if (onProgress) onProgress(`📁 Retrieved ${templateFiles.length} template files for customization`);

      return {
        ...context,
        template: {
          ...template,
          files: templateFiles
        }
      };

    } catch (error: any) {
      console.error('[TEMPLATE-STEP] ❌ Template retrieval failed:', error.message);
      throw new Error(`Template retrieval failed: ${error.message}`);
    }
  }

  private getFilePurpose(filePath: string): string {
    const purposes: Record<string, string> = {
      'src/App.tsx': 'Main application component and routing',
      'src/pages/Landing.tsx': 'Landing page with business-specific content',
      'src/components/auth/Dashboard.tsx': 'User dashboard and authenticated experience',
      'prisma/schema.prisma': 'Database schema and data models',
      'tailwind.config.js': 'Styling configuration and theme'
    };
    
    return purposes[filePath] || 'Template file for customization';
  }
}