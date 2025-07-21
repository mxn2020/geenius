// Cancel Session API - Stop processing of an active session
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';

// Initialize services
const sessionManager = new EnhancedSessionManager();

/**
 * Main handler function
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Extract session ID from path
    const pathParts = event.path.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId === 'cancel-session') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Check if session exists
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    // Check if session is in a state that can be cancelled
    const cancellableStates = ['received', 'validating', 'analyzing', 'processing', 'creating_branch', 'committing', 'testing', 'pr_creating', 'deploying'];
    if (!cancellableStates.includes(session.status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Session cannot be cancelled in current state: ${session.status}`,
          status: session.status
        })
      };
    }

    // Cancel the session
    await sessionManager.setError(sessionId, 'Processing cancelled by user');
    await sessionManager.addLog(sessionId, 'warning', '🛑 Processing cancelled by user request');

    console.log(`Session ${sessionId} cancelled by user`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Session cancelled successfully',
        sessionId
      })
    };

  } catch (error) {
    console.error('Cancel session error:', error);
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