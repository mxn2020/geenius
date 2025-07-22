import { Handler } from '@netlify/functions';
import { ProjectWorkflow } from '../src/utils/ProjectWorkflow';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';

// Initialize session manager
const sessionManager = new EnhancedSessionManager();

export const handler: Handler = async (event, context) => {
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

  // Handle GET requests for session status
  if (event.httpMethod === 'GET') {
    const sessionId = event.path.split('/').pop();
    
    if (!sessionId || sessionId === 'web-init') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    try {
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      // Get all logs including separately stored ones
      const allLogs = await sessionManager.getAllSessionLogs(sessionId);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionId: session.id,
          status: session.status,
          progress: session.progress,
          currentStep: session.currentStep,
          logs: allLogs,
          repoUrl: session.repoUrl,
          netlifyUrl: session.netlifyUrl,
          mongodbDatabase: session.mongodbDatabase,
          error: session.error,
          // Include the original request data for status display
          projectName: session.projectName || session.data?.projectName,
          templateId: session.templateId || session.data?.templateId,
          aiProvider: session.aiProvider || session.data?.aiProvider,
          agentMode: session.agentMode || session.data?.agentMode
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to get session status' })
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    // Validate required fields (projectRequirements is optional)
    if (!data.aiProvider || !data.agentMode || !data.templateId || !data.projectName || !data.githubOrg) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['aiProvider', 'agentMode', 'templateId', 'projectName', 'githubOrg']
        })
      };
    }

    // Check if we should use AI customization or standard deployment
    const hasProjectRequirements = data.projectRequirements && data.projectRequirements.trim().length > 0;
    console.log(`[WEB-INIT] Project requirements provided: ${hasProjectRequirements}`);
    
    if (hasProjectRequirements) {
      console.log(`[WEB-INIT] Delegating to AI-driven project initialization...`);
      
      // Transform data to initialize-project format and delegate
      const initRequest = {
        userRequirements: data.projectRequirements,
        businessDomain: 'general', // Could be inferred from project requirements
        projectId: `ai-${Date.now()}`,
        projectName: data.projectName,
        templateId: data.templateId,
        githubOrg: data.githubOrg,
        aiProvider: data.aiProvider,
        agentMode: data.agentMode,
        orchestrationStrategy: data.orchestrationStrategy,
        model: data.model,
        autoSetup: data.autoSetup,
        mongodbOrgId: data.mongodbOrgId,
        mongodbProjectId: data.mongodbProjectId
      };
      
      // Import and use the initialize-project handler
      const { handler: initHandler } = await import('./initialize-project');
      const initEvent = {
        ...event,
        body: JSON.stringify(initRequest)
      };
      
      return await initHandler(initEvent, context);
    }

    // Validate API key availability
    if (data.aiProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })
      };
    }
    
    if (data.aiProvider === 'openai' && !process.env.OPENAI_API_KEY) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' })
      };
    }

    if (data.aiProvider === 'google' && !process.env.GOOGLE_API_KEY) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'GOOGLE_API_KEY not configured' })
      };
    }

    if (data.aiProvider === 'grok' && !process.env.GROK_API_KEY) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'GROK_API_KEY not configured' })
      };
    }

    // Validate GitHub token
    if (!process.env.GITHUB_TOKEN) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
      };
    }

    // Apply default values for simple mode (when project requirements are empty)
    if (!hasProjectRequirements) {
      console.log(`[WEB-INIT] Applying default values for standard deployment`);
      
      // Set default MongoDB values if not provided and MongoDB is available
      if (!data.mongodbOrgId && process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY) {
        try {
          console.log(`[WEB-INIT] Looking up first available MongoDB organization`);
          const { MongoDBService } = await import('../src/services/mongodb');
          const mongodb = new MongoDBService();
          const organizations = await mongodb.getOrganizations();
          
          if (organizations.length > 0) {
            data.mongodbOrgId = organizations[0].id;
            console.log(`[WEB-INIT] Using MongoDB org: ${organizations[0].name} (${organizations[0].id})`);
          } else {
            console.log(`[WEB-INIT] No MongoDB organizations found - skipping MongoDB setup`);
            data.mongodbOrgId = null;
          }
        } catch (mongoError) {
          console.log(`[WEB-INIT] Failed to load MongoDB organizations: ${mongoError.message} - skipping MongoDB setup`);
          data.mongodbOrgId = null;
        }
      }
      
      if (!data.mongodbProjectId && data.mongodbOrgId) {
        console.log(`[WEB-INIT] Setting MongoDB project to CREATE_NEW`);
        data.mongodbProjectId = 'CREATE_NEW';
      }
      
      // Set other defaults for simple mode
      data.model = data.model || ''; // Empty model uses provider default
      console.log(`[WEB-INIT] Standard deployment configured with defaults`);
    }

    // Create session for async processing
    const sessionId = `ge_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize session
    await sessionManager.createInitializationSession(sessionId, data);
    
    // Start async processing
    processInitializationAsync(sessionId, data);

    // Return session info immediately
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionId,
        message: 'Project initialization started',
        statusUrl: `${event.headers.origin || 'http://localhost:8888'}/.netlify/functions/web-init/${sessionId}`,
        estimatedTime: 120000 // 2 minutes
      })
    };

  } catch (error) {
    console.error('Web-init error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

/**
 * Process initialization asynchronously
 */
async function processInitializationAsync(sessionId: string, data: any) {
  try {
    await sessionManager.updateSessionStatus(sessionId, 'initializing', 10, 'Starting project initialization...');

    // Prepare options for web workflow
    const options = {
      aiProvider: data.aiProvider,
      agentMode: data.agentMode,
      orchestrationStrategy: data.orchestrationStrategy || 'hierarchical',
      templateId: data.templateId,
      projectName: data.projectName,
      githubOrg: data.githubOrg,
      model: data.model || undefined,
      autoSetup: data.autoSetup !== false,
      mongodbOrgId: data.mongodbOrgId,
      mongodbProjectId: data.mongodbProjectId
    };

    await sessionManager.addLog(sessionId, 'info', 'Executing initialization workflow...');
    await sessionManager.updateSessionStatus(sessionId, 'processing', 30, 'Running project workflow...');

    // Execute the initialization workflow with logger
    const workflow = new ProjectWorkflow(async (level, message) => {
      await sessionManager.addLog(sessionId, level as any, message);
    });
    const result = await workflow.initializeProject(options);

    if (result.success) {
      await sessionManager.updateSessionStatus(sessionId, 'completed', 100, 'Project initialization completed!');
      await sessionManager.addLog(sessionId, 'success', 'Project initialized successfully');
      
      // Store results in session
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        session.repoUrl = result.repoUrl;
        session.netlifyUrl = result.netlifyProject?.ssl_url;
        session.mongodbDatabase = result.mongodbProject?.databaseName;
        await sessionManager.setSession(sessionId, session);
        
        // Log URLs explicitly
        if (result.repoUrl) {
          await sessionManager.addLog(sessionId, 'success', `📁 GitHub Repository: ${result.repoUrl}`);
        }
        if (result.netlifyProject?.ssl_url) {
          await sessionManager.addLog(sessionId, 'success', `🌐 Netlify URL: ${result.netlifyProject.ssl_url}`);
        }
        if (result.mongodbProject?.databaseName) {
          await sessionManager.addLog(sessionId, 'success', `🍃 MongoDB Database: ${result.mongodbProject.databaseName}`);
        }
        if (result.mongodbProject?.connectionString) {
          await sessionManager.addLog(sessionId, 'success', `🔗 MongoDB Connection: ${result.mongodbProject.connectionString}`);
        }
      }
    } else {
      await sessionManager.setError(sessionId, result.error || 'Project initialization failed');
      await sessionManager.addLog(sessionId, 'error', result.error || 'Initialization failed');
    }

  } catch (error) {
    console.error('Async initialization error:', error);
    await sessionManager.setError(sessionId, `Initialization failed: ${error.message}`);
    await sessionManager.addLog(sessionId, 'error', `Initialization error: ${error.message}`);
  }
}