// Project Initialization Context Provider
// Centralized state management for the entire project initialization workflow

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

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
  
  // Session and status
  sessionId: string | null;
  progress: number;
  status: string;
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
  | { type: 'SET_INFRASTRUCTURE_CONFIG'; payload: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId'>> }
  | { type: 'SET_SESSION'; payload: { sessionId: string; progress: number; status: string } }
  | { type: 'UPDATE_PROGRESS'; payload: { progress: number; status: string } }
  | { type: 'SET_DEPLOYMENT_URL'; payload: string }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: ProjectInitState = {
  currentStep: 'init',
  isProcessing: false,
  projectName: '',
  templateId: 'vite-react-mongo',
  userRequirements: '',
  businessDomain: '',
  aiProvider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  githubOrg: '',
  autoSetup: true,
  mongodbOrgId: '',
  mongodbProjectId: '',
  sessionId: null,
  progress: 0,
  status: 'Ready to start',
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
    
    case 'SET_DEPLOYMENT_URL':
      return { ...state, deploymentUrl: action.payload };
    
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
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
  updateInfrastructureConfig: (config: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId'>>) => void;
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // Workflow methods
  startInitialization: () => Promise<void>;
  pollStatus: (sessionId: string) => Promise<void>;
}

const ProjectInitContext = createContext<ProjectInitContextType | null>(null);

// Provider component
interface ProjectInitProviderProps {
  children: ReactNode;
}

export const ProjectInitProvider: React.FC<ProjectInitProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(projectInitReducer, initialState);

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

  const updateInfrastructureConfig = (config: Partial<Pick<ProjectInitState, 'githubOrg' | 'autoSetup' | 'mongodbOrgId' | 'mongodbProjectId'>>) => {
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

  // Workflow methods
  const startInitialization = async () => {
    try {
      setProcessing(true);
      setError(null);
      addLog({ level: 'info', message: 'Starting project initialization...' });

      const response = await fetch('/api/v1/initialize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: state.projectName,
          templateId: state.templateId,
          userRequirements: state.userRequirements,
          businessDomain: state.businessDomain,
          aiProvider: state.aiProvider,
          model: state.model,
          githubOrg: state.githubOrg,
          autoSetup: state.autoSetup,
          mongodbOrgId: state.mongodbOrgId,
          mongodbProjectId: state.mongodbProjectId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        dispatch({ 
          type: 'SET_SESSION', 
          payload: { 
            sessionId: result.sessionId, 
            progress: 10, 
            status: 'Initialization started' 
          } 
        });
        
        addLog({ level: 'success', message: `Session created: ${result.sessionId}` });
        setStep('status');
        
        // Start polling for status updates
        await pollStatus(result.sessionId);
      } else {
        throw new Error(result.message || 'Initialization failed');
      }
    } catch (error: any) {
      setError(error.message);
      addLog({ level: 'error', message: `Initialization failed: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const pollStatus = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/process-changes-enhanced/${sessionId}`);
        const status = await response.json();

        dispatch({ 
          type: 'UPDATE_PROGRESS', 
          payload: { 
            progress: status.progress || 0, 
            status: status.status || 'Processing...' 
          } 
        });

        // Add new logs
        if (status.logs && Array.isArray(status.logs)) {
          status.logs.forEach((log: any) => {
            if (!state.logs.find(l => l.timestamp === log.timestamp && l.message === log.message)) {
              addLog({
                level: log.level || 'info',
                message: log.message,
                data: log.data
              });
            }
          });
        }

        // Check if completed
        if (status.status === 'deployed' || status.status === 'completed' || status.status === 'error') {
          clearInterval(pollInterval);
          setProcessing(false);
          
          if (status.deploymentUrl) {
            dispatch({ type: 'SET_DEPLOYMENT_URL', payload: status.deploymentUrl });
          }
          
          if (status.status === 'error') {
            setError('Deployment failed');
          }
        }
      } catch (error: any) {
        console.error('Status polling error:', error);
        addLog({ level: 'warning', message: `Status update failed: ${error.message}` });
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setProcessing(false);
    }, 600000);
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