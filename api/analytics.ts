// netlify/functions/analytics.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { AnalyticsService } from './shared/analytics';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'POST') {
      // Track custom event
      const { event: eventName, properties } = JSON.parse(event.body || '{}');
      await AnalyticsService.trackEvent(eventName, properties);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    if (event.httpMethod === 'GET') {
      // Get analytics report
      const timeframe = event.queryStringParameters?.timeframe as any || '24h';
      const report = await AnalyticsService.generateReport(timeframe);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(report)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Analytics service failed' })
    };
  }
};

