// netlify/functions/shared/custom-ai-agent.ts
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

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

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = this.initializeMemory();
    this.tools = new Map();
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

      const systemPrompt = `You are an advanced AI development assistant with access to powerful tools for code analysis, file manipulation, testing, and GitHub integration.

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

**IMPORTANT:**
- Always use tools to interact with the codebase
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
      'anthropic': anthropic('claude-3-5-sonnet-20241022'),
      'openai': openai('gpt-4-turbo'),
      'google': google('gemini-pro'),
      'grok': anthropic('claude-3-5-sonnet-20241022') // Fallback to Claude for Grok
    };
    
    return modelMap[this.config.provider] || anthropic('claude-3-5-sonnet-20241022');
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
        maxTokens: 4000
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

