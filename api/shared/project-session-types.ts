// Clean separation between Projects and Sessions
// Projects are persistent entities, Sessions are temporal operations

import { RedisKeys } from './redis-keys';

// =============================================================================
// PROJECT DEFINITIONS - Persistent project configuration and metadata
// =============================================================================

export interface Project {
  // Core identification
  id: string;                              // proj_timestamp_random
  name: string;                           // User-friendly project name
  
  // Technical configuration
  template: string;                       // Template used (vite-react-mongo, etc.)
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  agentMode: 'single' | 'orchestrated' | 'hybrid';
  orchestrationStrategy?: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  
  // External integrations
  github: {
    org: string;
    repository?: string;
    repositoryUrl?: string;
  };
  
  netlify: {
    projectId?: string;
    url?: string;
    deploymentUrl?: string;
  };
  
  mongodb: {
    orgId?: string;
    projectId?: string;
    database?: string;
    connectionString?: string;
  };
  
  // Project lifecycle
  status: 'initializing' | 'active' | 'archived' | 'failed';
  createdAt: number;
  updatedAt: number;
  
  // Session tracking (references only)
  sessions: {
    initialization?: string;              // Session ID of project setup
    latest?: string;                     // Most recent session
    active?: string[];                   // Currently running sessions
  };
  
  // Project statistics (computed from sessions)
  stats: {
    totalSessions: number;
    successfulDeployments: number;
    failedDeployments: number;
    lastActivity: number;
  };
}

// =============================================================================
// SESSION DEFINITIONS - Temporal operations on projects
// =============================================================================

export interface BaseSession {
  // Core identification
  id: string;                            // Generated with RedisKeys.generateSessionId()
  projectId: string;                     // Reference to parent project
  type: keyof typeof RedisKeys.SESSION_TYPES;
  
  // Session lifecycle
  status: SessionStatus;
  progress: number;                      // 0-100
  currentStep: string;
  
  // Timing
  startTime: number;
  endTime?: number;
  estimatedCompletionTime?: number;
  
  // Results
  error?: string;
  retryInfo?: RetryInfo;
  
  // Change tracking
  changes: ChangeRequest[];
  
  // Logging
  logCount: number;                      // Number of log entries (stored separately)
}

export type SessionStatus = 
  | 'pending'           // Queued but not started
  | 'initializing'      // Setting up resources
  | 'processing'        // Main work in progress  
  | 'testing'          // Running tests
  | 'deploying'        // Creating deployment
  | 'completed'        // Successfully finished
  | 'failed'           // Terminated with error
  | 'cancelled';       // User cancelled

// =============================================================================
// SPECIFIC SESSION TYPES
// =============================================================================

// Project initialization session
export interface InitializationSession extends BaseSession {
  type: 'INIT';
  
  // Initialization-specific data
  template: string;
  aiProvider: string;
  agentMode: string;
  
  // Creation results
  created: {
    githubRepo?: {
      url: string;
      branch: string;
    };
    netlifyProject?: {
      id: string;
      url: string;
    };
    mongodbDatabase?: {
      name: string;
      connectionString: string;
    };
  };
}

// Template deployment session
export interface DeploymentSession extends BaseSession {
  type: 'DEPLOYMENT';
  
  // Deployment-specific data
  branchName?: string;
  commitSha?: string;
  prUrl?: string;
  prNumber?: number;
  previewUrl?: string;
  
  // File processing
  fileGroups: FileProcessingInfo[];
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  
  // Test results
  testResults?: TestResults;
  
  // AI processing
  aiProvider: string;
  baseBranch: string;
  autoTest: boolean;
  commits: CommitInfo[];
}

// Development session (direct AI requests)
export interface DevelopmentSession extends BaseSession {
  type: 'DEVELOPMENT';
  
  // Development request details
  requestType: 'feature' | 'bugfix' | 'refactor' | 'optimization';
  description: string;
  requirements: string[];
  
  // AI processing
  aiProvider: string;
  agentMode: string;
  
  // Code generation results
  generatedFiles: GeneratedFile[];
  modifiedFiles: ModifiedFile[];
}

// Change request session (from template apps)
export interface ChangeRequestSession extends BaseSession {
  type: 'CHANGE_REQUEST';
  
  // Request source
  submissionId: string;
  sourceApp: string;
  
  // External processing
  repositoryUrl: string;
  baseBranch: string;
  
  // Processing results
  branchName?: string;
  prUrl?: string;
  prNumber?: number;
  previewUrl?: string;
}

// Testing session
export interface TestSession extends BaseSession {
  type: 'TEST';
  
  // Test configuration
  testSuite: string;
  testFiles: string[];
  
  // Test results
  results: {
    passed: number;
    failed: number;
    skipped: number;
    coverage?: number;
    duration: number;
  };
}

// Union type for all session types
export type Session = 
  | InitializationSession 
  | DeploymentSession 
  | DevelopmentSession 
  | ChangeRequestSession 
  | TestSession;

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

export interface ChangeRequest {
  id: string;
  description: string;
  files: FileChange[];
  priority: 'low' | 'medium' | 'high';
  estimatedEffort: number; // minutes
}

export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  content?: string;
  lineChanges?: LineChange[];
}

export interface LineChange {
  line: number;
  type: 'add' | 'remove' | 'modify';
  content: string;
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

export interface TestResults {
  status: 'passed' | 'failed' | 'partial';
  passed: number;
  failed: number;
  skipped: number;
  coverage?: number;
  duration: number;
  failedTests?: string[];
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: number;
  filesChanged: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ModifiedFile {
  path: string;
  originalContent: string;
  modifiedContent: string;
  changes: LineChange[];
}

// =============================================================================
// LOG TYPES - Stored separately from sessions
// =============================================================================

export interface SessionLog {
  id: string;                           // Unique log entry ID
  sessionId: string;                    // Parent session
  level: 'debug' | 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  component?: string;                   // Which component generated the log
  metadata?: Record<string, any>;      // Additional context
  tags?: string[];                     // Searchable tags
}

// =============================================================================
// RELATIONSHIP HELPERS
// =============================================================================

export class ProjectSessionManager {
  // Get all sessions for a project
  static async getProjectSessions(projectId: string): Promise<Session[]> {
    // Implementation would use RedisKeys.patterns.PROJECT_SESSIONS(projectId)
    throw new Error('Not implemented');
  }
  
  // Get sessions by type for a project
  static async getProjectSessionsByType(projectId: string, type: keyof typeof RedisKeys.SESSION_TYPES): Promise<Session[]> {
    throw new Error('Not implemented');
  }
  
  // Get active sessions for a project
  static async getActiveProjectSessions(projectId: string): Promise<Session[]> {
    throw new Error('Not implemented');
  }
  
  // Add session to project tracking
  static async linkSessionToProject(projectId: string, sessionId: string): Promise<void> {
    throw new Error('Not implemented');
  }
  
  // Update project statistics from session completion
  static async updateProjectStats(projectId: string, session: Session): Promise<void> {
    throw new Error('Not implemented');
  }
}

// =============================================================================
// UI DATA STRUCTURES - What the frontend needs
// =============================================================================

export interface ProjectSummary {
  project: Project;
  activeSessions: BaseSession[];
  recentSessions: BaseSession[];
  sessionCounts: Record<string, number>; // By type
}

export interface SessionSummary {
  session: Session;
  project: Pick<Project, 'id' | 'name' | 'template'>;
  logCount: number;
  recentLogs: SessionLog[];
}

export interface LogsViewData {
  project: Pick<Project, 'id' | 'name'>;
  availableSessions: {
    id: string;
    type: string;
    status: SessionStatus;
    startTime: number;
    description: string;
  }[];
  selectedSession?: Session;
  logs: SessionLog[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
}

export default {
  RedisKeys,
  ProjectSessionManager
};