// Project Initialization Context Provider
// Centralized state management for the entire project initialization workflow

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
export interface ProjectInitState {
  // Current workflow state
  currentStep: 'init' | 'status' | 'develop' | 'logs';
  isProcessing: boolean;
  
  // Project configuration
  projectName: string;
  templateId: string;
  userRequirements: string;
  businessDomain: string;
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  model: string;
  
  // Infrastructure settings
  githubOrg: string;
  autoSetup: boolean;
  mongodbOrgId: string;
  mongodbProjectId: string;
  
  // AI Processing configuration (default: true)
  useAIProcessing: boolean;
  
  // Session and status
  sessionId: string | null;
  progress: number;
  status: string;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  
  // Logs and messages
  logs: LogEntry[];
  
  // Error state
  error: string | null;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: any;
}

// Actions
export type ProjectInitAction =
  | { type: 'SET_STEP'; payload: ProjectInitState['currentStep'] }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_PROJECT_CONFIG'; payload: Partial<Pick<ProjectInitState, 'projectName' | 'templateId' | 'userRequirements' | 'businessDomain'>> }
  | { type: 'SET_AI_CONFIG'; payload: Partial<Pick<ProjectInitState, 'aiProvider' | 'model'>> }
  | { type: 'SET_INFRASTRUCTURE_CONFIG'; payload: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId' | 'useAIProcessing'>> }
  | { type: 'SET_SESSION'; payload: { sessionId: string; progress: number; status: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { progress: number; status: string } }
  | { type: 'SET_REPOSITORY_URL'; payload: string }
  | { type: 'SET_DEPLOYMENT_URL'; payload: string }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SYNC_SESSION_STATUS'; payload: { status: string; progress: number; repoUrl?: string; netlifyUrl?: string } }
  | { type: 'RESET_STATE' };

// Generate random project name
const generateProjectName = (): string => {
  const adjectives = ['awesome', 'brilliant', 'creative', 'dynamic', 'elegant', 'fantastic', 'genius', 'innovative', 'modern', 'smart'];
  const nouns = ['app', 'platform', 'project', 'solution', 'system', 'tool', 'workspace', 'hub', 'studio', 'portal'];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${randomAdjective}-${randomNoun}`;
};

// Initial state
const initialState: ProjectInitState = {
  currentStep: 'init',
  isProcessing: false,
  projectName: generateProjectName(),
  templateId: 'vite-react-mongo',
  userRequirements: '',
  businessDomain: '',
  aiProvider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  githubOrg: '',
  autoSetup: true,
  mongodbOrgId: '',
  mongodbProjectId: 'CREATE_NEW', // Pre-select new project creation
  useAIProcessing: true, // Default to AI processing
  sessionId: null,
  progress: 0,
  status: 'Ready for AI-powered deployment',
  repositoryUrl: null,
  deploymentUrl: null,
  logs: [],
  error: null,
};

// Reducer
function projectInitReducer(state: ProjectInitState, action: ProjectInitAction): ProjectInitState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    
    case 'SET_PROJECT_CONFIG':
      return { ...state, ...action.payload };
    
    case 'SET_AI_CONFIG':
      return { ...state, ...action.payload };
    
    case 'SET_INFRASTRUCTURE_CONFIG':
      return { ...state, ...action.payload };
    
    case 'SET_SESSION':
      return { 
        ...state, 
        sessionId: action.payload.sessionId,
        progress: action.payload.progress,
        status: action.payload.status
      };
    
    case 'UPDATE_PROGRESS':
      return { 
        ...state, 
        progress: action.payload.progress,
        status: action.payload.status
      };
    
    case 'SET_REPOSITORY_URL':
      return { ...state, repositoryUrl: action.payload };
    
    case 'SET_DEPLOYMENT_URL':
      return { ...state, deploymentUrl: action.payload };
    
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SYNC_SESSION_STATUS':
      // Only update if values have actually changed
      const newIsProcessing = !['completed', 'failed', 'error'].includes(action.payload.status);
      const newDeploymentUrl = action.payload.netlifyUrl || state.deploymentUrl;
      const newRepositoryUrl = action.payload.repoUrl || state.repositoryUrl;
      
      if (state.status === action.payload.status && 
          state.progress === action.payload.progress &&
          state.isProcessing === newIsProcessing &&
          state.deploymentUrl === newDeploymentUrl &&
          state.repositoryUrl === newRepositoryUrl) {
        return state; // No changes, return same state object
      }
      
      return { 
        ...state, 
        status: action.payload.status,
        progress: action.payload.progress,
        isProcessing: newIsProcessing,
        repositoryUrl: newRepositoryUrl,
        deploymentUrl: newDeploymentUrl
      };
    
    case 'RESET_STATE':
      return { ...initialState };
    
    default:
      return state;
  }
}

// Context
interface ProjectInitContextType {
  state: ProjectInitState;
  dispatch: React.Dispatch<ProjectInitAction>;
  
  // Convenience methods
  setStep: (step: ProjectInitState['currentStep']) => void;
  setProcessing: (processing: boolean) => void;
  updateProjectConfig: (config: Partial<Pick<ProjectInitState, 'projectName' | 'templateId' | 'userRequirements' | 'businessDomain'>>) => void;
  updateAIConfig: (config: Partial<Pick<ProjectInitState, 'aiProvider' | 'model'>>) => void;
  updateInfrastructureConfig: (config: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId' | 'useAIProcessing'>>) => void;
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  setRepositoryUrl: (url: string) => void;
  syncSessionStatus: (status: string, progress: number, repoUrl?: string, netlifyUrl?: string) => void;
  
  // Workflow methods
  startInitialization: (userRequirements?: string) => Promise<void>;
  pollStatus: (sessionId: string) => Promise<void>;
}

const ProjectInitContext = createContext<ProjectInitContextType | null>(null);

// Provider component
interface ProjectInitProviderProps {
  children: ReactNode;
}

export const ProjectInitProvider: React.FC<ProjectInitProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(projectInitReducer, initialState);

  // Initialize from URL parameters if session exists (only run once on mount)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = urlParams.get('session');
    
    if (sessionIdFromUrl && !state.sessionId) {
      // Set session and move to processing view
      dispatch({ 
        type: 'SET_SESSION', 
        payload: { 
          sessionId: sessionIdFromUrl.trim(), // Remove any trailing spaces
          progress: 10, 
          status: 'Loading session...' 
        } 
      });
      dispatch({ type: 'SET_STEP', payload: 'status' });
    }
  }, []); // Empty dependency array - only run once on mount

  // Convenience methods
  const setStep = (step: ProjectInitState['currentStep']) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const setProcessing = (processing: boolean) => {
    dispatch({ type: 'SET_PROCESSING', payload: processing });
  };

  const updateProjectConfig = (config: Partial<Pick<ProjectInitState, 'projectName' | 'templateId' | 'userRequirements' | 'businessDomain'>>) => {
    dispatch({ type: 'SET_PROJECT_CONFIG', payload: config });
  };

  const updateAIConfig = (config: Partial<Pick<ProjectInitState, 'aiProvider' | 'model'>>) => {
    dispatch({ type: 'SET_AI_CONFIG', payload: config });
  };

  const updateInfrastructureConfig = (config: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId' | 'useAIProcessing'>>) => {
    dispatch({ type: 'SET_INFRASTRUCTURE_CONFIG', payload: config });
  };

  const addLog = (log: Omit<LogEntry, 'timestamp'>) => {
    dispatch({ 
      type: 'ADD_LOG', 
      payload: { 
        ...log, 
        timestamp: new Date().toISOString() 
      } 
    });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  const setRepositoryUrl = (url: string) => {
    dispatch({ type: 'SET_REPOSITORY_URL', payload: url });
  };

  const syncSessionStatus = (status: string, progress: number, repoUrl?: string, netlifyUrl?: string) => {
    dispatch({ 
      type: 'SYNC_SESSION_STATUS', 
      payload: { status, progress, repoUrl, netlifyUrl } 
    });
  };

  // Workflow methods
  const startInitialization = async (userRequirements?: string) => {
    try {
      setProcessing(true);
      setError(null);
      
      const initMessage = state.useAIProcessing 
        ? 'Starting AI-powered project initialization...' 
        : 'Starting standard project initialization...';
      addLog({ level: 'info', message: initMessage });

      // Choose endpoint based on AI processing preference
      const endpoint = state.useAIProcessing ? '/api/initialize-project' : '/api/init';
      
      // Use provided userRequirements or fallback to state
      const finalUserRequirements = userRequirements || state.userRequirements;
      
      const requestData = state.useAIProcessing ? {
        // AI-powered initialization parameters
        userRequirements: finalUserRequirements.trim(),
        businessDomain: state.businessDomain.trim(),
        aiProvider: state.aiProvider,
        projectName: state.projectName.trim(),
        templateId: state.templateId.trim(),
        githubOrg: state.githubOrg.trim(),
        agentMode: 'single',
        model: state.model,
        autoSetup: state.autoSetup,
        mongodbOrgId: state.mongodbOrgId.trim(),
        mongodbProjectId: state.mongodbProjectId.trim(),
      } : {
        // Standard initialization parameters (legacy format)
        projectName: state.projectName.trim(),
        templateId: state.templateId.trim(),
        projectRequirements: finalUserRequirements.trim(),
        githubOrg: state.githubOrg.trim(),
        agentMode: 'single',
        autoSetup: state.autoSetup,
        mongodbOrgId: state.mongodbOrgId.trim(),
        mongodbProjectId: state.mongodbProjectId.trim(),
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok && result.sessionId) {
        dispatch({ 
          type: 'SET_SESSION', 
          payload: { 
            sessionId: result.sessionId.trim(), // Remove any trailing spaces
            progress: 10, 
            status: 'Initialization started' 
          } 
        });
        
        const sessionMessage = state.useAIProcessing 
          ? `AI-powered session created: ${result.sessionId}` 
          : `Session created: ${result.sessionId}`;
        addLog({ level: 'success', message: sessionMessage });
        
        // If repository URL is in the response, set it
        if (result.repositoryUrl) {
          setRepositoryUrl(result.repositoryUrl);
        }
        
        setStep('status'); // This will map to 'processing' view - transition handled by ChatInterface
        
        // Trigger the existing log streaming system from useAppState
        // This will be handled in the ChatInterface component
      } else {
        throw new Error(result.error || result.message || `HTTP ${response.status}: Initialization failed`);
      }
    } catch (error: any) {
      setError(error.message);
      addLog({ level: 'error', message: `Initialization failed: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const pollStatus = async (sessionId: string) => {
    // Note: Polling is now handled by useAppState's startLogPolling
    // This method is kept for compatibility but delegates to the existing system
    
    // Set a timeout to stop processing state after reasonable time
    setTimeout(() => {
      setProcessing(false);
    }, 300000); // 5 minutes timeout
  };

  const contextValue: ProjectInitContextType = {
    state,
    dispatch,
    setStep,
    setProcessing,
    updateProjectConfig,
    updateAIConfig,
    updateInfrastructureConfig,
    addLog,
    setError,
    resetState,
    setRepositoryUrl,
    syncSessionStatus,
    startInitialization,
    pollStatus,
  };

  return (
    <ProjectInitContext.Provider value={contextValue}>
      {children}
    </ProjectInitContext.Provider>
  );
};

// Hook to use the context
export const useProjectInit = () => {
  const context = useContext(ProjectInitContext);
  if (!context) {
    throw new Error('useProjectInit must be used within a ProjectInitProvider');
  }
  return context;
};