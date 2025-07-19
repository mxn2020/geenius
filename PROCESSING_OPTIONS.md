# Geenius AI Processing Options

This document describes the three agentic AI workflow options available in the Geenius system for processing change requests from templates.

## Overview

The Geenius system now supports three different approaches to process change requests submitted from templates:

1. **Serverside Processing** - Complete local server execution
2. **Vercel Sandbox Processing** - Vercel Function-based execution
3. **Browser StackBlitz Processing** - Browser-based execution with StackBlitz WebContainers

Each option has its own advantages and use cases.

## Option 1: Serverside Processing

**Endpoint:** `/api/process-changes-serverside`

### Description
Processes changes entirely on the server hosting the Geenius system using local resources.

### How it Works
1. Clones the repository to a temporary local directory
2. Sets up the development environment (npm install, etc.)
3. Uses the Agent Orchestrator to process changes with AI
4. Applies code changes directly to local files
5. Generates and runs tests
6. Creates commits and pushes to GitHub
7. Creates a pull request
8. Waits for Netlify deployment
9. Cleans up temporary directory

### Advantages
- Full control over the execution environment
- No external dependencies (except GitHub/Netlify)
- Can handle complex build processes
- Direct file system access

### Disadvantages
- Requires server resources (CPU, memory, disk space)
- Security concerns with untrusted code execution
- Limited scalability
- Requires proper cleanup to avoid resource leaks

### Use Cases
- Development/testing environments
- When you have dedicated server resources
- Complex projects requiring specific system dependencies
- When maximum control is needed

### Configuration
```javascript
{
  "processingType": "serverside",
  "aiProvider": "anthropic|openai|google|grok",
  "aiModel": "claude-3-5-sonnet-20241022" // optional
}
```

## Option 2: Vercel Sandbox Processing

**Endpoint:** `/api/process-changes-vercel`

### Description
Uses Vercel Functions as a sandbox environment for AI agent execution, following the pattern described in the video.md workshop.

### How it Works
1. Creates a Vercel Function deployment for the processing session
2. The Function clones the repository in its environment
3. Uses AI SDK with tools to process changes
4. Runs tests within the Vercel Function environment
5. Creates commits and pushes to GitHub
6. Creates a pull request
7. Leverages Vercel's auto-deployment for preview URLs

### Advantages
- Isolated execution environment
- Automatic scaling with Vercel
- Built-in deployment integration
- No server resource management needed
- Follows modern serverless patterns

### Disadvantages
- Requires Vercel Function deployment
- Limited by Vercel Function constraints (timeout, memory)
- More complex setup
- Dependent on Vercel service availability

### Use Cases
- Production environments
- When serverless architecture is preferred
- High-traffic scenarios requiring scaling
- Integration with Vercel ecosystem

### Configuration
```javascript
{
  "processingType": "vercel",
  "aiProvider": "anthropic|openai|google|grok",
  "aiModel": "claude-3-5-sonnet-20241022", // optional
  "vercelProjectId": "proj_...", // optional
  "vercelTeamId": "team_..." // optional
}
```

### Setup Requirements
1. Deploy the `vercel-function-template.js` as a Vercel Function
2. Set environment variables:
   - `GITHUB_TOKEN`
   - `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / etc.
   - `VERCEL_TOKEN`
3. Update `VERCEL_FUNCTION_BASE_URL` in the Geenius system

## Option 3: Browser StackBlitz Processing

**Endpoint:** `/api/process-changes-browser`

### Description
Opens a browser tab with a StackBlitz WebContainer that runs the AI agent, providing a visual interface for the processing.

### How it Works
1. Generates a StackBlitz project configuration
2. Creates a unique browser session URL
3. Opens StackBlitz with the project and AI agent code
4. The agent runs in the browser's WebContainer
5. User can monitor progress in real-time
6. Agent processes changes, runs tests, and creates PR
7. Reports results back to the main system

### Advantages
- Visual monitoring of the AI agent's work
- Uses StackBlitz WebContainers (secure sandboxing)
- No server resources required
- Educational/demonstration value
- User can intervene if needed

### Disadvantages
- Requires user to open and monitor browser tab
- Dependent on browser/internet connection
- Limited by WebContainer capabilities
- Manual intervention required

### Use Cases
- Development and debugging
- Educational environments
- When visual monitoring is desired
- Demonstration purposes
- When manual oversight is needed

### Configuration
```javascript
{
  "processingType": "browser",
  "aiProvider": "anthropic|openai|google|grok",
  "aiModel": "claude-3-5-sonnet-20241022" // optional
}
```

### User Experience
1. Submit changes through the template
2. Receive a browser URL in the response
3. Open the URL to see StackBlitz with the AI agent
4. Monitor the agent's progress in real-time
5. Agent automatically creates PR when complete

## API Usage

### Submitting Changes

All three endpoints accept the same payload format:

```javascript
POST /api/process-changes-{type}
Content-Type: application/json

{
  "submissionId": "unique-id",
  "timestamp": 1647123456789,
  "changes": [
    {
      "id": "change-1",
      "componentId": "Button",
      "feedback": "Make the button larger and add hover effects",
      "category": "UI/UX",
      "priority": "medium",
      "componentContext": {...},
      "pageContext": {...}
    }
  ],
  "globalContext": {
    "projectId": "project-123",
    "repositoryUrl": "https://github.com/user/repo",
    "aiProvider": "anthropic",
    "environment": "development"
  },
  "summary": {
    "totalChanges": 1,
    "categoryCounts": {"UI/UX": 1},
    "priorityCounts": {"medium": 1},
    "affectedComponents": ["Button"],
    "estimatedComplexity": "medium"
  }
}
```

### Response Format

```javascript
{
  "success": true,
  "sessionId": "session-123",
  "processingType": "serverside|vercel|browser",
  "statusUrl": "/api/process-changes-{type}/session-123",
  "estimatedProcessingTime": 120000, // milliseconds
  "browserUrl": "https://stackblitz.com/..." // only for browser type
}
```

### Monitoring Progress

```javascript
GET /api/process-changes-{type}/{sessionId}

Response:
{
  "sessionId": "session-123",
  "status": "ai_processing",
  "progress": 45,
  "logs": [...],
  "previewUrl": "https://preview-url...",
  "prUrl": "https://github.com/user/repo/pull/123",
  "branchName": "feature/geenius-improvements-123",
  "processingType": "serverside|vercel|browser"
}
```

## Status Flow

All processing types follow a similar status progression:

1. `initializing` - Setting up the processing environment
2. `sandbox_creating` / `project_cloning` / `browser_initializing` - Environment-specific setup
3. `ai_processing` - AI agent processing the changes
4. `testing` - Running the test suite
5. `pr_creating` - Creating the pull request
6. `deploying` - Waiting for deployment
7. `completed` - All processing finished successfully
8. `failed` - Processing failed at some step

## Environment Variables

Required environment variables for each option:

### Common
- `GITHUB_TOKEN` - GitHub API access
- `ANTHROPIC_API_KEY` - Anthropic AI API (if using)
- `OPENAI_API_KEY` - OpenAI API (if using)
- `GOOGLE_API_KEY` - Google AI API (if using)
- `GROK_API_KEY` - Grok API (if using)

### Serverside
- `NETLIFY_API_TOKEN` - Netlify deployment monitoring

### Vercel
- `VERCEL_TOKEN` - Vercel API access
- `VERCEL_FUNCTION_BASE_URL` - Base URL of deployed Vercel Function

### Browser
- No additional environment variables required

## Error Handling

Each option implements comprehensive error handling:

- Invalid payloads return 400 status codes
- Missing sessions return 404 status codes
- Processing errors are logged to the session
- Cleanup is performed on errors
- Detailed error messages are provided

## Security Considerations

### Serverside
- Executes code on the host server
- Requires careful input validation
- Temporary directories must be properly cleaned up
- Consider using Docker containers for isolation

### Vercel
- Executes in Vercel's sandboxed environment
- Limited by Vercel Function security model
- API tokens must be securely managed

### Browser
- Executes in StackBlitz WebContainer (secure sandbox)
- AI API keys are exposed to the browser
- Consider using proxy endpoints for sensitive operations

## Performance Characteristics

| Option | Setup Time | Processing Speed | Resource Usage | Scalability |
|--------|------------|------------------|----------------|-------------|
| Serverside | Fast | Fast | High | Limited |
| Vercel | Medium | Medium | Low | High |
| Browser | Slow | Medium | None | Manual |

## Choosing the Right Option

### Use Serverside When:
- You have dedicated server resources
- Maximum performance is required
- Complex build processes are involved
- Full control over the environment is needed

### Use Vercel When:
- Building a production system
- Serverless architecture is preferred
- Auto-scaling is required
- Integration with Vercel ecosystem exists

### Use Browser When:
- Developing or debugging the system
- Visual monitoring is desired
- Manual oversight is acceptable
- Demonstrating the AI agent's capabilities

## Migration Path

The system is designed to allow easy switching between options:

1. All options use the same payload format
2. Session monitoring is consistent across options
3. The template can be updated to support multiple options
4. Configuration changes don't require code modifications

This modular approach ensures that you can start with one option and migrate to others as needs evolve.