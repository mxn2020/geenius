// netlify/functions/github-webhook.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { WebhookHandler } from './webhook-handler';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const signature = event.headers['x-hub-signature-256'] || '';
    const payload = JSON.parse(event.body || '{}');

    await WebhookHandler.handleGitHubWebhook(payload, signature);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Webhook processed' })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};
