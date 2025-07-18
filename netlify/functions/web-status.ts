import { Handler } from '@netlify/functions';
import { ConfigManager } from '../../src/utils/config';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const configManager = new ConfigManager();
    
    if (!(await configManager.configExists())) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          hasProject: false,
          message: 'No project initialized'
        })
      };
    }

    const config = await configManager.loadConfig();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        hasProject: true,
        ...config
      })
    };
  } catch (error: any) {
    console.error('Status error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Failed to load project status'
      })
    };
  }
};