// Enhanced Session Management for Agentic AI System
import { Redis } from '@upstash/redis';
import RedisKeys from './redis-keys';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export interface ProcessingLog {
  level: 'debug' | 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  component?: string;
  metadata?: Record<string, any>;
  sessionId: string;
}

export interface FileProcessingInfo {
  path: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  changeCount: number;
  processingTime?: number;
  commitSha?: string;
  error?: string;
}

export interface RetryInfo {
  attempt: number;
  maxRetries: number;
  lastError?: string;
  nextRetryAt?: number;
}

export interface EnhancedProcessingSession {
  // Basic session info
  id: string;
  submissionId: string;
  projectId: string;
  repositoryUrl: string;
  
  // Status tracking
  status: 'received' | 'validating' | 'analyzing' | 'processing' | 'creating_branch' | 
          'committing' | 'testing' | 'pr_creating' | 'deploying' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  
  // Change tracking
  changes: any[];
  fileGroups: FileProcessingInfo[];
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  
  // Branch and PR info
  branchName?: string;
  featureName?: string;
  prUrl?: string;
  prNumber?: number;
  previewUrl?: string;
  
  // Timing
  startTime: number;
  endTime?: number;
  estimatedCompletionTime?: number;
  
  // Error handling
  error?: string;
  retryInfo?: RetryInfo;
  
  // Logs
  logs: ProcessingLog[];
  
  // Configuration
  aiProvider: string;
  baseBranch: string;
  autoTest: boolean;
  
  // Results
  commits: Array<{
    sha: string;
    message: string;
    url: string;
    filePath: string;
  }>;
  testResults?: {
    passed: number;
    failed: number;
    total: number;
    details: string[];
  };
}

export class EnhancedSessionManager {
  private redis: Redis;
  private readonly SESSION_TTL = RedisKeys.TTL.SESSION;

  constructor() {
    this.redis = redis;
  }

  /**
   * Generate unique session ID in clean format
   */
  generateSessionId(type: string = 'INIT', projectId?: string): string {
    return RedisKeys.generateSessionId(type as any, projectId);
  }

  /**
   * Create new initialization session for web-init
   */
  async createInitializationSession(
    sessionId: string,
    initData: {
      aiProvider: string;
      agentMode: string;
      templateId: string;
      projectName: string;
      githubOrg: string;
      orchestrationStrategy?: string;
      model?: string;
      autoSetup?: boolean;
    }
  ): Promise<void> {
    const session = {
      id: sessionId,
      submissionId: sessionId,
      projectId: initData.projectName,
      repositoryUrl: '',
      status: 'received' as const,
      progress: 0,
      currentStep: 'Initializing project...',
      changes: [],
      fileGroups: [],
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      startTime: Date.now(),
      logs: [],
      aiProvider: initData.aiProvider,
      baseBranch: 'main',
      autoTest: true,
      commits: [],
      repoUrl: '',
      netlifyUrl: '',
      mongodbDatabase: '',
      error: undefined
    };

    await this.setSession(sessionId, session);
    await this.addLog(sessionId, 'info', 'Project initialization started', {
      projectName: initData.projectName,
      aiProvider: initData.aiProvider,
      templateId: initData.templateId
    });
  }

  /**
   * Create new processing session
   */
  async createSession(
    submissionId: string,
    projectId: string,
    repositoryUrl: string,
    changes: any[],
    config: {
      aiProvider: string;
      baseBranch?: string;
      autoTest?: boolean;
    }
  ): Promise<EnhancedProcessingSession> {
    const sessionId = this.generateSessionId();
    
    const session: EnhancedProcessingSession = {
      id: sessionId,
      submissionId,
      projectId,
      repositoryUrl,
      status: 'received',
      progress: 0,
      currentStep: 'Initializing processing session',
      changes,
      fileGroups: [],
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      startTime: Date.now(),
      estimatedCompletionTime: Date.now() + (changes.length * 90000), // 1.5 min per change
      logs: [],
      aiProvider: config.aiProvider,
      baseBranch: config.baseBranch || 'main',
      autoTest: config.autoTest !== false,
      commits: []
    };

    await this.setSession(sessionId, session);
    await this.addLog(sessionId, 'info', 'Processing session created', {
      changesCount: changes.length,
      aiProvider: config.aiProvider,
      repositoryUrl
    });

    return session;
  }

  /**
   * Store session data with TTL using RedisKeys
   */
  async setSession(sessionId: string, session: EnhancedProcessingSession): Promise<void> {
    try {
      const key = RedisKeys.session(sessionId);
      await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to store session:', error);
      // Fallback to in-memory storage if Redis fails
      this.fallbackStorage.set(sessionId, session);
    }
  }

  /**
   * Retrieve session data
   */
  async getSession(sessionId: string): Promise<EnhancedProcessingSession | null> {
    try {
      const key = RedisKeys.session(sessionId);
      const sessionData = await this.redis.get(key);
      
      if (sessionData) {
        // Upstash Redis automatically parses JSON, so check if it's already an object
        if (typeof sessionData === 'string') {
          return JSON.parse(sessionData);
        } else {
          // Data is already parsed by Upstash Redis
          return sessionData as EnhancedProcessingSession;
        }
      }
      
      // Check fallback storage
      return this.fallbackStorage.get(sessionId) || null;
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      return this.fallbackStorage.get(sessionId) || null;
    }
  }

  /**
   * Update session status and progress
   */
  async updateSessionStatus(
    sessionId: string, 
    status: EnhancedProcessingSession['status'],
    progress?: number,
    currentStep?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    if (progress !== undefined) {
      session.progress = Math.min(100, Math.max(0, progress));
    }
    if (currentStep) {
      session.currentStep = currentStep;
    }

    // Update estimated completion time based on progress
    if (session.progress > 0) {
      const elapsed = Date.now() - session.startTime;
      const estimatedTotal = (elapsed / session.progress) * 100;
      session.estimatedCompletionTime = session.startTime + estimatedTotal;
    }

    await this.setSession(sessionId, session);
  }

  /**
   * Add log entry to session
   */
  async addLog(
    sessionId: string,
    level: ProcessingLog['level'],
    message: string,
    metadata?: Record<string, any>,
    component?: string
  ): Promise<void> {
    const log: ProcessingLog = {
      level,
      message,
      timestamp: Date.now(),
      component,
      metadata,
      sessionId
    };

    const session = await this.getSession(sessionId);
    if (session) {
      session.logs.push(log);
      
      // Keep only last 500 logs to prevent memory issues but store more
      if (session.logs.length > 500) {
        session.logs = session.logs.slice(-500);
      }
      
      await this.setSession(sessionId, session);
    }

    // Also store logs separately for querying with unique key using RedisKeys
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 5);
      const logKey = RedisKeys.sessionLog(sessionId, timestamp, randomId);
      await this.redis.setex(logKey, this.SESSION_TTL, JSON.stringify(log));
    } catch (error) {
      console.error('Failed to store log separately:', error);
    }
  }

  /**
   * Get all logs for a session (both from session and separate storage)
   */
  async getAllSessionLogs(sessionId: string): Promise<ProcessingLog[]> {
    const allLogs: ProcessingLog[] = [];
    
    try {
      // Get logs from separate storage using RedisKeys pattern
      const logKeys = await this.redis.keys(RedisKeys.patterns.SESSION_LOGS(sessionId));
      
      if (logKeys.length > 0) {
        // Batch fetch all logs in a single call to reduce Upstash API calls
        const logDataArray = await this.redis.mget(...logKeys);
        
        for (let i = 0; i < logDataArray.length; i++) {
          try {
            const logData = logDataArray[i];
            if (logData) {
              const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
              allLogs.push(log);
            }
          } catch (error) {
            console.error('Error parsing log:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error retrieving separate logs:', error);
    }
    
    // Get logs from session (as fallback/supplement)
    const session = await this.getSession(sessionId);
    if (session && session.logs) {
      // Add session logs if they're not already in separate storage
      for (const sessionLog of session.logs) {
        const exists = allLogs.some(log => 
          log.timestamp === sessionLog.timestamp && log.message === sessionLog.message
        );
        if (!exists) {
          allLogs.push(sessionLog);
        }
      }
    }
    
    // Sort by timestamp (oldest first for chronological order)
    return allLogs.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Update file processing info
   */
  async updateFileProcessing(
    sessionId: string,
    filePath: string,
    update: Partial<FileProcessingInfo>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const fileIndex = session.fileGroups.findIndex(f => f.path === filePath);
    if (fileIndex >= 0) {
      session.fileGroups[fileIndex] = { ...session.fileGroups[fileIndex], ...update };
    } else {
      session.fileGroups.push({
        path: filePath,
        status: 'pending',
        changeCount: 0,
        ...update
      });
    }

    // Update counters
    session.totalFiles = session.fileGroups.length;
    session.processedFiles = session.fileGroups.filter(f => f.status === 'completed').length;
    session.failedFiles = session.fileGroups.filter(f => f.status === 'failed').length;

    // Update progress based on file completion
    if (session.totalFiles > 0) {
      const fileProgress = (session.processedFiles / session.totalFiles) * 80; // Files are 80% of progress
      session.progress = Math.max(session.progress, fileProgress);
    }

    await this.setSession(sessionId, session);
  }

  /**
   * Add commit info to session
   */
  async addCommit(
    sessionId: string,
    commitInfo: {
      sha: string;
      message: string;
      url: string;
      filePath: string;
    }
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.commits.push(commitInfo);
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'success', `Committed changes to ${commitInfo.filePath}`, {
        sha: commitInfo.sha,
        url: commitInfo.url
      });
    }
  }

  /**
   * Set branch and PR information
   */
  async setBranchInfo(
    sessionId: string,
    branchName: string,
    featureName?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.branchName = branchName;
      session.featureName = featureName;
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'info', `Created feature branch: ${branchName}`, {
        featureName
      });
    }
  }

  /**
   * Set pull request information
   */
  async setPullRequestInfo(
    sessionId: string,
    prUrl: string,
    prNumber: number
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.prUrl = prUrl;
      session.prNumber = prNumber;
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'success', `Pull request created: #${prNumber}`, {
        prUrl
      });
    }
  }

  /**
   * Set preview URL
   */
  async setPreviewUrl(sessionId: string, previewUrl: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.previewUrl = previewUrl;
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'success', 'Preview deployment ready', {
        previewUrl
      });
    }
  }

  /**
   * Set error and mark session as failed
   */
  async setError(sessionId: string, error: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = error;
      session.endTime = Date.now();
      session.progress = 0;
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'error', 'Session failed', { error });
    }
  }

  /**
   * Mark session as completed
   */
  async setCompleted(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = Date.now();
      session.progress = 100;
      session.currentStep = 'Processing completed successfully';
      await this.setSession(sessionId, session);
      
      const totalTime = Math.round((session.endTime - session.startTime) / 1000);
      await this.addLog(sessionId, 'success', 'Processing completed successfully', {
        totalTime: `${totalTime} seconds`,
        processedFiles: session.processedFiles,
        commits: session.commits.length,
        prUrl: session.prUrl,
        previewUrl: session.previewUrl
      });
    }
  }

  /**
   * Set retry information
   */
  async setRetryInfo(
    sessionId: string,
    attempt: number,
    maxRetries: number,
    error?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.retryInfo = {
        attempt,
        maxRetries,
        lastError: error,
        nextRetryAt: Date.now() + (attempt * 10000) // Exponential backoff
      };
      await this.setSession(sessionId, session);
      await this.addLog(sessionId, 'warning', `Retry attempt ${attempt}/${maxRetries}`, {
        error,
        nextRetryAt: session.retryInfo.nextRetryAt
      });
    }
  }

  /**
   * Get session summary for status endpoint
   */
  async getSessionSummary(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return {
      sessionId: session.id,
      status: session.status,
      progress: session.progress,
      currentStep: session.currentStep,
      branchName: session.branchName,
      prUrl: session.prUrl,
      previewUrl: session.previewUrl,
      error: session.error,
      startTime: session.startTime,
      endTime: session.endTime,
      estimatedCompletionTime: session.estimatedCompletionTime,
      totalFiles: session.totalFiles,
      processedFiles: session.processedFiles,
      failedFiles: session.failedFiles,
      commits: session.commits.length,
      logs: session.logs.slice(-10), // Last 10 logs
      retryInfo: session.retryInfo
    };
  }

  /**
   * List active sessions (for monitoring)
   */
  async listActiveSessions(): Promise<string[]> {
    try {
      const keys = await this.redis.keys(RedisKeys.patterns.ALL_SESSIONS);
      return keys.map(key => key.replace('geenius:session:', ''));
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return Array.from(this.fallbackStorage.keys());
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const sessionIds = await this.listActiveSessions();
      let cleaned = 0;

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session && session.startTime < cutoffTime) {
          await this.redis.del(RedisKeys.session(sessionId));
          this.fallbackStorage.delete(sessionId);
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup sessions:', error);
      return 0;
    }
  }

  // Fallback in-memory storage for when Redis is unavailable
  private fallbackStorage = new Map<string, EnhancedProcessingSession>();
}