# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm run dev` - Start development CLI using tsx (for development/testing)
- `ppnpm build` - Build TypeScript to JavaScript
- `pnpm run start` - Run the built CLI tool
- `pnpm run test` - Run tests with vitest

### CLI Commands (via `pnpm run dev`)
- `pnpm run dev init` - Initialize new project with AI agent
- `pnpm run dev develop` - Start AI-powered development session  
- `pnpm run dev status` - Show project and agent status
- `pnpm run dev compare-agents` - Compare AI providers on a task
- `pnpm run dev memory` - Manage agent memory (export/import/clear)
- `pnpm run dev switch-provider` - Switch AI provider

### CLI Options
- `pnpm run dev --help` - Show all available commands
- `pnpm run dev <command> --help` - Show help for specific command

### Testing
- `npm run test` - Run all tests with vitest
- Tests are configured with jsdom environment
- Test setup files in `src/test/setup.ts`
- Coverage reporting with v8 provider

### Linting
- ESLint configuration in `eslint.config.js`
- Configured for JavaScript/JSX files
- Uses React hooks and refresh plugins
- Run with standard ESLint commands

## Architecture

### Core Components

**CLI System (`cli/`)**
- `index.ts` - Main CLI entry point using Commander.js
- `commands/` - Individual command implementations (init, develop, status, compare-agents, memory, switch-provider)
- Binary entry point: `bin/geenius.js`

**Agent System (`src/agent/`)**
- `custom-ai-agent.ts` - Base AI agent implementation
- `agent-orchestrator.ts` - Multi-agent coordination system with specialized roles (architect, developer, tester, reviewer, documenter)
- `agent-service.ts` -  agent capabilities
- `coding-agent.ts` - Specialized coding agent

**Template System (`src/repo-templates/`)**
- `template-registry.json` - Repository of AI-enabled project templates
- `template-fetcher.ts` - Template retrieval logic
- `template-validator.ts` - Template validation
- `templates.ts` - Template management utilities
- Supports 8 different tech stacks with AI provider configurations

**Services (`src/services/`)**
- `github.ts` - GitHub API integration
- `netlify.ts` - Netlify deployment
- `stackblitz.ts` - StackBlitz sandbox integration
- `sandbox-ai-runner.ts` - Sandboxed AI execution
- `test-runner.ts` - Test execution utilities

**Configuration & Utilities (`src/utils/`, `src/types/`)**
- `config.ts` - Configuration management
- `logger.ts` - Winston-based logging
- `validation.ts` - Input validation utilities
- Type definitions for agents, services, templates, and configuration

### Agent Orchestration

The system supports multiple orchestration strategies:
- **Sequential** - Tasks executed one after another
- **Parallel** - Multiple tasks executed simultaneously (respects maxConcurrency)
- **Hierarchical** - Lead agent coordinates specialized team members
- **Collaborative** - Multiple agents work together on each task

Specialized agent roles:
- **Lead Agent** - Senior engineering manager, task breakdown and coordination
- **Architect** - System design and technical decisions
- **Developer** - Feature implementation and coding
- **Tester** - Quality assurance and test creation
- **Reviewer** - Code review and best practices
- **Documenter** - Technical writing and documentation

### Multi-Provider AI Support

Supports multiple AI providers with different specializations:
- **Claude (Anthropic)** - Best for coding and technical tasks
- **GPT-4 (OpenAI)** - Most versatile, general development
- **Gemini (Google)** - Creative problem solving and analysis
- **Grok (X.AI)** - Fast responses with unique perspectives

### Template System

8 pre-configured templates with AI provider-specific configurations:
- Next.js + Supabase + Claude
- Vite + React + MongoDB + Gemini
- React + IndexedDB + JWT + OpenAI
- Vue + Pinia + Firebase + Gemini
- SvelteKit + Drizzle + PlanetScale + Claude
- Astro + Content Collections + OpenAI
- Express + Prisma + PostgreSQL + Grok
- Remix + SQLite + Auth + Claude

Each template includes:
- Pre-configured AI system prompts
- Specific tool integrations
- Environment variable requirements
- Build/test/deploy commands
- Documentation links

### Development Workflow

The system follows a structured development workflow:
1. **Planning** - AI analyzes requirements and creates implementation plan
2. **Development** - AI writes code following best practices
3. **Testing** - Comprehensive test suite creation and execution
4. **Review** - Code review and improvement suggestions
5. **Documentation** - Automatic documentation generation
6. **Deployment** - Preview deployment to platforms like Netlify

### Configuration Files

- `package.json` - Node.js project configuration with CLI binary
- `tsconfig.json` - TypeScript configuration with path aliases (`@/*` -> `./src/*`)
- `vite.config.js` - Vite configuration for frontend development with React, Tailwind, and test setup
- `eslint.config.js` - ESLint configuration for JavaScript/JSX
- `tailwind.config.js` - Tailwind CSS configuration
- `components.json` - Component library configuration

### Key Features

- **Memory System** - Persistent agent memory with export/import capabilities
- **Cross-Validation** - Quality assurance through multi-agent review
- **Sandbox Integration** - Safe execution environment with StackBlitz
- **GitHub Integration** - Automatic repository management and deployment
- **Performance Tracking** - Agent performance metrics and analytics
- **Template Validation** - Automated template verification and updates

### Entry Points

- CLI: `npm run dev` (development) or `npm run start` (production)
- Binary: `geenius` command after installation
- Main entry: `cli/index.ts`

The codebase is designed as a comprehensive AI-powered development workflow tool that can initialize projects, develop features, manage code quality, and deploy applications using various AI providers and orchestration strategies.