// Netlify function to get available GitHub accounts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GitHubService } from '../src/services/github';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if GitHub token is available
    if (!process.env.GITHUB_TOKEN) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'GitHub token not configured',
          message: 'GITHUB_TOKEN environment variable is required'
        })
      };
    }

    const github = new GitHubService();
    const accounts = await github.getAvailableAccounts();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        accounts,
        total: accounts.length
      })
    };

  } catch (error) {
    console.error('GitHub accounts API error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch GitHub accounts',
        message: error.message || 'Unknown error occurred'
      })
    };
  }
};