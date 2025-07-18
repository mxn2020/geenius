// netlify/functions/shared/security-validator.ts
export class SecurityValidator {
  static validateRepositoryUrl(url: string): boolean {
    // Only allow GitHub repositories
    const githubPattern = /^https:\/\/github\.com\/[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_\.]+(?:\.git)?$/;
    return githubPattern.test(url);
  }

  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"'&]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .trim();
  }

  static validateChangeRequest(change: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!change.id || typeof change.id !== 'string') {
      errors.push('Change ID is required and must be a string');
    }

    if (!change.componentId || typeof change.componentId !== 'string') {
      errors.push('Component ID is required and must be a string');
    }

    if (!change.feedback || typeof change.feedback !== 'string') {
      errors.push('Feedback is required and must be a string');
    }

    if (change.feedback && change.feedback.length > 1000) {
      errors.push('Feedback must be less than 1000 characters');
    }

    const validCategories = ['styling', 'enhancement', 'behavior', 'performance', 'bug_fix', 'content'];
    if (!change.category || !validCategories.includes(change.category)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!change.priority || !validPriorities.includes(change.priority)) {
      errors.push(`Priority must be one of: ${validPriorities.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateGlobalContext(context: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.repositoryUrl || !this.validateRepositoryUrl(context.repositoryUrl)) {
      errors.push('Valid GitHub repository URL is required');
    }

    if (!context.projectId || typeof context.projectId !== 'string') {
      errors.push('Project ID is required and must be a string');
    }

    const validProviders = ['anthropic', 'openai', 'google', 'grok'];
    if (context.aiProvider && !validProviders.includes(context.aiProvider)) {
      errors.push(`AI provider must be one of: ${validProviders.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static checkPermissions(repoUrl: string, userToken?: string): Promise<boolean> {
    // In a real implementation, verify user has write access to the repository
    return Promise.resolve(true);
  }
}

