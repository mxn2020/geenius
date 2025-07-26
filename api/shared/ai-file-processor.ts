// AI File Processor for Agentic AI System
import { CustomAIAgent } from './custom-ai-agent';
import { EnhancedGitHubService } from '../../src/services/enhanced-github-service';

export interface ChangeRequest {
  id: string;
  componentId: string;
  feedback: string;
  timestamp: number;
  category: string;
  priority: string;
  status: string;
  componentContext: any;
  pageContext: any;
  userContext?: any;
  metadata?: any;
}

export interface ProcessingResult {
  success: boolean;
  updatedContent: string;
  explanation: string;
  testSuggestions: string[];
  commitMessage: string;
  error?: string;
}

export interface FileProcessingGroup {
  filePath: string;
  originalContent: string;
  changes: ChangeRequest[];
  repositoryPath?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  securityConcerns: string[];
}

export class AIFileProcessor {
  private aiAgent: CustomAIAgent;
  private githubService: EnhancedGitHubService;
  private maxRetries: number = 3;

  constructor(aiProvider: 'anthropic' | 'openai' | 'google' | 'grok' = 'anthropic') {
    // Create a minimal sandbox interface for the AI agent
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

    this.aiAgent = new CustomAIAgent({
      sessionId: 'file-processor',
      sandbox: mockSandbox,
      repositoryUrl: '',
      provider: aiProvider,
      model: 'default',
      projectContext: {
        componentRegistry: {},
        dependencies: {},
        framework: 'react',
        structure: 'typescript'
      }
    });
    
    // Note: We're not calling aiAgent.initialize() here to keep it lightweight
    // The AI will use Pexels URLs directly in generated code based on prompt instructions
    // If you need the AI to actively search Pexels, uncomment: await this.aiAgent.initialize();
    
    this.githubService = new EnhancedGitHubService();
  }

  /**
   * Validate change requests for security and relevance with retry logic
   */
  async validateChangeRequests(changes: ChangeRequest[], attempt: number = 1): Promise<ValidationResult> {
    const maxAttempts = 3;
    
    const prompt = `
Analyze these change requests for a React/TypeScript application and validate them:

Changes to validate:
${changes.map(change => `
- ID: ${change.id}
- Component: ${change.componentId}
- Category: ${change.category}
- Request: ${change.feedback}
- Priority: ${change.priority}
`).join('\n')}

Validate each change request for:
1. Security concerns (malicious code, unauthorized access)
2. Relevance (UI/component development related)
3. Technical feasibility

IMPORTANT: Respond with ONLY a valid JSON object, no additional text:

{
  "isValid": true,
  "issues": [],
  "securityConcerns": [],
  "validChanges": ["${changes.map(c => c.id).join('", "')}"],
  "rejectedChanges": []
}
`;

    let response: string | undefined;
    
    try {
      response = await this.aiAgent.processRequest(prompt);
      
      // Extract JSON from response (handle cases where AI adds extra text)
      let jsonResponse = response;
      
      // Try to find JSON object in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResponse = jsonMatch[0];
      }
      
      // Clean up common JSON issues
      jsonResponse = jsonResponse
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*[\r\n]+/gm, '')
        .trim();
      
      const result = JSON.parse(jsonResponse);

      // Validate that result has required fields
      if (typeof result.isValid !== 'boolean') {
        throw new Error('Invalid response format: missing isValid field');
      }

      return {
        isValid: result.isValid && (result.securityConcerns || []).length === 0,
        issues: result.issues || [],
        securityConcerns: result.securityConcerns || []
      };
    } catch (error) {
      console.error(`Validation attempt ${attempt}/${maxAttempts} failed:`, error);
      console.error('Raw AI response:', response || 'No response received');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      console.error('Error details:', errorMessage);
      
      // Retry logic - only retry for parsing errors or network issues
      if (attempt < maxAttempts && (
        errorMessage.includes('JSON') || 
        errorMessage.includes('parse') || 
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        !response
      )) {
        console.log(`Retrying validation (attempt ${attempt + 1}/${maxAttempts})...`);
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.validateChangeRequests(changes, attempt + 1);
      }
      
      // Return validation failure for security
      return {
        isValid: false,
        issues: [
          'Validation failed due to system error',
          `Error: ${errorMessage}`,
          response ? 'AI response received but could not be parsed' : 'No response from AI service'
        ],
        securityConcerns: ['Could not validate security of requests']
      };
    }
  }

  /**
   * Group changes by affected files for efficient processing
   */
  groupChangesByFile(changes: ChangeRequest[]): FileProcessingGroup[] {
    const fileGroups = new Map<string, ChangeRequest[]>();

    for (const change of changes) {
      // PRIORITY: Use usageFilePath (where component is used) over filePath (component definition)
      // This ensures we modify the usage location, not the reusable component definition
      let filePath = change.componentContext?.usageFilePath ||
        change.componentContext?.filePath ||
        change.metadata?.filePath ||
        change.pageContext?.filePath;

      if (!filePath) {
        // Fallback: try to determine from component ID
        filePath = this.inferFilePathFromComponent(change.componentId);
      }

      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath)!.push(change);
    }

    return Array.from(fileGroups.entries()).map(([filePath, changes]) => ({
      filePath,
      originalContent: '',
      changes,
      repositoryPath: changes[0]?.componentContext?.usageRepositoryPath || changes[0]?.componentContext?.repositoryPath
    }));
  }

  /**
   * Infer file path from component ID (fallback method)
   * Focus on usage locations, not component definitions
   */
  private inferFilePathFromComponent(componentId: string): string {
    // Inference logic for USAGE files (where components are implemented)
    if (componentId.includes('landing') || componentId.includes('hero')) {
      return 'src/pages/Landing.tsx';
    }
    if (componentId.includes('auth') || componentId.includes('login')) {
      return 'src/pages/Auth.tsx';
    }
    if (componentId.includes('dashboard') || componentId.includes('admin')) {
      return 'src/pages/Dashboard.tsx';
    }
    if (componentId.includes('nav') || componentId.includes('header')) {
      return 'src/components/Navigation.tsx';
    }
    if (componentId.includes('footer')) {
      return 'src/components/Footer.tsx';
    }
    if (componentId.includes('sidebar')) {
      return 'src/components/Sidebar.tsx';
    }
    // Default fallback - try to infer page from component ID
    return 'src/pages/index.tsx';
  }

  /**
   * Process changes for a single file with retry logic
   */
  async processFileChanges(
    filePath: string,
    fileContent: string,
    changes: ChangeRequest[],
    attempt: number = 1
  ): Promise<ProcessingResult> {
    const prompt = `
You are a senior React/TypeScript developer. I need you to implement the following changes to this file:

File: ${filePath}
Current content:
\`\`\`typescript
${fileContent}
\`\`\`

Changes to implement:
${changes.map((change, index) => `
${index + 1}. Component: ${change.componentId}
   Category: ${change.category}
   Priority: ${change.priority}
   Request: ${change.feedback}
   Context: ${JSON.stringify(change.componentContext, null, 2)}
`).join('\n')}

IMPORTANT CONTEXT:
- You are modifying the USAGE file where components are implemented/styled
- Do NOT modify the component definition files in src/lib/dev-container/
- Focus on changing how these components are used, styled, or configured in this specific file
- The componentId refers to a specific instance/usage of a reusable component
- Update props, className, styling, content, or layout as requested

Please:
1. Implement ALL requested changes in the file
2. Ensure the code follows React/TypeScript best practices
3. Maintain existing functionality while adding the requested changes
4. Keep the existing import structure and dependencies
5. Preserve component structure and naming conventions
6. Focus on modifying component usage, NOT component definitions

IMPORTANT - MEDIA ASSETS:
- NEVER use placeholder image services (placeholder.com, placehold.it, lorem picsum, via.placeholder.com)
- Use real Pexels image URLs when updating images
- For any image changes, use URLs like: https://images.pexels.com/photos/[id]/pexels-photo-[id].jpeg?auto=compress&cs=tinysrgb&w=1920
- Common Pexels image IDs:
  - Business/Office: 3184292, 3184339, 3183197, 416320
  - Technology: 1181244, 1181677, 3861964, 546819
  - Healthcare: 4021258, 4173251, 5722164, 7089392
  - Food: 1640777, 1565982, 1279330, 262978
  - People/Teams: 3184418, 3184465, 3153201, 1181519
- Include alt text that describes the actual image content

Provide your response in this exact format:

---METADATA---
{
  "success": true,
  "explanation": "detailed explanation of what was changed",
  "testSuggestions": ["list of tests that should be created for these changes"],
  "commitMessage": "Clear, descriptive commit message for these changes",
  "changesImplemented": ["list of change IDs that were successfully implemented"]
}
---CODE---
[complete updated file content here]
---END---

If you cannot implement the changes safely, use this format:
---METADATA---
{
  "success": false,
  "error": "detailed explanation of why changes cannot be implemented",
  "suggestedAlternatives": ["alternative approaches"]
}
---END---
`;

    let response: string = '';
    
    try {
      console.log(`[AI-PROCESSOR] Making AI request for file: ${filePath}`);
      console.log(`[AI-PROCESSOR] Prompt length: ${prompt.length} characters`);
      console.log(`[AI-PROCESSOR] File content length: ${fileContent.length} characters`);
      console.log(`[AI-PROCESSOR] Changes count: ${changes.length}`);
      
      response = await this.aiAgent.processRequest(prompt);
      
      console.log(`[AI-PROCESSOR] AI response received, length: ${response.length} characters`);
      console.log(`[AI-PROCESSOR] AI response preview: ${response.substring(0, 200)}...`);
      
      // Try to parse the new format with separate metadata and code sections
      const metadataMatch = response.match(/---METADATA---([\s\S]*?)---(?:CODE|END)---/);
      const codeMatch = response.match(/---CODE---([\s\S]*?)---END---/);
      
      console.log(`[AI-PROCESSOR] Metadata match found: ${!!metadataMatch}`);
      console.log(`[AI-PROCESSOR] Code match found: ${!!codeMatch}`);
      
      if (metadataMatch) {
        console.log(`[AI-PROCESSOR] Metadata content: ${metadataMatch[1].trim().substring(0, 200)}...`);
      }
      if (codeMatch) {
        console.log(`[AI-PROCESSOR] Code content length: ${codeMatch[1].trim().length} characters`);
        console.log(`[AI-PROCESSOR] Code content preview: ${codeMatch[1].trim().substring(0, 200)}...`);
      }
      
      let result;
      
      if (metadataMatch) {
        // New format
        result = JSON.parse(metadataMatch[1].trim());
        
        // Add the code content if it exists
        if (codeMatch && result.success) {
          result.updatedContent = codeMatch[1].trim();
          console.log(`[AI-PROCESSOR] Set updatedContent from CODE section, length: ${result.updatedContent.length}`);
        } else if (result.success) {
          result.updatedContent = '';
          console.log(`[AI-PROCESSOR] No CODE section found or result not successful, setting empty updatedContent`);
          console.log(`[AI-PROCESSOR] codeMatch: ${!!codeMatch}, result.success: ${result.success}`);
        }
      } else {
        console.log(`[AI-PROCESSOR] No metadata match found, trying fallback format`);
        // Fallback to old format - try to extract JSON from response
        let jsonResponse = response.trim();
        
        // Try to find JSON object in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonResponse = jsonMatch[0];
          console.log(`[AI-PROCESSOR] Found JSON in response: ${jsonResponse.substring(0, 200)}...`);
        } else {
          console.log(`[AI-PROCESSOR] No JSON found in response`);
        }
        
        result = JSON.parse(jsonResponse);
        console.log(`[AI-PROCESSOR] Parsed result: ${JSON.stringify(result).substring(0, 200)}...`);
      }

      if (result.success) {
        console.log(`[AI-PROCESSOR] About to validate generated code, length: ${result.updatedContent?.length || 0}`);
        console.log(`[AI-PROCESSOR] Generated code preview: ${result.updatedContent?.substring(0, 200) || 'EMPTY'}...`);

        // Validate the generated code
        const validationResult = await this.validateGeneratedCode(result.updatedContent, filePath);
        
        console.log(`[AI-PROCESSOR] Validation result: isValid=${validationResult.isValid}, issues=${validationResult.issues.length}`);
        if (validationResult.issues.length > 0) {
          console.log(`[AI-PROCESSOR] Validation issues: ${validationResult.issues.join(', ')}`);
        }
        
        if (!validationResult.isValid) {
          console.log(`[AI-PROCESSOR] Validation failed on attempt ${attempt}/${this.maxRetries}`);
          if (attempt < this.maxRetries) {
            console.log(`Validation failed on attempt ${attempt}, retrying...`);
            return this.processFileChanges(filePath, fileContent, changes, attempt + 1);
          } else {
            return {
              success: false,
              updatedContent: '',
              explanation: '',
              testSuggestions: [],
              commitMessage: '',
              error: `Code validation failed after ${this.maxRetries} attempts: ${validationResult.issues.join(', ')}`
            };
          }
        }

        return {
          success: true,
          updatedContent: result.updatedContent,
          explanation: result.explanation,
          testSuggestions: result.testSuggestions || [],
          commitMessage: result.commitMessage || `Update ${filePath} with AI-generated changes`
        };
      } else {
        return {
          success: false,
          updatedContent: '',
          explanation: '',
          testSuggestions: [],
          commitMessage: '',
          error: result.error || 'AI failed to process changes'
        };
      }
    } catch (error) {
      console.error(`Processing attempt ${attempt} failed:`, error);
      console.error('Raw AI response:', response || 'No response received');
      
      if (attempt < this.maxRetries) {
        console.log(`Processing failed on attempt ${attempt}, retrying...`);
        return this.processFileChanges(filePath, fileContent, changes, attempt + 1);
      } else {
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);
        return {
          success: false,
          updatedContent: '',
          explanation: '',
          testSuggestions: [],
          commitMessage: '',
          error: `Failed to process changes after ${this.maxRetries} attempts: ${errorMessage}. Check logs for AI response details.`
        };
      }
    }
  }

  /**
   * Validate generated code for syntax and security
   */
  private async validateGeneratedCode(code: string, filePath: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const securityConcerns: string[] = [];

    // Basic syntax checks
    if (!code.trim()) {
      issues.push('Generated code is empty');
    }

    // Check for React/TypeScript patterns
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      if (!code.includes('import') && code.length > 100) {
        issues.push('Missing import statements for a substantial file');
      }

      if (filePath.endsWith('.tsx') && !code.includes('export') && code.length > 50) {
        issues.push('Missing export statement for component file');
      }
    }

    // Security checks
    const dangerousPatterns = [
      /eval\(/g,
      /innerHTML\s*=/g,
      /dangerouslySetInnerHTML/g,
      /<script/g,
      /document\.write/g,
      /window\.location/g
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        securityConcerns.push(`Potentially dangerous pattern found: ${pattern.source}`);
      }
    }

    // Advanced validation using AI
    if (issues.length === 0 && securityConcerns.length === 0) {
      try {
        const validationPrompt = `
Analyze this ${filePath.endsWith('.tsx') ? 'React TypeScript' : 'TypeScript'} code for syntax errors and potential issues:

\`\`\`typescript
${code}
\`\`\`

Check for:
1. TypeScript syntax errors
2. React best practices violations
3. Missing dependencies or imports
4. Potential runtime errors

Return JSON: {"isValid": boolean, "issues": ["list of issues"]}
`;

        const aiResponse = await this.aiAgent.processRequest(validationPrompt);
        const aiResult = JSON.parse(aiResponse);

        if (!aiResult.isValid) {
          issues.push(...(aiResult.issues || []));
        }
      } catch (error) {
        console.warn('AI validation failed, proceeding with basic validation');
      }
    }

    return {
      isValid: issues.length === 0 && securityConcerns.length === 0,
      issues,
      securityConcerns
    };
  }

  /**
   * Generate test suggestions for the changes
   */
  async generateTestSuggestions(
    filePath: string,
    changes: ChangeRequest[],
    updatedContent: string
  ): Promise<string[]> {
    const prompt = `
Generate comprehensive test suggestions for the following React/TypeScript file changes:

File: ${filePath}
Changes made:
${changes.map(change => `- ${change.feedback} (${change.category})`).join('\n')}

Updated code structure:
\`\`\`typescript
${updatedContent.substring(0, 1000)}...
\`\`\`

Suggest specific tests that should be written to verify these changes work correctly. Include:
1. Unit tests for component functionality
2. Integration tests for user interactions
3. Visual regression tests for UI changes
4. Accessibility tests if relevant

Return a JSON array of test suggestions:
["test description 1", "test description 2", ...]
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const testSuggestions = JSON.parse(response);
      return Array.isArray(testSuggestions) ? testSuggestions : [];
    } catch (error) {
      console.error('Failed to generate test suggestions:', error);
      return [`Test ${filePath} functionality after recent changes`];
    }
  }

  /**
   * Create comprehensive commit message for file changes
   */
  generateCommitMessage(filePath: string, changes: ChangeRequest[], explanation: string): string {
    const fileName = filePath.split('/').pop() || filePath;
    const categories = [...new Set(changes.map(c => c.category))];
    const priorities = changes.filter(c => c.priority === 'high').length;

    let message = `feat: update ${fileName}`;

    if (categories.length === 1) {
      message += ` - ${categories[0]} improvements`;
    } else {
      message += ` - multiple UI enhancements`;
    }

    if (priorities > 0) {
      message += ` (${priorities} high priority)`;
    }

    message += `\n\n${explanation}`;

    // Add change details
    message += '\n\nChanges implemented:';
    changes.forEach(change => {
      message += `\n- ${change.componentId}: ${change.feedback}`;
    });

    message += '\n\n🤖 Generated with [Claude Code](https://claude.ai/code)';
    message += '\n\nCo-Authored-By: Claude <noreply@anthropic.com>';

    return message;
  }

  /**
   * Process all file groups with comprehensive error handling
   */
  async processAllFileGroups(
    repoUrl: string,
    fileGroups: FileProcessingGroup[]
  ): Promise<{
    success: boolean;
    processedFiles: string[];
    failedFiles: { path: string; error: string }[];
    totalChanges: number;
  }> {
    const processedFiles: string[] = [];
    const failedFiles: { path: string; error: string }[] = [];
    let totalChanges = 0;

    // First, retrieve all file contents
    const filePaths = fileGroups.map(group => group.filePath);
    const fileContents = await this.retrieveFiles(repoUrl, filePaths);

    // Update file groups with retrieved content
    for (const group of fileGroups) {
      const fileContent = fileContents.find(f => f.path === group.filePath);
      if (fileContent) {
        group.originalContent = fileContent.content;
      }
    }

    // Process each file group
    for (const group of fileGroups) {
      try {
        if (!group.originalContent) {
          failedFiles.push({
            path: group.filePath,
            error: 'Could not retrieve file content from repository'
          });
          continue;
        }

        const result = await this.processFileChanges(
          group.filePath,
          group.originalContent,
          group.changes
        );

        if (result.success) {
          processedFiles.push(group.filePath);
          totalChanges += group.changes.length;
        } else {
          failedFiles.push({
            path: group.filePath,
            error: result.error || 'Unknown processing error'
          });
        }
      } catch (error) {
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);

        failedFiles.push({
          path: group.filePath,
          error: errorMessage
        });
      }
    }

    return {
      success: failedFiles.length === 0,
      processedFiles,
      failedFiles,
      totalChanges
    };
  }

  /**
   * Retrieve multiple files from GitHub repository
   */
  private async retrieveFiles(repoUrl: string, filePaths: string[]): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];

    for (const filePath of filePaths) {
      try {
        const content = await this.githubService.getFileContent(repoUrl, filePath);
        results.push({ path: filePath, content });
      } catch (error) {
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error);

        console.error(`Failed to retrieve ${filePath}:`, errorMessage);
        // Add empty content as fallback
        results.push({ path: filePath, content: '' });
      }
    }

    return results;
  }
}