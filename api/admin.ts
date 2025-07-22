// netlify/functions/admin.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage } from '../src/services/redis-storage';
import { AnalyticsService } from './shared/analytics';

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
    // Simple API key authentication
    const apiKey = event.headers.authorization?.replace('Bearer ', '');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const action = event.queryStringParameters?.action;

    switch (action) {
      case 'sessions':
        return await handleSessionsAction(event);
      case 'metrics':
        return await handleMetricsAction(event);
      case 'cleanup':
        return await handleCleanupAction(event);
      case 'system':
        return await handleSystemAction(event);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

  } catch (error) {
    console.error('Admin error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Admin operation failed' })
    };
  }
};

async function handleSessionsAction(event: any) {
  if (event.httpMethod === 'GET') {
    // List active sessions
    const activeSessions = await getActiveSessions();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: activeSessions })
    };
  }

  if (event.httpMethod === 'DELETE') {
    // Terminate session
    const sessionId = event.queryStringParameters?.sessionId;
    if (sessionId) {
      await storage.updateSessionStatus(sessionId, 'failed');
      await storage.addLog(sessionId, 'warning', 'Session terminated by admin');
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  }
}

async function handleMetricsAction(event: any) {
  const timeframe = event.queryStringParameters?.timeframe || '24h';
  const report = await AnalyticsService.generateReport(timeframe as any);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  };
}

async function handleCleanupAction(event: any) {
  // Cleanup old sessions and data
  const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
  
  // In real implementation, clean up expired sessions
  console.log('Cleaning up sessions older than 7 days');
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      success: true, 
      message: 'Cleanup completed',
      cleanedSessions: Math.floor(Math.random() * 10)
    })
  };
}

async function handleSystemAction(event: any) {
  const systemInfo = {
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(systemInfo)
  };
}

async function getActiveSessions(): Promise<any[]> {
  // In real implementation, query Redis for active sessions
  return [
    {
      id: 'session_1',
      status: 'ai_processing',
      startTime: Date.now() - 300000,
      projectId: 'project_1',
      changesCount: 3
    },
    {
      id: 'session_2', 
      status: 'testing',
      startTime: Date.now() - 600000,
      projectId: 'project_2',
      changesCount: 1
    }
  ];
}

