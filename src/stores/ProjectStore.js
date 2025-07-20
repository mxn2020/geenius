// Web app project store - manages project state and operations
export class ProjectStore {
  constructor() {
    this.state = {
      currentProject: null,
      templates: [],
      isLoading: false,
      logs: [],
      environmentStatus: {
        github: { configured: false },
        netlify: { configured: false },
        mongodb: { configured: false }
      }
    };
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.state.logs.push(logMessage);
    this.notify();
  }

  clearLogs() {
    this.state.logs = [];
    this.notify();
  }

  setLoading(isLoading, title = '', message = '') {
    this.setState({ 
      isLoading,
      loadingTitle: title,
      loadingMessage: message
    });
  }

  async loadTemplates() {
    try {
      const response = await fetch('/.netlify/functions/web-templates');
      const templates = await response.json();
      this.setState({ templates });
      return templates;
    } catch (error) {
      console.error('Failed to load templates:', error);
      throw error;
    }
  }

  async checkEnvironmentStatus() {
    try {
      const response = await fetch('/.netlify/functions/web-env-status');
      const environmentStatus = await response.json();
      this.setState({ environmentStatus });
      return environmentStatus;
    } catch (error) {
      console.error('Failed to check environment status:', error);
      throw error;
    }
  }

  async loadProjectStatus() {
    try {
      const response = await fetch('/.netlify/functions/web-status');
      const projectStatus = await response.json();
      
      if (projectStatus.hasProject) {
        this.setState({ currentProject: projectStatus });
      }
      
      return projectStatus;
    } catch (error) {
      console.error('Failed to load project status:', error);
      throw error;
    }
  }

  async initializeProject(projectData) {
    this.setLoading(true, 'Initializing Project', 'Setting up your AI development environment...');
    
    try {
      const response = await fetch('/.netlify/functions/web-init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      const result = await response.json();
      
      if (result.success && result.sessionId) {
        this.addLog('🚀 Project initialization started...');
        this.addLog(`📝 Session ID: ${result.sessionId}`);
        
        // Update URL with session ID and switch to logs view
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('session', result.sessionId);
        window.history.pushState({}, '', currentUrl.toString());
        
        // Set state to show logs tab
        this.setState({ 
          activeTab: 'logs',
          sessionId: result.sessionId,
          isInitializing: true
        });
        
        // Start polling for logs
        this.startLogPolling(result.sessionId);
        
        return result;
      } else {
        this.addLog(`❌ Initialization failed: ${result.error}`);
        throw new Error(result.error);
      }
    } catch (error) {
      // Check if this is a timeout error
      if (error.message.includes('TimeoutError') || error.message.includes('timed out')) {
        this.addLog('❌ Request timed out - the initialization is taking longer than expected');
        this.addLog('💡 Please check the logs page for progress updates');
      } else {
        this.addLog(`❌ Network error: ${error.message}`);
      }
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async startDevelopment(developmentData) {
    this.setLoading(true, 'Starting Development', 'Creating feature branch and initializing AI agents...');
    
    try {
      const response = await fetch('/.netlify/functions/web-develop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(developmentData)
      });

      const result = await response.json();
      
      // Display all logs from the development process
      if (result.logs && Array.isArray(result.logs)) {
        result.logs.forEach(log => {
          this.addLog(log);
        });
      }
      
      if (result.success) {
        this.addLog('🎉 Development session completed!');
        this.addLog(`🌿 Feature branch: ${result.featureBranch}`);
        if (result.pullRequestUrl) {
          this.addLog(`🔗 Pull Request: ${result.pullRequestUrl}`);
        }
        
        return result;
      } else {
        this.addLog(`❌ Development failed: ${result.error}`);
        throw new Error(result.error);
      }
    } catch (error) {
      this.addLog(`❌ Network error: ${error.message}`);
      throw error;
    } finally {
      this.setLoading(false);
    }
  }

  async startLogPolling(sessionId) {
    if (this.logPollingInterval) {
      clearInterval(this.logPollingInterval);
    }
    
    this.logPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`/.netlify/functions/web-init/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Update state with latest session data
          this.setState({
            sessionStatus: data.status,
            sessionProgress: data.progress,
            sessionLogs: data.logs || [],
            sessionError: data.error,
            repoUrl: data.repoUrl,
            netlifyUrl: data.netlifyUrl,
            mongodbDatabase: data.mongodbDatabase
          });
          
          // Stop polling if completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            this.stopLogPolling();
            this.setState({ isInitializing: false });
            
            if (data.status === 'completed') {
              this.addLog('🎉 Project initialization completed!');
              if (data.repoUrl) this.addLog(`📁 Repository: ${data.repoUrl}`);
              if (data.netlifyUrl) this.addLog(`🌐 Netlify URL: ${data.netlifyUrl}`);
              if (data.mongodbDatabase) this.addLog(`🍃 MongoDB Database: ${data.mongodbDatabase}`);
            }
          }
        }
      } catch (error) {
        console.error('Error polling logs:', error);
      }
    }, 2000); // Poll every 2 seconds
  }
  
  stopLogPolling() {
    if (this.logPollingInterval) {
      clearInterval(this.logPollingInterval);
      this.logPollingInterval = null;
    }
  }

  getState() {
    return this.state;
  }
}

// Global store instance
export const projectStore = new ProjectStore();