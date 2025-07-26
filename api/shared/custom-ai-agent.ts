// netlify/functions/shared/custom-ai-agent.ts
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { PexelsService } from '../../src/services/pexels';

interface AgentConfig {
  sessionId: string;
  sandbox: any;
  repositoryUrl: string;
  provider: 'anthropic' | 'openai' | 'google' | 'grok';
  model: string;
  projectContext: {
    componentRegistry: any;
    dependencies: Record<string, string>;
    framework: string;
    structure: string;
  };
}

interface AgentMemory {
  conversation: Array<{ role: string; content: string; timestamp: number }>;
  projectContext: any;
  taskHistory: Array<{
    task: string;
    approach: string;
    result: string;
    success: boolean;
    timestamp: number;
  }>;
  codePatterns: Array<{
    pattern: string;
    context: string;
    effectiveness: number;
  }>;
}

interface AgentResult {
  success: boolean;
  result?: any;
  error?: string;
  reasoning: string[];
  executionSteps: Array<{
    step: string;
    result: string;
    success: boolean;
    tool?: string;
    parameters?: any;
  }>;
}

export class CustomAIAgent {
  private config: AgentConfig;
  private memory: AgentMemory;
  private tools: Map<string, any>;
  private pexelsService: PexelsService;

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = this.initializeMemory();
    this.tools = new Map();
    this.pexelsService = new PexelsService();
  }

  private initializeMemory(): AgentMemory {
    return {
      conversation: [],
      projectContext: this.config.projectContext,
      taskHistory: [],
      codePatterns: []
    };
  }

  async initialize(): Promise<void> {
    await this.registerTools();
  }

  private async registerTools(): Promise<void> {
    // File system tools
    this.tools.set('read_file', tool({
      description: 'Read the contents of a file in the sandbox',
      parameters: z.object({
        path: z.string().describe('File path to read')
      }),
      execute: async ({ path }) => {
        return await this.config.sandbox.readFile(path);
      }
    }));

    this.tools.set('write_file', tool({
      description: 'Write or update a file in the sandbox',
      parameters: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('File content')
      }),
      execute: async ({ path, content }) => {
        await this.config.sandbox.writeFile(path, content);
        return `File ${path} updated successfully`;
      }
    }));

    this.tools.set('list_files', tool({
      description: 'List files and directories in a given path',
      parameters: z.object({
        path: z.string().optional().describe('Directory path to list (defaults to current directory)')
      }),
      execute: async ({ path = '.' }) => {
        return await this.config.sandbox.listFiles(path);
      }
    }));

    // Git operations
    this.tools.set('git_clone', tool({
      description: 'Clone a repository into the sandbox',
      parameters: z.object({
        repositoryUrl: z.string().describe('Git repository URL'),
        branch: z.string().optional().describe('Branch to checkout (defaults to develop)')
      }),
      execute: async ({ repositoryUrl, branch = 'develop' }) => {
        return await this.config.sandbox.gitClone(repositoryUrl, branch);
      }
    }));

    this.tools.set('git_create_branch', tool({
      description: 'Create and switch to a new git branch',
      parameters: z.object({
        branchName: z.string().describe('Name of the new branch')
      }),
      execute: async ({ branchName }) => {
        return await this.config.sandbox.gitCreateBranch(branchName);
      }
    }));

    this.tools.set('git_commit', tool({
      description: 'Commit changes to git',
      parameters: z.object({
        message: z.string().describe('Commit message')
      }),
      execute: async ({ message }) => {
        return await this.config.sandbox.gitCommit(message);
      }
    }));

    // Testing tools
    this.tools.set('run_tests', tool({
      description: 'Run the project test suite',
      parameters: z.object({
        testPath: z.string().optional().describe('Specific test file or directory to run')
      }),
      execute: async ({ testPath }) => {
        return await this.config.sandbox.runTests(testPath);
      }
    }));

    this.tools.set('create_test', tool({
      description: 'Create a test file for a component',
      parameters: z.object({
        componentPath: z.string().describe('Path to the component file'),
        testType: z.enum(['unit', 'integration', 'e2e']).describe('Type of test to create')
      }),
      execute: async ({ componentPath, testType }) => {
        return await this.createTest(componentPath, testType);
      }
    }));

    // Command execution
    this.tools.set('run_command', tool({
      description: 'Run a shell command in the sandbox',
      parameters: z.object({
        command: z.string().describe('Command to execute'),
        workingDir: z.string().optional().describe('Working directory for the command')
      }),
      execute: async ({ command, workingDir = '.' }) => {
        return await this.config.sandbox.runCommand(command, { cwd: workingDir });
      }
    }));

    // GitHub operations
    this.tools.set('create_pull_request', tool({
      description: 'Create a pull request on GitHub',
      parameters: z.object({
        title: z.string().describe('PR title'),
        changes: z.array(z.any()).describe('List of changes made'),
        sessionId: z.string().describe('Session ID for tracking')
      }),
      execute: async ({ title, changes, sessionId }) => {
        return await this.createPullRequest(title, changes, sessionId);
      }
    }));

    // Deployment monitoring
    this.tools.set('wait_for_deployment', tool({
      description: 'Wait for and monitor deployment status',
      parameters: z.object({
        branchName: z.string().describe('Branch name to monitor')
      }),
      execute: async ({ branchName }) => {
        return await this.waitForDeployment(branchName);
      }
    }));

    // Pexels media tools
    this.tools.set('search_pexels_media', tool({
      description: 'Search for stock photos and videos on Pexels. Use this when you need real images or videos instead of placeholders.',
      parameters: z.object({
        query: z.string().describe('Search query for the media (e.g., "modern office", "healthy food", "technology")'),
        type: z.enum(['photos', 'videos', 'both']).default('photos').describe('Type of media to search'),
        orientation: z.enum(['landscape', 'portrait', 'square']).optional().describe('Media orientation'),
        size: z.enum(['large', 'medium', 'small']).optional().describe('Media size'),
        color: z.string().optional().describe('Dominant color (e.g., "red", "blue", "#FF5733")'),
        perPage: z.number().min(1).max(80).default(10).describe('Number of results per page'),
        page: z.number().min(1).default(1).describe('Page number for pagination')
      }),
      execute: async ({ query, type, orientation, size, color, perPage, page }) => {
        try {
          const result = await this.pexelsService.searchMedia({
            query,
            type,
            orientation,
            size,
            color,
            perPage,
            page,
            includeMetadata: true
          });
          
          return {
            success: true,
            totalResults: result.totalResults,
            assets: result.assets.map(asset => ({
              id: asset.id,
              type: asset.type,
              url: asset.url,
              downloadUrl: asset.downloadUrl,
              thumbnailUrl: asset.thumbnailUrl,
              alt: asset.alt,
              photographer: asset.photographer,
              width: asset.width,
              height: asset.height,
              avgColor: asset.avgColor
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    }));

    this.tools.set('get_curated_photos', tool({
      description: 'Get high-quality curated photos from Pexels. Use this for hero sections, backgrounds, or featured content.',
      parameters: z.object({
        perPage: z.number().min(1).max(80).default(10).describe('Number of results'),
        page: z.number().min(1).default(1).describe('Page number for pagination')
      }),
      execute: async ({ perPage, page }) => {
        try {
          const result = await this.pexelsService.getCuratedContent({
            perPage,
            page,
            includeMetadata: true
          });
          
          return {
            success: true,
            assets: result.assets.map(asset => ({
              id: asset.id,
              url: asset.url,
              downloadUrl: asset.downloadUrl,
              thumbnailUrl: asset.thumbnailUrl,
              alt: asset.alt,
              photographer: asset.photographer,
              width: asset.width,
              height: asset.height,
              avgColor: asset.avgColor
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    }));

    this.tools.set('get_popular_videos', tool({
      description: 'Get popular videos from Pexels for backgrounds, hero sections, or video content.',
      parameters: z.object({
        perPage: z.number().min(1).max(80).default(10).describe('Number of results'),
        page: z.number().min(1).default(1).describe('Page number'),
        minWidth: z.number().optional().describe('Minimum video width'),
        minHeight: z.number().optional().describe('Minimum video height'),
        minDuration: z.number().optional().describe('Minimum duration in seconds'),
        maxDuration: z.number().optional().describe('Maximum duration in seconds')
      }),
      execute: async ({ perPage, page, minWidth, minHeight, minDuration, maxDuration }) => {
        try {
          const result = await this.pexelsService.getPopularVideos({
            perPage,
            page,
            minWidth,
            minHeight,
            minDuration,
            maxDuration,
            includeMetadata: true
          });
          
          return {
            success: true,
            assets: result.assets.map(asset => ({
              id: asset.id,
              type: asset.type,
              url: asset.url,
              downloadUrl: asset.downloadUrl,
              thumbnailUrl: asset.thumbnailUrl,
              duration: asset.duration,
              quality: asset.quality,
              photographer: asset.photographer,
              width: asset.width,
              height: asset.height
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    }));

    this.tools.set('get_media_recommendations', tool({
      description: 'Get AI-powered media recommendations based on a seed image or video',
      parameters: z.object({
        seedAssetId: z.number().describe('ID of the seed asset to base recommendations on'),
        seedAssetType: z.enum(['photo', 'video']).describe('Type of the seed asset'),
        count: z.number().min(1).max(50).default(10).describe('Number of recommendations'),
        similarColor: z.boolean().default(true).describe('Find assets with similar colors'),
        sameType: z.boolean().default(true).describe('Only recommend same type (photo/video)')
      }),
      execute: async ({ seedAssetId, seedAssetType, count, similarColor, sameType }) => {
        try {
          // First, we need to construct a seed asset object
          // In a real implementation, we might cache previously fetched assets
          const seedAsset = {
            id: seedAssetId,
            type: seedAssetType,
            url: '',
            downloadUrl: '',
            thumbnailUrl: '',
            alt: 'Seed asset',
            photographer: '',
            photographerUrl: '',
            width: 1920,
            height: 1080,
            aspectRatio: 16/9
          };
          
          const result = await this.pexelsService.getRecommendations(seedAsset, {
            count,
            similarColor,
            sameType
          });
          
          return {
            success: true,
            recommendations: result.recommendations.map(asset => ({
              id: asset.id,
              type: asset.type,
              url: asset.url,
              downloadUrl: asset.downloadUrl,
              thumbnailUrl: asset.thumbnailUrl,
              alt: asset.alt,
              photographer: asset.photographer,
              similarityScore: asset.similarityScore
            })),
            confidence: result.confidence
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    }));
  }

  async processTask(
    prompt: string, 
    options: {
      reasoning: boolean;
      maxSteps: number;
      onProgress?: (step: string, agent?: string) => Promise<void>;
    }
  ): Promise<AgentResult> {
    const reasoning: string[] = [];
    const executionSteps: Array<{
      step: string;
      result: string;
      success: boolean;
      tool?: string;
      parameters?: any;
    }> = [];

    try {
      // Add task to memory
      this.memory.conversation.push({
        role: 'user',
        content: prompt,
        timestamp: Date.now()
      });

      if (options.reasoning) {
        reasoning.push('🧠 Analyzing task and generating execution plan...');
        if (options.onProgress) await options.onProgress('Analyzing task and generating execution plan...');
      }

      const systemPrompt = `You are an advanced AI development assistant with access to powerful tools for code analysis, file manipulation, testing, GitHub integration, and media assets.

**AVAILABLE TOOLS:**
${Array.from(this.tools.keys()).map(tool => `- ${tool}`).join('\n')}

**PROJECT CONTEXT:**
- Repository: ${this.config.repositoryUrl}
- Framework: ${this.memory.projectContext.framework}
- Component Registry: ${JSON.stringify(this.memory.projectContext.componentRegistry, null, 2)}

**YOUR APPROACH:**
1. Analyze the task thoroughly
2. Break it down into actionable steps
3. Use tools strategically to implement the solution
4. Validate your work with tests
5. Ensure code quality and maintainability

**MEDIA ASSETS:**
- When you need images or videos, use the Pexels tools (search_pexels_media, get_curated_photos, get_popular_videos)
- NEVER use placeholder image services like placeholder.com, placehold.it, or lorem picsum
- ALWAYS search for real, high-quality images that match the business context
- For hero sections and backgrounds, prefer using get_curated_photos or search with relevant business terms
- Include proper attribution when required (photographer name from Pexels)
- Use appropriate image sizes and orientations for different components

**IMPORTANT:**
- Always use tools to interact with the codebase
- Replace ALL placeholder images with real Pexels images
- Make incremental changes and test frequently
- Follow React/TypeScript best practices
- Consider component relationships and dependencies
- Document your changes appropriately

Start by analyzing the current codebase structure, then implement the requested changes step by step.`;

      // Use AI SDK with all registered tools
      const result = await generateText({
        model: this.getModelString(),
        prompt: `${systemPrompt}\n\nTask: ${prompt}`,
        tools: Object.fromEntries(this.tools.entries()),
        maxSteps: options.maxSteps,
        temperature: 0.1
      });

      // Store successful task in memory
      this.memory.taskHistory.push({
        task: prompt,
        approach: `${result.steps?.length || 0} steps executed`,
        result: result.text.slice(0, 500),
        success: true,
        timestamp: Date.now()
      });

      return {
        success: true,
        result: result.text,
        reasoning,
        executionSteps: result.steps?.map(step => ({
          step: step.stepType,
          result: JSON.stringify(step.result).slice(0, 500),
          success: true,
          tool: step.toolName,
          parameters: step.toolArguments
        })) || []
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        reasoning,
        executionSteps
      };
    }
  }

  async executeCommand(command: string, parameters: any): Promise<any> {
    const tool = this.tools.get(command);
    if (!tool) {
      throw new Error(`Unknown command: ${command}`);
    }
    
    return await tool.execute(parameters);
  }

  private async createTest(componentPath: string, testType: string): Promise<any> {
    const componentCode = await this.config.sandbox.readFile(componentPath);
    const componentName = componentPath.split('/').pop()?.replace('.tsx', '');
    
    const testPrompt = `Create a comprehensive ${testType} test for this React component:

Component: ${componentName}
File: ${componentPath}

Code:
${componentCode}

Create tests that cover:
1. Component rendering
2. Props handling
3. User interactions
4. Edge cases
5. Error states

Use Jest and React Testing Library. Provide the complete test file.`;

    const testResult = await generateText({
      model: this.getModelString(),
      prompt: testPrompt,
      temperature: 0.1
    });

    const testPath = componentPath.replace('.tsx', '.test.tsx');
    await this.config.sandbox.writeFile(testPath, testResult.text);
    
    return {
      testPath,
      componentPath,
      testType,
      created: true
    };
  }

  private async createPullRequest(title: string, changes: any[], sessionId: string): Promise<any> {
    const description = `# AI-Generated Improvements

This pull request contains ${changes.length} AI-generated improvements:

${changes.map((change, index) => 
  `## ${index + 1}. ${change.category}: ${change.componentId}\n${change.feedback}\n`
).join('\n')}

🤖 Generated automatically by Geenius AI Agent
Session ID: ${sessionId}`;

    return await this.config.sandbox.createPullRequest(title, description);
  }

  private async waitForDeployment(branchName: string): Promise<any> {
    // Implementation for deployment monitoring
    await new Promise(resolve => setTimeout(resolve, 5000));
    return {
      success: true,
      previewUrl: `https://${branchName.replace('/', '-')}--preview.netlify.app`
    };
  }

  private getModelString(): any {
    const modelMap = {
      'anthropic': anthropic('claude-sonnet-4-20250514'),
      'openai': openai('gpt-4-turbo'),
      'google': google('gemini-pro'),
      'grok': anthropic('claude-sonnet-4-20250514') // Fallback to Claude for Grok
    };
    
    return modelMap[this.config.provider] || anthropic('claude-sonnet-4-20250514');
  }

  async getStats(): Promise<any> {
    return {
      tasksCompleted: this.memory.taskHistory.length,
      successRate: this.memory.taskHistory.filter(t => t.success).length / this.memory.taskHistory.length,
      toolsAvailable: this.tools.size,
      memoryEntries: this.memory.conversation.length
    };
  }

  async exportMemory(): Promise<string> {
    return JSON.stringify(this.memory, null, 2);
  }

  async importMemory(memoryData: string): Promise<void> {
    try {
      this.memory = JSON.parse(memoryData);
    } catch (error) {
      throw new Error('Invalid memory data format');
    }
  }

  async switchProvider(newConfig: { provider: string; apiKey: string; model: string }): Promise<void> {
    this.config.provider = newConfig.provider as any;
    // In real implementation, update provider configuration
  }

  async getMemoryStats(): Promise<any> {
    return {
      conversationLength: this.memory.conversation.length,
      taskHistoryLength: this.memory.taskHistory.length,
      codePatternsLength: this.memory.codePatterns.length,
      lastActivity: this.memory.conversation[this.memory.conversation.length - 1]?.timestamp
    };
  }

  /**
   * Process a single request with the AI agent
   */
  async processRequest(prompt: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.getModelString(),
        prompt: prompt,
        temperature: 0.1,
        maxTokens: 12000
      });

      // Store in memory
      this.memory.conversation.push({
        role: 'user',
        content: prompt,
        timestamp: Date.now()
      });
      
      this.memory.conversation.push({
        role: 'assistant',
        content: result.text,
        timestamp: Date.now()
      });

      return result.text;
    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }
}

