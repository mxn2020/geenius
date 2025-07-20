#!/usr/bin/env node
// bin/geenius.ts (Updated with custom agent support)
import { Command } from 'commander';
import { initCommand } from '../cli/commands/init';
import { developCommand } from '../cli/commands/develop';
import { statusCommand } from '../cli/commands/status';
import { compareAgentsCommand } from '../cli/commands/compare-agents';
import { memoryCommand } from '../cli/commands/memory';
import { switchProviderCommand } from '../cli/commands/switch-provider';

const program = new Command();

program
  .name('geenius')
  .description('AI-powered development workflow with custom agents and multi-provider support')
  .version('3.0.0');

// Add commands
program
  .command('init')
  .description('Initialize a new project with AI agent')
  .action(initCommand);

program
  .command('develop')
  .description('Start AI-powered development session')
  .option('-f, --feature <name>', 'Feature branch name')
  .option('-c, --complexity <level>', 'Task complexity (simple/medium/complex)')
  .option('-m, --mode <mode>', 'Agent mode override (single/orchestrated/auto)')
  .option('-p, --priority <level>', 'Task priority (low/medium/high/urgent)')
  .action(developCommand);

program
  .command('status')
  .description('Show comprehensive project and agent status')
  .action(statusCommand);

program
  .command('compare-agents')
  .description('Compare different AI providers on a task')
  .option('-p, --providers <providers>', 'Comma-separated list of providers')
  .action(compareAgentsCommand);

program
  .command('memory')
  .description('Manage agent memory')
  .option('-e, --export', 'Export agent memory')
  .option('-i, --import <file>', 'Import agent memory')
  .option('-c, --clear', 'Clear agent memory')
  .action(memoryCommand);

program
  .command('switch-provider')
  .description('Switch AI provider for existing project')
  .action(switchProviderCommand);

program.parse();