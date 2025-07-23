// Session initialization step

import { EnhancedSessionManager } from '../../shared/enhanced-session-manager';
import { ProjectInitRequest, WorkflowContext } from '../types/project-types';

export class SessionStep {
  private sessionManager: EnhancedSessionManager;

  constructor() {
    this.sessionManager = new EnhancedSessionManager();
  }

  async execute(request: ProjectInitRequest): Promise<WorkflowContext> {
    console.log('[SESSION-STEP] Creating new session...');
    
    // Create session ID
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sessionId = `init_ai-${timestamp}_${process.pid}_${randomId}`;

    // Initialize session
    await this.sessionManager.createSession(sessionId, {
      projectName: request.projectName,
      userRequirements: request.userRequirements || request.projectRequirements,
      repositoryUrl: request.repositoryUrl,
      templateId: request.templateId,
      aiProvider: request.aiProvider || 'anthropic',
      model: request.model || 'claude-sonnet-4-20250514',
      status: 'initializing',
      progress: 0,
      startTime: new Date().toISOString()
    });

    await this.sessionManager.updateSessionStatus(
      sessionId, 
      'preparing', 
      10, 
      'Session created, preparing for AI-powered customization...'
    );

    console.log(`[SESSION-STEP] ✅ Session created: ${sessionId}`);

    return {
      sessionId,
      request,
      infrastructure: {}
    };
  }

  async logProgress(sessionId: string, level: 'info' | 'success' | 'warning' | 'error', message: string, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    if (data) {
      console.log('   Data:', data);
    }

    // Store in session logs
    const session = await this.sessionManager.getSession(sessionId);
    if (session) {
      if (!session.logs) session.logs = [];
      session.logs.push(logEntry);
      await this.sessionManager.setSession(sessionId, session);
    }
  }
}