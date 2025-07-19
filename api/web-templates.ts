import { Handler } from '@netlify/functions';
import { TemplateRegistry } from '../apps/web/services/template-registry';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN);
    const templates = await templateRegistry.getAllTemplates();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(templates)
    };
  } catch (error: any) {
    console.error('Templates error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Failed to load templates'
      })
    };
  }
};