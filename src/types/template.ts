// src/types/template.ts

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  repository: string;
  branch: string;
  stack: string[];
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok' | 'claude' | 'gemini';
  aiConfig: {
    model: string;
    tools: string[];
    systemPrompt: string;
  };
  features: string[];
  envVars: string[];
  testCommand: string;
  buildCommand: string;
  devCommand: string;
  deployCommand: string;
  documentation: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastUpdated: string;
  maintainer: string;
  license: string;
}

export interface AIEnabledTemplate extends ProjectTemplate {
  aiProvider: 'claude' | 'gemini' | 'openai' | 'grok';
  aiConfig: {
    model: string;
    tools: string[];
    systemPrompt: string;
  };
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  templates: string[];
}

export interface TemplateProvider {
  id: string;
  name: string;
  description: string;
  models: string[];
}

export interface TemplateRegistry {
  templates: ProjectTemplate[];
  categories: TemplateCategory[];
  providers: TemplateProvider[];
  meta: {
    lastUpdated: string;
    version: string;
    totalTemplates: number;
    registry: string;
  };
}

export interface TemplateValidation {
  valid: boolean;
  issues: string[];
  score: number;
  recommendations?: string[];
}

