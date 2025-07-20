// AI File Processor for Agentic AI System
import { CustomAIAgent } from './custom-ai-agent';
import { EnhancedGitHubService } from './enhanced-github-service';

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
    this.githubService = new EnhancedGitHubService();
  }

  /**
   * Validate change requests for security and relevance
   */
  async validateChangeRequests(changes: ChangeRequest[]): Promise<ValidationResult> {
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
      
      const result = JSON.parse(jsonResponse);

      return {
        isValid: result.isValid && (result.securityConcerns || []).length === 0,
        issues: result.issues || [],
        securityConcerns: result.securityConcerns || []
      };
    } catch (error) {
      console.error('Validation error:', error);
      console.error('Raw AI response:', response || 'No response received');
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      console.error('Error details:', errorMessage);
      
      // Return validation failure instead of permissive fallback for security
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
      // Extract file path from component context or metadata
      let filePath = change.componentContext?.filePath ||
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
      repositoryPath: changes[0]?.componentContext?.repositoryPath
    }));
  }

  /**
   * Infer file path from component ID (fallback method)
   */
  private inferFilePathFromComponent(componentId: string): string {
    // Basic inference logic - can be enhanced
    if (componentId.includes('landing') || componentId.includes('hero')) {
      return 'src/pages/Landing.tsx';
    }
    if (componentId.includes('auth') || componentId.includes('login')) {
      return 'src/components/auth/';
    }
    return 'src/components/'; // Default fallback
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

Please:
1. Implement ALL requested changes in the file
2. Ensure the code follows React/TypeScript best practices
3. Maintain existing functionality while adding the requested changes
4. Keep the existing import structure and dependencies
5. Preserve component structure and naming conventions

Provide your response in this JSON format:
{
  "success": true,
  "updatedContent": "complete updated file content here",
  "explanation": "detailed explanation of what was changed",
  "testSuggestions": ["list of tests that should be created for these changes"],
  "commitMessage": "Clear, descriptive commit message for these changes",
  "changesImplemented": ["list of change IDs that were successfully implemented"]
}

If you cannot implement the changes safely, return:
{
  "success": false,
  "error": "detailed explanation of why changes cannot be implemented",
  "suggestedAlternatives": ["alternative approaches"]
}
`;

    try {
      const response = await this.aiAgent.processRequest(prompt);
      const result = JSON.parse(response);

      if (result.success) {
        // Validate the generated code
        const validationResult = await this.validateGeneratedCode(result.updatedContent, filePath);
        if (!validationResult.isValid) {
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
          error: `Failed to process changes after ${this.maxRetries} attempts: ${errorMessage}`
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