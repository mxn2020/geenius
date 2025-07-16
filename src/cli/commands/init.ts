// src/cli/commands/init.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../utils/config';
import { validateInput, InitCommandSchema } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { TemplateRegistry } from '../../repo-templates/index';
import { GitHubService } from '../../services/github';
import { NetlifyService } from '../../services/netlify';
import { EnhancedAgentService } from '../../agent/enhanced-agent-service';
import type { InitOptions, ProjectConfig } from '../../types/config';

export async function initCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 AI Development Agent v3.0'));
  console.log(chalk.gray('Advanced AI agents with orchestration capabilities!\n'));

  const configManager = new ConfigManager();
  
  // Check if config already exists
  if (await configManager.configExists()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Project already initialized. Overwrite existing configuration?',
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.yellow('Init cancelled.'));
      return;
    }
  }

  try {
    // Get template registry
    const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN);
    const templates = await templateRegistry.getAllTemplates();

    // AI Provider and mode selection
    const responses = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Choose your AI provider:',
        choices: [
          { name: '🤖 Claude (Anthropic) - Best for coding', value: 'anthropic' },
          { name: '🧠 GPT-4 (OpenAI) - Most versatile', value: 'openai' },
          { name: '✨ Gemini (Google) - Creative problem solving', value: 'google' },
          { name: '⚡ Grok (X.AI) - Fast and witty', value: 'grok' }
        ]
      },
      {
        type: 'list',
        name: 'agentMode',
        message: 'Choose agent architecture:',
        choices: [
          { name: '🎯 Single Agent - Fast and focused', value: 'single' },
          { name: '👥 Multi-Agent Team - Specialized roles', value: 'orchestrated' },
          { name: '🔄 Hybrid - Best of both worlds', value: 'hybrid' }
        ]
      },
      {
        type: 'list',
        name: 'orchestrationStrategy',
        message: 'Team coordination strategy:',
        choices: [
          { name: '📋 Hierarchical - Lead manages team', value: 'hierarchical' },
          { name: '🤝 Collaborative - Agents work together', value: 'collaborative' },
          { name: '⚡ Parallel - Maximum speed', value: 'parallel' },
          { name: '📐 Sequential - Step by step', value: 'sequential' }
        ],
        when: (answers) => answers.agentMode === 'orchestrated' || answers.agentMode === 'hybrid'
      },
      {
        type: 'list',
        name: 'templateId',
        message: 'Choose your project template:',
        choices: templates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id
        }))
      },
      {
        type: 'password',
        name: 'apiKey',
        message: (answers) => `Enter your ${answers.aiProvider.toUpperCase()} API key:`,
        mask: '*',
        validate: (input) => input.length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => input.length > 0 || 'Project name is required'
      },
      {
        type: 'input',
        name: 'githubOrg',
        message: 'GitHub organization/username:',
        validate: (input) => input.length > 0 || 'GitHub org is required'
      },
      {
        type: 'input',
        name: 'model',
        message: (answers) => `${answers.aiProvider.toUpperCase()} model (optional):`,
        default: (answers) => getDefaultModel(answers.aiProvider)
      },
      {
        type: 'confirm',
        name: 'autoSetup',
        message: 'Auto-setup GitHub repo and Netlify project?',
        default: true
      }
    ]);

    // Validate input
    const validatedInput = validateInput(InitCommandSchema, responses);
    
    const spinner = ora('Initializing advanced AI development environment...').start();
    
    // Initialize services
    const github = new GitHubService();
    const netlify = new NetlifyService();
    const template = templates.find(t => t.id === validatedInput.templateId)!;

    // Fork template repository
    spinner.text = 'Forking template repository...';
    const repoUrl = await github.forkTemplate(
      template.repository, 
      validatedInput.projectName, 
      validatedInput.githubOrg
    );
    
    logger.info('Repository forked successfully', { repoUrl, template: template.id });

    // Setup Netlify project
    let netlifyProject;
    if (validatedInput.autoSetup) {
      spinner.text = 'Setting up Netlify project...';
      netlifyProject = await netlify.createProject(validatedInput.projectName, repoUrl);
      
      // Set environment variables
      await netlify.setupEnvironmentVariables(netlifyProject.id, {
        ...getEnvVarsForProvider(validatedInput.aiProvider, validatedInput.apiKey, validatedInput.model),
        ...template.envVars.reduce((acc, envVar) => ({ ...acc, [envVar]: '' }), {})
      });

      // Configure branch deployments
      await netlify.configureBranchDeployments(netlifyProject.id, {
        main: { production: true },
        develop: { preview: true },
        'feature/*': { preview: true }
      });
      
      logger.info('Netlify project configured', { projectId: netlifyProject.id });
    }

    // Initialize AI agent service
    spinner.text = 'Initializing AI agent system...';
    const agentService = new EnhancedAgentService(repoUrl, {
      type: validatedInput.agentMode,
      provider: validatedInput.aiProvider,
      orchestrationStrategy: validatedInput.orchestrationStrategy || 'hierarchical'
    });

    await agentService.initializeProject(repoUrl);
    
    logger.info('AI agent system initialized', { 
      provider: validatedInput.aiProvider, 
      mode: validatedInput.agentMode 
    });

    spinner.succeed('Advanced AI development environment initialized!');
    
    // Create project configuration
    const config: ProjectConfig = {
      template: template.id,
      name: validatedInput.projectName,
      repoUrl,
      aiProvider: validatedInput.aiProvider,
      agentMode: validatedInput.agentMode,
      orchestrationStrategy: validatedInput.orchestrationStrategy,
      apiKey: validatedInput.apiKey,
      model: validatedInput.model,
      netlifyProject: netlifyProject?.id,
      systemPrompt: template.aiConfig.systemPrompt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await configManager.saveConfig(config);
    
    // Success output
    console.log(chalk.green('\n✅ Setup complete!'));
    console.log(chalk.gray('Repository:'), repoUrl);
    console.log(chalk.gray('AI Provider:'), validatedInput.aiProvider.toUpperCase());
    console.log(chalk.gray('Agent Mode:'), validatedInput.agentMode);
    console.log(chalk.gray('Template:'), template.name);
    
    if (validatedInput.agentMode === 'orchestrated' || validatedInput.agentMode === 'hybrid') {
      console.log(chalk.gray('Strategy:'), validatedInput.orchestrationStrategy);
    }
    
    if (netlifyProject) {
      console.log(chalk.gray('Netlify:'), netlifyProject.ssl_url);
    }

    console.log(chalk.blue('\n🎉 Ready to develop! Try:'));
    console.log(chalk.gray('  dev-agent develop'));
    console.log(chalk.gray('  dev-agent status'));
    console.log(chalk.gray('  dev-agent compare-agents'));

  } catch (error) {
    logger.error('Init command failed', error);
    console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
    process.exit(1);
  }
}

function getDefaultModel(provider: string): string {
  const defaults = {
    anthropic: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4-turbo',
    google: 'gemini-pro',
    grok: 'grok-beta'
  };
  
  return defaults[provider] || 'gpt-4';
}

function getEnvVarsForProvider(provider: string, apiKey: string, model?: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
  switch (provider) {
    case 'anthropic':
      vars.ANTHROPIC_API_KEY = apiKey;
      if (model) vars.CLAUDE_MODEL = model;
      break;
    case 'openai':
      vars.OPENAI_API_KEY = apiKey;
      if (model) vars.OPENAI_MODEL = model;
      break;
    case 'google':
      vars.GOOGLE_API_KEY = apiKey;
      if (model) vars.GEMINI_MODEL = model;
      break;
    case 'grok':
      vars.GROK_API_KEY = apiKey;
      if (model) vars.GROK_MODEL = model;
      break;
  }
  
  return vars;
}

