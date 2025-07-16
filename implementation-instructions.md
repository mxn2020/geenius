# AI Development Workflow - Implementation Instructions

## 📋 Overview

This document provides comprehensive instructions for an AI agent to implement the complete AI Development Workflow project. The agent should read this document and execute the implementation step-by-step.

## 🎯 Project Goal

Create a CLI tool that orchestrates AI agents (Claude, GPT-4, Gemini, Grok) to develop software projects using templates, with features like:
- Multi-provider AI support
- Single agent and multi-agent orchestration
- Template-based project initialization
- Sandbox development environment (StackBlitz)
- GitHub integration and deployment (Netlify)

## 📁 Target Directory Structure

```
ai-dev-workflow/
├── bin/
│   └── dev-agent.js                    # CLI entry point (compiled) ALREADY CREATED ✅
├── src/
│   ├── agent/
│   │   ├── custom-ai-agent.ts          # ALREADY CREATED ✅
│   │   ├── agent-orchestrator.ts       # ALREADY CREATED ✅
│   │   ├── enhanced-agent-service.ts   # ALREADY CREATED ✅
│   │   └── enhanced-coding-agent.ts    # ALREADY CREATED ✅
│   ├── services/
│   │   ├── github.ts                   # ALREADY CREATED ✅
│   │   ├── netlify.ts                  # ALREADY CREATED ✅
│   │   ├── stackblitz.ts               # ALREADY CREATED ✅
│   │   ├── sandbox-ai-runner.ts        # ALREADY CREATED ✅
│   │   └── test-runner.ts              # ALREADY CREATED ✅
│   ├── templates/
│   │   ├── index.ts                    # ALREADY CREATED ✅
│   │   ├── template-validator.ts       # ALREADY CREATED ✅
│   │   ├── template-fetcher.ts         # ALREADY CREATED ✅
│   │   └── template-registry.json      # ALREADY CREATED ✅
│   ├── utils/
│   │   ├── config.ts                   # ALREADY CREATED ✅
│   │   ├── logger.ts                   # ALREADY CREATED ✅
│   │   ├── validation.ts               # ALREADY CREATED ✅
│   │   └── helpers.ts                  # ALREADY CREATED ✅
│   ├── types/
│   │   ├── agent.ts                    # ALREADY CREATED ✅
│   │   ├── template.ts                 # ALREADY CREATED ✅
│   │   ├── service.ts                  # ALREADY CREATED ✅
│   │   └── config.ts                   # ALREADY CREATED ✅
│   └── cli/
│       ├── commands/
│       │   ├── init.ts                 # ALREADY CREATED ✅
│       │   ├── develop.ts              # ALREADY CREATED ✅
│       │   ├── status.ts               # ALREADY CREATED ✅
│       │   ├── compare-agents.ts       # ALREADY CREATED ✅
│       │   ├── memory.ts               # ALREADY CREATED ✅
│       │   └── switch-provider.ts      # ALREADY CREATED ✅
│       └── index.ts                    # ALREADY CREATED ✅
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   └── README.md                       # ALREADY CREATED ✅
├── package.json                        # ALREADY CREATED ✅ CHECK FOR UPDATES (minimal)
├── tsconfig.json                       # ALREADY CREATED ✅ CHECK FOR UPDATES (minimal)
├── .env.example                        # TO CREATE
└── README.md                           # ALREADY CREATED ✅
```

## 🔧 Implementation Steps

### STEP 1: Check Project Setup and File Organization

1. **Check if all files exist**
2. **Implement missing files:**

3. **Create minimal package.json:**
```json
{
  "name": "ai-dev-workflow",
  "version": "1.0.0",
  "description": "AI-powered development workflow with multi-provider support",
  "type": "module",
  "bin": {
    "dev-agent": "./bin/dev-agent.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest",
    "start": "node bin/dev-agent.js"
  },
  "dependencies": {
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.50",
    "@ai-sdk/anthropic": "^0.0.50",
    "@ai-sdk/google": "^0.0.50",
    "@stackblitz/sdk": "^1.9.0",
    "netlify": "^13.0.0",
    "octokit": "^3.0.0",
    "commander": "^11.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/inquirer": "^9.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  }
}
```

### STEP 2: Create TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "declaration": true,
    "declarationMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### STEP 3: Create Type Definitions

**Read these existing files for context:**
- `src/agent/custom-ai-agent.ts` - for agent interfaces
- `src/services/github.ts` - for service interfaces
- `src/repo-templates/index.ts` - for template interfaces

Create `src/types/agent.ts`:
```typescript
// Extract and define all agent-related types from existing agent files
// Include: AgentConfig, AgentRole, AgentTeam, Task, OrchestrationStrategy, etc.
```

Create `src/types/template.ts`:
```typescript
// Extract template types from existing template files
// Include: ProjectTemplate, AIEnabledTemplate, TemplateConfig, etc.
```

Create `src/types/service.ts`:
```typescript
// Extract service types from existing service files
// Include: GitHubService interfaces, NetlifyService interfaces, etc.
```

Create `src/types/config.ts`:
```typescript
// Define configuration types
// Include: ProjectConfig, AIProviderConfig, DeploymentConfig, etc.
```

### STEP 4: Create Utility Functions

Create `src/utils/config.ts`:
```typescript
// Configuration management utilities
// Functions: loadConfig, saveConfig, validateConfig, getEnvVar
// Should handle .dev-agent.json file operations
```

Create `src/utils/logger.ts`:
```typescript
// Logging utilities using winston
// Different log levels, file logging, console logging
// Integration with CLI progress indicators
```

Create `src/utils/validation.ts`:
```typescript
// Input validation using zod
// Validate API keys, project names, template configurations
// CLI input validation schemas
```

Create `src/utils/helpers.ts`:
```typescript
// Common helper functions
// String manipulation, file operations, async utilities
// Error handling helpers
```

### STEP 5: Create CLI Command Structure

**Read this file for context:**
- `src/cli/index.ts` (the moved updated-cli-with-custom-agents.ts file)

Create `src/cli/commands/init.ts`:
```typescript
// Extract init command logic from main CLI file
// Handle template selection, project setup, GitHub forking
// Use: TemplateRegistry, GitHubService, NetlifyService
```

Create `src/cli/commands/develop.ts`:
```typescript
// Extract develop command logic from main CLI file
// Handle feature development, agent orchestration
// Use: EnhancedAgentService, AgentOrchestrator
```

Create `src/cli/commands/status.ts`:
```typescript
// Extract status command logic from main CLI file
// Show project status, agent performance, deployments
// Use: All services for comprehensive status
```

Create `src/cli/commands/compare-agents.ts`:
```typescript
// Extract compare-agents command logic from main CLI file
// Run agent comparison across providers
// Use: EnhancedAgentService
```

Create `src/cli/commands/memory.ts`:
```typescript
// Extract memory command logic from main CLI file
// Handle agent memory import/export/clear
// Use: Agent memory management functions
```

Create `src/cli/commands/switch-provider.ts`:
```typescript
// Extract switch-provider command logic from main CLI file
// Handle switching between AI providers
// Use: Configuration management
```

Update `src/cli/index.ts`:
```typescript
// Clean up the main CLI file to just register commands
// Import and register all command modules
// Keep main program structure but delegate to command files
```

### STEP 6: Create Template Validator

Create `src/templates/template-validator.ts`:
```typescript
// Template validation utilities
// Validate template repository structure
// Check required files, package.json scripts, etc.
// Use existing template-fetcher.ts as reference
```

### STEP 7: Create Environment Configuration

Create `.env.example`:
```env
# AI Provider API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
GROK_API_KEY=your_grok_key

# GitHub Integration
GITHUB_TOKEN=your_github_token

# Netlify Deployment
NETLIFY_TOKEN=your_netlify_token

# StackBlitz Integration
STACKBLITZ_TOKEN=your_stackblitz_token

# Development
NODE_ENV=development
LOG_LEVEL=info
```

### STEP 8: Fix Import Paths

**CRITICAL**: Update all import statements in moved files to use correct relative paths:
- Update imports in `src/agent/` files
- Update imports in `src/services/` files
- Update imports in `src/templates/` files
- Update imports in `src/cli/` files

### STEP 9: Create Build Configuration

Create `bin/dev-agent.js`:
```javascript
#!/usr/bin/env node
import('../dist/cli/index.js');
```

### STEP 10: Create Basic Tests

Create `tests/unit/agent/custom-ai-agent.test.ts`:
```typescript
// Basic unit tests for custom AI agent
// Test agent initialization, provider switching, basic functionality
```

Create `tests/integration/full-workflow.test.ts`:
```typescript
// Integration test for complete workflow
// Test project initialization, development, deployment
```

## 🔍 Implementation Guidelines

### Code Quality Standards
- Use TypeScript strict mode
- Follow ESLint configuration
- Add JSDoc comments for public APIs
- Use proper error handling with try-catch
- Implement proper logging throughout

### Dependencies Management
- Keep dependencies minimal
- Use peer dependencies where appropriate
- Prefer native Node.js modules when possible
- Document why each dependency is needed

### Error Handling
- Use custom error classes
- Provide helpful error messages
- Include error codes for programmatic handling
- Log errors appropriately

### Testing Strategy
- Unit tests for individual components
- Integration tests for service interactions
- E2E tests for complete workflows
- Mock external services in tests

## 🎨 Code Style Guidelines

### File Naming
- Use kebab-case for file names
- Use PascalCase for class names
- Use camelCase for function names
- Use UPPER_SNAKE_CASE for constants

### Import Organization
```typescript
// 1. Node.js built-in modules
import { readFileSync } from 'fs';

// 2. Third-party modules
import { Octokit } from 'octokit';
import chalk from 'chalk';

// 3. Internal modules (relative imports)
import { CustomAIAgent } from './custom-ai-agent.js';
import type { AgentConfig } from '../types/agent.js';
```

### Function Documentation
```typescript
/**
 * Initializes a new AI development project
 * @param templateId - The template identifier
 * @param projectName - Name of the project
 * @param options - Configuration options
 * @returns Promise resolving to project configuration
 */
export async function initializeProject(
  templateId: string,
  projectName: string,
  options: InitOptions
): Promise<ProjectConfig> {
  // Implementation
}
```

## 🚀 Execution Priority

1. **Setup & Organization** (Steps 1-2) - Get basic structure
2. **Type Definitions** (Step 3) - Define all interfaces
3. **Utilities** (Step 4) - Create helper functions
4. **CLI Commands** (Step 5) - Break apart main CLI
5. **Remaining Files** (Steps 6-9) - Complete implementation
6. **Testing** (Step 10) - Ensure quality

## 📚 Context Files to Read

When implementing each component, read these files for context:

### For Agent Components:
- `src/agent/custom-ai-agent.ts`
- `src/agent/agent-orchestrator.ts`
- `src/agent/enhanced-agent-service.ts`

### For Services:
- `src/services/github.ts`
- `src/services/netlify.ts`
- `src/services/stackblitz.ts`

### For Templates:
- `src/repo-templates/index.ts`
- `src/templates/template-fetcher.ts`
- `src/templates/template-registry.json`

### For CLI:
- `src/cli/index.ts` (the main CLI file)

## 🎯 Success Criteria

The implementation is complete when:
- [ ] All directories and files are created
- [ ] All existing files are moved to correct locations
- [ ] All import paths are updated and working
- [ ] TypeScript compilation succeeds
- [ ] Basic CLI commands work (`dev-agent --help`)
- [ ] Project can be initialized with a template
- [ ] Tests pass
- [ ] Documentation is accurate

## 🔧 Development Commands

After implementation:
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Test CLI
npm run dev -- --help

# Run tests
npm test

# Start development
npm run dev
```

This implementation will create a comprehensive AI development workflow tool that can orchestrate multiple AI providers to develop software projects efficiently.
