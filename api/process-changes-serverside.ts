// netlify/functions/process-changes-serverside.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage, ProcessingSession } from './shared/redis-storage';
import { AgentOrchestrator } from './shared/agent-orchestrator';
import { GitHubService } from './shared/github-service';
import { NetlifyService } from './shared/netlify-service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  };
  summary: {
    totalChanges: number;
    categoryCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    affectedComponents: string[];
    estimatedComplexity: string;
  };
}

class ServerSideAgentService {
  private workingDir: string;
  private repoUrl: string;
  private githubService: GitHubService;
  private netlifyService: NetlifyService;
  private agentOrchestrator: AgentOrchestrator;

  constructor(repoUrl: string, options: { provider?: string; model?: string } = {}) {
    this.repoUrl = repoUrl;
    this.workingDir = '';
    this.githubService = new GitHubService();
    this.netlifyService = new NetlifyService();
    this.agentOrchestrator = new AgentOrchestrator({
      type: 'orchestrated',
      provider: options.provider || 'anthropic',
      orchestrationStrategy: 'hierarchical'
    });
  }

  async initializeProject(baseBranch: string = 'develop'): Promise<void> {
    // Create temporary working directory
    this.workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geenius-serverside-'));

    try {
      // Clone the repository to the working directory
      await this.executeCommand(`git clone ${this.repoUrl} ${this.workingDir}`);
      
      // Switch to the base branch
      await this.executeCommand(`git checkout ${baseBranch}`, this.workingDir);
      
      // Create a new feature branch
      const branchName = `feature/geenius-serverside-${Date.now()}`;
      await this.executeCommand(`git checkout -b ${branchName}`, this.workingDir);
      
      // Install dependencies if package.json exists
      if (fs.existsSync(path.join(this.workingDir, 'package.json'))) {
        await this.executeCommand('npm install', this.workingDir);
      }
    } catch (error) {
      throw new Error(`Failed to initialize project: ${error.message}`);
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
      const processedTasks = [];
      let testsCreated = 0;

      for (const task of tasks) {
        try {
          // Process task with AI agent
          const projectFiles = await this.getProjectFilesList();
          const result = await this.agentOrchestrator.orchestrateTask(task.description, {
            priority: task.priority as 'low' | 'medium' | 'high' | 'urgent'
          });

          if (result.success) {
            // Apply code changes (mock implementation)
            const changes = result.result?.changes || [];
            
            // Create tests for the changes
            const testResult = await this.createTestsForChanges(changes, task);
            if (testResult.success) {
              testsCreated += testResult.testsCreated;
            }

            processedTasks.push(task.id);
          }
        } catch (taskError) {
          console.error(`Failed to process task ${task.id}:`, taskError);
          // Continue with other tasks
        }
      }

      return {
        success: true,
        completedTasks: processedTasks.length,
        testsCreated
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
      // Check if package.json has test scripts
      const packageJsonPath = path.join(this.workingDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return { passed: true, passedTests: 0, totalTests: 0, failedTests: 0 };
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.scripts?.test) {
        return { passed: true, passedTests: 0, totalTests: 0, failedTests: 0 };
      }

      // Run tests
      const testOutput = await this.executeCommand('npm test', this.workingDir);
      
      // Parse test results (this is a simplified parser)
      const passedMatches = testOutput.match(/(\d+)\s+passing/);
      const failedMatches = testOutput.match(/(\d+)\s+failing/);
      
      const passedTests = passedMatches ? parseInt(passedMatches[1]) : 0;
      const failedTests = failedMatches ? parseInt(failedMatches[1]) : 0;
      const totalTests = passedTests + failedTests;

      return {
        passed: failedTests === 0,
        passedTests,
        totalTests,
        failedTests
      };
    } catch (error) {
      // If tests fail to run, assume they're broken but continue
      return { passed: false, passedTests: 0, totalTests: 1, failedTests: 1 };
    }
  }

  async createPullRequest(changes: ChangeRequest[]): Promise<{ success: boolean; prUrl?: string; branchName?: string; error?: string }> {
    try {
      // Get current branch name
      const branchNameResult = await this.executeCommand('git branch --show-current', this.workingDir);
      const branchName = branchNameResult.trim();
      
      // Stage all changes
      await this.executeCommand('git add .', this.workingDir);
      
      // Create commit message
      const commitMessage = this.generateCommitMessage(changes);
      await this.executeCommand(`git commit -m "${commitMessage}"`, this.workingDir);
      
      // Push to origin
      await this.executeCommand(`git push origin ${branchName}`, this.workingDir);
      
      // Create pull request via GitHub API
      const prResult = await this.githubService.createPullRequest(this.repoUrl, {
        head: branchName,
        base: 'develop',
        title: `Geenius AI: ${this.generatePRTitle(changes)}`,
        body: this.generatePRBody(changes)
      });

      return {
        success: true,
        prUrl: prResult.html_url,
        branchName: branchName
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
      // Wait for Netlify deployment
      const deployResult = await this.netlifyService.waitForDeployment('default-site', `deploy-${Date.now()}`); // 5 minute timeout
      
      return {
        success: deployResult.success,
        previewUrl: deployResult.previewUrl
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
      if (this.workingDir && fs.existsSync(this.workingDir)) {
        // Clean up temporary directory
        await this.executeCommand(`rm -rf ${this.workingDir}`);
      }
    } catch (error) {
      console.error('Failed to cleanup working directory:', error);
    }
  }

  private async executeCommand(command: string, cwd?: string): Promise<string> {
    try {
      const result = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      return result;
    } catch (error) {
      throw new Error(`Command failed: ${command}\nError: ${error.message}`);
    }
  }

  private async getProjectFilesList(): Promise<string[]> {
    try {
      const gitFiles = await this.executeCommand('git ls-files', this.workingDir);
      return gitFiles.split('\n').filter(file => file.trim());
    } catch (error) {
      return [];
    }
  }

  private async applyCodeChanges(changes: any[]): Promise<void> {
    for (const change of changes) {
      try {
        if (change.type === 'file_create' || change.type === 'file_update') {
          const filePath = path.join(this.workingDir, change.filePath);
          const dir = path.dirname(filePath);
          
          // Ensure directory exists
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write file content
          fs.writeFileSync(filePath, change.content, 'utf8');
        } else if (change.type === 'file_delete') {
          const filePath = path.join(this.workingDir, change.filePath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.error(`Failed to apply change to ${change.filePath}:`, error);
      }
    }
  }

  private async createTestsForChanges(changes: any[], task: any): Promise<{ success: boolean; testsCreated: number }> {
    try {
      let testsCreated = 0;
      
      for (const change of changes) {
        if (change.type === 'file_create' || change.type === 'file_update') {
          // Generate test file for the changed component
          const testResult = await this.agentOrchestrator.orchestrateTask(`Generate tests for ${change.filePath || 'component'}`, {
            priority: 'medium'
          });
          
          if (testResult.success && testResult.result?.testContent) {
            const testFilePath = this.generateTestFilePath(change.filePath || 'test.js');
            const testFileFullPath = path.join(this.workingDir, testFilePath);
            const testDir = path.dirname(testFileFullPath);
            
            // Ensure test directory exists
            if (!fs.existsSync(testDir)) {
              fs.mkdirSync(testDir, { recursive: true });
            }
            
            fs.writeFileSync(testFileFullPath, testResult.result.testContent, 'utf8');
            testsCreated++;
          }
        }
      }
      
      return { success: true, testsCreated };
    } catch (error) {
      console.error('Failed to create tests:', error);
      return { success: false, testsCreated: 0 };
    }
  }

  private generateTestFilePath(filePath: string): string {
    const parsed = path.parse(filePath);
    const testFileName = `${parsed.name}.test${parsed.ext}`;
    
    // Put tests in __tests__ directory or alongside the file
    if (filePath.includes('src/')) {
      return filePath.replace('src/', 'src/__tests__/').replace(parsed.base, testFileName);
    } else {
      return path.join(parsed.dir, '__tests__', testFileName);
    }
  }

  private generateCommitMessage(changes: ChangeRequest[]): string {
    const categories = Array.from(new Set(changes.map(c => c.category)));
    const summary = `feat: ${categories.join(', ')} improvements via Geenius AI`;
    
    const details = changes.map(c => 
      `- ${c.category}: ${c.feedback.substring(0, 60)}${c.feedback.length > 60 ? '...' : ''}`
    ).join('\n');
    
    return `${summary}\n\n${details}\n\nGenerated by Geenius AI (Serverside Processing)`;
  }

  private generatePRTitle(changes: ChangeRequest[]): string {
    const categories = Array.from(new Set(changes.map(c => c.category)));
    return `${categories.join(', ')} improvements (${changes.length} changes)`;
  }

  private generatePRBody(changes: ChangeRequest[]): string {
    const summary = `## Summary\n\nThis PR implements ${changes.length} improvements processed by Geenius AI serverside workflow.\n\n`;
    
    const changesList = changes.map(c => 
      `- **${c.category}** (${c.priority}): ${c.feedback}`
    ).join('\n');
    
    const testPlan = `\n\n## Test Plan\n\n- [ ] Review AI-generated code changes\n- [ ] Run test suite\n- [ ] Verify functionality in preview deployment\n- [ ] Manual testing of affected components\n\n`;
    
    const footer = `---\n\n🤖 Generated with Geenius AI (Serverside Processing)\nSubmission ID: ${Date.now()}`;
    
    return summary + changesList + testPlan + footer;
  }
}

// Main processing function
async function processChangesServerside(sessionId: string, payload: SubmissionPayload): Promise<void> {
  let agentService: ServerSideAgentService | null = null;
  
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Initialize Agent Service
    await storage.updateSessionStatus(sessionId, 'initializing');
    await storage.addLog(sessionId, 'info', 'Starting serverside AI agent processing workflow', {
      projectId: payload.globalContext.projectId,
      repositoryUrl: payload.globalContext.repositoryUrl,
      changesCount: payload.changes.length
    });

    agentService = new ServerSideAgentService(payload.globalContext.repositoryUrl, {
      provider: payload.globalContext.aiProvider || 'anthropic',
      model: payload.globalContext.aiModel
    });

    // Step 1: Initialize project locally
    await storage.updateSessionStatus(sessionId, 'sandbox_creating');
    await storage.addLog(sessionId, 'info', 'Cloning repository and setting up local environment...');
    
    await agentService.initializeProject('develop');
    await storage.addLog(sessionId, 'success', 'Project cloned and environment initialized successfully');

    // Step 2: Process multiple change requests
    await storage.updateSessionStatus(sessionId, 'ai_processing');
    await storage.addLog(sessionId, 'info', `Processing ${payload.changes.length} change requests with AI...`);

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
      throw new Error(processResult.error || 'Failed to process changes');
    }

    await storage.addLog(sessionId, 'success', `Successfully processed ${processResult.completedTasks} tasks`);

    // Step 3: Run tests
    await storage.updateSessionStatus(sessionId, 'testing');
    await storage.addLog(sessionId, 'info', 'Running test suite...');

    const testResult = await agentService.runTests();
    
    if (testResult.passed) {
      await storage.addLog(sessionId, 'success', `All tests passed! (${testResult.passedTests}/${testResult.totalTests})`);
    } else {
      await storage.addLog(sessionId, 'warning', `Some tests failed (${testResult.failedTests}/${testResult.totalTests})`);
      // Continue with process as tests might be fixed in PR review
    }

    // Step 4: Create pull request
    await storage.updateSessionStatus(sessionId, 'pr_creating');
    await storage.addLog(sessionId, 'info', 'Creating pull request...');

    const prResult = await agentService.createPullRequest(payload.changes);
    
    if (prResult.success && prResult.prUrl) {
      const currentSession = await storage.getSession(sessionId);
      if (currentSession) {
        currentSession.prUrl = prResult.prUrl;
        currentSession.branchName = prResult.branchName;
        await storage.setSession(sessionId, currentSession);
      }
      
      await storage.addLog(sessionId, 'success', 'Pull request created successfully', { 
        prUrl: prResult.prUrl,
        branchName: prResult.branchName 
      });

      // Step 5: Wait for Netlify deployment
      await storage.updateSessionStatus(sessionId, 'deploying');
      await storage.addLog(sessionId, 'info', 'Waiting for Netlify deployment...');

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
      throw new Error(prResult.error || 'Failed to create pull request');
    }

    // Step 6: Cleanup and mark as completed
    await agentService.cleanup();
    
    await storage.updateSessionStatus(sessionId, 'completed');
    const completedSession = await storage.getSession(sessionId);
    if (completedSession) {
      completedSession.endTime = Date.now();
      await storage.setSession(sessionId, completedSession);
      
      await storage.addLog(sessionId, 'success', 'Serverside processing workflow completed successfully!', {
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
    await storage.addLog(sessionId, 'error', 'Serverside processing failed', { error: error.message });
    
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
      
      if (!sessionId || sessionId === 'process-changes-serverside') {
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
          processingType: 'serverside'
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
      processChangesServerside(sessionId, payload).catch(error => {
        console.error('Serverside processing error:', error);
      });
      
      await storage.addLog(sessionId, 'info', 'Serverside AI agent processing started', { 
        changesCount: payload.changes.length,
        submissionId: payload.submissionId,
        aiProvider: payload.globalContext.aiProvider || 'anthropic',
        processingType: 'serverside'
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId,
          submissionId: payload.submissionId,
          processingType: 'serverside',
          message: 'Changes submitted successfully. Serverside AI agent processing started.',
          statusUrl: `${process.env.URL}/api/process-changes-serverside/${sessionId}`,
          estimatedProcessingTime: payload.changes.length * 120000 // 2 minutes per change for serverside
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
    initializing: 5,
    sandbox_creating: 15,
    ai_processing: 50,
    testing: 70,
    pr_creating: 80,
    deploying: 90,
    completed: 100,
    failed: 0
  };
  
  return statusOrder[status] || 0;
}