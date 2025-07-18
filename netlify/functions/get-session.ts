// netlify/functions/get-session.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage } from './shared/redis-storage';

function getProgressPercentage(status: string): number {
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
    // Get session ID from query parameters
    const sessionId = event.queryStringParameters?.sessionId;
    
    if (!sessionId) {
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
        error: session.error,
        startTime: session.startTime,
        endTime: session.endTime,
        progress: getProgressPercentage(session.status)
      })
    };

  } catch (error) {
    console.error('Get session error:', error);
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