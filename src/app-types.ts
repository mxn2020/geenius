// src/types.ts

export type EnvStatusType = {
  github: { configured: boolean; loading: boolean; error: string | null };
  netlify: { configured: boolean; loading: boolean; error: string | null };
  mongodb: { configured: boolean; loading: boolean; error: string | null };
};

export type TemplateType = { 
  id: string; 
  name: string; 
  description: string 
};

export type MongoDBOrganization = {
  organization: { id: string; name: string };
  projects: Array<{ id: string; name: string; clusters?: Array<any> }>;
};

export type GithubAccountType = { 
  login: string; 
  type: string; 
  description?: string 
};

export type SessionLog = {
  timestamp: string;
  level: string;
  message: string;
};

export type ProjectStatusType = {
  hasProject: boolean;
  loading: boolean;
  error?: string;
  status?: string;
  projectName?: string;
  projectId?: string;
  templateId?: string;
  aiProvider?: string;
  agentMode?: string;
  orchestrationStrategy?: string;
  githubOrg?: string;
  repositoryUrl?: string;
  netlifyUrl?: string;
  netlifyProject?: string;
  mongodbOrgId?: string;
  mongodbProjectId?: string;
  mongodbDatabase?: string;
  createdAt?: string;
  updatedAt?: string;
  // Session-specific fields
  isActiveSession?: boolean;
  sessionId?: string;
  sessionStatus?: string;
  progress?: number;
  currentStep?: string;
};

export interface AppHooks {
  envStatus: EnvStatusType;
  templates: TemplateType[];
  mongodbData: { available: boolean; organizations: MongoDBOrganization[] };
  githubAccounts: { available: boolean; accounts: GithubAccountType[]; loading: boolean };
  selectedOrg: string;
  setSelectedOrg: (org: string) => void;
  selectedProject: string;
  setSelectedProject: (project: string) => void;
  selectedGithubAccount: string;
  setSelectedGithubAccount: (account: string) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  agentMode: string;
  setAgentMode: (mode: string) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  deploymentStatus: string;
  setDeploymentStatus: (status: string) => void;
  sessionLogs: SessionLog[];
  setSessionLogs: React.Dispatch<React.SetStateAction<SessionLog[]>>;
  sessionStatus: string;
  setSessionStatus: (status: string) => void;
  sessionProgress: number;
  setSessionProgress: (progress: number) => void;
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  netlifyUrl: string;
  setNetlifyUrl: (url: string) => void;
  projectStatus: ProjectStatusType;
  setProjectStatus: React.Dispatch<React.SetStateAction<ProjectStatusType>>;
  // Functions
  addLog: (message: string, useCurrentTime?: boolean) => void;
  handleOrgChange: (orgId: string) => void;
  getSelectedOrgProjects: () => Array<{ id: string; name: string; clusters?: Array<any> }>;
  loadProjectStatus: () => Promise<void>;
  startLogStreaming: (sessionId: string, isNewSession?: boolean) => Promise<void>;
  stopLogPolling: () => void;
}

