// netlify/functions/process-changes.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { AgentService } from './shared/agent-service';
import { storage, ProcessingSession } from './shared/redis-storage';

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

// Main processing function
async function processChanges(sessionId: string, payload: SubmissionPayload): Promise<void> {
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Initialize Agent Service
    await storage.updateSessionStatus(sessionId, 'initializing');
    await storage.addLog(sessionId, 'info', 'Starting AI agent processing workflow', {
      projectId: payload.globalContext.projectId,
      repositoryUrl: payload.globalContext.repositoryUrl,
      changesCount: payload.changes.length
    });

    const agentService = new AgentService(payload.globalContext.repositoryUrl, {
      type: 'single', // Start with single agent, can be upgraded to orchestrated
      provider: payload.globalContext.aiProvider || 'anthropic',
      orchestrationStrategy: 'hierarchical'
    });

    // Step 1: Initialize project in StackBlitz sandbox
    await storage.updateSessionStatus(sessionId, 'sandbox_creating');
    await storage.addLog(sessionId, 'info', 'Creating StackBlitz sandbox environment...');
    
    await agentService.initializeProject(payload.globalContext.repositoryUrl, 'develop');
    await storage.addLog(sessionId, 'success', 'StackBlitz sandbox initialized successfully');

    // Step 2: Process multiple change requests
    await storage.updateSessionStatus(sessionId, 'ai_processing');
    await storage.addLog(sessionId, 'info', `Processing ${payload.changes.length} change requests...`);

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

    // Step 6: Mark as completed
    await storage.updateSessionStatus(sessionId, 'completed');
    const completedSession = await storage.getSession(sessionId);
    if (completedSession) {
      completedSession.endTime = Date.now();
      await storage.setSession(sessionId, completedSession);
      
      await storage.addLog(sessionId, 'success', 'Processing workflow completed successfully!', {
        totalTime: Math.round((completedSession.endTime - completedSession.startTime) / 1000) + ' seconds',
        previewUrl: completedSession.previewUrl,
        prUrl: completedSession.prUrl,
        completedTasks: processResult.completedTasks,
        testsCreated: processResult.testsCreated
      });
    }

  } catch (error) {
    await storage.updateSessionStatus(sessionId, 'failed');
    await storage.addLog(sessionId, 'error', 'Processing failed', { error: error.message });
    
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
      
      if (!sessionId || sessionId === 'process-changes') {
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
          progress: getProgressPercentage(session.status)
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
      processChanges(sessionId, payload).catch(error => {
        console.error('Processing error:', error);
      });
      
      await storage.addLog(sessionId, 'info', 'AI agent processing started', { 
        changesCount: payload.changes.length,
        submissionId: payload.submissionId,
        aiProvider: payload.globalContext.aiProvider || 'anthropic'
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId,
          submissionId: payload.submissionId,
          message: 'Changes submitted successfully. AI agent processing started.',
          statusUrl: `${process.env.URL}/api/process-changes/${sessionId}`,
          estimatedProcessingTime: payload.changes.length * 90000 // 1.5 minutes per change
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

