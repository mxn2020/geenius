// src/cli/index.ts
import 'dotenv/config';
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { developCommand } from './commands/develop';
import { statusCommand } from './commands/status';
import { compareAgentsCommand } from './commands/compare-agents';
import { memoryCommand } from './commands/memory';
import { switchProviderCommand } from './commands/switch-provider';
import { logger } from '../utils/logger';

const program = new Command();

program
  .name('dev-agent')
  .description('AI-powered development workflow with custom agents and multi-provider support')
  .version('3.0.0');

program
  .command('init')
  .description('Initialize a new project with AI agent')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      logger.error('Init command error', error);
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
    try {
      await developCommand(options);
    } catch (error) {
      logger.error('Develop command error', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show comprehensive project and agent status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      logger.error('Status command error', error);
      process.exit(1);
    }
  });

program
  .command('compare-agents')
  .description('Compare different AI providers on a task')
  .option('-p, --providers <providers>', 'Comma-separated list of providers')
  .action(async (options) => {
    try {
      await compareAgentsCommand(options);
    } catch (error) {
      logger.error('Compare agents command error', error);
      process.exit(1);
    }
  });

program
  .command('memory')
  .description('Manage agent memory')
  .option('-e, --export', 'Export agent memory')
  .option('-i, --import <file>', 'Import agent memory')
  .option('-c, --clear', 'Clear agent memory')
  .action(async (options) => {
    try {
      await memoryCommand(options);
    } catch (error) {
      logger.error('Memory command error', error);
      process.exit(1);
    }
  });

program
  .command('switch-provider')
  .description('Switch AI provider for existing project')
  .action(async () => {
    try {
      await switchProviderCommand();
    } catch (error) {
      logger.error('Switch provider command error', error);
      process.exit(1);
    }
  });

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();