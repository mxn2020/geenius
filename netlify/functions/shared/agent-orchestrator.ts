// netlify/functions/shared/agent-orchestrator.ts
import { CustomAIAgent } from './custom-ai-agent';
import { EventEmitter } from 'events';

interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  specialization: 'planning' | 'coding' | 'testing' | 'reviewing' | 'documenting';
}

interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[];
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  startTime?: number;
  endTime?: number;
}

interface OrchestrationStrategy {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  maxConcurrency: number;
  retryOnFailure: boolean;
  crossValidation: boolean;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, CustomAIAgent> = new Map();
  private roles: Map<string, AgentRole> = new Map();
  private activeTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, Task> = new Map();
  private strategy: OrchestrationStrategy;

  constructor(leadConfig: any, strategy: OrchestrationStrategy = {
    type: 'hierarchical',
    maxConcurrency: 3,
    retryOnFailure: true,
    crossValidation: true
  }) {
    super();
    this.strategy = strategy;
    this.initializeTeam(leadConfig);
  }

  private initializeTeam(leadConfig: any): void {
    // Define specialized roles
    const roles = new Map<string, AgentRole>([
      ['architect', {
        name: 'Software Architect',
        description: 'Designs system architecture and makes high-level decisions',
        systemPrompt: this.getArchitectPrompt(),
        tools: ['analyze_code', 'generate_plan', 'search_memory'],
        specialization: 'planning'
      }],
      ['developer', {
        name: 'Senior Developer',
        description: 'Implements features and writes high-quality code',
        systemPrompt: this.getDeveloperPrompt(),
        tools: ['read_file', 'write_file', 'run_command', 'git_commit'],
        specialization: 'coding'
      }],
      ['tester', {
        name: 'QA Engineer',
        description: 'Creates comprehensive tests and ensures quality',
        systemPrompt: this.getTesterPrompt(),
        tools: ['create_test', 'run_tests', 'read_file'],
        specialization: 'testing'
      }],
      ['reviewer', {
        name: 'Code Reviewer',
        description: 'Reviews code for best practices and improvements',
        systemPrompt: this.getReviewerPrompt(),
        tools: ['read_file', 'analyze_code'],
        specialization: 'reviewing'
      }]
    ]);

    // Initialize specialized agents
    for (const [roleKey, role] of roles.entries()) {
      const agent = new CustomAIAgent({
        ...leadConfig,
        systemPrompt: role.systemPrompt
      });
      this.agents.set(roleKey, agent);
    }

    this.roles = roles;
  }

  async orchestrateTask(description: string, options: {
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    requiredRoles?: string[];
    strategy?: OrchestrationStrategy;
  } = {}): Promise<{
    success: boolean;
    result: any;
    taskBreakdown: Task[];
    agentContributions: Map<string, any>;
    timeline: Array<{ timestamp: number; event: string; agent: string }>;
  }> {
    const strategy = options.strategy || this.strategy;
    const timeline: Array<{ timestamp: number; event: string; agent: string }> = [];
    const agentContributions = new Map<string, any>();

    // Step 1: Break down the task
    timeline.push({ timestamp: Date.now(), event: 'Task analysis started', agent: 'orchestrator' });
    const taskBreakdown = await this.analyzeAndBreakdownTask(description, options);
    timeline.push({ timestamp: Date.now(), event: 'Task breakdown completed', agent: 'orchestrator' });

    // Step 2: Execute based on strategy
    let result;
    let success = false;

    switch (strategy.type) {
      case 'sequential':
        result = await this.executeSequential(taskBreakdown, timeline, agentContributions);
        break;
      case 'parallel':
        result = await this.executeParallel(taskBreakdown, timeline, agentContributions);
        break;
      case 'hierarchical':
        result = await this.executeHierarchical(taskBreakdown, timeline, agentContributions);
        break;
      case 'collaborative':
        result = await this.executeCollaborative(taskBreakdown, timeline, agentContributions);
        break;
    }

    success = result.success;

    this.emit('taskCompleted', {
      success,
      result,
      taskBreakdown,
      agentContributions,
      timeline
    });

    return {
      success,
      result,
      taskBreakdown,
      agentContributions,
      timeline
    };
  }

  private async analyzeAndBreakdownTask(description: string, options: any): Promise<Task[]> {
    // Use the architect agent to break down the task
    const architect = this.agents.get('architect');
    if (!architect) {
      throw new Error('Architect agent not available');
    }

    const analysisResult = await architect.processTask(
      `Analyze this task and break it down into smaller, manageable subtasks: ${description}
      
      Consider:
      - Required skills and roles
      - Task dependencies
      - Priority levels
      - Estimated complexity
      - Required tools and resources
      
      Available roles: ${Array.from(this.roles.keys()).join(', ')}`,
      { reasoning: true, maxSteps: 5 }
    );

    return this.parseTaskBreakdown(analysisResult.result, description);
  }

  private parseTaskBreakdown(analysisResult: string, originalDescription: string): Task[] {
    const tasks: Task[] = [];
    const lines = analysisResult.split('\n');
    let currentTask: Partial<Task> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('Task:') || trimmed.startsWith('-')) {
        if (currentTask.description) {
          tasks.push({
            id: `task-${tasks.length + 1}`,
            description: currentTask.description,
            priority: (currentTask.priority as any) || 'medium',
            dependencies: currentTask.dependencies || [],
            status: 'pending'
          });
        }
        
        currentTask = {
          description: trimmed.replace(/^(Task:|-)/, '').trim(),
          priority: 'medium',
          dependencies: []
        };
      }
    }

    if (currentTask.description) {
      tasks.push({
        id: `task-${tasks.length + 1}`,
        description: currentTask.description,
        priority: (currentTask.priority as any) || 'medium',
        dependencies: currentTask.dependencies || [],
        status: 'pending'
      });
    }

    return tasks.length > 0 ? tasks : [{
      id: 'task-1',
      description: originalDescription,
      priority: 'medium',
      dependencies: [],
      status: 'pending'
    }];
  }

  private async executeHierarchical(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    
    // Execute high-priority tasks first
    const priorityOrder = ['urgent', 'high', 'medium', 'low'];
    const sortedTasks = tasks.sort((a, b) => {
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    for (const task of sortedTasks) {
      const agent = this.selectBestAgent(task);
      
      timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });

      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = agent;

      try {
        const agentInstance = this.agents.get(agent);
        if (!agentInstance) {
          throw new Error(`Agent ${agent} not available`);
        }

        const result = await agentInstance.processTask(task.description, {
          reasoning: true,
          maxSteps: 8
        });

        task.result = result;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(result);

        agentContributions.set(agent, {
          ...(agentContributions.get(agent) || {}),
          [task.id]: result
        });

        timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeSequential(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    
    for (const task of tasks) {
      const agent = this.selectBestAgent(task);
      timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });
      
      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = agent;

      try {
        const agentInstance = this.agents.get(agent);
        if (!agentInstance) {
          throw new Error(`Agent ${agent} not available`);
        }

        const result = await agentInstance.processTask(task.description, {
          reasoning: true,
          maxSteps: 8
        });

        task.result = result;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(result);

        agentContributions.set(agent, {
          ...(agentContributions.get(agent) || {}),
          [task.id]: result
        });

        timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeParallel(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const maxConcurrency = this.strategy.maxConcurrency;
    const results: any[] = [];

    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (task) => {
        const agent = this.selectBestAgent(task);
        timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });
        
        task.status = 'in_progress';
        task.startTime = Date.now();
        task.assignedAgent = agent;

        try {
          const agentInstance = this.agents.get(agent);
          if (!agentInstance) {
            throw new Error(`Agent ${agent} not available`);
          }

          const result = await agentInstance.processTask(task.description, {
            reasoning: true,
            maxSteps: 8
          });

          task.result = result;
          task.status = 'completed';
          task.endTime = Date.now();

          agentContributions.set(agent, {
            ...(agentContributions.get(agent) || {}),
            [task.id]: result
          });

          timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
          return result;
        } catch (error) {
          task.status = 'failed';
          task.result = { error: error.message };
          timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeCollaborative(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    
    for (const task of tasks) {
      const primaryAgent = this.selectBestAgent(task);
      const secondaryAgent = this.selectSecondaryAgent(task, primaryAgent);
      
      timeline.push({ timestamp: Date.now(), event: `Collaborative task started: ${task.description}`, agent: primaryAgent });

      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = primaryAgent;

      try {
        const primaryAgentInstance = this.agents.get(primaryAgent);
        const secondaryAgentInstance = this.agents.get(secondaryAgent);

        if (!primaryAgentInstance || !secondaryAgentInstance) {
          throw new Error('Required agents not available');
        }

        // Primary agent does initial work
        const primaryResult = await primaryAgentInstance.processTask(task.description, {
          reasoning: true,
          maxSteps: 5
        });

        // Secondary agent reviews and improves
        const secondaryResult = await secondaryAgentInstance.processTask(
          `Review and improve this work: ${primaryResult.result}\nOriginal task: ${task.description}`,
          { reasoning: true, maxSteps: 5 }
        );

        const combinedResult = {
          primary: primaryResult,
          secondary: secondaryResult,
          final: secondaryResult.result
        };

        task.result = combinedResult;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(combinedResult);

        agentContributions.set(primaryAgent, {
          ...(agentContributions.get(primaryAgent) || {}),
          [task.id]: primaryResult
        });

        agentContributions.set(secondaryAgent, {
          ...(agentContributions.get(secondaryAgent) || {}),
          [task.id]: secondaryResult
        });

        timeline.push({ timestamp: Date.now(), event: `Collaborative task completed: ${task.description}`, agent: secondaryAgent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent: primaryAgent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private selectBestAgent(task: Task): string {
    const taskText = task.description.toLowerCase();
    
    if (taskText.includes('architecture') || taskText.includes('design') || taskText.includes('plan')) {
      return 'architect';
    }
    if (taskText.includes('test') || taskText.includes('quality') || taskText.includes('bug')) {
      return 'tester';
    }
    if (taskText.includes('review') || taskText.includes('improve') || taskText.includes('refactor')) {
      return 'reviewer';
    }
    
    return 'developer';
  }

  private selectSecondaryAgent(task: Task, primaryAgent: string): string {
    const agents = Array.from(this.agents.keys()).filter(agent => agent !== primaryAgent);
    
    if (primaryAgent === 'developer') return 'reviewer';
    if (primaryAgent === 'architect') return 'developer';
    if (primaryAgent === 'tester') return 'developer';
    if (primaryAgent === 'reviewer') return 'developer';
    
    return agents[0];
  }

  // System prompts for different agent roles
  private getArchitectPrompt(): string {
    return `You are a Senior Software Architect. Your role is to:
    - Design system architecture and technical solutions
    - Make technology stack decisions
    - Define coding standards and best practices
    - Create technical specifications and documentation
    - Ensure scalability and maintainability
    
    Focus on long-term technical vision and architectural soundness.`;
  }

  private getDeveloperPrompt(): string {
    return `You are a Senior Software Developer. Your role is to:
    - Write clean, efficient, and well-documented code
    - Implement features according to specifications
    - Debug and fix issues
    - Optimize performance
    - Follow best practices and coding standards
    
    Focus on code quality, functionality, and maintainability.`;
  }

  private getTesterPrompt(): string {
    return `You are a Senior QA Engineer. Your role is to:
    - Create comprehensive test suites
    - Identify edge cases and potential issues
    - Ensure code quality and reliability
    - Write both unit and integration tests
    - Perform code quality analysis
    
    Focus on thorough testing and quality assurance.`;
  }

  private getReviewerPrompt(): string {
    return `You are a Senior Code Reviewer. Your role is to:
    - Review code for quality, security, and performance
    - Provide constructive feedback and suggestions
    - Ensure coding standards are followed
    - Identify potential improvements and refactoring opportunities
    - Verify that requirements are met
    
    Focus on code quality, security, and best practices.`;
  }

  async getTeamStatus(): Promise<{
    agents: Map<string, any>;
    activeTasks: number;
    completedTasks: number;
  }> {
    const agentStats = new Map();
    
    for (const [role, agent] of this.agents) {
      agentStats.set(role, await agent.getMemoryStats());
    }

    return {
      agents: agentStats,
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedTasks.size
    };
  }
}

