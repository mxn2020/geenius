// src/utils/config.ts
import { promises as fs } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import type { ProjectConfig } from '../types/config';

const ProjectConfigSchema = z.object({
  template: z.string(),
  name: z.string(),
  repoUrl: z.string().url(),
  aiProvider: z.enum(['anthropic', 'openai', 'google', 'grok']),
  agentMode: z.enum(['single', 'orchestrated', 'hybrid']),
  orchestrationStrategy: z.enum(['sequential', 'parallel', 'hierarchical', 'collaborative']).optional(),
  apiKey: z.string(),
  model: z.string().optional(),
  maxConcurrency: z.number().optional(),
  crossValidation: z.boolean().optional(),
  netlifyProject: z.string().optional(),
  systemPrompt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export class ConfigManager {
  private configFile: string;
  private globalConfigDir: string;

  constructor() {
    this.configFile = '.dev-agent.json';
    this.globalConfigDir = join(process.env.HOME || process.env.USERPROFILE || '', '.dev-agent');
  }

  async loadConfig(): Promise<ProjectConfig | null> {
    try {
      const configPath = join(process.cwd(), this.configFile);
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      
      // Validate config structure
      const validatedConfig = ProjectConfigSchema.parse(config);
      return validatedConfig;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Config file doesn't exist
      }
      throw new Error(`Failed to load config: ${error.message}`);
    }
  }

  async saveConfig(config: ProjectConfig): Promise<void> {
    try {
      // Validate config before saving
      const validatedConfig = ProjectConfigSchema.parse(config);
      
      // Update timestamp
      validatedConfig.updatedAt = new Date().toISOString();
      
      const configPath = join(process.cwd(), this.configFile);
      await fs.writeFile(configPath, JSON.stringify(validatedConfig, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  async validateConfig(config: any): Promise<{ valid: boolean; errors: string[] }> {
    try {
      ProjectConfigSchema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: [error.message] };
    }
  }

  async loadGlobalConfig(): Promise<Record<string, any>> {
    try {
      const globalConfigPath = join(this.globalConfigDir, 'global.json');
      const data = await fs.readFile(globalConfigPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {}; // Return empty object if no global config
    }
  }

  async saveGlobalConfig(config: Record<string, any>): Promise<void> {
    try {
      // Ensure config directory exists
      await fs.mkdir(this.globalConfigDir, { recursive: true });
      
      const globalConfigPath = join(this.globalConfigDir, 'global.json');
      await fs.writeFile(globalConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save global config: ${error.message}`);
    }
  }

  getEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name];
    if (!value && !defaultValue) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value || defaultValue!;
  }

  getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }

  async createDefaultConfig(overrides: Partial<ProjectConfig> = {}): Promise<ProjectConfig> {
    const defaultConfig: ProjectConfig = {
      template: '',
      name: '',
      repoUrl: '',
      aiProvider: 'openai',
      agentMode: 'single',
      apiKey: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };

    return defaultConfig;
  }

  async configExists(): Promise<boolean> {
    try {
      const configPath = join(process.cwd(), this.configFile);
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteConfig(): Promise<void> {
    try {
      const configPath = join(process.cwd(), this.configFile);
      await fs.unlink(configPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Failed to delete config: ${error.message}`);
      }
    }
  }
}

