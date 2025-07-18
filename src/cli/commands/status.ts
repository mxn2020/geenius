// src/cli/commands/status.ts
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../utils/config';
import { logger } from '../../utils/logger';
import { formatDuration } from '../../utils/helpers';
import { AgentService } from '../../agent/agent-service';
import { NetlifyService } from '../../services/netlify';

export async function statusCommand(): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  if (!config) {
    console.log(chalk.red('No project found. Run "dev-agent init" first.'));
    return;
  }

  const spinner = ora('Gathering status information...').start();
  
  try {
    // Initialize agent service
    const agentService = new AgentService(config.repoUrl, {
      type: config.agentMode,
      provider: config.aiProvider,
      orchestrationStrategy: config.orchestrationStrategy
    });

    await agentService.initializeProject(config.repoUrl);
    const analytics = await agentService.getAgentAnalytics();

    spinner.succeed('Status check complete');
    
    // Project information
    console.log(chalk.blue.bold('\n📊 Project Status'));
    console.log(chalk.gray('Name:'), config.name);
    console.log(chalk.gray('Template:'), config.template);
    console.log(chalk.gray('AI Provider:'), config.aiProvider.toUpperCase());
    console.log(chalk.gray('Agent Mode:'), config.agentMode);
    console.log(chalk.gray('Repository:'), config.repoUrl);
    console.log(chalk.gray('Created:'), new Date(config.createdAt).toLocaleDateString());
    console.log(chalk.gray('Updated:'), new Date(config.updatedAt).toLocaleDateString());
    
    if (config.agentMode === 'orchestrated' || config.agentMode === 'hybrid') {
      console.log(chalk.gray('Strategy:'), config.orchestrationStrategy);
      console.log(chalk.gray('Cross-validation:'), config.crossValidation ? '✅ Enabled' : '❌ Disabled');
    }
    
    // Agent performance
    console.log(chalk.blue('\n🤖 Agent Performance:'));
    console.log(chalk.gray('Success Rate:'), `${(analytics.performance.successRate * 100).toFixed(1)}%`);
    console.log(chalk.gray('Average Time:'), formatDuration(analytics.performance.averageTime));
    console.log(chalk.gray('Tasks Completed:'), analytics.performance.tasksCompleted);
    
    // Agent statistics
    if (analytics.agentStats) {
      console.log(chalk.blue('\n👥 Agent Statistics:'));
      for (const [agent, stats] of analytics.agentStats.entries()) {
        console.log(`  ${agent}: ${stats.tasks} tasks, ${(stats.successRate * 100).toFixed(1)}% success`);
      }
    }
    
    // Usage statistics
    console.log(chalk.blue('\n📈 Usage Statistics:'));
    console.log(chalk.gray('Total Requests:'), analytics.usage.totalRequests);
    console.log(chalk.gray('Provider Breakdown:'));
    for (const [provider, count] of analytics.usage.providerBreakdown.entries()) {
      console.log(`  ${provider}: ${count} requests`);
    }
    
    // Netlify deployments
    if (config.netlifyProject) {
      const netlify = new NetlifyService();
      const deployments = await netlify.getDeployments(config.netlifyProject);
      
      console.log(chalk.blue('\n🚀 Recent Deployments:'));
      deployments.slice(0, 5).forEach(deployment => {
        const status = deployment.state === 'ready' ? '✅' : '🔄';
        const time = new Date(deployment.created_at).toLocaleDateString();
        console.log(`${status} ${deployment.branch} (${time}) - ${deployment.deploy_ssl_url}`);
      });
    }

  } catch (error) {
    spinner.fail('Status check failed');
    logger.error('Status command failed', error);
    console.error(chalk.red(`\n❌ Status check failed: ${error.message}`));
    process.exit(1);
  }
}

