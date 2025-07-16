// src/agent/custom-ai-agent.ts
import { generateText, generateObject, streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Custom provider for Grok (X.AI)
class GrokProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.x.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateText(prompt: string, options: any = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        stream: false
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateStream(prompt: string, options: any = {}): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        stream: true
      })
    });

    return response.body!;
  }
}

// AI Provider configuration
interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'grok';
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// Agent memory for context management
interface AgentMemory {
  conversation: Array<{ role: string; content: string; timestamp: number }>;
  projectContext: {
    structure: string;
    dependencies: Record<string, string>;
    framework: string;
    lastAnalysis: string;
  };
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

// Agent reasoning and planning
interface AgentPlan {
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    type: 'analyze' | 'code' | 'test' | 'refactor' | 'document';
    dependencies: string[];
    estimatedTime: number;
    tools: string[];
  }>;
  constraints: string[];
  successCriteria: string[];
}

export class CustomAIAgent {
  private config: AIProviderConfig;
  private memory: AgentMemory;
  private grokProvider?: GrokProvider;
  private toolRegistry: Map<string, any>;
  private reasoningDepth: number = 3;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.memory = this.initializeMemory();
    this.toolRegistry = new Map();
    
    if (config.provider === 'grok') {
      this.grokProvider = new GrokProvider(config.apiKey);
    }

    this.registerTools();
  }

  private initializeMemory(): AgentMemory {
    return {
      conversation: [],
      projectContext: {
        structure: '',
        dependencies: {},
        framework: '',
        lastAnalysis: ''
      },
      taskHistory: [],
      codePatterns: []
    };
  }

  private getProvider() {
    switch (this.config.provider) {
      case 'openai':
        return openai(this.config.apiKey);
      case 'anthropic':
        return anthropic(this.config.apiKey);
      case 'google':
        return google(this.config.apiKey);
      case 'grok':
        return this.grokProvider!;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private getModel() {
    return this.config.model;
  }

  private registerTools() {
    this.toolRegistry.set('analyze_code', tool({
      description: 'Analyze code for patterns, issues, and improvements',
      parameters: z.object({
        code: z.string().describe('The code to analyze'),
        focus: z.string().optional().describe('Specific aspect to focus on')
      }),
      execute: async ({ code, focus }) => {
        return await this.analyzeCode(code, focus);
      }
    }));

    this.toolRegistry.set('generate_plan', tool({
      description: 'Generate a detailed implementation plan',
      parameters: z.object({
        goal: z.string().describe('The main goal to achieve'),
        constraints: z.array(z.string()).optional().describe('Any constraints to consider')
      }),
      execute: async ({ goal, constraints }) => {
        return await this.generatePlan(goal, constraints);
      }
    }));

    this.toolRegistry.set('execute_step', tool({
      description: 'Execute a specific step from the plan',
      parameters: z.object({
        stepId: z.string().describe('The step ID to execute'),
        context: z.string().optional().describe('Additional context for execution')
      }),
      execute: async ({ stepId, context }) => {
        return await this.executeStep(stepId, context);
      }
    }));

    this.toolRegistry.set('reflect_and_improve', tool({
      description: 'Reflect on recent actions and suggest improvements',
      parameters: z.object({
        actions: z.array(z.string()).describe('Recent actions taken'),
        outcomes: z.array(z.string()).describe('Outcomes of those actions')
      }),
      execute: async ({ actions, outcomes }) => {
        return await this.reflectAndImprove(actions, outcomes);
      }
    }));

    this.toolRegistry.set('search_memory', tool({
      description: 'Search agent memory for relevant information',
      parameters: z.object({
        query: z.string().describe('What to search for'),
        type: z.enum(['conversation', 'tasks', 'patterns']).describe('Type of memory to search')
      }),
      execute: async ({ query, type }) => {
        return await this.searchMemory(query, type);
      }
    }));
  }

  async processTask(task: string, options: {
    reasoning: boolean;
    streaming?: boolean;
    maxSteps?: number;
  } = { reasoning: true, maxSteps: 10 }): Promise<{
    result: string;
    reasoning: string[];
    plan?: AgentPlan;
    executionSteps: Array<{ step: string; result: string; success: boolean }>;
  }> {
    const reasoning: string[] = [];
    const executionSteps: Array<{ step: string; result: string; success: boolean }> = [];

    // Add task to memory
    this.memory.conversation.push({
      role: 'user',
      content: task,
      timestamp: Date.now()
    });

    // Step 1: Reasoning and Planning
    if (options.reasoning) {
      reasoning.push('🧠 Analyzing task and generating plan...');
      const plan = await this.generatePlan(task);
      reasoning.push(`📋 Generated plan with ${plan.steps.length} steps`);
      
      // Step 2: Execute plan
      for (let i = 0; i < Math.min(plan.steps.length, options.maxSteps || 10); i++) {
        const step = plan.steps[i];
        reasoning.push(`⚡ Executing step ${i + 1}: ${step.description}`);
        
        try {
          const result = await this.executeStepWithReasoning(step, task);
          executionSteps.push({
            step: step.description,
            result: result.content,
            success: result.success
          });
          reasoning.push(`✅ Step ${i + 1} completed: ${result.summary}`);
        } catch (error) {
          executionSteps.push({
            step: step.description,
            result: `Error: ${error.message}`,
            success: false
          });
          reasoning.push(`❌ Step ${i + 1} failed: ${error.message}`);
        }
      }
    }

    // Step 3: Generate final response
    const finalResult = await this.generateFinalResponse(task, executionSteps);
    
    // Step 4: Learn from execution
    await this.learnFromExecution(task, executionSteps);

    return {
      result: finalResult,
      reasoning,
      plan: options.reasoning ? await this.generatePlan(task) : undefined,
      executionSteps
    };
  }

  private async generatePlan(goal: string, constraints: string[] = []): Promise<AgentPlan> {
    const systemPrompt = `You are an AI agent planning system. Generate a detailed, executable plan for achieving the given goal.
    
    Consider:
    - Breaking down complex tasks into smaller steps
    - Dependencies between steps
    - Required tools and resources
    - Time estimates
    - Success criteria
    
    Project context: ${JSON.stringify(this.memory.projectContext)}
    Previous similar tasks: ${JSON.stringify(this.memory.taskHistory.slice(-3))}`;

    const provider = this.getProvider();
    
    if (this.config.provider === 'grok') {
      const response = await this.grokProvider!.generateText(
        `${systemPrompt}\n\nGoal: ${goal}\nConstraints: ${constraints.join(', ')}\n\nGenerate a detailed plan in JSON format.`,
        { model: this.getModel() }
      );
      
      try {
        return JSON.parse(response);
      } catch {
        // Fallback to structured format
        return this.parsePlanFromText(response, goal);
      }
    }

    const result = await generateObject({
      model: provider(this.getModel()),
      system: systemPrompt,
      prompt: `Goal: ${goal}\nConstraints: ${constraints.join(', ')}\n\nGenerate a detailed plan.`,
      schema: z.object({
        goal: z.string(),
        steps: z.array(z.object({
          id: z.string(),
          description: z.string(),
          type: z.enum(['analyze', 'code', 'test', 'refactor', 'document']),
          dependencies: z.array(z.string()),
          estimatedTime: z.number(),
          tools: z.array(z.string())
        })),
        constraints: z.array(z.string()),
        successCriteria: z.array(z.string())
      })
    });

    return result.object;
  }

  private async executeStepWithReasoning(step: any, originalTask: string): Promise<{
    content: string;
    success: boolean;
    summary: string;
  }> {
    const tools = Object.fromEntries(this.toolRegistry);
    
    const systemPrompt = `You are executing a specific step in a larger plan. 
    
    Original task: ${originalTask}
    Current step: ${step.description}
    Step type: ${step.type}
    Available tools: ${step.tools.join(', ')}
    
    Execute this step thoroughly and provide detailed output.
    Use the available tools when appropriate.
    
    Context: ${JSON.stringify(this.memory.projectContext)}`;

    const provider = this.getProvider();
    
    if (this.config.provider === 'grok') {
      const response = await this.grokProvider!.generateText(
        `${systemPrompt}\n\nExecute the step: ${step.description}`,
        { model: this.getModel() }
      );
      
      return {
        content: response,
        success: true,
        summary: `Executed ${step.description}`
      };
    }

    const result = await generateText({
      model: provider(this.getModel()),
      system: systemPrompt,
      prompt: `Execute step: ${step.description}`,
      tools,
      maxSteps: 5
    });

    return {
      content: result.text,
      success: true,
      summary: `Executed ${step.description}`
    };
  }

  private async generateFinalResponse(task: string, executionSteps: any[]): Promise<string> {
    const systemPrompt = `You are synthesizing the results of a multi-step execution into a final response.
    
    Original task: ${task}
    Execution steps completed: ${executionSteps.length}
    
    Provide a comprehensive final response that:
    1. Summarizes what was accomplished
    2. Highlights key insights or results
    3. Mentions any limitations or next steps
    4. Provides concrete deliverables when applicable`;

    const provider = this.getProvider();
    
    if (this.config.provider === 'grok') {
      return await this.grokProvider!.generateText(
        `${systemPrompt}\n\nTask: ${task}\nExecution steps: ${JSON.stringify(executionSteps, null, 2)}\n\nProvide final response:`,
        { model: this.getModel() }
      );
    }

    const result = await generateText({
      model: provider(this.getModel()),
      system: systemPrompt,
      prompt: `Synthesize results for task: ${task}\n\nExecution steps: ${JSON.stringify(executionSteps, null, 2)}`
    });

    return result.text;
  }

  private async learnFromExecution(task: string, executionSteps: any[]): Promise<void> {
    // Analyze execution for patterns and improvements
    const successRate = executionSteps.filter(step => step.success).length / executionSteps.length;
    
    // Store in memory
    this.memory.taskHistory.push({
      task,
      approach: `${executionSteps.length} steps executed`,
      result: `${successRate * 100}% success rate`,
      success: successRate > 0.7,
      timestamp: Date.now()
    });

    // Extract patterns for future use
    const patterns = executionSteps
      .filter(step => step.success)
      .map(step => ({
        pattern: step.step,
        context: task,
        effectiveness: step.success ? 1 : 0
      }));

    this.memory.codePatterns.push(...patterns);

    // Keep memory manageable
    if (this.memory.taskHistory.length > 100) {
      this.memory.taskHistory = this.memory.taskHistory.slice(-50);
    }
    if (this.memory.codePatterns.length > 200) {
      this.memory.codePatterns = this.memory.codePatterns.slice(-100);
    }
  }

  // Tool implementations
  private async analyzeCode(code: string, focus?: string): Promise<string> {
    const systemPrompt = `You are a code analysis expert. Analyze the provided code for:
    - Code quality and best practices
    - Potential bugs or issues
    - Performance improvements
    - Security concerns
    - Architecture patterns
    ${focus ? `Focus specifically on: ${focus}` : ''}`;

    const provider = this.getProvider();
    
    if (this.config.provider === 'grok') {
      return await this.grokProvider!.generateText(
        `${systemPrompt}\n\nCode to analyze:\n${code}`,
        { model: this.getModel() }
      );
    }

    const result = await generateText({
      model: provider(this.getModel()),
      system: systemPrompt,
      prompt: `Analyze this code:\n\n${code}`
    });

    return result.text;
  }

  private async executeStep(stepId: string, context?: string): Promise<string> {
    // Implementation would execute specific step
    return `Executed step ${stepId} with context: ${context}`;
  }

  private async reflectAndImprove(actions: string[], outcomes: string[]): Promise<string> {
    const systemPrompt = `You are a self-improving AI agent. Analyze the given actions and outcomes to suggest improvements.
    
    Focus on:
    - What worked well
    - What could be improved
    - Patterns to remember
    - Adjustments for future tasks`;

    const provider = this.getProvider();
    
    if (this.config.provider === 'grok') {
      return await this.grokProvider!.generateText(
        `${systemPrompt}\n\nActions: ${actions.join(', ')}\nOutcomes: ${outcomes.join(', ')}`,
        { model: this.getModel() }
      );
    }

    const result = await generateText({
      model: provider(this.getModel()),
      system: systemPrompt,
      prompt: `Actions taken: ${actions.join(', ')}\nOutcomes: ${outcomes.join(', ')}`
    });

    return result.text;
  }

  private async searchMemory(query: string, type: 'conversation' | 'tasks' | 'patterns'): Promise<string> {
    let searchResults: any[] = [];

    switch (type) {
      case 'conversation':
        searchResults = this.memory.conversation.filter(msg => 
          msg.content.toLowerCase().includes(query.toLowerCase())
        );
        break;
      case 'tasks':
        searchResults = this.memory.taskHistory.filter(task => 
          task.task.toLowerCase().includes(query.toLowerCase()) ||
          task.approach.toLowerCase().includes(query.toLowerCase())
        );
        break;
      case 'patterns':
        searchResults = this.memory.codePatterns.filter(pattern => 
          pattern.pattern.toLowerCase().includes(query.toLowerCase()) ||
          pattern.context.toLowerCase().includes(query.toLowerCase())
        );
        break;
    }

    return JSON.stringify(searchResults.slice(0, 10), null, 2);
  }

  private parsePlanFromText(text: string, goal: string): AgentPlan {
    // Fallback parser for when JSON parsing fails
    const lines = text.split('\n');
    const steps = [];
    let currentStep = null;

    for (const line of lines) {
      if (line.trim().startsWith('Step') || line.trim().startsWith('-')) {
        if (currentStep) {
          steps.push(currentStep);
        }
        currentStep = {
          id: `step-${steps.length + 1}`,
          description: line.trim(),
          type: 'code' as const,
          dependencies: [],
          estimatedTime: 30,
          tools: ['analyze_code']
        };
      }
    }

    if (currentStep) {
      steps.push(currentStep);
    }

    return {
      goal,
      steps,
      constraints: [],
      successCriteria: ['Task completion', 'Code quality', 'Tests passing']
    };
  }

  // Public methods for external use
  async getMemoryStats(): Promise<{
    conversations: number;
    tasks: number;
    patterns: number;
    successRate: number;
  }> {
    const successfulTasks = this.memory.taskHistory.filter(t => t.success).length;
    const totalTasks = this.memory.taskHistory.length;

    return {
      conversations: this.memory.conversation.length,
      tasks: totalTasks,
      patterns: this.memory.codePatterns.length,
      successRate: totalTasks > 0 ? successfulTasks / totalTasks : 0
    };
  }

  async clearMemory(): Promise<void> {
    this.memory = this.initializeMemory();
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

  async switchProvider(newConfig: AIProviderConfig): Promise<void> {
    this.config = newConfig;
    if (newConfig.provider === 'grok') {
      this.grokProvider = new GrokProvider(newConfig.apiKey);
    }
  }
}
