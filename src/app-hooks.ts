// src/hooks.ts

import { useState, useEffect, useRef } from 'react';
import { 
  EnvStatusType, 
  TemplateType, 
  MongoDBOrganization, 
  GithubAccountType, 
  SessionLog, 
  ProjectStatusType 
} from './app-types';

export const useAppState = () => {
  const [envStatus, setEnvStatus] = useState<EnvStatusType>({
    github: { configured: false, loading: true, error: null },
    netlify: { configured: false, loading: true, error: null },
    mongodb: { configured: false, loading: true, error: null }
  });

  const [templates, setTemplates] = useState<TemplateType[]>([]);
  const [mongodbData, setMongodbData] = useState<{ available: boolean; organizations: MongoDBOrganization[] }>({ 
    available: false, 
    organizations: [] 
  });
  const [githubAccounts, setGithubAccounts] = useState<{ available: boolean; accounts: GithubAccountType[]; loading: boolean }>({ 
    available: false, 
    accounts: [], 
    loading: true 
  });

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGithubAccount, setSelectedGithubAccount] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [agentMode, setAgentMode] = useState('single');
  const [sessionId, setSessionId] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [sessionStatus, setSessionStatus] = useState('');
  const [sessionProgress, setSessionProgress] = useState(0);
  const [repoUrl, setRepoUrl] = useState('');
  const [netlifyUrl, setNetlifyUrl] = useState('');
  const [logPollingInterval, setLogPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatusType>({ hasProject: false, loading: true });

  // API Functions
  const checkEnvironmentStatus = async () => {
    try {
      const response = await fetch('/api/env-status');
      const data = await response.json();

      if (response.ok) {
        setEnvStatus({
          github: {
            configured: data.github.configured,
            loading: false,
            error: data.github.error
          },
          netlify: {
            configured: data.netlify.configured,
            loading: false,
            error: data.netlify.error
          },
          mongodb: {
            configured: data.mongodb.configured,
            loading: false,
            error: data.mongodb.error
          }
        });
      } else {
        throw new Error(data.error || 'Failed to check environment status');
      }
    } catch (error) {
      console.error('Environment status check failed:', error);
      setEnvStatus({
        github: { configured: false, loading: false, error: 'Check failed' },
        netlify: { configured: false, loading: false, error: 'Check failed' },
        mongodb: { configured: false, loading: false, error: 'Check failed' }
      });
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      if (response.ok) {
        setTemplates(Array.isArray(data) ? data : data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadMongodbProjects = async () => {
    try {
      const response = await fetch('/api/mongodb-projects');
      const data = await response.json();
      if (response.ok) {
        setMongodbData(data);
        if (data.available && data.organizations.length > 0) {
          const firstOrg = data.organizations[0];
          setSelectedOrg(firstOrg.organization.id);
          if (firstOrg.projects.length > 0) {
            setSelectedProject(firstOrg.projects[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load MongoDB projects:', error);
    }
  };

  const loadGithubAccounts = async () => {
    try {
      const response = await fetch('/api/github-accounts');
      const data = await response.json();
      if (response.ok) {
        setGithubAccounts({
          available: true,
          accounts: data.accounts,
          loading: false
        });
        if (data.accounts.length > 0) {
          setSelectedGithubAccount(data.accounts[0].login);
        }
      } else {
        setGithubAccounts({
          available: false,
          accounts: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      setGithubAccounts({
        available: false,
        accounts: [],
        loading: false
      });
    }
  };

  const loadProjectStatus = async () => {
    try {
      // Check if there's a session ID in URL
      const urlParams = new URLSearchParams(window.location.search);
      const sessionIdFromUrl = urlParams.get('session');
      
      // Only load project status if there's an active session ID
      if (sessionId || sessionIdFromUrl) {
        const activeSessionId = sessionId || sessionIdFromUrl;
        try {
          const sessionResponse = await fetch(`/api/init/${activeSessionId}`);
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            setProjectStatus({ 
              hasProject: true, 
              loading: false,
              isActiveSession: true,
              sessionId: activeSessionId,
              sessionStatus: sessionData.status,
              projectName: sessionData.projectName || (sessionData.status === 'completed' ? 'Project Completed' : 'Project Initializing'),
              templateId: sessionData.templateId || (sessionData.status === 'completed' ? 'Template Applied' : 'Loading Template'),
              status: sessionData.status || 'initializing',
              progress: sessionData.progress || 0,
              currentStep: sessionData.currentStep || 'Initializing...',
              aiProvider: sessionData.aiProvider,
              agentMode: sessionData.agentMode,
              // If session is completed, also show the deployed URLs
              repositoryUrl: sessionData.repoUrl,
              netlifyUrl: sessionData.netlifyUrl,
              mongodbDatabase: sessionData.mongodbDatabase
            });
            
            // Set the session ID if it came from URL
            if (!sessionId && sessionIdFromUrl) {
              setSessionId(sessionIdFromUrl);
            }
            return;
          }
        } catch (sessionError) {
          console.log('Session not found');
        }
      }
      
      // No session ID found - clear project status
      setProjectStatus({ hasProject: false, loading: false, isActiveSession: false });
    } catch (error) {
      console.error('Failed to load project status:', error);
      setProjectStatus({ hasProject: false, loading: false, error: 'Failed to load status', isActiveSession: false });
    }
  };

  // Helper Functions
  const handleOrgChange = (orgId: string) => {
    setSelectedOrg(orgId);
    if (projectName) {
      setSelectedProject('CREATE_NEW');
    } else {
      const org = mongodbData.organizations.find(o => o.organization.id === orgId);
      if (org && org.projects.length > 0) {
        setSelectedProject(org.projects[0].id);
      } else {
        setSelectedProject('');
      }
    }
  };

  const getSelectedOrgProjects = () => {
    const org = mongodbData.organizations.find(o => o.organization.id === selectedOrg);
    return org ? org.projects : [];
  };

  const addLog = (message: string, useCurrentTime = true) => {
    if (useCurrentTime) {
      const timestamp = `[${new Date().toLocaleTimeString()}] ${message}`;
      setLogs(prev => [...prev, timestamp]);
    } else {
      setLogs(prev => [...prev, message]);
    }
  };

  // Log Polling Functions
  const startLogPolling = (sessionIdParam: string) => {
    if (logPollingInterval) {
      clearInterval(logPollingInterval);
    }

    const interval = setInterval(async () => {
      try {
        let endpoint;
        if (sessionIdParam.startsWith('ge_')) {
          endpoint = `/.netlify/functions/web-init/${sessionIdParam}`;
        } else if (sessionIdParam.startsWith('init_')) {
          // Use the initialize-project status endpoint for init sessions
          endpoint = `/api/initialize-project/${sessionIdParam}`;
        } else {
          endpoint = `/api/process-changes-enhanced/${sessionIdParam}`;
        }

        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();

          const previousStatus = sessionStatus;
          const previousLogCount = sessionLogs.length;

          setSessionStatus(data.status);
          setSessionProgress(data.progress || 0);

          const newLogs = data.logs || [];
          if (newLogs.length !== previousLogCount || data.status !== previousStatus) {
            setSessionLogs(newLogs);
          }

          if (data.repoUrl) setRepoUrl(data.repoUrl);
          if (data.netlifyUrl) setNetlifyUrl(data.netlifyUrl);
          if (data.prUrl) setRepoUrl(data.prUrl);
          if (data.previewUrl) setNetlifyUrl(data.previewUrl);

          if ((data.repoUrl || data.netlifyUrl || data.prUrl || data.previewUrl) && data.status === 'completed') {
            loadProjectStatus();
          }

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            setLogPollingInterval(null);
            setDeploymentStatus(data.status);

            const hasCompletionLogs = logs.some(log => log.includes('🎉') && log.includes('completed'));
            const isProjectInit = sessionIdParam.startsWith('init_');
            const isWebInit = sessionIdParam.startsWith('ge_');
            
            // Only add completion logs for change processing sessions (not init sessions)
            if (data.status === 'completed' && !hasCompletionLogs && !isWebInit && !isProjectInit) {
              addLog('🎉 Change processing completed!');
              if (data.prUrl) addLog(`🔀 Pull Request: ${data.prUrl}`);
              if (data.previewUrl) addLog(`🌐 Preview URL: ${data.previewUrl}`);
            }
          }
        } else if (response.status === 404) {
          setSessionStatus('session_not_found');
          addLog(`❌ Session ${sessionIdParam} not found`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error polling logs:', error);
        addLog(`❌ Error polling logs: ${errorMessage}`);
      }
    }, 1500);

    setLogPollingInterval(interval);
  };

  const stopLogPolling = () => {
    if (logPollingInterval) {
      clearInterval(logPollingInterval);
      setLogPollingInterval(null);
    }
  };

  const startLogStreaming = async (sessionIdParam: string, isNewSession = true) => {
    if (isNewSession) {
      addLog('🚀 Project initialization started...');
      addLog(`📝 Session ID: ${sessionIdParam}`);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionIdParam);
    window.history.pushState({}, '', url.toString());

    startLogPolling(sessionIdParam);
  };

  // Initial load effect
  useEffect(() => {
    checkEnvironmentStatus();
    loadTemplates();
    loadMongodbProjects();
    loadGithubAccounts();
    loadProjectStatus();

    // Check for session ID in URL parameters or path
    let urlSessionId = null;
    const urlParams = new URLSearchParams(window.location.search);
    urlSessionId = urlParams.get('session');

    if (!urlSessionId) {
      const pathMatch = window.location.pathname.match(/\/logs\/(.+)/);
      if (pathMatch) {
        urlSessionId = pathMatch[1];
      }
    }

    if (urlSessionId) {
      setSessionId(urlSessionId);
      startLogPolling(urlSessionId);
      setSessionStatus('running');
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopLogPolling();
  }, []);

  return {
    // State
    envStatus,
    templates,
    mongodbData,
    githubAccounts,
    selectedOrg,
    setSelectedOrg,
    selectedProject,
    setSelectedProject,
    selectedGithubAccount,
    setSelectedGithubAccount,
    projectName,
    setProjectName,
    loading,
    setLoading,
    loadingMessage,
    setLoadingMessage,
    agentMode,
    setAgentMode,
    sessionId,
    setSessionId,
    logs,
    setLogs,
    deploymentStatus,
    setDeploymentStatus,
    sessionLogs,
    setSessionLogs,
    sessionStatus,
    setSessionStatus,
    sessionProgress,
    setSessionProgress,
    repoUrl,
    setRepoUrl,
    netlifyUrl,
    setNetlifyUrl,
    projectStatus,
    setProjectStatus,
    // Functions
    addLog,
    handleOrgChange,
    getSelectedOrgProjects,
    loadProjectStatus,
    startLogStreaming,
    stopLogPolling
  };
};

export const useKeyboardNavigation = (activeView: string, setActiveView: (view: string) => void) => {
  useEffect(() => {
    const tabs = ['init', 'status', 'develop', 'logs'];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();

        const currentIndex = tabs.indexOf(activeView);
        let newIndex: number;

        if (event.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }

        setActiveView(tabs[newIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeView, setActiveView]);
};