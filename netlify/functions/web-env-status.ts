import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const envStatus = {
      github: {
        configured: !!process.env.GITHUB_TOKEN,
        optional: false,
        error: !process.env.GITHUB_TOKEN ? 'Missing GITHUB_TOKEN' : null
      },
      netlify: {
        configured: !!process.env.NETLIFY_TOKEN,
        optional: true,
        error: !process.env.NETLIFY_TOKEN ? 'Missing NETLIFY_TOKEN (optional)' : null
      },
      mongodb: {
        configured: !!(process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY),
        optional: true,
        error: !(process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY) ? 'Missing MONGODB_ATLAS_* keys (optional)' : null
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(envStatus)
    };
  } catch (error: any) {
    console.error('Env status error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Failed to check environment status'
      })
    };
  }
};