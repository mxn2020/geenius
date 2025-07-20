# Agentic AI System Implementation Plan

## Executive Summary

This document outlines the implementation plan for an agentic AI system that processes template app changes and automatically applies them to the geenius system through GitHub workflows. The system will create a seamless feedback loop between deployed templates and the main geenius repository.

## Current Architecture Analysis

### Geenius System (Main System)
- **Purpose**: AI-powered development workflow tool with CLI and web interface
- **Tech Stack**: Node.js, TypeScript, Vite, Netlify Functions
- **Key Components**:
  - Agent orchestration system with multiple AI providers
  - Template registry and management
  - GitHub/Netlify integration services
  - Web interface for project management

### Geenius Template (Template App)
- **Purpose**: Deployable template with dev-container system for change requests
- **Tech Stack**: Vite + React + TypeScript + MongoDB + Prisma
- **Key Components**:
  - Dev-container wrapper system for all UI components
  - Component registry mapping components to file paths
  - Change submission dialog with status tracking
  - Better Auth integration

### Current Change Flow
1. Template app collects user changes via dev-container system
2. Changes submitted to geenius system via API
3. Basic processing exists but needs enhancement for GitHub workflow

## Implementation Plan Options

### Phase 1: Core Infrastructure Setup

#### Option A: Minimal GitHub Integration (Recommended for POC)
**Scope**: Basic GitHub API integration with manual merge process
- ✅ **Pros**: Fast to implement, low complexity, good for testing
- ❌ **Cons**: Manual steps required, limited automation

**Implementation**:
1. Enhance existing `/api/process-changes` endpoint
2. Add GitHub API file retrieval
3. Simple branch creation and push
4. Manual PR review and merge

#### Option B: Full GitHub Actions Integration
**Scope**: Complete automation with GitHub Actions workflows
- ✅ **Pros**: Fully automated, production-ready
- ❌ **Cons**: Complex setup, longer development time

**Implementation**:
1. Create GitHub Actions workflows for AI processing
2. Implement webhook handlers for status updates
3. Automated testing and deployment pipeline

**Recommendation**: Start with Option A for POC, then enhance to Option B

### Phase 2: AI Processing Architecture

#### Option A: Server-Side AI Processing (Recommended)
**Architecture**: AI agents run on Netlify Functions with queue system
```
Template → Geenius API → Queue → AI Agent → GitHub API → Status Updates
```
- ✅ **Pros**: Centralized control, easier debugging, cost-effective
- ❌ **Cons**: Function timeout limits, scaling concerns

#### Option B: GitHub Actions AI Processing
**Architecture**: AI processing happens in GitHub Actions runners
```
Template → Geenius API → GitHub Actions → AI Processing → PR Creation
```
- ✅ **Pros**: Unlimited processing time, GitHub native integration
- ❌ **Cons**: Complex secret management, GitHub Actions costs

#### Option C: Hybrid Approach
**Architecture**: Lightweight orchestration + GitHub Actions for heavy processing
```
Template → Geenius API → Orchestrator → GitHub Actions → Status Webhooks
```
- ✅ **Pros**: Best of both worlds, scalable
- ❌ **Cons**: Most complex to implement

**Recommendation**: Option A for POC, Option C for production

### Phase 3: File Processing Strategy

#### Option A: Component-Centric Processing (Recommended)
**Strategy**: Group changes by affected files, process file-by-file
```javascript
// Pseudo-code flow
const affectedFiles = groupChangesByFile(changes);
for (const filePath of affectedFiles) {
  const fileChanges = changes.filter(c => c.filePath === filePath);
  await processFileChanges(filePath, fileChanges);
}
```
- ✅ **Pros**: Efficient, maintains file consistency, easier testing
- ❌ **Cons**: May miss cross-file dependencies

#### Option B: Change-Request Processing
**Strategy**: Process each change request individually
- ✅ **Pros**: Simple logic, granular control
- ❌ **Cons**: Inefficient, potential conflicts between changes

#### Option C: Dependency-Aware Processing
**Strategy**: Analyze dependencies and process in optimal order
- ✅ **Pros**: Handles complex scenarios, optimal results
- ❌ **Cons**: Complex dependency analysis required

**Recommendation**: Option A with fallback to dependency analysis for complex cases

### Phase 4: Testing Strategy

#### Option A: Automated Playwright Testing (Recommended)
**Implementation**: Generate and run Playwright tests for each change
```typescript
// Auto-generated test example
test('Hero button color change', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('[data-testid="hero-start-building"]');
  await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 0)');
});
```
- ✅ **Pros**: Comprehensive testing, visual validation
- ❌ **Cons**: Test generation complexity

#### Option B: Component Unit Testing
**Implementation**: Generate Jest/Vitest tests for component changes
- ✅ **Pros**: Fast execution, focused testing
- ❌ **Cons**: Limited integration coverage

#### Option C: Manual Testing with Screenshots
**Implementation**: Deploy preview and capture screenshots for manual review
- ✅ **Pros**: Simple implementation, human validation
- ❌ **Cons**: No automation, manual bottleneck

**Recommendation**: Option A with Option C as backup

### Phase 5: Branch Management Strategy

#### Option A: Feature Branch per Session (Recommended)
**Pattern**: `ai-update-session-${sessionId}-${timestamp}`
- ✅ **Pros**: Clear isolation, easy tracking, supports multiple simultaneous changes
- ❌ **Cons**: Many branches created

#### Option B: Feature Branch per Component
**Pattern**: `ai-update-component-${componentId}-${timestamp}`
- ✅ **Pros**: Component-focused, logical grouping
- ❌ **Cons**: Complex when changes span multiple components

#### Option C: Single Rolling Feature Branch
**Pattern**: `ai-updates-rolling`
- ✅ **Pros**: Fewer branches, continuous integration
- ❌ **Cons**: Potential conflicts, harder to track individual changes

**Recommendation**: Option A for POC, consider Option C for high-volume production

## Detailed Implementation Phases

### Phase 1: Foundation (Proof of Concept)
**Timeline**: 1-2 weeks
**Goal**: Basic end-to-end flow working

#### 1.1 Enhanced Change Processing API
```typescript
// /api/process-changes.ts - Enhanced
interface ProcessingSession {
  sessionId: string;
  status: 'received' | 'analyzing' | 'processing' | 'creating_branch' | 'testing' | 'completed' | 'failed';
  changes: ChangeRequest[];
  repositoryUrl: string;
  branchName?: string;
  prUrl?: string;
  previewUrl?: string;
  logs: ProcessingLog[];
  error?: string;
}
```

#### 1.2 GitHub Integration Service
```typescript
// /api/shared/github-service-enhanced.ts
class GitHubService {
  async retrieveFiles(repoUrl: string, filePaths: string[]): Promise<FileContent[]>
  async createFeatureBranch(repoUrl: string, baseBranch: string): Promise<string>
  async commitChanges(repoUrl: string, branch: string, changes: FileChange[]): Promise<void>
  async createPullRequest(repoUrl: string, branch: string, title: string, body: string): Promise<string>
  async mergePullRequest(prUrl: string): Promise<void>
}
```

#### 1.3 AI File Processor
```typescript
// /api/shared/ai-file-processor.ts
class AIFileProcessor {
  async processFileChanges(
    filePath: string, 
    fileContent: string, 
    changes: ChangeRequest[]
  ): Promise<{
    updatedContent: string;
    explanation: string;
    testSuggestions: string[];
  }>
}
```

### Phase 2: Enhanced AI Processing
**Timeline**: 2-3 weeks
**Goal**: Intelligent change processing with context awareness

#### 2.1 Component Dependency Analysis
```typescript
// Analyze imports and dependencies
class DependencyAnalyzer {
  async analyzeFileDependencies(filePath: string, content: string): Promise<{
    imports: string[];
    exports: string[];
    relatedFiles: string[];
    affectedComponents: string[];
  }>
}
```

#### 2.2 Multi-Agent Processing
```typescript
// Use existing agent orchestration system
const processingPipeline = [
  { agent: 'analyzer', task: 'understand_changes' },
  { agent: 'developer', task: 'implement_changes' },
  { agent: 'tester', task: 'generate_tests' },
  { agent: 'reviewer', task: 'review_implementation' }
];
```

### Phase 3: Testing Automation
**Timeline**: 1-2 weeks
**Goal**: Automated testing and validation

#### 3.1 Test Generation
```typescript
class TestGenerator {
  async generatePlaywrightTests(changes: ChangeRequest[]): Promise<TestFile[]>
  async generateUnitTests(filePath: string, changes: ChangeRequest[]): Promise<TestFile[]>
}
```

#### 3.2 Preview Deployment Integration
```typescript
// Enhanced Netlify integration
class PreviewDeployment {
  async waitForDeployment(deploymentUrl: string): Promise<DeploymentStatus>
  async runTests(previewUrl: string, tests: TestFile[]): Promise<TestResults>
  async captureScreenshots(previewUrl: string): Promise<Screenshot[]>
}
```

### Phase 4: Production Features
**Timeline**: 2-3 weeks
**Goal**: Production-ready with advanced features

#### 4.1 GitHub Actions Integration
```yaml
# .github/workflows/ai-processing.yml
name: AI Change Processing
on:
  repository_dispatch:
    types: [ai-process-changes]
jobs:
  process-changes:
    runs-on: ubuntu-latest
    steps:
      - name: Process Changes with AI
        uses: ./.github/actions/ai-processor
```

#### 4.2 Advanced Status Tracking
```typescript
// Real-time status updates via webhooks
interface StatusUpdate {
  sessionId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  logs: ProcessingLog[];
  previewUrl?: string;
  prUrl?: string;
}
```

## Security Considerations

### Authentication & Authorization
- GitHub Personal Access Tokens with minimal required permissions
- Repository-specific tokens for template apps
- Secure secret management in Netlify environment variables

### Code Safety
```typescript
// Code validation before processing
class SecurityValidator {
  async validateChangeRequests(changes: ChangeRequest[]): Promise<ValidationResult>
  async scanGeneratedCode(content: string): Promise<SecurityIssue[]>
  async validateFileOperations(operations: FileOperation[]): Promise<boolean>
}
```

### Rate Limiting
```typescript
// API rate limiting
const rateLimiter = {
  github: '5000 requests/hour per token',
  ai_provider: 'Per provider limits',
  netlify_functions: '100k requests/month'
};
```

## Error Handling & Recovery

### Retry Mechanisms
```typescript
class RetryHandler {
  async retryWithBackoff<T>(operation: () => Promise<T>, maxRetries: number): Promise<T>
  async recoverFromFailure(sessionId: string, error: ProcessingError): Promise<void>
}
```

### Rollback Procedures
```typescript
// Automatic rollback on critical failures
class RollbackManager {
  async rollbackBranch(sessionId: string): Promise<void>
  async cleanupFailedDeployment(deploymentId: string): Promise<void>
}
```

## Monitoring & Logging

### Comprehensive Logging
```typescript
interface ProcessingLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  sessionId: string;
}
```

### Performance Metrics
- Processing time per change
- Success/failure rates
- AI provider response times
- GitHub API usage

## Cost Optimization

### AI Provider Usage
- Smart prompt optimization
- Caching for similar changes
- Provider selection based on change complexity

### GitHub API Efficiency
- Batch file operations
- Minimize API calls through caching
- Efficient diff generation

### Netlify Function Optimization
- Function warming strategies
- Efficient memory usage
- Background job processing

## Questions for Discussion

### Technical Architecture
1. **AI Provider Strategy**: Should we use a single AI provider (Claude) for consistency, or implement provider selection based on change type/complexity?

2. **Processing Location**: Do you prefer server-side processing (Netlify Functions) or GitHub Actions-based processing for the AI agents?

3. **Repository Structure**: Should the AI processing logic live in the geenius repo, or should we create a separate repository for the GitHub Actions workflows?

### GitHub Integration
4. **Branch Naming Convention**: What naming pattern do you prefer for feature branches? Should they include user identification or session information?

5. **Base Branch Strategy**: Should we always branch from `develop`, or allow users to specify the base branch?

6. **Auto-merge Policy**: Under what conditions should the system automatically merge to develop? Should it always require manual approval?

### Testing Strategy
7. **Test Generation**: Should we generate tests for every change, or only for certain types of changes (e.g., UI modifications)?

8. **Test Framework Preference**: Do you have a preference between Playwright (E2E) vs Jest/Vitest (unit) for automated testing?

### User Experience
9. **Status Updates Frequency**: How often should the template app poll for status updates? Every 2 seconds, or should we implement real-time updates via webhooks?

10. **Error Recovery**: When AI processing fails, should the system automatically retry with different parameters, or always require manual intervention?

### Deployment Strategy
11. **Environment Management**: Should preview deployments use a separate Netlify site/account, or deploy to the same site with different URLs?

12. **Cleanup Policy**: How long should feature branches and preview deployments be kept before automatic cleanup?

### Security & Access Control
13. **Token Management**: Should each template deployment have its own GitHub token, or should we use a shared service account?

14. **Change Validation**: What level of validation should we implement for incoming change requests to prevent malicious modifications?

### Scalability Planning
15. **Concurrent Processing**: How many change processing sessions should we allow simultaneously? Should there be limits per repository or globally?

16. **Resource Allocation**: What are your thoughts on implementing a queue system for high-volume scenarios?

Please review these options and questions. Based on your preferences, I'll refine the implementation plan and we can begin with the proof of concept phase.

My answers:

Phase 1:
Option A

Phase 2:
Option A  if possible with netlify functions (i have set them to folder /api, check netlify.toml files)

Phase 3:
Option A

Phase 4:
Option A + B

Phase 5:
kind of Option B, file focused, as we apply changes per file, let ai create a feature name, feature/(ai generated name), then provide a good description in the commit messages. ensure always continous commits step by step. ai should be able to make the updates, commit, check its updates, refine or update again if needed, check again until changes are implemented correctly.

answers for questions:
1. provider selection (check env file, its already implemented)
2. absolutely server side (netlify functiosns in api folder) first, once it works we move on to add github actions and track them in netlify functions
3. it should live in the geenius repo
4. ai should be able to name the second part of the feature branches: feature/xxxxx
5. yes, always from develop. once a feature has been implemented it should be marked as done somehow so it can be deleted or archived
6. no auto merge for now, we will look into this later
7. tests for every combined changes of a file. as we combien changes per file
8. i heard the word "test-suite". maybe that? 
9. every 2 seconds for now, real-time later
10. retry 3 times, then ask user to retry manually, show the exact error message when and after retrying
11. netlify automatically deplyos feature branches within the same project, so we can use that and just grab the link
12. we should have a cleanup dialog for that for manual removal and no automatic removal for now
13. lets keep it simple and public for now, we can always change it later
14. let ai validate the changes and only accept changes that are related to the app, no unrelated changes
15. for now no concurrent processes
16. not needed for now, we want a proof of conecept first
