// netlify/functions/webhooks.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { WebhookManager } from './shared/webhook-manager';
import { SecurityValidator } from './shared/security-validator';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // API key authentication
    const apiKey = event.headers.authorization?.replace('Bearer ', '');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    if (event.httpMethod === 'POST') {
      // Create webhook subscription
      const { url, events, secret } = JSON.parse(event.body || '{}');
      
      if (!url || !SecurityValidator.validateRepositoryUrl(url)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Valid URL is required' })
        };
      }

      const webhookId = await WebhookManager.subscribe(url, events || ['*'], secret);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          webhookId,
          events: events || ['*']
        })
      };
    }

    if (event.httpMethod === 'GET') {
      // List webhook subscriptions
      const subscriptions = WebhookManager.getSubscriptions();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ subscriptions })
      };
    }

    if (event.httpMethod === 'DELETE') {
      // Delete webhook subscription
      const webhookId = event.queryStringParameters?.id;
      
      if (!webhookId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Webhook ID is required' })
        };
      }

      const success = await WebhookManager.unsubscribe(webhookId);
      
      return {
        statusCode: success ? 200 : 404,
        headers,
        body: JSON.stringify({ 
          success,
          message: success ? 'Webhook deleted' : 'Webhook not found'
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Webhook management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook operation failed' })
    };
  }
};

