import { Handler } from '@netlify/functions';
import { promises as fs } from 'fs';
import { join } from 'path';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check for config file in current working directory
    const configPath = join(process.cwd(), '.dev-agent.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
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
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        // Config file doesn't exist
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
      throw fileError;
    }
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