// src/types/agent.ts
export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'grok';
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AgentMemory {
  conversation: Array<{ role: string; content: string; timestamp: number }>;
  projectContext: {
    structure: string;
    dependencies: Record<string, string>;
    framework: string;
    lastAnalysis: string;
  };
  taskHistory: Array<{
    task: string;
    approach: string;
    result: string;
    success: boolean;
    timestamp: number;
  }>;
  codePatterns: Array<{
    pattern: string;
    context: string;
    effectiveness: number;
  }>;
}

export interface AgentPlan {
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    type: 'analyze' | 'code' | 'test' | 'refactor' | 'document';
    dependencies: string[];
    estimatedTime: number;
    tools: string[];
  }>;
  constraints: string[];
  successCriteria: string[];
}

export interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  specialization: 'planning' | 'coding' | 'testing' | 'reviewing' | 'documenting';
}

export interface AgentTeam {
  lead: any; // CustomAIAgent type
  members: Map<string, any>; // Map<string, CustomAIAgent>
  roles: Map<string, AgentRole>;
}

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[];
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  startTime?: number;
  endTime?: number;
}

export interface OrchestrationStrategy {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  maxConcurrency: number;
  retryOnFailure: boolean;
  crossValidation: boolean;
}

export interface AgentMode {
  type: 'single' | 'orchestrated' | 'hybrid';
  provider: 'openai' | 'anthropic' | 'google' | 'grok' | 'custom';
  orchestrationStrategy?: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
}

export interface DevelopmentResult {
  success: boolean;
  result: any;
  approach: string;
  agentContributions?: Map<string, any>;
  timeline?: Array<{ timestamp: number; event: string; agent: string }>;
}

