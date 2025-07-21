// netlify/functions/shared/redis-storage.ts
import { Redis } from '@upstash/redis';
import RedisKeys from './redis-keys';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Check if Redis is configured
const isRedisConfigured = () => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
};

export interface ProcessingSession {
  id: string;
  status: 'initializing' | 'sandbox_creating' | 'ai_processing' | 'testing' | 'pr_creating' | 'deploying' | 'completed' | 'failed';
  submissionId: string;
  projectId: string;
  repositoryUrl: string;
  changes: any[];
  deploymentLogs: Array<{
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: number;
    data?: any;
  }>;
  developmentLogs: Array<{
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: number;
    data?: any;
  }>;
  startTime: number;
  endTime?: number;
  prUrl?: string;
  branchName?: string;
  previewUrl?: string;
  error?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  template: string;
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  agentMode: 'single' | 'orchestrated' | 'hybrid';
  orchestrationStrategy?: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  githubOrg: string;
  repositoryUrl?: string;
  netlifyUrl?: string;
  mongodbOrgId?: string;
  mongodbProjectId?: string;
  mongodbDatabase?: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived' | 'failed';
}

export class RedisStorage {
  private redis: Redis;
  private sessionKeyPrefix = 'geenius:session:';
  private projectKeyPrefix = 'geenius:project:';

  constructor() {
    this.redis = redis;
  }

  // Generate unique session ID using new RedisKeys format
  generateSessionId(type: string = 'CHANGE_REQUEST', projectId?: string): string {
    return RedisKeys.generateSessionId(type as any, projectId);
  }

  // Store session data
  async setSession(sessionId: string, session: ProcessingSession): Promise<void> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.sessionKeyPrefix}${sessionId}`;
    try {
      const serializedSession = JSON.stringify(session);
      await this.redis.setex(key, 3600, serializedSession); // Expire after 1 hour
    } catch (error) {
      console.error('Error storing session data:', error);
      throw error;
    }
  }

  // Get session data
  async getSession(sessionId: string): Promise<ProcessingSession | null> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.sessionKeyPrefix}${sessionId}`;
    try {
      const data = await this.redis.get(key);
      
      if (!data) return null;
      
      // Handle case where data might be an object instead of string
      if (typeof data === 'object') {
        return data as ProcessingSession;
      }
      
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  // Add log to session (specify log type: deployment or development)
  async addLog(sessionId: string, level: 'info' | 'success' | 'warning' | 'error', message: string, logType: 'deployment' | 'development' = 'deployment', metadata?: Record<string, any>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      metadata
    };

    if (logType === 'deployment') {
      session.deploymentLogs.push(logEntry);
    } else {
      session.developmentLogs.push(logEntry);
    }

    await this.setSession(sessionId, session);
    console.log(`[${sessionId}] ${logType.toUpperCase()} ${level.toUpperCase()}: ${message}`, metadata || '');
  }

  // Update session status
  async updateSessionStatus(sessionId: string, status: ProcessingSession['status']): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.status = status;
    await this.setSession(sessionId, session);
  }

  // Get all sessions (for admin/monitoring) - OPTIMIZED with batch operations
  async getAllSessions(): Promise<ProcessingSession[]> {
    try {
      const keys = await this.redis.keys(`${this.sessionKeyPrefix}*`);
      
      if (keys.length === 0) {
        return [];
      }
      
      // Use batch operation to get all sessions at once - MUCH FASTER!
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      const sessions: ProcessingSession[] = [];
      
      if (results) {
        for (let i = 0; i < results.length; i++) {
          const [error, data] = results[i];
          if (!error && data) {
            try {
              const parsed = typeof data === 'string' ? JSON.parse(data) : data;
              sessions.push(parsed);
            } catch (parseError) {
              console.error('Error parsing session data:', parseError);
            }
          }
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions - OPTIMIZED with batch operations
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    try {
      const keys = await this.redis.keys(`${this.sessionKeyPrefix}*`);
      
      if (keys.length === 0) {
        return;
      }
      
      // Use batch operation to get all sessions at once
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      const keysToDelete: string[] = [];
      
      if (results) {
        for (let i = 0; i < results.length; i++) {
          const [error, data] = results[i];
          const key = keys[i];
          
          if (error || !data) {
            // If there's an error or no data, mark for deletion
            keysToDelete.push(key);
          } else {
            try {
              const session = typeof data === 'string' ? JSON.parse(data) : data;
              if (now - session.startTime > maxAge) {
                keysToDelete.push(key);
              }
            } catch (parseError) {
              // If we can't parse the session, delete it
              keysToDelete.push(key);
            }
          }
        }
      }
      
      // Batch delete expired sessions
      if (keysToDelete.length > 0) {
        const deletePipeline = this.redis.pipeline();
        keysToDelete.forEach(key => deletePipeline.del(key));
        await deletePipeline.exec();
        console.log(`Cleaned up ${keysToDelete.length} expired sessions`);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // PROJECT DATA METHODS

  // Generate unique project ID using new RedisKeys format
  generateProjectId(): string {
    return RedisKeys.generateProjectId();
  }

  // Store project data
  async setProject(projectId: string, project: ProjectData): Promise<void> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.projectKeyPrefix}${projectId}`;
    try {
      const serializedProject = JSON.stringify(project);
      await this.redis.setex(key, 30 * 24 * 3600, serializedProject); // Expire after 30 days
    } catch (error) {
      console.error('Error storing project data:', error);
      throw error;
    }
  }

  // Alias for setProject to maintain compatibility with ProjectWorkflow
  async storeProject(projectId: string, project: ProjectData): Promise<void> {
    return this.setProject(projectId, project);
  }

  // Get project data
  async getProject(projectId: string): Promise<ProjectData | null> {
    if (!isRedisConfigured()) {
      throw new Error('Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.');
    }
    
    const key = `${this.projectKeyPrefix}${projectId}`;
    try {
      const data = await this.redis.get(key);
      
      if (!data) return null;
      
      // Handle case where data might be an object instead of string
      if (typeof data === 'object') {
        return data as ProjectData;
      }
      
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing project data:', error);
      return null;
    }
  }

  // Get project by name (useful for status lookup) - Optimized with batch fetching
  async getProjectByName(projectName: string): Promise<ProjectData | null> {
    try {
      const keys = await this.redis.keys(`${this.projectKeyPrefix}*`);
      
      if (keys.length === 0) {
        return null;
      }
      
      // Batch fetch all projects in a single call to reduce API calls from N to 1
      const projectDataArray = await this.redis.mget(...keys);
      
      for (let i = 0; i < projectDataArray.length; i++) {
        const data = projectDataArray[i];
        if (data) {
          try {
            const project = typeof data === 'string' ? JSON.parse(data) : data;
            if (project.name === projectName) {
              return project;
            }
          } catch (error) {
            console.error('Error parsing project data:', error);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting project by name:', error);
      return null;
    }
  }

  // Update project deployment URLs
  async updateProjectDeployment(projectId: string, deploymentData: {
    repositoryUrl?: string;
    netlifyUrl?: string;
    mongodbDatabase?: string;
  }): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    // Update only provided fields
    if (deploymentData.repositoryUrl) project.repositoryUrl = deploymentData.repositoryUrl;
    if (deploymentData.netlifyUrl) project.netlifyUrl = deploymentData.netlifyUrl;
    if (deploymentData.mongodbDatabase) project.mongodbDatabase = deploymentData.mongodbDatabase;
    
    project.updatedAt = Date.now();
    await this.setProject(projectId, project);
  }

  // Get all projects (for admin/monitoring) - OPTIMIZED with batch operations
  async getAllProjects(): Promise<ProjectData[]> {
    try {
      const keys = await this.redis.keys(`${this.projectKeyPrefix}*`);
      
      if (keys.length === 0) {
        return [];
      }
      
      // Use batch operation to get all projects at once - MUCH FASTER!
      const projectDataArray = await this.redis.mget(...keys);
      
      const projects: ProjectData[] = [];
      
      for (let i = 0; i < projectDataArray.length; i++) {
        const data = projectDataArray[i];
        if (data) {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            projects.push(parsed);
          } catch (parseError) {
            console.error('Error parsing project data:', parseError);
          }
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }
}

export const storage = new RedisStorage();