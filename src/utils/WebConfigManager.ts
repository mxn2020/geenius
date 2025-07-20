// Web-specific configuration management
interface ProjectConfig {
  template: string;
  name: string;
  repoUrl: string;
  aiProvider: string;
  agentMode: string;
  orchestrationStrategy?: string;
  model?: string;
  netlifyProject?: string;
  createdAt: string;
  updatedAt: string;
}

export class WebConfigManager {
  private static readonly CONFIG_KEY = 'geenius_project_config';
  private static instance: WebConfigManager;
  private currentConfig: ProjectConfig | null = null;

  private constructor() {}

  static getInstance(): WebConfigManager {
    if (!WebConfigManager.instance) {
      WebConfigManager.instance = new WebConfigManager();
    }
    return WebConfigManager.instance;
  }

  async loadConfig(): Promise<ProjectConfig | null> {
    if (this.currentConfig) {
      return this.currentConfig;
    }

    // Try to load from localStorage first (client-side)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(WebConfigManager.CONFIG_KEY);
        if (stored) {
          this.currentConfig = JSON.parse(stored);
          return this.currentConfig;
        }
      } catch (error) {
        console.warn('Failed to load config from localStorage:', error);
      }
    }

    return null;
  }

  async saveConfig(config: ProjectConfig): Promise<void> {
    // Update timestamp
    config.updatedAt = new Date().toISOString();
    
    this.currentConfig = config;

    // Save to localStorage (client-side)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(WebConfigManager.CONFIG_KEY, JSON.stringify(config));
      } catch (error) {
        console.warn('Failed to save config to localStorage:', error);
      }
    }
  }

  async configExists(): Promise<boolean> {
    const config = await this.loadConfig();
    return config !== null;
  }

  async deleteConfig(): Promise<void> {
    this.currentConfig = null;
    
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(WebConfigManager.CONFIG_KEY);
      } catch (error) {
        console.warn('Failed to delete config from localStorage:', error);
      }
    }
  }

  getCurrentConfig(): ProjectConfig | null {
    return this.currentConfig;
  }
}