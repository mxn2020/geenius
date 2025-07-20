// Enhanced Agent Orchestrator for Agentic AI System
import { CustomAIAgent } from './custom-ai-agent';
import { AIFileProcessor, ChangeRequest, ProcessingResult } from './ai-file-processor';
import { DependencyAnalyzer } from './dependency-analyzer';
import { TestSuiteGenerator, TestGenerationConfig } from './test-suite-generator';
import { EnhancedSessionManager } from './enhanced-session-manager';

export interface AgentTeamConfig {
  leadAgent: {
    provider: 'anthropic' | 'openai' | 'google' | 'grok';
    model?: string;
  };
  specialists: {
    analyzer: { provider: string; model?: string };
    developer: { provider: string; model?: string };
    tester: { provider: string; model?: string };
    reviewer: { provider: string; model?: string };
  };
}

export interface ProcessingTask {
  id: string;
  type: 'analyze' | 'develop' | 'test' | 'review' | 'document';
  description: string;
  input: any;
  dependencies: string[];
  priority: 'low' | 'medium' | 'high';
  assignedAgent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount: number;
}

export interface OrchestrationResult {
  success: boolean;
  completedTasks: number;
  failedTasks: number;
  totalTime: number;
  results: Map<string, any>;
  errors: string[];
}

export class EnhancedAgentOrchestrator {
  private sessionManager: EnhancedSessionManager;
  private agents: Map<string, CustomAIAgent> = new Map();
  private processors: Map<string, any> = new Map();
  private tasks: Map<string, ProcessingTask> = new Map();
  private taskQueue: string[] = [];
  private activeTaskCount = 0;
  private maxConcurrentTasks = 2; // Conservative for now

  constructor(
    sessionManager: EnhancedSessionManager,
    teamConfig: AgentTeamConfig
  ) {
    this.sessionManager = sessionManager;
    this.initializeAgentTeam(teamConfig);
    this.initializeSpecializedProcessors(teamConfig.leadAgent.provider);
  }

  /**
   * Initialize the AI agent team with specialized roles
   */
  private initializeAgentTeam(config: AgentTeamConfig): void {
    // Lead Agent - Overall coordination and decision making
    this.agents.set('lead', new CustomAIAgent({
      provider: config.leadAgent.provider,
      model: config.leadAgent.model,
      role: 'senior-architect',
      expertise: ['system-design', 'project-management', 'decision-making'],
      systemPrompt: `You are a senior software architect leading an AI development team. 
      Your role is to coordinate tasks, make high-level decisions, and ensure quality outcomes.
      Always consider the bigger picture and potential impacts of changes.`
    }));

    // Analyzer Agent - Code analysis and dependency mapping
    this.agents.set('analyzer', new CustomAIAgent({
      provider: config.specialists.analyzer.provider,
      model: config.specialists.analyzer.model,
      role: 'senior-analyst',
      expertise: ['code-analysis', 'dependency-mapping', 'architecture-review'],
      systemPrompt: `You are a senior code analyst specializing in understanding complex codebases.
      Your role is to analyze dependencies, identify potential impacts, and provide insights
      about code structure and relationships.`
    }));

    // Developer Agent - Code implementation and modifications
    this.agents.set('developer', new CustomAIAgent({
      provider: config.specialists.developer.provider,
      model: config.specialists.developer.model,
      role: 'senior-developer',
      expertise: ['react', 'typescript', 'component-development', 'ui-implementation'],
      systemPrompt: `You are a senior React/TypeScript developer with expertise in modern frontend development.
      Your role is to implement changes efficiently while maintaining code quality and best practices.
      Always consider performance, accessibility, and maintainability.`
    }));

    // Tester Agent - Test generation and quality assurance
    this.agents.set('tester', new CustomAIAgent({
      provider: config.specialists.tester.provider,
      model: config.specialists.tester.model,
      role: 'qa-engineer',
      expertise: ['testing', 'quality-assurance', 'test-automation'],
      systemPrompt: `You are a senior QA engineer specializing in comprehensive testing strategies.
      Your role is to ensure changes are thoroughly tested and meet quality standards.
      Focus on creating meaningful tests that catch real issues.`
    }));

    // Reviewer Agent - Code review and final validation
    this.agents.set('reviewer', new CustomAIAgent({
      provider: config.specialists.reviewer.provider,
      model: config.specialists.reviewer.model,
      role: 'senior-reviewer',
      expertise: ['code-review', 'security', 'best-practices', 'performance'],
      systemPrompt: `You are a senior code reviewer with deep expertise in security and best practices.
      Your role is to review implementations for potential issues, security concerns, and improvements.
      Provide constructive feedback and ensure changes meet high standards.`
    }));
  }

  /**
   * Initialize specialized processors
   */
  private initializeSpecializedProcessors(aiProvider: string): void {
    this.processors.set('fileProcessor', new AIFileProcessor(aiProvider as any));
    this.processors.set('dependencyAnalyzer', new DependencyAnalyzer());
    this.processors.set('testGenerator', new TestSuiteGenerator(aiProvider as any));
  }

  /**
   * Orchestrate the complete processing workflow
   */
  async orchestrateProcessing(
    sessionId: string,
    repoUrl: string,
    changes: ChangeRequest[],
    fileGroups: any[]
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const results = new Map<string, any>();
    const errors: string[] = [];

    try {
      await this.sessionManager.addLog(sessionId, 'info', 'Starting agent orchestration workflow');

      // Phase 1: Analysis (Lead + Analyzer)
      const analysisTask = await this.createTask({
        type: 'analyze',
        description: 'Analyze dependencies and code structure',
        input: { repoUrl, changes, fileGroups },
        priority: 'high',
        assignedAgent: 'analyzer'
      });

      const analysisResult = await this.executeTask(sessionId, analysisTask);
      if (!analysisResult.success) {
        throw new Error('Analysis phase failed');
      }
      results.set('analysis', analysisResult.result);

      // Phase 2: Strategic Planning (Lead Agent)
      const planningTask = await this.createTask({
        type: 'develop',
        description: 'Create strategic implementation plan',
        input: { changes, analysisResult: analysisResult.result },
        priority: 'high',
        assignedAgent: 'lead',
        dependencies: [analysisTask.id]
      });

      const planningResult = await this.executeTask(sessionId, planningTask);
      if (!planningResult.success) {
        throw new Error('Planning phase failed');
      }
      results.set('planning', planningResult.result);

      // Phase 3: Implementation (Developer + File Processor)
      const implementationTasks: ProcessingTask[] = [];
      
      for (const [index, fileGroup] of fileGroups.entries()) {
        const implTask = await this.createTask({
          type: 'develop',
          description: `Implement changes for ${fileGroup.filePath}`,
          input: { fileGroup, strategicPlan: planningResult.result },
          priority: 'high',
          assignedAgent: 'developer',
          dependencies: [planningTask.id]
        });
        implementationTasks.push(implTask);
      }

      // Execute implementation tasks with controlled concurrency
      const implementationResults = await this.executeTasksConcurrently(
        sessionId, 
        implementationTasks, 
        this.maxConcurrentTasks
      );

      const failedImplementations = implementationResults.filter(r => !r.success);
      if (failedImplementations.length > 0) {
        await this.sessionManager.addLog(sessionId, 'warning', 
          `${failedImplementations.length} file implementations failed, attempting recovery`);
        
        // Retry failed implementations with lead agent assistance
        for (const failed of failedImplementations) {
          const retryResult = await this.retryWithLeadAssistance(sessionId, failed);
          if (retryResult.success) {
            implementationResults[implementationResults.indexOf(failed)] = retryResult;
          }
        }
      }

      results.set('implementations', implementationResults);

      // Phase 4: Quality Review (Reviewer)
      const reviewTask = await this.createTask({
        type: 'review',
        description: 'Review all implementations for quality and security',
        input: { implementations: implementationResults },
        priority: 'high',
        assignedAgent: 'reviewer',
        dependencies: implementationTasks.map(t => t.id)
      });

      const reviewResult = await this.executeTask(sessionId, reviewTask);
      if (!reviewResult.success) {
        await this.sessionManager.addLog(sessionId, 'warning', 'Review phase had issues, but proceeding');
      }
      results.set('review', reviewResult.result);

      // Phase 5: Test Generation (Tester)
      const testTask = await this.createTask({
        type: 'test',
        description: 'Generate comprehensive test suite',
        input: { 
          implementations: implementationResults,
          changes,
          reviewFeedback: reviewResult.result 
        },
        priority: 'medium',
        assignedAgent: 'tester',
        dependencies: [reviewTask.id]
      });

      const testResult = await this.executeTask(sessionId, testTask);
      results.set('tests', testResult.result);

      // Calculate final metrics
      const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
      const failedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'failed').length;
      const totalTime = Date.now() - startTime;

      await this.sessionManager.addLog(sessionId, 'success', 
        'Agent orchestration completed successfully', {
          completedTasks,
          failedTasks,
          totalTimeMs: totalTime,
          tasksExecuted: this.tasks.size
        });

      return {
        success: failedTasks === 0,
        completedTasks,
        failedTasks,
        totalTime,
        results,
        errors
      };

    } catch (error) {
      await this.sessionManager.addLog(sessionId, 'error', 'Agent orchestration failed', { error: error.message });
      errors.push(error.message);

      return {
        success: false,
        completedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
        failedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length,
        totalTime: Date.now() - startTime,
        results,
        errors
      };
    }
  }

  /**
   * Create a new processing task
   */
  private async createTask(params: {
    type: ProcessingTask['type'];
    description: string;
    input: any;
    priority: ProcessingTask['priority'];
    assignedAgent: string;
    dependencies?: string[];
  }): Promise<ProcessingTask> {
    const task: ProcessingTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      description: params.description,
      input: params.input,
      dependencies: params.dependencies || [],
      priority: params.priority,
      assignedAgent: params.assignedAgent,
      status: 'pending',
      retryCount: 0
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task.id);

    return task;
  }

  /**
   * Execute a single task with the assigned agent
   */
  private async executeTask(sessionId: string, task: ProcessingTask): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      task.status = 'in_progress';
      task.startTime = Date.now();
      this.activeTaskCount++;

      await this.sessionManager.addLog(sessionId, 'info', 
        `Starting ${task.type} task: ${task.description}`, 
        { taskId: task.id, assignedAgent: task.assignedAgent });

      const agent = this.agents.get(task.assignedAgent);
      if (!agent) {
        throw new Error(`Agent ${task.assignedAgent} not found`);
      }

      let result: any;

      // Route to appropriate processing logic based on task type
      switch (task.type) {
        case 'analyze':
          result = await this.executeAnalysisTask(task, agent);
          break;
        case 'develop':
          result = await this.executeDevelopmentTask(task, agent);
          break;
        case 'test':
          result = await this.executeTestingTask(task, agent);
          break;
        case 'review':
          result = await this.executeReviewTask(task, agent);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.status = 'completed';
      task.endTime = Date.now();
      task.result = result;

      await this.sessionManager.addLog(sessionId, 'success', 
        `Completed ${task.type} task`, 
        { taskId: task.id, duration: task.endTime - task.startTime! });

      return { success: true, result };

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.endTime = Date.now();

      await this.sessionManager.addLog(sessionId, 'error', 
        `Failed ${task.type} task: ${error.message}`, 
        { taskId: task.id });

      return { success: false, error: error.message };
    } finally {
      this.activeTaskCount--;
    }
  }

  /**
   * Execute analysis task
   */
  private async executeAnalysisTask(task: ProcessingTask, agent: CustomAIAgent): Promise<any> {
    const { repoUrl, changes, fileGroups } = task.input;
    const dependencyAnalyzer = this.processors.get('dependencyAnalyzer') as DependencyAnalyzer;

    const filePaths = fileGroups.map((fg: any) => fg.filePath);
    const analysisResult = await dependencyAnalyzer.analyzeMultipleFiles(repoUrl, filePaths, changes);

    // Get AI insights on the analysis
    const aiAnalysisPrompt = `
Analyze this dependency and component analysis for a React/TypeScript project:

Files to be modified: ${filePaths.join(', ')}
Processing order: ${analysisResult.processingOrder.join(' → ')}
Risk analysis: ${JSON.stringify(analysisResult.riskAnalysis, null, 2)}

Changes to implement:
${changes.map(c => `- ${c.componentId}: ${c.feedback}`).join('\n')}

Provide strategic insights:
1. What are the highest risk changes?
2. What additional considerations should be made?
3. Are there any architectural concerns?
4. What order should changes be implemented in?
5. Are there any missing dependencies we should analyze?

Return your analysis as JSON with these keys: risks, recommendations, processingStrategy, additionalFiles
`;

    const aiInsights = await agent.processRequest(aiAnalysisPrompt);
    
    return {
      ...analysisResult,
      aiInsights: JSON.parse(aiInsights)
    };
  }

  /**
   * Execute development task
   */
  private async executeDevelopmentTask(task: ProcessingTask, agent: CustomAIAgent): Promise<any> {
    const fileProcessor = this.processors.get('fileProcessor') as AIFileProcessor;

    if (task.input.fileGroup) {
      // Single file implementation
      const { fileGroup, strategicPlan } = task.input;
      
      const result = await fileProcessor.processFileChanges(
        fileGroup.filePath,
        fileGroup.originalContent,
        fileGroup.changes
      );

      return result;
    } else {
      // Strategic planning task
      const { changes, analysisResult } = task.input;
      
      const planningPrompt = `
Based on this analysis, create a strategic implementation plan:

Analysis Results: ${JSON.stringify(analysisResult, null, 2)}
Changes to implement: ${changes.map((c: any) => `- ${c.componentId}: ${c.feedback}`).join('\n')}

Create a detailed implementation plan that includes:
1. Optimal order of implementation
2. Risk mitigation strategies
3. Testing requirements
4. Rollback procedures
5. Performance considerations

Return as JSON with keys: implementationOrder, riskMitigation, testingStrategy, rollbackPlan, performanceNotes
`;

      const planningResult = await agent.processRequest(planningPrompt);
      return JSON.parse(planningResult);
    }
  }

  /**
   * Execute testing task
   */
  private async executeTestingTask(task: ProcessingTask, agent: CustomAIAgent): Promise<any> {
    const { implementations, changes, reviewFeedback } = task.input;
    const testGenerator = this.processors.get('testGenerator') as TestSuiteGenerator;

    const fileChanges = implementations
      .filter((impl: any) => impl.success)
      .map((impl: any) => ({
        path: impl.result.filePath || 'unknown',
        content: impl.result.updatedContent || '',
        message: impl.result.commitMessage || 'AI generated changes'
      }));

    const testConfig: TestGenerationConfig = {
      framework: 'vitest',
      includeVisualTests: true,
      includeAccessibilityTests: true,
      coverageThreshold: 80,
      testTypes: ['unit', 'integration']
    };

    const testSuite = await testGenerator.generateTestSuite(fileChanges, changes, testConfig);

    return {
      testSuite,
      coverage: testSuite.coverage,
      recommendations: reviewFeedback?.testRecommendations || []
    };
  }

  /**
   * Execute review task
   */
  private async executeReviewTask(task: ProcessingTask, agent: CustomAIAgent): Promise<any> {
    const { implementations } = task.input;

    const reviewPrompt = `
Review these AI-generated code implementations for quality, security, and best practices:

${implementations.map((impl: any, index: number) => `
Implementation ${index + 1}:
File: ${impl.result?.filePath || 'unknown'}
Success: ${impl.success}
${impl.success ? `
Code:
\`\`\`typescript
${impl.result.updatedContent?.substring(0, 1000)}...
\`\`\`
Explanation: ${impl.result.explanation}
` : `Error: ${impl.error}`}
`).join('\n')}

Provide a comprehensive review covering:
1. Code quality and best practices
2. Security concerns
3. Performance implications
4. Accessibility considerations
5. Maintainability issues
6. Testing recommendations

Return as JSON with keys: overallScore, issues, recommendations, securityConcerns, performanceNotes, testRecommendations
`;

    const reviewResult = await agent.processRequest(reviewPrompt);
    return JSON.parse(reviewResult);
  }

  /**
   * Execute multiple tasks concurrently with limit
   */
  private async executeTasksConcurrently(
    sessionId: string,
    tasks: ProcessingTask[],
    maxConcurrent: number
  ): Promise<Array<{ success: boolean; result?: any; error?: string }>> {
    const results: Array<{ success: boolean; result?: any; error?: string }> = [];
    const executing: Promise<any>[] = [];

    for (const task of tasks) {
      if (executing.length >= maxConcurrent) {
        // Wait for one to complete before starting the next
        await Promise.race(executing);
      }

      const taskPromise = this.executeTask(sessionId, task).then(result => {
        const index = executing.indexOf(taskPromise);
        if (index > -1) executing.splice(index, 1);
        return result;
      });

      executing.push(taskPromise);
      results.push(await taskPromise);
    }

    // Wait for all remaining tasks
    await Promise.all(executing);

    return results;
  }

  /**
   * Retry failed task with lead agent assistance
   */
  private async retryWithLeadAssistance(
    sessionId: string,
    failedResult: { success: boolean; error?: string }
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const leadAgent = this.agents.get('lead');
    if (!leadAgent) {
      return failedResult;
    }

    await this.sessionManager.addLog(sessionId, 'info', 'Lead agent assisting with failed task recovery');

    const recoveryPrompt = `
A task has failed with this error: ${failedResult.error}

As the lead architect, provide guidance on how to recover from this failure:
1. What alternative approaches could work?
2. How should we modify the original request?
3. What safeguards should be added?
4. Should we skip this task or retry with different parameters?

Return JSON with keys: shouldRetry, alternativeApproach, modifications, safeguards
`;

    try {
      const recoveryGuidance = await leadAgent.processRequest(recoveryPrompt);
      const guidance = JSON.parse(recoveryGuidance);

      if (guidance.shouldRetry) {
        await this.sessionManager.addLog(sessionId, 'info', 'Retrying task with lead agent guidance');
        // Implementation of retry logic would go here
        return { success: true, result: guidance };
      } else {
        return failedResult;
      }
    } catch (error) {
      return failedResult;
    }
  }

  /**
   * Get orchestration status
   */
  getStatus(): {
    activeTasks: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      activeTasks: tasks.filter(t => t.status === 'in_progress').length,
      queuedTasks: tasks.filter(t => t.status === 'pending').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length
    };
  }

  /**
   * Clean up completed tasks and reset for new orchestration
   */
  cleanup(): void {
    this.tasks.clear();
    this.taskQueue = [];
    this.activeTaskCount = 0;
  }
}