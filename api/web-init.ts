import { Handler } from '@netlify/functions';
import { ProjectWorkflow } from '../apps/web/src/utils/ProjectWorkflow';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!data.aiProvider || !data.agentMode || !data.templateId || !data.projectName || !data.githubOrg) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['aiProvider', 'agentMode', 'templateId', 'projectName', 'githubOrg']
        })
      };
    }

    // Validate API key availability
    if (data.aiProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })
      };
    }
    
    if (data.aiProvider === 'openai' && !process.env.OPENAI_API_KEY) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' })
      };
    }

    if (data.aiProvider === 'google' && !process.env.GOOGLE_API_KEY) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'GOOGLE_API_KEY not configured' })
      };
    }

    if (data.aiProvider === 'grok' && !process.env.GROK_API_KEY) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'GROK_API_KEY not configured' })
      };
    }

    // Validate GitHub token
    if (!process.env.GITHUB_TOKEN) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
      };
    }

    // Prepare options for web workflow
    const options = {
      aiProvider: data.aiProvider,
      agentMode: data.agentMode,
      orchestrationStrategy: data.orchestrationStrategy || 'hierarchical',
      templateId: data.templateId,
      projectName: data.projectName,
      githubOrg: data.githubOrg,
      model: data.model || undefined,
      autoSetup: data.autoSetup !== false
    };

    // Execute the initialization workflow
    const workflow = new ProjectWorkflow();
    const result = await workflow.initializeProject(options);

    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Project initialized successfully',
          repoUrl: result.repoUrl,
          netlifyUrl: result.netlifyProject?.ssl_url,
          mongodbDatabase: result.mongodbProject?.databaseName,
          logs: result.logs
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: result.error,
          logs: result.logs
        })
      };
    }

  } catch (error: any) {
    console.error('Web init error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        logs: [`❌ Unexpected error: ${error.message}`]
      })
    };
  }
};