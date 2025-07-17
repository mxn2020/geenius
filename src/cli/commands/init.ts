// src/cli/commands/init.ts
import 'dotenv/config';
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

    // Check for existing API keys and show status
    const availableProviders = [];
    if (process.env.ANTHROPIC_API_KEY) availableProviders.push('anthropic');
    if (process.env.OPENAI_API_KEY) availableProviders.push('openai');
    if (process.env.GOOGLE_API_KEY) availableProviders.push('google');
    if (process.env.GROK_API_KEY) availableProviders.push('grok');

    if (availableProviders.length > 0) {
      console.log(chalk.green(`✅ Found API keys for: ${availableProviders.map(p => p.toUpperCase()).join(', ')}`));
    } else {
      console.log(chalk.yellow('⚠️  No API keys found in environment. You will be prompted to enter them.'));
    }

    // Check for existing GitHub configuration
    const githubConfig = [];
    if (process.env.GITHUB_USERNAME) githubConfig.push('username');
    if (process.env.GITHUB_ORG) githubConfig.push('organization');
    if (githubConfig.length > 0) {
      console.log(chalk.green(`✅ Found GitHub ${githubConfig.join(', ')} in environment`));
    }

    console.log(); // Add spacing

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
        validate: (input) => input.length > 0 || 'API key is required',
        when: (answers) => !getExistingApiKey(answers.aiProvider)
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
        message: 'GitHub organization/username (where to fork the repo):',
        default: process.env.GITHUB_ORG || process.env.GITHUB_USERNAME,
        validate: (input) => input.length > 0 || 'GitHub org/username is required',
        when: () => !process.env.GITHUB_ORG && !process.env.GITHUB_USERNAME
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

    // Use existing API key if available, otherwise use the prompted one
    const finalApiKey = responses.apiKey || getExistingApiKey(responses.aiProvider);
    if (!finalApiKey) {
      throw new Error(`No API key found for ${responses.aiProvider}. Please set ${getApiKeyEnvName(responses.aiProvider)} in your .env file or enter it when prompted.`);
    }
    responses.apiKey = finalApiKey;

    // Use existing GitHub org/username if available, otherwise use the prompted one
    const finalGithubOrg = responses.githubOrg || process.env.GITHUB_ORG || process.env.GITHUB_USERNAME;
    if (!finalGithubOrg) {
      throw new Error('No GitHub organization/username found. Please set GITHUB_ORG or GITHUB_USERNAME in your .env file or enter it when prompted.');
    }
    responses.githubOrg = finalGithubOrg;

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
      if (!process.env.NETLIFY_TOKEN) {
        spinner.warn('Netlify token not found - skipping deployment setup');
        console.log(chalk.yellow('⚠️  NETLIFY_TOKEN not found in environment. Skipping Netlify setup.'));
        console.log(chalk.gray('Add NETLIFY_TOKEN to your .env file to enable auto-deployment.'));
        netlifyProject = null;
      } else {
        try {
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
        } catch (error) {
          spinner.fail('Netlify setup failed');
          console.log(chalk.red(`❌ Netlify setup failed: ${error.message}`));
          throw error; // Don't continue if Netlify setup was requested but failed
        }
      }
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
      systemPrompt: getSystemPromptForTemplate(template.id),
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
      console.log(chalk.gray('Netlify Project:'), `https://app.netlify.com/sites/${netlifyProject.id}/overview`);
    }

    console.log(chalk.blue('\n🎉 Ready to develop!'));
    
    // Show interactive menu
    const { nextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: '🚀 Start Development Session', value: 'develop' },
          { name: '📊 Check Project Status', value: 'status' },
          { name: '⚖️  Compare AI Providers', value: 'compare' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);

    switch (nextAction) {
      case 'develop':
        const { developCommand } = await import('./develop');
        await developCommand();
        break;
      case 'status':
        const { statusCommand } = await import('./status');
        await statusCommand();
        break;
      case 'compare':
        const { compareAgentsCommand } = await import('./compare-agents');
        await compareAgentsCommand();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 Thanks for using Geenius! Happy coding!'));
        process.exit(0);
        break;
    }

  } catch (error) {
    logger.error('Init command failed', error);
    console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
    process.exit(1);
  }
}

function getDefaultModel(provider: string): string {
  const defaults = {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4-turbo',
    google: 'gemini-pro',
    grok: 'grok-beta'
  };
  
  return defaults[provider] || 'gpt-4';
}

function getExistingApiKey(provider: string): string | null {
  const envVarName = getApiKeyEnvName(provider);
  return process.env[envVarName] || null;
}

function getApiKeyEnvName(provider: string): string {
  const envNames = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    grok: 'GROK_API_KEY'
  };
  
  return envNames[provider] || 'API_KEY';
}

function getSystemPromptForTemplate(templateId: string): string {
  const prompts = {
    'nextjs-supabase': 'You are a Next.js expert working with Supabase. Focus on type-safe code, proper error handling, and following Next.js best practices.',
    'vite-react-mongo': 'You are a React developer using Vite and MongoDB. Focus on modern React patterns, hooks, and efficient database operations.',
    'react-indexeddb-jwt': 'You are a React developer focusing on client-side applications. Emphasize performance, offline capability, and secure authentication.',
    'vue-pinia-firebase': 'You are a Vue.js expert working with Firebase. Focus on composition API, reactive patterns, and Firebase best practices.',
    'svelte-drizzle-planetscale': 'You are a SvelteKit expert working with modern database tools. Focus on performance, type safety, and edge-ready applications.',
    'astro-content-collections': 'You are an Astro expert focusing on static site generation and content management. Emphasize performance, SEO, and content structure.',
    'express-prisma-postgres': 'You are a backend API expert using Express.js and Prisma. Focus on scalable architecture, security, and database optimization.',
    'remix-sqlite-auth': 'You are a Remix expert focusing on full-stack development. Emphasize progressive enhancement, web standards, and performance.'
  };
  
  return prompts[templateId] || 'You are an expert developer. Focus on writing clean, maintainable, and well-documented code following industry best practices.';
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

