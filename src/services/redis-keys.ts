// Redis Key Management for Geenius Platform
// Centralized key pattern management with clear separation between projects and sessions

export class RedisKeys {
  // Base prefixes
  private static readonly BASE_PREFIX = 'geenius';
  
  // TTL Constants (in seconds)
  public static readonly TTL = {
    PROJECT: 30 * 24 * 60 * 60,        // 30 days - persistent project data
    SESSION: 7 * 24 * 60 * 60,         // 7 days - session lifecycle  
    LOG: 7 * 24 * 60 * 60,             // 7 days - match session lifecycle
    TEMP: 60 * 60,                     // 1 hour - temporary data
    PERMANENT: -1                       // Never expire
  } as const;

  // Session Types
  public static readonly SESSION_TYPES = {
    INIT: 'init',                       // Project initialization
    DEPLOYMENT: 'deploy',               // Template deployment
    DEVELOPMENT: 'dev',                 // AI development requests
    CHANGE_REQUEST: 'change',           // External change requests
    TEST: 'test'                       // Testing sessions
  } as const;

  // Project Keys
  public static project(projectId: string): string {
    return `${this.BASE_PREFIX}:project:${projectId}`;
  }

  public static projectSessions(projectId: string): string {
    return `${this.BASE_PREFIX}:project:${projectId}:sessions`;
  }

  public static projectMetadata(projectId: string): string {
    return `${this.BASE_PREFIX}:project:${projectId}:metadata`;
  }

  public static allProjects(): string {
    return `${this.BASE_PREFIX}:project:*`;
  }

  // Session Keys
  public static session(sessionId: string): string {
    return `${this.BASE_PREFIX}:session:${sessionId}`;
  }

  public static sessionLogs(sessionId: string): string {
    return `${this.BASE_PREFIX}:session:${sessionId}:logs`;
  }

  public static sessionLog(sessionId: string, timestamp: number, id: string): string {
    return `${this.BASE_PREFIX}:session:${sessionId}:logs:${timestamp}:${id}`;
  }

  public static sessionStatus(sessionId: string): string {
    return `${this.BASE_PREFIX}:session:${sessionId}:status`;
  }

  public static allSessions(): string {
    return `${this.BASE_PREFIX}:session:*`;
  }

  public static sessionsByProject(projectId: string): string {
    return `${this.BASE_PREFIX}:session:*:project:${projectId}`;
  }

  public static sessionsByType(sessionType: string): string {
    return `${this.BASE_PREFIX}:session:*:type:${sessionType}`;
  }

  // ID Generation
  public static generateProjectId(): string {
    const yearMonth = this.getYearMonth();
    const random = Math.random().toString(36).substr(2, 8);
    return `proj_${yearMonth}_${random}`;
  }

  public static generateSessionId(type: keyof typeof RedisKeys.SESSION_TYPES, projectId?: string): string {
    const sessionType = this.SESSION_TYPES[type];
    const yearMonth = this.getYearMonth();
    const random = Math.random().toString(36).substr(2, 8);
    
    if (projectId) {
      return `${sessionType}_${projectId}_${yearMonth}_${random}`;
    }
    return `${sessionType}_${yearMonth}_${random}`;
  }

  // Helper to generate short year-month format (e.g., "2510" for 2025-10)
  private static getYearMonth(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01-12
    return `${year}${month}`;
  }

  // Pattern matching helpers
  public static parseSessionId(sessionId: string): {
    type: string;
    projectId?: string;
    yearMonth: string;
    random: string;
  } | null {
    const parts = sessionId.split('_');
    if (parts.length < 3) return null;

    const [type, ...rest] = parts;
    
    if (rest.length === 2) {
      // Format: type_yearMonth_random
      const [yearMonth, random] = rest;
      return { type, yearMonth, random };
    } else if (rest.length === 3) {
      // Format: type_projectId_yearMonth_random
      const [projectId, yearMonth, random] = rest;
      return { type, projectId, yearMonth, random };
    }
    
    return null;
  }

  public static getProjectIdFromSessionId(sessionId: string): string | null {
    const parsed = this.parseSessionId(sessionId);
    return parsed?.projectId || null;
  }

  public static getSessionType(sessionId: string): string | null {
    const parsed = this.parseSessionId(sessionId);
    return parsed?.type || null;
  }

  // Query patterns
  public static patterns = {
    // Get all sessions for a specific project
    PROJECT_SESSIONS: (projectId: string) => `${this.BASE_PREFIX}:session:*_${projectId}_*`,
    
    // Get all sessions of a specific type
    SESSION_TYPE: (type: string) => `${this.BASE_PREFIX}:session:${type}_*`,
    
    // Get all logs for a session
    SESSION_LOGS: (sessionId: string) => `${this.BASE_PREFIX}:session:${sessionId}:logs:*`,
    
    // Get all projects
    ALL_PROJECTS: `${this.BASE_PREFIX}:project:*`,
    
    // Get all sessions
    ALL_SESSIONS: `${this.BASE_PREFIX}:session:*`
  };

  // Validation helpers
  public static isValidProjectId(projectId: string): boolean {
    return projectId.startsWith('proj_') && projectId.split('_').length === 3;
  }

  public static isValidSessionId(sessionId: string): boolean {
    const parsed = this.parseSessionId(sessionId);
    return parsed !== null && Object.values(this.SESSION_TYPES).includes(parsed.type as any);
  }

  // Date helpers
  public static parseYearMonth(yearMonth: string): { year: number; month: number } | null {
    if (yearMonth.length !== 4) return null;
    
    const year = parseInt('20' + yearMonth.slice(0, 2)); // Convert "25" to 2025
    const month = parseInt(yearMonth.slice(2, 4)); // Extract month
    
    if (month < 1 || month > 12) return null;
    
    return { year, month };
  }

  // Migration helpers for existing keys
  public static legacy = {
    // Legacy key patterns for migration
    SESSION: (sessionId: string) => `geenius:session:${sessionId}`,
    ENHANCED_SESSION: (sessionId: string) => `geenius:enhanced:session:${sessionId}`,
    LOGS: (sessionId: string) => `geenius:logs:${sessionId}:*`,
    PROJECT: (projectId: string) => `geenius:project:${projectId}`,
    
    // Check if a key uses legacy pattern
    isLegacyKey: (key: string): boolean => {
      return key.startsWith('geenius:session:') || 
             key.startsWith('geenius:enhanced:session:') ||
             key.startsWith('geenius:logs:') ||
             (key.startsWith('geenius:project:') && !key.includes(':sessions') && !key.includes(':metadata'));
    }
  };
}

export default RedisKeys;