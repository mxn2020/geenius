// netlify/functions/queue-processor.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { QueueManager } from './shared/queue-manager';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // This function can be triggered by a cron job or manually
    const queueNames = ['notifications', 'cleanup', 'backup', 'reports'];
    
    for (const queueName of queueNames) {
      await QueueManager.processQueue(queueName);
    }

    const status = queueNames.reduce((acc, name) => {
      acc[name] = QueueManager.getQueueStatus(name);
      return acc;
    }, {} as Record<string, any>);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        processed: true,
        queueStatus: status,
        timestamp: Date.now()
      })
    };

  } catch (error) {
    console.error('Queue processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Queue processing failed',
        message: error.message
      })
    };
  }
};

