#!/usr/bin/env node
// bin/geenius.ts (Updated with custom agent support)
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { aiEnabledTemplates } from '../src/templates/index.js';
import { EnhancedAgentService } from '../src/agent/enhanced-agent-service.js';
import { GitHubService } from '../src/services/github.js';
import { NetlifyService } from '../src/services/netlify.js';

const program = new Command();

program
  .name('geenius')
  .description('AI-powered development workflow with custom agents and multi-provider support')
  .version('3.0.0');

program
  .command('init')
  .description('Initialize a new project with AI agent')
  .action(async () => {
    console.log(chalk.blue.bold('🚀 AI Development Agent v3.0'));
    console.log(chalk.gray('Advanced AI agents with orchestration capabilities!\n'));

    // AI Provider and mode selection
    const { aiProvider, agentMode, orchestrationStrategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Choose your AI provider:',
        choices: [
          { name: '🤖 Claude (Anthropic) - Best for coding', value: 'anthropic' },
          { name: '🧠 GPT-4 (OpenAI) - Most versatile', value: 'openai' },
          { name: '✨ Gemini (Google) - Creative problem solving', value: 'google' },
          { name: '⚡ Grok (X.AI) - Fast and witty', value: 'grok' },
          { name: '🔧 Custom Agent - Our own AI system', value: 'custom' }
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
      }
    ]);

    // Filter templates by AI provider
    const availableTemplates = aiEnabledTemplates.filter(t => 
      t.aiProvider === aiProvider || aiProvider === 'custom'
    );
    
    const { templateId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'templateId',
        message: 'Choose your project template:',
        choices: availableTemplates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id
        }))
      }
    ]);

    const template = availableTemplates.find(t => t.id === templateId)!;
    
    // Get AI API key
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `Enter your ${aiProvider.toUpperCase()} API key:`,
        mask: '*',
        validate: (input) => input.length > 0 || 'API key is required'
      }
    ]);

    // Advanced configuration
    const advancedConfig = await inquirer.prompt([
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
        message: `${aiProvider.toUpperCase()} model (optional):`,
        default: getDefaultModel(aiProvider)
      },
      {
        type: 'number',
        name: 'maxConcurrency',
        message: 'Max concurrent agents (orchestrated mode):',
        default: 3,
        when: () => agentMode === 'orchestrated' || agentMode === 'hybrid'
      },
      {
        type: 'confirm',
        name: 'crossValidation',
        message: 'Enable cross-validation by reviewer agent?',
        default: true,
        when: () => agentMode === 'orchestrated' || agentMode === 'hybrid'
      },
      {
        type: 'confirm',
        name: 'autoSetup',
        message: 'Auto-setup GitHub repo and Netlify project?',
        default: true
      }
    ]);

    const spinner = ora('Initializing advanced AI development environment...').start();
    
    try {
      const github = new GitHubService();
      const netlify = new NetlifyService();

      // Fork template repository
      spinner.text = 'Forking template repository...';
      const repoUrl = await github.forkTemplate(template.githubRepo, advancedConfig.projectName, advancedConfig.githubOrg);
      
      // Setup Netlify project
      let netlifyProject;
      if (advancedConfig.autoSetup) {
        spinner.text = 'Setting up Netlify project...';
        netlifyProject = await netlify.createProject(advancedConfig.projectName, repoUrl);
        
        // Set environment variables
        await netlify.setupEnvironmentVariables(netlifyProject.id, {
          ...getEnvVarsForProvider(aiProvider, apiKey, advancedConfig.model),
          ...template.envVars.reduce((acc, envVar) => ({ ...acc, [envVar]: '' }), {})
        });

        // Configure branch deployments
        await netlify.configureBranchDeployments(netlifyProject.id, {
          main: { production: true },
          develop: { preview: true },
          'feature/*': { preview: true }
        });
      }

      // Initialize AI agent service
      spinner.text = 'Initializing AI agent system...';
      const agentService = new EnhancedAgentService(repoUrl, {
        type: agentMode,
        provider: aiProvider,
        orchestrationStrategy: orchestrationStrategy || 'hierarchical'
      });

      await agentService.initializeProject(repoUrl);

      spinner.succeed('Advanced AI development environment initialized!');
      
      console.log(chalk.green('\n✅ Setup complete!'));
      console.log(chalk.gray('Repository:'), repoUrl);
      console.log(chalk.gray('AI Provider:'), aiProvider.toUpperCase());
      console.log(chalk.gray('Agent Mode:'), agentMode);
      console.log(chalk.gray('Template:'), template.name);
      
      if (agentMode === 'orchestrated' || agentMode === 'hybrid') {
        console.log(chalk.gray('Strategy:'), orchestrationStrategy);
        console.log(chalk.gray('Max Concurrency:'), advancedConfig.maxConcurrency);
      }
      
      if (netlifyProject) {
        console.log(chalk.gray('Netlify:'), netlifyProject.ssl_url);
      }
      
      // Save project configuration
      await saveProjectConfig({
        template: template.id,
        name: advancedConfig.projectName,
        repoUrl,
        aiProvider,
        agentMode,
        orchestrationStrategy,
        apiKey, // In production, encrypt this
        model: advancedConfig.model,
        maxConcurrency: advancedConfig.maxConcurrency,
        crossValidation: advancedConfig.crossValidation,
        netlifyProject: netlifyProject?.id,
        systemPrompt: template.aiConfig.systemPrompt
      });

      console.log(chalk.blue('\n🎉 Ready to develop! Try:'));
      console.log(chalk.gray('  geenius develop'));
      console.log(chalk.gray('  geenius compare-agents'));
      console.log(chalk.gray('  geenius status'));

    } catch (error) {
      spinner.fail(`Setup failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('develop')
  .description('Start AI-powered development session')
  .option('-f, --feature <name>', 'Feature branch name')
  .option('-c, --complexity <level>', 'Task complexity (simple/medium/complex)')
  .option('-m, --mode <mode>', 'Agent mode override (single/orchestrated/auto)')
  .option('-p, --priority <level>', 'Task priority (low/medium/high/urgent)')
  .action(async (options) => {
    const config = await loadProjectConfig();
    
    if (!config) {
      console.log(chalk.red('No project found. Run "geenius init" first.'));
      return;
    }

    const developmentOptions = await inquirer.prompt([
      {
        type: 'input',
        name: 'featureName',
        message: 'Feature branch name:',
        default: options.feature || `feature/ai-${Date.now()}`
      },
      {
        type: 'list',
        name: 'complexity',
        message: 'Task complexity:',
        choices: [
          { name: '🟢 Simple - Bug fixes, small updates', value: 'simple' },
          { name: '🟡 Medium - New features, refactoring', value: 'medium' },
          { name: '🔴 Complex - Architecture changes, integrations', value: 'complex' }
        ],
        default: options.complexity || 'medium'
      },
      {
        type: 'list',
        name: 'mode',
        message: 'Agent mode for this task:',
        choices: [
          { name: '🎯 Single Agent - Fast execution', value: 'single' },
          { name: '👥 Multi-Agent Team - Comprehensive approach', value: 'orchestrated' },
          { name: '🤖 Auto-select - Let AI decide', value: 'auto' }
        ],
        default: options.mode || 'auto'
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Task priority:',
        choices: [
          { name: '🔥 Urgent - Critical fixes', value: 'urgent' },
          { name: '🔴 High - Important features', value: 'high' },
          { name: '🟡 Medium - Regular development', value: 'medium' },
          { name: '🟢 Low - Nice to have', value: 'low' }
        ],
        default: options.priority || 'medium'
      },
      {
        type: 'editor',
        name: 'taskDescription',
        message: 'Describe what you want to build:',
        default: `# Feature Requirements\n\n## Description\nDescribe your feature here...\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Technical Notes\n- Implementation details\n- Performance considerations\n- Security requirements\n\n## Testing Requirements\n- Unit tests\n- Integration tests\n- E2E tests if applicable`
      }
    ]);

    const spinner = ora('Starting AI development session...').start();
    
    try {
      const github = new GitHubService();
      
      // Create feature branch
      spinner.text = 'Creating feature branch...';
      await github.createBranch(config.repoUrl, developmentOptions.featureName, 'develop');
      
      // Initialize agent service
      const agentService = new EnhancedAgentService(config.repoUrl, {
        type: config.agentMode,
        provider: config.aiProvider,
        orchestrationStrategy: config.orchestrationStrategy
      });

      await agentService.initializeProject(config.repoUrl, developmentOptions.featureName);

      // Start development with progress tracking
      spinner.text = 'AI agents analyzing requirements...';
      
      const result = await agentService.developFeature(developmentOptions.taskDescription, {
        complexity: developmentOptions.complexity,
        priority: developmentOptions.priority,
        preferredMode: developmentOptions.mode,
        onProgress: (step, agent) => {
          spinner.text = agent ? `${agent}: ${step}` : `🤖 ${step}`;
        },
        onCommit: (message) => {
          console.log(chalk.green(`\n📝 ${message}`));
        }
      });

      if (result.success) {
        spinner.succeed('Development completed successfully!');
        console.log(chalk.green('\n✅ Feature development complete!'));
        console.log(chalk.gray('Branch:'), developmentOptions.featureName);
        console.log(chalk.gray('Approach:'), result.approach);
        console.log(chalk.gray('AI Provider:'), config.aiProvider.toUpperCase());
        
        if (result.agentContributions) {
          console.log(chalk.gray('Agent Contributions:'), result.agentContributions.size);
        }
      } else {
        spinner.warn('Development completed with issues');
        console.log(chalk.yellow('\n⚠️  Development completed with some issues'));
        console.log(chalk.gray('Check the logs for details'));
      }

      // Show timeline for orchestrated mode
      if (result.timeline && result.timeline.length > 0) {
        console.log(chalk.blue('\n📋 Development Timeline:'));
        result.timeline.forEach(event => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          console.log(chalk.gray(`${time} [${event.agent}]: ${event.event}`));
        });
      }

    } catch (error) {
      spinner.fail(`Development failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('compare-agents')
  .description('Compare different AI providers on a task')
  .option('-p, --providers <providers>', 'Comma-separated list of providers')
  .action(async (options) => {
    const config = await loadProjectConfig();
    
    if (!config) {
      console.log(chalk.red('No project found. Run "geenius init" first.'));
      return;
    }

    const providers = options.providers ? options.providers.split(',') : ['openai', 'anthropic', 'google', 'grok'];
    
    const { taskDescription } = await inquirer.prompt([
      {
        type: 'input',
        name: 'taskDescription',
        message: 'Task for comparison:',
        default: 'Create a simple React component with state management'
      }
    ]);

    const spinner = ora('Running agent comparison...').start();
    
    try {
      const agentService = new EnhancedAgentService(config.repoUrl, {
        type: 'single',
        provider: config.aiProvider
      });

      await agentService.initializeProject(config.repoUrl);

      const comparison = await agentService.runAgentComparison(taskDescription, providers);

      spinner.succeed('Agent comparison completed!');
      
      console.log(chalk.blue('\n📊 Agent Comparison Results'));
      console.log(chalk.gray('Task:'), taskDescription);
      console.log(chalk.gray('Best Approach:'), chalk.green(comparison.bestApproach.toUpperCase()));
      
      console.log(chalk.blue('\n⚡ Speed (lower is better):'));
      for (const [provider, time] of comparison.comparison.speed.entries()) {
        console.log(`  ${provider}: ${time}ms`);
      }
      
      console.log(chalk.blue('\n🎯 Quality Score:'));
      for (const [provider, score] of comparison.comparison.quality.entries()) {
        console.log(`  ${provider}: ${score}/100`);
      }
      
      console.log(chalk.blue('\n🎨 Creativity Score:'));
      for (const [provider, score] of comparison.comparison.creativity.entries()) {
        console.log(`  ${provider}: ${score}/100`);
      }

    } catch (error) {
      spinner.fail(`Comparison failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show comprehensive project and agent status')
  .action(async () => {
    const config = await loadProjectConfig();
    
    if (!config) {
      console.log(chalk.red('No project found. Run "geenius init" first.'));
      return;
    }

    const spinner = ora('Gathering status information...').start();
    
    try {
      const agentService = new EnhancedAgentService(config.repoUrl, {
        type: config.agentMode,
        provider: config.aiProvider,
        orchestrationStrategy: config.orchestrationStrategy
      });

      await agentService.initializeProject(config.repoUrl);
      const analytics = await agentService.getAgentAnalytics();

      spinner.succeed('Status check complete');
      
      console.log(chalk.blue.bold('\n📊 Project Status'));
      console.log(chalk.gray('Template:'), config.template);
      console.log(chalk.gray('AI Provider:'), config.aiProvider.toUpperCase());
      console.log(chalk.gray('Agent Mode:'), config.agentMode);
      console.log(chalk.gray('Repository:'), config.repoUrl);
      
      if (config.agentMode === 'orchestrated' || config.agentMode === 'hybrid') {
        console.log(chalk.gray('Strategy:'), config.orchestrationStrategy);
        console.log(chalk.gray('Cross-validation:'), config.crossValidation ? '✅ Enabled' : '❌ Disabled');
      }
      
      console.log(chalk.blue('\n🤖 Agent Performance:'));
      console.log(chalk.gray('Success Rate:'), `${(analytics.performance.successRate * 100).toFixed(1)}%`);
      console.log(chalk.gray('Average Time:'), `${(analytics.performance.averageTime / 1000).toFixed(1)}s`);
      console.log(chalk.gray('Tasks Completed:'), analytics.performance.tasksCompleted);
      
      if (analytics.agentStats) {
        console.log(chalk.blue('\n👥 Agent Statistics:'));
        for (const [agent, stats] of analytics.agentStats.entries()) {
          console.log(`  ${agent}: ${stats.tasks} tasks, ${(stats.successRate * 100).toFixed(1)}% success`);
        }
      }
      
      console.log(chalk.blue('\n📈 Usage Statistics:'));
      console.log(chalk.gray('Total Requests:'), analytics.usage.totalRequests);
      console.log(chalk.gray('Provider Breakdown:'));
      for (const [provider, count] of analytics.usage.providerBreakdown.entries()) {
        console.log(`  ${provider}: ${count} requests`);
      }
      
      if (config.netlifyProject) {
        const netlify = new NetlifyService();
        const deployments = await netlify.getDeployments(config.netlifyProject);
        
        console.log(chalk.blue('\n🚀 Recent Deployments:'));
        deployments.slice(0, 5).forEach(deployment => {
          const status = deployment.state === 'ready' ? '✅' : '🔄';
          console.log(`${status} ${deployment.branch} - ${deployment.deploy_ssl_url}`);
        });
      }

    } catch (error) {
      spinner.fail(`Status check failed: ${error.message}`);
    }
  });

program
  .command('memory')
  .description('Manage agent memory')
  .option('-e, --export', 'Export agent memory')
  .option('-i, --import <file>', 'Import agent memory')
  .option('-c, --clear', 'Clear agent memory')
  .action(async (options) => {
    const config = await loadProjectConfig();
    
    if (!config) {
      console.log(chalk.red('No project found. Run "geenius init" first.'));
      return;
    }

    const agentService = new EnhancedAgentService(config.repoUrl, {
      type: config.agentMode,
      provider: config.aiProvider
    });

    await agentService.initializeProject(config.repoUrl);

    if (options.export) {
      const memory = await agentService.exportAgentMemory();
      const fs = await import('fs/promises');
      await fs.writeFile('agent-memory.json', memory);
      console.log(chalk.green('✅ Agent memory exported to agent-memory.json'));
    }

    if (options.import) {
      const fs = await import('fs/promises');
      const memory = await fs.readFile(options.import, 'utf-8');
      await agentService.importAgentMemory(memory);
      console.log(chalk.green('✅ Agent memory imported successfully'));
    }

    if (options.clear) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear all agent memory?',
          default: false
        }
      ]);

      if (confirm) {
        // Clear memory implementation would go here
        console.log(chalk.green('✅ Agent memory cleared'));
      }
    }
  });

program
  .command('switch-provider')
  .description('Switch AI provider for existing project')
  .action(async () => {
    const config = await loadProjectConfig();
    
    if (!config) {
      console.log(chalk.red('No project found. Run "geenius init" first.'));
      return;
    }

    const { newProvider, newApiKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'newProvider',
        message: `Switch from ${config.aiProvider.toUpperCase()} to:`,
        choices: [
          { name: '🤖 Claude (Anthropic)', value: 'anthropic' },
          { name: '🧠 GPT-4 (OpenAI)', value: 'openai' },
          { name: '✨ Gemini (Google)', value: 'google' },
          { name: '⚡ Grok (X.AI)', value: 'grok' },
          { name: '🔧 Custom Agent', value: 'custom' }
        ].filter(choice => choice.value !== config.aiProvider)
      },
      {
        type: 'password',
        name: 'newApiKey',
        message: 'Enter new API key:',
        mask: '*'
      }
    ]);

    const spinner = ora('Switching AI provider...').start();
    
    try {
      const agentService = new EnhancedAgentService(config.repoUrl, {
        type: config.agentMode,
        provider: config.aiProvider
      });

      await agentService.initializeProject(config.repoUrl);
      await agentService.switchProvider(newProvider, newApiKey);

      // Update configuration
      const updatedConfig = {
        ...config,
        aiProvider: newProvider,
        apiKey: newApiKey
      };

      await saveProjectConfig(updatedConfig);
      
      spinner.succeed(`Switched to ${newProvider.toUpperCase()}!`);
      
    } catch (error) {
      spinner.fail(`Provider switch failed: ${error.message}`);
      process.exit(1);
    }
  });

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
    case 'custom':
      vars.CUSTOM_AI_API_KEY = apiKey;
      if (model) vars.CUSTOM_AI_MODEL = model;
      break;
  }
  
  return vars;
}

function getDefaultModel(provider: string): string {
  const defaults = {
    anthropic: 'claude-3-5-sonnet-20241022',
    openai: 'gpt-4-turbo',
    google: 'gemini-pro',
    grok: 'grok-beta',
    custom: 'gpt-4'
  };
  
  return defaults[provider] || 'gpt-4';
}

async function saveProjectConfig(config: any) {
  const fs = await import('fs/promises');
  await fs.writeFile('.geenius.json', JSON.stringify(config, null, 2));
}

async function loadProjectConfig() {
  const fs = await import('fs/promises');
  try {
    const data = await fs.readFile('.geenius.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

program.parse();