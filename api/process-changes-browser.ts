// netlify/functions/process-changes-browser.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage, ProcessingSession } from './shared/redis-storage';
import { NetlifyService } from './shared/netlify-service';
import { GitHubService } from './shared/github-service';

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

interface BrowserSessionConfig {
  repoUrl: string;
  stackblitzProjectId?: string;
  sessionToken: string;
  aiConfig: {
    provider: string;
    model?: string;
    apiKey?: string;
  };
  webhookUrl: string;
}

class BrowserStackBlitzService {
  private repoUrl: string;
  private config: BrowserSessionConfig;
  private githubService: GitHubService;
  private netlifyService: NetlifyService;
  private sessionId: string;

  constructor(repoUrl: string, sessionId: string, options: { 
    provider?: string; 
    model?: string;
  } = {}) {
    this.repoUrl = repoUrl;
    this.sessionId = sessionId;
    this.githubService = new GitHubService();
    this.netlifyService = new NetlifyService();
    
    this.config = {
      repoUrl,
      sessionToken: this.generateSessionToken(),
      aiConfig: {
        provider: options.provider || 'anthropic',
        model: options.model,
        apiKey: this.getProviderApiKey(options.provider || 'anthropic')
      },
      webhookUrl: `${process.env.URL}/api/process-changes-browser/webhook/${sessionId}`
    };
  }

  async initializeBrowserSession(): Promise<{ 
    success: boolean; 
    browserUrl?: string; 
    stackblitzProjectId?: string;
    error?: string 
  }> {
    try {
      // Generate StackBlitz project configuration
      const stackblitzConfig = this.generateStackBlitzConfig();
      
      // Create a unique browser session URL that will open StackBlitz with our agent
      const browserUrl = this.generateBrowserSessionUrl(stackblitzConfig);
      
      // Store session configuration for the browser
      await this.storeBrowserSessionConfig();
      
      return {
        success: true,
        browserUrl,
        stackblitzProjectId: stackblitzConfig.projectId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkBrowserSessionStatus(): Promise<{
    status: 'initializing' | 'ready' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    try {
      // Check if browser session has been established
      const sessionData = await storage.getSession(`browser_${this.sessionId}`);
      
      if (!sessionData) {
        return { status: 'initializing' };
      }
      
      return {
        status: sessionData.browserStatus || 'initializing',
        progress: sessionData.browserProgress || 0
      };
    } catch (error) {
      return { status: 'failed', error: error.message };
    }
  }

  async processTasksInBrowser(tasks: Array<{
    id: string;
    description: string;
    component: string;
    category: string;
    priority: string;
    context: any;
  }>): Promise<{ success: boolean; completedTasks: number; testsCreated: number; error?: string }> {
    try {
      // Send tasks to browser session via WebSocket or polling mechanism
      await this.sendTasksToBrowser(tasks);
      
      // Wait for browser processing to complete (with timeout)
      const result = await this.waitForBrowserProcessing(300000); // 5 minute timeout
      
      return result;
    } catch (error) {
      return {
        success: false,
        completedTasks: 0,
        testsCreated: 0,
        error: error.message
      };
    }
  }

  async createPullRequestFromBrowser(): Promise<{ success: boolean; prUrl?: string; branchName?: string; error?: string }> {
    try {
      // Get the processed changes from browser session
      const sessionData = await storage.getSession(`browser_${this.sessionId}`);
      
      if (!sessionData?.browserResults) {
        throw new Error('No results from browser session');
      }
      
      const { changes, branchName } = sessionData.browserResults;
      
      // Create pull request via GitHub API
      const prResult = await this.githubService.createPullRequest({
        repoUrl: this.repoUrl,
        branchName,
        title: `Geenius AI: Browser-based improvements (${changes.length} changes)`,
        body: this.generatePRBody(changes),
        baseBranch: 'develop'
      });

      return {
        success: true,
        prUrl: prResult.prUrl,
        branchName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private generateSessionToken(): string {
    return `browser_${this.sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getProviderApiKey(provider: string): string {
    const keyMap = {
      'anthropic': process.env.ANTHROPIC_API_KEY,
      'openai': process.env.OPENAI_API_KEY,
      'google': process.env.GOOGLE_API_KEY,
      'grok': process.env.GROK_API_KEY
    };
    
    return keyMap[provider] || '';
  }

  private generateStackBlitzConfig(): any {
    const projectId = `geenius-${this.sessionId}-${Date.now()}`;
    
    return {
      projectId,
      title: `Geenius AI Agent - Session ${this.sessionId}`,
      description: 'AI Agent processing session in StackBlitz WebContainer',
      template: 'node',
      dependencies: {
        '@ai-sdk/anthropic': '^0.0.39',
        '@ai-sdk/openai': '^0.0.42',
        '@ai-sdk/google': '^0.0.35',
        'ai': '^3.3.0',
        'octokit': '^3.1.2',
        'simple-git': '^3.21.0',
        'fs-extra': '^11.2.0',
        'node-fetch': '^3.3.2'
      },
      files: {
        'package.json': this.generatePackageJson(),
        'agent.js': this.generateAgentScript(),
        'config.json': JSON.stringify(this.config, null, 2),
        'README.md': this.generateReadme()
      }
    };
  }

  private generateBrowserSessionUrl(stackblitzConfig: any): string {
    const baseUrl = 'https://stackblitz.com/fork/github';
    const params = new URLSearchParams({
      'file': 'agent.js',
      'title': stackblitzConfig.title,
      'description': stackblitzConfig.description,
      'deps': Object.keys(stackblitzConfig.dependencies).join(','),
      'embed': '1',
      'view': 'editor'
    });
    
    // Encode the configuration data
    const configData = encodeURIComponent(JSON.stringify({
      sessionId: this.sessionId,
      sessionToken: this.config.sessionToken,
      webhookUrl: this.config.webhookUrl,
      repoUrl: this.repoUrl,
      aiConfig: this.config.aiConfig
    }));
    
    return `${baseUrl}/${this.extractRepoPath(this.repoUrl)}?${params.toString()}&config=${configData}`;
  }

  private extractRepoPath(repoUrl: string): string {
    // Extract owner/repo from GitHub URL
    const match = repoUrl.match(/github\.com[\/:]([^\/]+\/[^\/\.]+)/);
    return match ? match[1] : '';
  }

  private async storeBrowserSessionConfig(): Promise<void> {
    const sessionConfig = {
      id: `browser_${this.sessionId}`,
      config: this.config,
      browserStatus: 'initializing',
      browserProgress: 0,
      createdAt: Date.now()
    };
    
    await storage.setSession(`browser_${this.sessionId}`, sessionConfig);
  }

  private async sendTasksToBrowser(tasks: any[]): Promise<void> {
    // Store tasks for the browser session to pick up
    const sessionData = await storage.getSession(`browser_${this.sessionId}`);
    if (sessionData) {
      sessionData.tasks = tasks;
      sessionData.browserStatus = 'processing';
      sessionData.browserProgress = 10;
      await storage.setSession(`browser_${this.sessionId}`, sessionData);
    }
  }

  private async waitForBrowserProcessing(timeout: number): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const sessionData = await storage.getSession(`browser_${this.sessionId}`);
      
      if (sessionData?.browserStatus === 'completed') {
        return {
          success: true,
          completedTasks: sessionData.browserResults?.completedTasks || 0,
          testsCreated: sessionData.browserResults?.testsCreated || 0
        };
      }
      
      if (sessionData?.browserStatus === 'failed') {
        return {
          success: false,
          completedTasks: 0,
          testsCreated: 0,
          error: sessionData.browserError || 'Browser processing failed'
        };
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Browser processing timeout');
  }

  private generatePackageJson(): string {
    return JSON.stringify({
      name: `geenius-agent-${this.sessionId}`,
      version: '1.0.0',
      description: 'Geenius AI Agent running in StackBlitz WebContainer',
      main: 'agent.js',
      scripts: {
        start: 'node agent.js',
        dev: 'node agent.js'
      },
      dependencies: {
        '@ai-sdk/anthropic': '^0.0.39',
        '@ai-sdk/openai': '^0.0.42',
        '@ai-sdk/google': '^0.0.35',
        'ai': '^3.3.0',
        'octokit': '^3.1.2',
        'simple-git': '^3.21.0',
        'fs-extra': '^11.2.0',
        'node-fetch': '^3.3.2'
      }
    }, null, 2);
  }

  private generateAgentScript(): string {
    return `
// Geenius AI Agent - Browser/StackBlitz WebContainer Version
const { generateText, tool } = require('ai');
const { anthropic } = require('@ai-sdk/anthropic');
const { openai } = require('@ai-sdk/openai');
const { google } = require('@ai-sdk/google');
const { Octokit } = require('octokit');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const config = require('./config.json');

class BrowserAgent {
  constructor() {
    this.config = config;
    this.sessionId = config.sessionId;
    this.git = simpleGit();
    this.octokit = new Octokit({ auth: config.githubToken });
    this.setupAI();
  }

  setupAI() {
    const providers = {
      anthropic: anthropic,
      openai: openai,
      google: google
    };
    
    this.aiProvider = providers[config.aiConfig.provider];
    this.model = config.aiConfig.model || this.getDefaultModel(config.aiConfig.provider);
  }

  getDefaultModel(provider) {
    const defaults = {
      anthropic: 'claude-3-5-sonnet-20241022',
      openai: 'gpt-4o',
      google: 'gemini-1.5-pro'
    };
    return defaults[provider] || 'claude-3-5-sonnet-20241022';
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Geenius AI Agent in Browser/StackBlitz...');
      
      // Clone the repository
      await this.cloneRepository();
      
      // Set up working environment
      await this.setupEnvironment();
      
      // Report ready status
      await this.reportStatus('ready', 20);
      
      // Start listening for tasks
      await this.listenForTasks();
      
    } catch (error) {
      console.error('❌ Agent initialization failed:', error);
      await this.reportStatus('failed', 0, error.message);
    }
  }

  async cloneRepository() {
    console.log('📥 Cloning repository:', config.repoUrl);
    await this.git.clone(config.repoUrl, './project');
    await this.git.cwd('./project');
    await this.git.checkout('develop');
    
    // Create feature branch
    const branchName = \`feature/geenius-browser-\${Date.now()}\`;
    await this.git.checkoutBranch(branchName, 'develop');
    
    this.branchName = branchName;
  }

  async setupEnvironment() {
    console.log('⚙️ Setting up development environment...');
    
    // Install dependencies if package.json exists
    if (await fs.pathExists('./project/package.json')) {
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm install', { cwd: './project' }, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
    }
  }

  async listenForTasks() {
    console.log('👂 Listening for tasks...');
    
    // Poll for tasks from the server
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(\`\${config.webhookUrl}/tasks\`);
        if (response.ok) {
          const data = await response.json();
          if (data.tasks && data.tasks.length > 0) {
            clearInterval(pollInterval);
            await this.processTasks(data.tasks);
          }
        }
      } catch (error) {
        console.log('⏳ Waiting for tasks...');
      }
    }, 3000);

    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      console.log('⏰ Task listening timeout');
    }, 600000);
  }

  async processTasks(tasks) {
    console.log(\`🎯 Processing \${tasks.length} tasks...\`);
    await this.reportStatus('processing', 30);
    
    let completedTasks = 0;
    let testsCreated = 0;
    const changes = [];

    for (const task of tasks) {
      try {
        console.log(\`📝 Processing task: \${task.description}\`);
        
        const result = await this.processTask(task);
        if (result.success) {
          completedTasks++;
          testsCreated += result.testsCreated || 0;
          changes.push(...result.changes);
          
          await this.reportStatus('processing', 30 + (completedTasks / tasks.length) * 40);
        }
      } catch (error) {
        console.error(\`❌ Task failed: \${task.id}\`, error);
      }
    }

    // Run tests
    console.log('🧪 Running tests...');
    await this.reportStatus('testing', 70);
    const testResults = await this.runTests();

    // Create commit and push
    console.log('📤 Creating commit and pushing changes...');
    await this.reportStatus('pr_creating', 80);
    await this.createCommitAndPush(changes);

    // Report completion
    await this.reportCompletion({
      completedTasks,
      testsCreated,
      changes,
      branchName: this.branchName,
      testResults
    });
  }

  async processTask(task) {
    const tools = {
      listFiles: tool({
        description: 'List files and directories at a given path',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to list files from' }
          }
        }
      }, async ({ path = '.' }) => {
        const files = await fs.readdir(\`./project/\${path}\`);
        return files.join('\\n');
      }),

      readFile: tool({
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to read' }
          },
          required: ['path']
        }
      }, async ({ path }) => {
        return await fs.readFile(\`./project/\${path}\`, 'utf8');
      }),

      writeFile: tool({
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to write' },
            content: { type: 'string', description: 'Content to write to the file' }
          },
          required: ['path', 'content']
        }
      }, async ({ path, content }) => {
        await fs.ensureDir(\`./project/\${require('path').dirname(path)}\`);
        await fs.writeFile(\`./project/\${path}\`, content, 'utf8');
        return \`File written: \${path}\`;
      })
    };

    const result = await generateText({
      model: this.aiProvider(this.model),
      messages: [
        {
          role: 'system',
          content: \`You are a coding agent working on a project. Your task is to implement the following change: "\${task.description}".
          
          First, explore the project structure, read relevant files, understand the codebase, then implement the requested changes.
          Be sure to follow existing code patterns and conventions.
          
          Component context: \${JSON.stringify(task.context)}
          Category: \${task.category}
          Priority: \${task.priority}\`
        },
        {
          role: 'user',
          content: task.description
        }
      ],
      tools,
      maxSteps: 10
    });

    return {
      success: true,
      changes: [{ 
        id: task.id,
        description: task.description,
        implementation: result.text
      }],
      testsCreated: 0
    };
  }

  async runTests() {
    try {
      if (await fs.pathExists('./project/package.json')) {
        const packageJson = await fs.readJson('./project/package.json');
        if (packageJson.scripts && packageJson.scripts.test) {
          const { exec } = require('child_process');
          return new Promise((resolve) => {
            exec('npm test', { cwd: './project' }, (error, stdout, stderr) => {
              if (error) {
                resolve({ passed: false, error: error.message });
              } else {
                resolve({ passed: true, output: stdout });
              }
            });
          });
        }
      }
      return { passed: true, message: 'No tests configured' };
    } catch (error) {
      return { passed: false, error: error.message };
    }
  }

  async createCommitAndPush(changes) {
    await this.git.add('.');
    await this.git.commit(\`feat: Geenius AI improvements (\${changes.length} changes)

\${changes.map(c => \`- \${c.description}\`).join('\\n')}

🤖 Generated with Geenius AI (Browser Processing)\`);
    
    await this.git.push('origin', this.branchName);
  }

  async reportStatus(status, progress, error = null) {
    try {
      await fetch(\`\${config.webhookUrl}/status\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          status,
          progress,
          error
        })
      });
    } catch (err) {
      console.error('Failed to report status:', err);
    }
  }

  async reportCompletion(results) {
    try {
      await fetch(\`\${config.webhookUrl}/complete\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          results
        })
      });
      
      console.log('✅ Processing completed successfully!');
      await this.reportStatus('completed', 100);
    } catch (err) {
      console.error('Failed to report completion:', err);
    }
  }
}

// Initialize and start the agent
const agent = new BrowserAgent();
agent.initialize().catch(console.error);

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserAgent;
}
`;
  }

  private generateReadme(): string {
    return `# Geenius AI Agent - Browser Session

This is a Geenius AI Agent running in a StackBlitz WebContainer environment.

## Session Information
- Session ID: ${this.sessionId}
- Repository: ${this.repoUrl}
- AI Provider: ${this.config.aiConfig.provider}

## Instructions

1. The agent will automatically start when this project loads
2. It will clone your repository and set up the development environment
3. Wait for tasks to be submitted from the main Geenius system
4. Process the tasks autonomously using AI
5. Create tests, run them, and commit changes
6. Push changes to a new feature branch

## Monitoring

Watch the console for progress updates. The agent will report its status back to the main Geenius system.

## Manual Override

If you need to take manual control, you can modify the \`agent.js\` file and restart the process.
`;
  }

  private generatePRBody(changes: any[]): string {
    const summary = `## Summary\n\nThis PR implements ${changes.length} improvements processed by Geenius AI in a browser StackBlitz environment.\n\n`;
    
    const changesList = changes.map(c => 
      `- **${c.category || 'General'}**: ${c.description}`
    ).join('\n');
    
    const testPlan = `\n\n## Test Plan\n\n- [ ] Review AI-generated code changes\n- [ ] Run test suite\n- [ ] Verify functionality in preview deployment\n- [ ] Manual testing of affected components\n\n`;
    
    const footer = `---\n\n🤖 Generated with Geenius AI (Browser/StackBlitz Processing)\nSession ID: ${this.sessionId}`;
    
    return summary + changesList + testPlan + footer;
  }
}

// Main processing function
async function processChangesBrowser(sessionId: string, payload: SubmissionPayload): Promise<void> {
  let browserService: BrowserStackBlitzService | null = null;
  
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Initialize Browser Service
    await storage.updateSessionStatus(sessionId, 'initializing');
    await storage.addLog(sessionId, 'info', 'Starting browser-based AI agent processing workflow', {
      projectId: payload.globalContext.projectId,
      repositoryUrl: payload.globalContext.repositoryUrl,
      changesCount: payload.changes.length
    });

    browserService = new BrowserStackBlitzService(payload.globalContext.repositoryUrl, sessionId, {
      provider: payload.globalContext.aiProvider || 'anthropic',
      model: payload.globalContext.aiModel
    });

    // Step 1: Initialize browser session
    await storage.updateSessionStatus(sessionId, 'browser_initializing');
    await storage.addLog(sessionId, 'info', 'Setting up browser StackBlitz environment...');
    
    const initResult = await browserService.initializeBrowserSession();
    if (!initResult.success) {
      throw new Error(initResult.error || 'Failed to initialize browser session');
    }
    
    const currentSession = await storage.getSession(sessionId);
    if (currentSession) {
      currentSession.browserUrl = initResult.browserUrl;
      currentSession.stackblitzProjectId = initResult.stackblitzProjectId;
      await storage.setSession(sessionId, currentSession);
    }
    
    await storage.addLog(sessionId, 'success', 'Browser session initialized successfully', {
      browserUrl: initResult.browserUrl,
      stackblitzProjectId: initResult.stackblitzProjectId,
      message: 'Please open the browser URL to start the AI agent processing'
    });

    // Step 2: Wait for browser to be ready and process tasks
    await storage.updateSessionStatus(sessionId, 'browser_waiting');
    await storage.addLog(sessionId, 'info', 'Waiting for browser session to be ready...');

    // Wait for browser session to be established (with timeout)
    let browserReady = false;
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (!browserReady && (Date.now() - startTime) < maxWaitTime) {
      const statusCheck = await browserService.checkBrowserSessionStatus();
      if (statusCheck.status === 'ready') {
        browserReady = true;
        break;
      } else if (statusCheck.status === 'failed') {
        throw new Error(statusCheck.error || 'Browser session failed to initialize');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    if (!browserReady) {
      throw new Error('Browser session timeout - please refresh the browser and try again');
    }

    await storage.addLog(sessionId, 'success', 'Browser session is ready');

    // Step 3: Send tasks to browser for processing
    await storage.updateSessionStatus(sessionId, 'ai_processing');
    await storage.addLog(sessionId, 'info', `Sending ${payload.changes.length} change requests to browser for AI processing...`);

    const processResult = await browserService.processTasksInBrowser(
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
      throw new Error(processResult.error || 'Failed to process changes in browser');
    }

    await storage.addLog(sessionId, 'success', `Successfully processed ${processResult.completedTasks} tasks in browser`);

    // Step 4: Create pull request from browser results
    await storage.updateSessionStatus(sessionId, 'pr_creating');
    await storage.addLog(sessionId, 'info', 'Creating pull request from browser session results...');

    const prResult = await browserService.createPullRequestFromBrowser();
    
    if (prResult.success && prResult.prUrl) {
      const prSession = await storage.getSession(sessionId);
      if (prSession) {
        prSession.prUrl = prResult.prUrl;
        prSession.branchName = prResult.branchName;
        await storage.setSession(sessionId, prSession);
      }
      
      await storage.addLog(sessionId, 'success', 'Pull request created successfully from browser session', { 
        prUrl: prResult.prUrl,
        branchName: prResult.branchName 
      });

      // Step 5: Wait for deployment
      await storage.updateSessionStatus(sessionId, 'deploying');
      await storage.addLog(sessionId, 'info', 'Waiting for deployment...');

      const netlifyService = new NetlifyService();
      const deploymentResult = await netlifyService.waitForBranchDeployment(prResult.branchName!, 300000);
      
      if (deploymentResult.success && deploymentResult.deployUrl) {
        const deploySession = await storage.getSession(sessionId);
        if (deploySession) {
          deploySession.previewUrl = deploymentResult.deployUrl;
          await storage.setSession(sessionId, deploySession);
        }
        await storage.addLog(sessionId, 'success', 'Deployment completed successfully', { 
          previewUrl: deploymentResult.deployUrl 
        });
      }
    } else {
      throw new Error(prResult.error || 'Failed to create pull request from browser session');
    }

    // Step 6: Mark as completed
    await storage.updateSessionStatus(sessionId, 'completed');
    const completedSession = await storage.getSession(sessionId);
    if (completedSession) {
      completedSession.endTime = Date.now();
      await storage.setSession(sessionId, completedSession);
      
      await storage.addLog(sessionId, 'success', 'Browser-based processing workflow completed successfully!', {
        totalTime: Math.round((completedSession.endTime - completedSession.startTime) / 1000) + ' seconds',
        previewUrl: completedSession.previewUrl,
        prUrl: completedSession.prUrl,
        completedTasks: processResult.completedTasks,
        testsCreated: processResult.testsCreated,
        browserUrl: completedSession.browserUrl
      });
    }

  } catch (error) {
    await storage.updateSessionStatus(sessionId, 'failed');
    await storage.addLog(sessionId, 'error', 'Browser-based processing failed', { error: error.message });
    
    const errorSession = await storage.getSession(sessionId);
    if (errorSession) {
      errorSession.error = error.message;
      errorSession.endTime = Date.now();
      await storage.setSession(sessionId, errorSession);
    }
  }
}

// Webhook handler for browser session updates
async function handleWebhook(sessionId: string, action: string, data: any): Promise<any> {
  try {
    const session = await storage.getSession(`browser_${sessionId}`);
    if (!session) {
      return { error: 'Session not found' };
    }

    switch (action) {
      case 'status':
        session.browserStatus = data.status;
        session.browserProgress = data.progress;
        if (data.error) {
          session.browserError = data.error;
        }
        await storage.setSession(`browser_${sessionId}`, session);
        return { success: true };

      case 'tasks':
        return { tasks: session.tasks || [] };

      case 'complete':
        session.browserStatus = 'completed';
        session.browserProgress = 100;
        session.browserResults = data.results;
        await storage.setSession(`browser_${sessionId}`, session);
        return { success: true };

      default:
        return { error: 'Unknown action' };
    }
  } catch (error) {
    return { error: error.message };
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
    // Handle webhook requests from browser sessions
    if (event.path.includes('/webhook/')) {
      const pathParts = event.path.split('/');
      const sessionId = pathParts[pathParts.length - 1];
      const action = pathParts[pathParts.length - 2];
      
      const data = event.body ? JSON.parse(event.body) : {};
      const result = await handleWebhook(sessionId, action, data);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    // Handle GET request for session status
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/');
      const sessionId = pathParts[pathParts.length - 1];
      
      if (!sessionId || sessionId === 'process-changes-browser') {
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
          browserUrl: session.browserUrl,
          stackblitzProjectId: session.stackblitzProjectId,
          error: session.error,
          startTime: session.startTime,
          endTime: session.endTime,
          progress: getProgressPercentage(session.status),
          processingType: 'browser'
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
      processChangesBrowser(sessionId, payload).catch(error => {
        console.error('Browser processing error:', error);
      });
      
      await storage.addLog(sessionId, 'info', 'Browser-based AI agent processing started', { 
        changesCount: payload.changes.length,
        submissionId: payload.submissionId,
        aiProvider: payload.globalContext.aiProvider || 'anthropic',
        processingType: 'browser'
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId,
          submissionId: payload.submissionId,
          processingType: 'browser',
          message: 'Changes submitted successfully. Browser-based AI agent processing started. You will receive a browser URL to monitor progress.',
          statusUrl: `${process.env.URL}/api/process-changes-browser/${sessionId}`,
          estimatedProcessingTime: payload.changes.length * 60000 // 1 minute per change for browser
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
    browser_initializing: 15,
    browser_waiting: 25,
    ai_processing: 50,
    testing: 70,
    pr_creating: 80,
    deploying: 90,
    completed: 100,
    failed: 0
  };
  
  return statusOrder[status] || 0;
}