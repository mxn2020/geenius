// netlify/functions/process-changes-vercel.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage, ProcessingSession } from './shared/redis-storage';
import { NetlifyService } from './shared/netlify-service';

interface ChangeRequest {
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

interface SubmissionPayload {
  submissionId: string;
  timestamp: number;
  changes: ChangeRequest[];
  globalContext: {
    projectId: string;
    environment: string;
    version: string;
    repositoryUrl: string;
    userInfo: any;
    aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
    aiModel?: string;
    vercelProjectId?: string;
    vercelTeamId?: string;
  };
  summary: {
    totalChanges: number;
    categoryCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    affectedComponents: string[];
    estimatedComplexity: string;
  };
}

interface VercelSandboxConfig {
  repoUrl: string;
  framework: string;
  buildCommand?: string;
  devCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
}

class VercelAgentService {
  private repoUrl: string;
  private config: VercelSandboxConfig;
  private netlifyService: NetlifyService;
  private vercelFunctionUrl: string;

  constructor(repoUrl: string, options: { 
    provider?: string; 
    model?: string;
    vercelProjectId?: string;
    vercelTeamId?: string;
  } = {}) {
    this.repoUrl = repoUrl;
    this.netlifyService = new NetlifyService();
    this.config = this.detectFrameworkConfig(repoUrl);
    
    // Create Vercel Function endpoint for this processing session
    this.vercelFunctionUrl = this.generateVercelFunctionUrl(options.vercelProjectId, options.vercelTeamId);
  }

  async initializeProject(baseBranch: string = 'develop'): Promise<{ success: boolean; sandboxUrl?: string; error?: string }> {
    try {
      // Call Vercel Function to initialize sandbox
      const response = await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'initialize',
          repoUrl: this.repoUrl,
          baseBranch,
          config: this.config
        })
      });

      if (!response.ok) {
        throw new Error(`Vercel Function initialization failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize Vercel sandbox');
      }

      return {
        success: true,
        sandboxUrl: result.sandboxUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processMultipleTasks(tasks: Array<{
    id: string;
    description: string;
    component: string;
    category: string;
    priority: string;
    context: any;
  }>): Promise<{ success: boolean; completedTasks: number; testsCreated: number; error?: string }> {
    try {
      // Call Vercel Function to process tasks
      const response = await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'process_tasks',
          tasks: tasks,
          config: this.config
        })
      });

      if (!response.ok) {
        throw new Error(`Vercel Function processing failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to process tasks');
      }

      return {
        success: true,
        completedTasks: result.completedTasks || 0,
        testsCreated: result.testsCreated || 0
      };
    } catch (error) {
      return {
        success: false,
        completedTasks: 0,
        testsCreated: 0,
        error: error.message
      };
    }
  }

  async runTests(): Promise<{ passed: boolean; passedTests: number; totalTests: number; failedTests: number }> {
    try {
      // Call Vercel Function to run tests
      const response = await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'run_tests',
          config: this.config
        })
      });

      if (!response.ok) {
        throw new Error(`Vercel Function test execution failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        passed: result.passed || false,
        passedTests: result.passedTests || 0,
        totalTests: result.totalTests || 0,
        failedTests: result.failedTests || 0
      };
    } catch (error) {
      // If tests fail to run, assume they're broken but continue
      return { passed: false, passedTests: 0, totalTests: 1, failedTests: 1 };
    }
  }

  async createPullRequest(changes: ChangeRequest[]): Promise<{ success: boolean; prUrl?: string; branchName?: string; error?: string }> {
    try {
      // Call Vercel Function to create PR
      const response = await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'create_pr',
          changes: changes,
          config: this.config,
          prDetails: {
            title: `Geenius AI: ${this.generatePRTitle(changes)}`,
            body: this.generatePRBody(changes)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Vercel Function PR creation failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create pull request');
      }

      return {
        success: true,
        prUrl: result.prUrl,
        branchName: result.branchName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async waitForDeployment(branchName: string): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
    try {
      // First check if Vercel has auto-deployment for this branch
      const vercelDeployment = await this.checkVercelDeployment(branchName);
      
      if (vercelDeployment.success && vercelDeployment.deployUrl) {
        return {
          success: true,
          previewUrl: vercelDeployment.deployUrl
        };
      }

      // Fallback to Netlify deployment
      const deployResult = await this.netlifyService.waitForBranchDeployment(branchName, 300000); // 5 minute timeout
      
      return {
        success: deployResult.success,
        previewUrl: deployResult.deployUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Call Vercel Function to cleanup sandbox
      await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'cleanup',
          config: this.config
        })
      });
    } catch (error) {
      console.error('Failed to cleanup Vercel sandbox:', error);
    }
  }

  private generateVercelFunctionUrl(projectId?: string, teamId?: string): string {
    // Generate the Vercel Function URL based on project configuration
    const baseUrl = process.env.VERCEL_FUNCTION_BASE_URL || 'https://your-vercel-function.vercel.app';
    const params = new URLSearchParams();
    
    if (projectId) params.append('projectId', projectId);
    if (teamId) params.append('teamId', teamId);
    
    return `${baseUrl}/api/geenius-agent${params.toString() ? '?' + params.toString() : ''}`;
  }

  private detectFrameworkConfig(repoUrl: string): VercelSandboxConfig {
    // Basic framework detection - in a real implementation, you'd analyze the repo
    // For now, we'll use sensible defaults
    return {
      repoUrl,
      framework: 'vite', // Default to Vite for modern projects
      buildCommand: 'npm run build',
      devCommand: 'npm run dev',
      installCommand: 'npm install',
      outputDirectory: 'dist'
    };
  }

  private async checkVercelDeployment(branchName: string): Promise<{ success: boolean; deployUrl?: string }> {
    try {
      // Call Vercel API to check deployment status
      const response = await fetch(this.vercelFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`
        },
        body: JSON.stringify({
          action: 'check_deployment',
          branchName: branchName,
          config: this.config
        })
      });

      if (!response.ok) {
        return { success: false };
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        deployUrl: result.deployUrl
      };
    } catch (error) {
      return { success: false };
    }
  }

  private generatePRTitle(changes: ChangeRequest[]): string {
    const categories = [...new Set(changes.map(c => c.category))];
    return `${categories.join(', ')} improvements (${changes.length} changes)`;
  }

  private generatePRBody(changes: ChangeRequest[]): string {
    const summary = `## Summary\n\nThis PR implements ${changes.length} improvements processed by Geenius AI using Vercel Sandbox workflow.\n\n`;
    
    const changesList = changes.map(c => 
      `- **${c.category}** (${c.priority}): ${c.feedback}`
    ).join('\n');
    
    const testPlan = `\n\n## Test Plan\n\n- [ ] Review AI-generated code changes\n- [ ] Run test suite in Vercel sandbox\n- [ ] Verify functionality in preview deployment\n- [ ] Manual testing of affected components\n\n`;
    
    const footer = `---\n\n🤖 Generated with Geenius AI (Vercel Sandbox Processing)\nSubmission ID: ${Date.now()}`;
    
    return summary + changesList + testPlan + footer;
  }
}

// Main processing function
async function processChangesVercel(sessionId: string, payload: SubmissionPayload): Promise<void> {
  let agentService: VercelAgentService | null = null;
  
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Initialize Agent Service
    await storage.updateSessionStatus(sessionId, 'initializing');
    await storage.addLog(sessionId, 'info', 'Starting Vercel Sandbox AI agent processing workflow', {
      projectId: payload.globalContext.projectId,
      repositoryUrl: payload.globalContext.repositoryUrl,
      changesCount: payload.changes.length
    });

    agentService = new VercelAgentService(payload.globalContext.repositoryUrl, {
      provider: payload.globalContext.aiProvider || 'anthropic',
      model: payload.globalContext.aiModel,
      vercelProjectId: payload.globalContext.vercelProjectId,
      vercelTeamId: payload.globalContext.vercelTeamId
    });

    // Step 1: Initialize project in Vercel Sandbox
    await storage.updateSessionStatus(sessionId, 'sandbox_creating');
    await storage.addLog(sessionId, 'info', 'Creating Vercel Sandbox environment...');
    
    const initResult = await agentService.initializeProject('develop');
    if (!initResult.success) {
      throw new Error(initResult.error || 'Failed to initialize Vercel sandbox');
    }
    
    await storage.addLog(sessionId, 'success', 'Vercel Sandbox initialized successfully', {
      sandboxUrl: initResult.sandboxUrl
    });

    // Step 2: Process multiple change requests
    await storage.updateSessionStatus(sessionId, 'ai_processing');
    await storage.addLog(sessionId, 'info', `Processing ${payload.changes.length} change requests in Vercel Sandbox...`);

    const processResult = await agentService.processMultipleTasks(
      payload.changes.map(change => ({
        id: change.id,
        description: change.feedback,
        component: change.componentId,
        category: change.category,
        priority: change.priority,
        context: {
          ...change.componentContext,
          ...change.pageContext
        }
      }))
    );

    if (!processResult.success) {
      throw new Error(processResult.error || 'Failed to process changes in Vercel Sandbox');
    }

    await storage.addLog(sessionId, 'success', `Successfully processed ${processResult.completedTasks} tasks in Vercel Sandbox`);

    // Step 3: Run tests
    await storage.updateSessionStatus(sessionId, 'testing');
    await storage.addLog(sessionId, 'info', 'Running test suite in Vercel Sandbox...');

    const testResult = await agentService.runTests();
    
    if (testResult.passed) {
      await storage.addLog(sessionId, 'success', `All tests passed in Vercel Sandbox! (${testResult.passedTests}/${testResult.totalTests})`);
    } else {
      await storage.addLog(sessionId, 'warning', `Some tests failed in Vercel Sandbox (${testResult.failedTests}/${testResult.totalTests})`);
      // Continue with process as tests might be fixed in PR review
    }

    // Step 4: Create pull request
    await storage.updateSessionStatus(sessionId, 'pr_creating');
    await storage.addLog(sessionId, 'info', 'Creating pull request from Vercel Sandbox...');

    const prResult = await agentService.createPullRequest(payload.changes);
    
    if (prResult.success && prResult.prUrl) {
      const currentSession = await storage.getSession(sessionId);
      if (currentSession) {
        currentSession.prUrl = prResult.prUrl;
        currentSession.branchName = prResult.branchName;
        await storage.setSession(sessionId, currentSession);
      }
      
      await storage.addLog(sessionId, 'success', 'Pull request created successfully from Vercel Sandbox', { 
        prUrl: prResult.prUrl,
        branchName: prResult.branchName 
      });

      // Step 5: Wait for deployment
      await storage.updateSessionStatus(sessionId, 'deploying');
      await storage.addLog(sessionId, 'info', 'Waiting for deployment (Vercel or Netlify)...');

      const deploymentResult = await agentService.waitForDeployment(prResult.branchName!);
      
      if (deploymentResult.success && deploymentResult.previewUrl) {
        const deploySession = await storage.getSession(sessionId);
        if (deploySession) {
          deploySession.previewUrl = deploymentResult.previewUrl;
          await storage.setSession(sessionId, deploySession);
        }
        await storage.addLog(sessionId, 'success', 'Deployment completed successfully', { 
          previewUrl: deploymentResult.previewUrl 
        });
      }
    } else {
      throw new Error(prResult.error || 'Failed to create pull request from Vercel Sandbox');
    }

    // Step 6: Cleanup and mark as completed
    await agentService.cleanup();
    
    await storage.updateSessionStatus(sessionId, 'completed');
    const completedSession = await storage.getSession(sessionId);
    if (completedSession) {
      completedSession.endTime = Date.now();
      await storage.setSession(sessionId, completedSession);
      
      await storage.addLog(sessionId, 'success', 'Vercel Sandbox processing workflow completed successfully!', {
        totalTime: Math.round((completedSession.endTime - completedSession.startTime) / 1000) + ' seconds',
        previewUrl: completedSession.previewUrl,
        prUrl: completedSession.prUrl,
        completedTasks: processResult.completedTasks,
        testsCreated: processResult.testsCreated
      });
    }

  } catch (error) {
    // Cleanup on error
    if (agentService) {
      await agentService.cleanup();
    }
    
    await storage.updateSessionStatus(sessionId, 'failed');
    await storage.addLog(sessionId, 'error', 'Vercel Sandbox processing failed', { error: error.message });
    
    const errorSession = await storage.getSession(sessionId);
    if (errorSession) {
      errorSession.error = error.message;
      errorSession.endTime = Date.now();
      await storage.setSession(sessionId, errorSession);
    }
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Handle GET request for session status
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/');
      const sessionId = pathParts[pathParts.length - 1];
      
      if (!sessionId || sessionId === 'process-changes-vercel') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Session ID required' })
        };
      }
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionId,
          status: session.status,
          logs: session.logs,
          previewUrl: session.previewUrl,
          prUrl: session.prUrl,
          branchName: session.branchName,
          error: session.error,
          startTime: session.startTime,
          endTime: session.endTime,
          progress: getProgressPercentage(session.status),
          processingType: 'vercel'
        })
      };
    }
    
    // Handle POST request for change submission
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }
      
      const payload: SubmissionPayload = JSON.parse(event.body);
      
      // Validate payload
      if (!payload.changes || payload.changes.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No changes provided' })
        };
      }

      if (!payload.globalContext?.repositoryUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Repository URL required' })
        };
      }

      // Create processing session
      const sessionId = storage.generateSessionId();
      const session: ProcessingSession = {
        id: sessionId,
        status: 'initializing',
        submissionId: payload.submissionId,
        projectId: payload.globalContext.projectId,
        repositoryUrl: payload.globalContext.repositoryUrl,
        changes: payload.changes,
        logs: [],
        startTime: Date.now()
      };
      
      await storage.setSession(sessionId, session);
      
      // Start processing asynchronously
      processChangesVercel(sessionId, payload).catch(error => {
        console.error('Vercel processing error:', error);
      });
      
      await storage.addLog(sessionId, 'info', 'Vercel Sandbox AI agent processing started', { 
        changesCount: payload.changes.length,
        submissionId: payload.submissionId,
        aiProvider: payload.globalContext.aiProvider || 'anthropic',
        processingType: 'vercel'
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId,
          submissionId: payload.submissionId,
          processingType: 'vercel',
          message: 'Changes submitted successfully. Vercel Sandbox AI agent processing started.',
          statusUrl: `${process.env.URL}/api/process-changes-vercel/${sessionId}`,
          estimatedProcessingTime: payload.changes.length * 90000 // 1.5 minutes per change for Vercel
        })
      };
    }
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
       })
    };
  }
};

function getProgressPercentage(status: ProcessingSession['status']): number {
  const statusOrder = {
    initializing: 10,
    sandbox_creating: 20,
    ai_processing: 50,
    testing: 70,
    pr_creating: 80,
    deploying: 90,
    completed: 100,
    failed: 0
  };
  
  return statusOrder[status] || 0;
}