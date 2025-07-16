// src/utils/validation.ts
import { z } from 'zod';

// Common validation schemas
export const ApiKeySchema = z.string().min(10, 'API key must be at least 10 characters');
export const ProjectNameSchema = z.string().min(1).max(50).regex(/^[a-zA-Z0-9-_]+$/, 'Project name must contain only letters, numbers, hyphens, and underscores');
export const GitHubUrlSchema = z.string().url().refine(url => url.includes('github.com'), 'Must be a valid GitHub URL');
export const EmailSchema = z.string().email();

// CLI input validation
export const InitCommandSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  projectName: ProjectNameSchema,
  githubOrg: z.string().min(1, 'GitHub organization is required'),
  aiProvider: z.enum(['anthropic', 'openai', 'google', 'grok']),
  agentMode: z.enum(['single', 'orchestrated', 'hybrid']),
  orchestrationStrategy: z.enum(['sequential', 'parallel', 'hierarchical', 'collaborative']).optional(),
  apiKey: ApiKeySchema,
  model: z.string().optional(),
  autoSetup: z.boolean().default(true),
  netlifyTeam: z.string().optional()
});

export const DevelopCommandSchema = z.object({
  featureName: z.string().min(1, 'Feature name is required'),
  taskDescription: z.string().min(10, 'Task description must be at least 10 characters'),
  complexity: z.enum(['simple', 'medium', 'complex']).default('medium'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  preferredMode: z.enum(['single', 'orchestrated', 'auto']).default('auto'),
  maxIterations: z.number().min(1).max(20).default(10)
});

export class ValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateInput<T>(schema: z.ZodSchema<T>, input: any): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new ValidationError('Validation failed', errors);
    }
    throw error;
  }
}

export function validateApiKey(provider: string, apiKey: string): boolean {
  const patterns = {
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-_]{90,}$/,
    google: /^[a-zA-Z0-9-_]{39}$/,
    grok: /^xai-[a-zA-Z0-9-_]{32,}$/
  };

  const pattern = patterns[provider];
  return pattern ? pattern.test(apiKey) : apiKey.length >= 10;
}

export function validateProjectName(name: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (name.length < 1) {
    errors.push('Project name cannot be empty');
  }
  
  if (name.length > 50) {
    errors.push('Project name cannot exceed 50 characters');
  }
  
  if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
    errors.push('Project name must contain only letters, numbers, hyphens, and underscores');
  }
  
  if (name.startsWith('-') || name.endsWith('-')) {
    errors.push('Project name cannot start or end with a hyphen');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateGitHubUrl(url: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') {
      errors.push('URL must be from github.com');
    }
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      errors.push('URL must include owner and repository name');
    }
  } catch {
    errors.push('Invalid URL format');
  }
  
  return { valid: errors.length === 0, errors };
}

