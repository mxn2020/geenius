import { AgentMode } from "./agent";

// src/types/config.ts
export interface ProjectConfig {
  template: string;
  name: string;
  repoUrl: string;
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  agentMode: 'single' | 'orchestrated' | 'hybrid';
  orchestrationStrategy?: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  apiKey: string;
  model?: string;
  maxConcurrency?: number;
  crossValidation?: boolean;
  netlifyProject?: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitOptions {
  templateId: string;
  projectName: string;
  githubOrg: string;
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  agentMode: 'single' | 'orchestrated' | 'hybrid';
  orchestrationStrategy?: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  apiKey: string;
  model?: string;
  autoSetup: boolean;
  netlifyTeam?: string;
}

export interface DevelopOptions {
  featureName: string;
  taskDescription: string;
  complexity: 'simple' | 'medium' | 'complex';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  preferredMode: 'single' | 'orchestrated' | 'auto';
  maxIterations?: number;
}

export interface AgentAnalytics {
  mode: AgentMode;
  performance: {
    successRate: number;
    averageTime: number;
    tasksCompleted: number;
  };
  agentStats?: Map<string, any>;
  usage: {
    totalRequests: number;
    providerBreakdown: Map<string, number>;
  };
}

export interface ComparisonResult {
  results: Map<string, any>;
  bestApproach: string;
  comparison: {
    speed: Map<string, number>;
    quality: Map<string, number>;
    creativity: Map<string, number>;
  };
}

export interface MemoryStats {
  conversations: number;
  tasks: number;
  patterns: number;
  successRate: number;
}