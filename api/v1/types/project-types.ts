// Project initialization types and interfaces

export interface ProjectInitRequest {
  // Support both new and legacy parameter formats
  userRequirements?: string;        // "doctor website with client and appointment management"
  projectRequirements?: string;     // Legacy parameter name (same as userRequirements)
  businessDomain?: string;          // "medical", "legal", "restaurant", etc.
  projectId?: string;               // Unique identifier for the project
  repositoryUrl?: string;           // Target template repository
  aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
  baseBranch?: string;             // Usually 'main' or 'develop'
  
  // Web UI compatibility parameters
  projectName?: string;             // Project name from web UI
  templateId?: string;              // Template ID from web UI
  githubOrg?: string;               // GitHub organization from web UI
  agentMode?: string;               // Agent mode from web UI
  orchestrationStrategy?: string;   // Orchestration strategy from web UI
  model?: string;                   // AI model from web UI
  autoSetup?: boolean;              // Auto setup flag from web UI
  mongodbOrgId?: string;            // MongoDB org ID from web UI
  mongodbProjectId?: string;        // MongoDB project ID from web UI
}

export interface ProjectInitResponse {
  success: boolean;
  sessionId: string;
  message: string;
  statusUrl: string;
  generatedFiles: string[];
  estimatedProcessingTime: number;
  error?: string;
}

export interface ParsedError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  type: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown';
}

export interface FileFix {
  file: string;
  oldContent: string;
  newContent: string;
  description: string;
}

export interface DeploymentErrorInfo {
  errorType: 'typescript' | 'build' | 'dependency' | 'config' | 'unknown';
  errors: ParsedError[];
  buildLog: string;
  canFix: boolean;
}

export interface TemplateFileContent {
  path: string;
  content: string;
  purpose: string; // Description of what this file does
}

export interface ProjectInfrastructure {
  mongodbProject?: any;
  netlifyProject?: any;
}

export interface WorkflowContext {
  sessionId: string;
  request: ProjectInitRequest;
  infrastructure: ProjectInfrastructure;
  template?: any;
}