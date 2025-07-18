// netlify/functions/shared/queue-manager.ts
interface QueueJob {
  id: string;
  type: string;
  payload: any;
  priority: number;
  createdAt: number;
  scheduledFor?: number;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class QueueManager {
  private static queues: Map<string, QueueJob[]> = new Map();
  private static processing: Set<string> = new Set();

  static async addJob(
    queueName: string, 
    type: string, 
    payload: any, 
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      priority: options.priority || 0,
      createdAt: Date.now(),
      scheduledFor: options.delay ? Date.now() + options.delay : undefined,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      status: 'pending'
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;
    queue.push(job);
    
    // Sort by priority (higher priority first)
    queue.sort((a, b) => b.priority - a.priority);

    return job.id;
  }

  static async processQueue(queueName: string): Promise<void> {
    if (this.processing.has(queueName)) {
      return; // Already processing this queue
    }

    this.processing.add(queueName);

    try {
      const queue = this.queues.get(queueName);
      if (!queue) return;

      const now = Date.now();
      const readyJobs = queue.filter(job => 
        job.status === 'pending' && 
        (!job.scheduledFor || job.scheduledFor <= now)
      );

      for (const job of readyJobs) {
        await this.processJob(job);
      }

      // Remove completed and failed jobs that exceeded max attempts
      this.queues.set(queueName, queue.filter(job => 
        job.status === 'pending' || 
        (job.status === 'failed' && job.attempts < job.maxAttempts)
      ));

    } finally {
      this.processing.delete(queueName);
    }
  }

  private static async processJob(job: QueueJob): Promise<void> {
    job.status = 'processing';
    job.attempts++;

    try {
      switch (job.type) {
        case 'send_notification':
          await this.handleNotification(job.payload);
          break;
        case 'cleanup_session':
          await this.handleSessionCleanup(job.payload);
          break;
        case 'backup_data':
          await this.handleBackup(job.payload);
          break;
        case 'generate_report':
          await this.handleReportGeneration(job.payload);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
    } catch (error) {
      job.error = error.message;
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        job.status = 'pending';
        // Exponential backoff for retries
        job.scheduledFor = Date.now() + (Math.pow(2, job.attempts) * 1000);
      }
    }
  }

  private static async handleNotification(payload: any): Promise<void> {
    const { type, config, message, sessionId } = payload;
    
    switch (type) {
      case 'slack':
        await IntegrationManager.notifySlack(config, message, sessionId);
        break;
      case 'discord':
        await IntegrationManager.notifyDiscord(config, message, sessionId);
        break;
      case 'email':
        await IntegrationManager.sendEmail(config, payload.to, payload.subject, message);
        break;
    }
  }

  private static async handleSessionCleanup(payload: any): Promise<void> {
    const { sessionId } = payload;
    // Implement session cleanup logic
    console.log(`Cleaning up session: ${sessionId}`);
  }

  private static async handleBackup(payload: any): Promise<void> {
    const { sessionId } = payload;
    // Implement backup logic
    console.log(`Backing up session: ${sessionId}`);
  }

  private static async handleReportGeneration(payload: any): Promise<void> {
    const { reportType, parameters } = payload;
    // Implement report generation logic
    console.log(`Generating report: ${reportType}`);
  }

  static getQueueStatus(queueName: string): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const queue = this.queues.get(queueName) || [];
    
    return {
      pending: queue.filter(job => job.status === 'pending').length,
      processing: queue.filter(job => job.status === 'processing').length,
      completed: queue.filter(job => job.status === 'completed').length,
      failed: queue.filter(job => job.status === 'failed').length
    };
  }

  static async retryFailedJobs(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName) || [];
    let retriedCount = 0;

    for (const job of queue) {
      if (job.status === 'failed' && job.attempts < job.maxAttempts) {
        job.status = 'pending';
        job.scheduledFor = undefined;
        retriedCount++;
      }
    }

    return retriedCount;
  }
}

