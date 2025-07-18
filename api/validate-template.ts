// netlify/functions/validate-template.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { TemplateValidator } from './shared/template-validator';
import { SecurityValidator } from './shared/security-validator';
import { ProcessingSession } from './shared/redis-storage';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { repositoryUrl } = JSON.parse(event.body || '{}');

    if (!repositoryUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Repository URL is required' })
      };
    }

    if (!SecurityValidator.validateRepositoryUrl(repositoryUrl)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid repository URL' })
      };
    }

    const validationResult = await TemplateValidator.validateTemplate(repositoryUrl);
    const report = TemplateValidator.generateValidationReport(validationResult);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        validation: validationResult,
        report,
        timestamp: Date.now()
      })
    };

  } catch (error) {
    console.error('Template validation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Template validation failed',
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

