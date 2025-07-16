# Project File Structure

```
ai-dev-workflow/
├── bin/
│   └── dev-agent.js                    # CLI entry point (compiled)
├── src/
│   ├── agent/
│   │   ├── custom-ai-agent.ts          # Core custom AI agent with multi-provider support
│   │   ├── agent-orchestrator.ts       # Multi-agent orchestration system
│   │   ├── enhanced-agent-service.ts   # Main service integrating all agents
│   │   └── coding-agent.ts             # Original coding agent (legacy)
│   ├── services/
│   │   ├── github.ts                   # GitHub API integration
│   │   ├── netlify.ts                  # Netlify deployment service
│   │   ├── stackblitz.ts               # StackBlitz sandbox integration
│   │   ├── sandbox-ai-runner.ts        # AI CLI runner in sandbox
│   │   └── test-runner.ts              # Test execution service
│   ├── templates/
│   │   ├── index.ts                    # Template registry and metadata
│   │   ├── template-validator.ts       # Template validation utilities
│   │   ├── template-fetcher.ts         # Fetch template info from GitHub
│   │   └── template-registry.json      # Template repository URLs and metadata
│   ├── utils/
│   │   ├── config.ts                   # Configuration management
│   │   ├── logger.ts                   # Logging utilities
│   │   ├── validation.ts               # Input validation schemas
│   │   └── helpers.ts                  # Common helper functions
│   ├── types/
│   │   ├── agent.ts                    # Agent-related type definitions
│   │   ├── template.ts                 # Template type definitions
│   │   ├── service.ts                  # Service type definitions
│   │   └── config.ts                   # Configuration types
│   └── cli/
│       ├── commands/
│       │   ├── init.ts                 # Initialize project command
│       │   ├── develop.ts              # Development command
│       │   ├── status.ts               # Status command
│       │   ├── compare-agents.ts       # Agent comparison command
│       │   ├── memory.ts               # Memory management command
│       │   └── switch-provider.ts      # Provider switching command
│       └── index.ts                    # CLI command registration
# Templates are now separate GitHub repositories:
# https://github.com/ai-dev-workflow/template-nextjs-supabase
# https://github.com/ai-dev-workflow/geenius-template-vite-react-mongo
# https://github.com/ai-dev-workflow/template-react-indexeddb-jwt
# https://github.com/ai-dev-workflow/template-vue-pinia-firebase
# https://github.com/ai-dev-workflow/template-svelte-drizzle-planetscale
# https://github.com/ai-dev-workflow/template-astro-content-collections
# https://github.com/ai-dev-workflow/template-express-prisma-postgres
# https://github.com/ai-dev-workflow/template-remix-sqlite-auth
├── tests/
│   ├── unit/
│   │   ├── agent/
│   │   │   ├── custom-ai-agent.test.ts
│   │   │   ├── agent-orchestrator.test.ts
│   │   │   └── enhanced-agent-service.test.ts
│   │   ├── services/
│   │   │   ├── github.test.ts
│   │   │   ├── netlify.test.ts
│   │   │   └── stackblitz.test.ts
│   │   └── utils/
│   ├── integration/
│   │   ├── full-workflow.test.ts
│   │   ├── multi-agent-collaboration.test.ts
│   │   └── provider-switching.test.ts
│   ├── e2e/
│   │   ├── cli-commands.test.ts
│   │   ├── project-initialization.test.ts
│   │   └── feature-development.test.ts
│   ├── fixtures/
│   │   ├── sample-projects/
│   │   ├── mock-responses/
│   │   └── test-data/
│   └── helpers/
│       ├── test-utils.ts
│       ├── mock-services.ts
│       └── test-setup.ts
├── docs/
│   ├── README.md                       # Main documentation
│   ├── CONTRIBUTING.md                 # Contribution guidelines
│   ├── API.md                          # API documentation
│   ├── TEMPLATES.md                    # Template creation guide
│   ├── AGENTS.md                       # Agent system documentation
│   ├── ORCHESTRATION.md                # Multi-agent orchestration guide
│   ├── DEPLOYMENT.md                   # Deployment instructions
│   ├── TROUBLESHOOTING.md              # Common issues and solutions
│   └── examples/
│       ├── basic-usage.md
│       ├── advanced-workflows.md
│       ├── custom-templates.md
│       └── multi-agent-scenarios.md
├── scripts/
│   ├── build.sh                        # Build script
│   ├── test.sh                         # Test runner script
│   ├── setup-dev.sh                    # Development setup
│   ├── release.sh                      # Release preparation
│   └── generate-docs.sh                # Documentation generation
├── config/
│   ├── default.json                    # Default configuration
│   ├── development.json                # Development config
│   ├── production.json                 # Production config
│   └── test.json                       # Test configuration
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                      # Continuous integration
│   │   ├── release.yml                 # Release workflow
│   │   └── test.yml                    # Test workflow
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── template_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── examples/
│   ├── basic-project-init/
│   │   ├── .dev-agent.json
│   │   └── session-log.md
│   ├── multi-agent-development/
│   │   ├── requirements.md
│   │   ├── agent-contributions.json
│   │   └── timeline.md
│   ├── provider-comparison/
│   │   ├── task-description.md
│   │   ├── results.json
│   │   └── analysis.md
│   └── custom-template-creation/
│       ├── template-definition.ts
│       ├── setup-instructions.md
│       └── testing-guide.md
├── benchmarks/
│   ├── agent-performance/
│   │   ├── speed-tests.ts
│   │   ├── quality-assessment.ts
│   │   └── memory-usage.ts
│   ├── provider-comparison/
│   │   ├── response-time.ts
│   │   ├── code-quality.ts
│   │   └── creativity-score.ts
│   └── orchestration-efficiency/
│       ├── single-vs-multi.ts
│       ├── strategy-comparison.ts
│       └── scalability-tests.ts
├── package.json                        # Core dependencies only
├── tsconfig.json                       # TypeScript configuration
├── eslint.config.js                    # ESLint configuration
├── prettier.config.js                  # Prettier configuration
├── vitest.config.ts                    # Vitest configuration
├── docker-compose.yml                  # Local development services
├── Dockerfile                          # Container configuration
├── .env.example                        # Environment variables template
├── .gitignore                          # Git ignore rules
├── LICENSE                             # MIT license
├── CHANGELOG.md                        # Version history
└── README.md                           # Project overview

# Runtime Files (created during usage)
├── .dev-agent.json                     # Project configuration (auto-generated)
├── agent-memory.json                   # Exported agent memory
├── logs/
│   ├── agent-activity.log
│   ├── error.log
│   └── development-sessions.log
└── cache/
    ├── provider-responses/
    ├── template-cache/
    └── memory-snapshots/
```

## Key Directory Explanations

### 📁 `src/agent/`
Core AI agent implementations:
- **custom-ai-agent.ts**: Multi-provider agent with reasoning, memory, and tool usage
- **agent-orchestrator.ts**: Manages team of specialized agents
- **enhanced-agent-service.ts**: Main service that integrates everything

### 📁 `src/services/`
External service integrations:
- **github.ts**: Repository management, branching, commits, PRs
- **netlify.ts**: Deployment, environment variables, branch previews
- **stackblitz.ts**: Sandbox environment for safe code execution
- **sandbox-ai-runner.ts**: Runs AI CLIs (Claude Code, Gemini, etc.) in sandbox

### 📁 `src/templates/`
Template definitions and metadata:
- **index.ts**: All template configurations and exports
- Individual template folders contain the actual starter code

### 📁 `templates/`
Actual template repositories:
- Complete starter projects for each stack
- Ready to fork and customize
- Include tests, documentation, and deployment config

### 📁 `src/cli/`
CLI command implementations:
- Separated by command for maintainability
- Each command handles its own argument parsing and execution

### 📁 `tests/`
Comprehensive test suite:
- **unit/**: Individual component tests
- **integration/**: Service interaction tests
- **e2e/**: Full workflow tests
- **fixtures/**: Test data and mocks

### 📁 `docs/`
Documentation and guides:
- User guides, API docs, troubleshooting
- Examples and tutorials
- Contribution guidelines

### 📁 `examples/`
Real-world usage examples:
- Complete session logs
- Configuration examples
- Best practices demonstrations

## Usage Context

### Development Workflow
```bash
# User runs this
dev-agent init

# Which executes
src/cli/commands/init.ts
  ↓
src/services/github.ts (fork template)
  ↓
src/services/netlify.ts (setup deployment)
  ↓
src/agent/enhanced-agent-service.ts (initialize AI)
  ↓
.dev-agent.json (save config)
```

### Feature Development
```bash
# User runs this
dev-agent develop

# Which executes
src/cli/commands/develop.ts
  ↓
src/agent/enhanced-agent-service.ts
  ↓
src/agent/custom-ai-agent.ts OR src/agent/agent-orchestrator.ts
  ↓
src/services/stackblitz.ts (sandbox execution)
  ↓
src/services/github.ts (commit changes)
  ↓
src/services/netlify.ts (deploy preview)
```

This structure provides clean separation of concerns, comprehensive testing, and excellent developer experience while maintaining the flexibility to add new providers, templates, and orchestration strategies.
