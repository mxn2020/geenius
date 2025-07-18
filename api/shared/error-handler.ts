// netlify/functions/shared/error-handler.ts
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ErrorHandler {
  static async handleError(error: any, sessionId?: string): Promise<{
    userMessage: string;
    logMessage: string;
    shouldRetry: boolean;
    context?: any;
  }> {
    // Log error details
    console.error('Agent Error:', {
      error: error.message,
      stack: error.stack,
      sessionId,
      timestamp: new Date().toISOString()
    });

    if (error instanceof AgentError) {
      return {
        userMessage: error.message,
        logMessage: `Agent Error [${error.code}]: ${error.message}`,
        shouldRetry: error.recoverable,
        context: error.context
      };
    }

    // Handle specific error types
    if (error.message?.includes('API key')) {
      return {
        userMessage: 'AI provider authentication failed. Please check configuration.',
        logMessage: `Authentication Error: ${error.message}`,
        shouldRetry: false
      };
    }

    if (error.message?.includes('rate limit')) {
      return {
        userMessage: 'Service temporarily overloaded. Please try again in a few minutes.',
        logMessage: `Rate Limit Error: ${error.message}`,
        shouldRetry: true
      };
    }

    if (error.message?.includes('GitHub')) {
      return {
        userMessage: 'GitHub operation failed. Repository access may be limited.',
        logMessage: `GitHub Error: ${error.message}`,
        shouldRetry: true
      };
    }

    if (error.message?.includes('sandbox') || error.message?.includes('StackBlitz')) {
      return {
        userMessage: 'Development environment error. Retrying with fresh sandbox.',
        logMessage: `Sandbox Error: ${error.message}`,
        shouldRetry: true
      };
    }

    // Generic error handling
    return {
      userMessage: 'An unexpected error occurred during processing.',
      logMessage: `Unexpected Error: ${error.message}`,
      shouldRetry: true
    };
  }

  static createRecoverableError(message: string, code: string, context?: any): AgentError {
    return new AgentError(message, code, context, true);
  }

  static createFatalError(message: string, code: string, context?: any): AgentError {
    return new AgentError(message, code, context, false);
  }
}

