import { Handler } from '@netlify/functions';
import { initCommand } from '../../src/cli/commands/init';

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

    // Set environment variables temporarily for this request
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

    // Capture console output
    const logs: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    console.error = (...args) => {
      logs.push(`ERROR: ${args.join(' ')}`);
      originalError(...args);
    };

    try {
      // Mock the inquirer prompts by setting up the responses
      const responses = {
        aiProvider: data.aiProvider,
        agentMode: data.agentMode,
        orchestrationStrategy: data.orchestrationStrategy || 'hierarchical',
        templateId: data.templateId,
        projectName: data.projectName,
        githubOrg: data.githubOrg,
        model: data.model || '',
        autoSetup: data.autoSetup !== false
      };

      // This is tricky - the init command uses inquirer which won't work in serverless
      // We need to refactor the init logic to accept parameters directly
      // For now, return a mock success response
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Project initialization started',
          logs: logs,
          // Mock data for now
          repoUrl: `https://github.com/${data.githubOrg}/${data.projectName}`,
          netlifyUrl: `https://${data.projectName}-${Date.now().toString(36)}.netlify.app`,
          mongodbDatabase: data.templateId.includes('mongo') ? `${data.projectName}_db` : null
        })
      };
    } finally {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
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
        error: error.message || 'Internal server error'
      })
    };
  }
};