// Enhanced Agentic AI Process Changes API
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager, EnhancedProcessingSession } from './shared/enhanced-session-manager';
import { EnhancedGitHubService, FileChange } from './shared/enhanced-github-service';
import { AIFileProcessor, ChangeRequest } from './shared/ai-file-processor';
import { NetlifyService } from './shared/netlify-service';

// Types
interface SubmissionPayload {
  submissionId: string;
  timestamp: number;
  changes: ChangeRequest[];
  globalContext: {
    projectId: string;
    environment: string;
    version: string;
    repositoryUrl: string;
    userInfo: any;
    aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
    aiModel?: string;
  };
  summary: {
    totalChanges: number;
    categoryCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    affectedComponents: string[];
    estimatedComplexity: string;
  };
}

interface SubmissionResponse {
  success: boolean;
  sessionId: string;
  submissionId: string;
  message: string;
  statusUrl: string;
  estimatedProcessingTime: number;
  error?: string;
}

// Initialize services
const sessionManager = new EnhancedSessionManager();
const githubService = new EnhancedGitHubService();
const netlifyService = new NetlifyService();

/**
 * Main processing function with enhanced workflow
 */
async function processChangesEnhanced(sessionId: string, payload: SubmissionPayload): Promise<void> {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Phase 1: Validation
    await sessionManager.updateSessionStatus(sessionId, 'validating', 5, 'Validating change requests...');
    
    const aiProcessor = new AIFileProcessor(payload.globalContext.aiProvider);
    const validationResult = await aiProcessor.validateChangeRequests(payload.changes);
    
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.issues.join(', ')}`);
    }
    
    await sessionManager.addLog(sessionId, 'success', 'All change requests validated successfully');

    // Phase 2: File Analysis
    await sessionManager.updateSessionStatus(sessionId, 'analyzing', 15, 'Analyzing affected files...');
    
    const fileGroups = aiProcessor.groupChangesByFile(payload.changes);
    await sessionManager.addLog(sessionId, 'info', `Identified ${fileGroups.length} files to be modified`);
    
    // Initialize file tracking
    for (const group of fileGroups) {
      await sessionManager.updateFileProcessing(sessionId, group.filePath, {
        status: 'pending',
        changeCount: group.changes.length
      });
    }

    // Phase 3: Generate Feature Branch Name
    await sessionManager.updateSessionStatus(sessionId, 'processing', 20, 'Creating feature branch...');
    
    const branchName = await githubService.generateFeatureBranchName(payload.changes);
    const featureName = branchName.replace('feature/', '');
    
    // Check if branch already exists
    const branchExists = await githubService.branchExists(payload.globalContext.repositoryUrl, branchName);
    if (branchExists) {
      const timestamp = Date.now();
      const uniqueBranchName = `${branchName}-${timestamp}`;
      await sessionManager.setBranchInfo(sessionId, uniqueBranchName, featureName);
    } else {
      await sessionManager.setBranchInfo(sessionId, branchName, featureName);
    }

    // Create the feature branch
    const branchInfo = await githubService.createFeatureBranch(
      payload.globalContext.repositoryUrl,
      session.branchName!,
      session.baseBranch
    );
    
    await sessionManager.addLog(sessionId, 'success', `Created feature branch: ${session.branchName}`);

    // Phase 4: Process Files
    await sessionManager.updateSessionStatus(sessionId, 'processing', 30, 'Processing file changes with AI...');

    const fileChanges: FileChange[] = [];
    let processedCount = 0;

    for (const group of fileGroups) {
      try {
        await sessionManager.updateFileProcessing(group.filePath, group.filePath, { status: 'processing' });
        
        const startTime = Date.now();
        const result = await aiProcessor.processFileChanges(
          group.filePath,
          group.originalContent,
          group.changes
        );

        if (result.success) {
          const commitMessage = aiProcessor.generateCommitMessage(
            group.filePath,
            group.changes,
            result.explanation
          );

          fileChanges.push({
            path: group.filePath,
            content: result.updatedContent,
            message: commitMessage
          });

          await sessionManager.updateFileProcessing(sessionId, group.filePath, {
            status: 'completed',
            processingTime: Date.now() - startTime
          });

          await sessionManager.addLog(sessionId, 'success', 
            `Successfully processed ${group.filePath}`, 
            { changesCount: group.changes.length, explanation: result.explanation }
          );
        } else {
          await sessionManager.updateFileProcessing(sessionId, group.filePath, {
            status: 'failed',
            error: result.error
          });

          await sessionManager.addLog(sessionId, 'error', 
            `Failed to process ${group.filePath}: ${result.error}`
          );
        }

        processedCount++;
        const progress = 30 + (processedCount / fileGroups.length) * 40; // 30-70% for file processing
        await sessionManager.updateSessionStatus(sessionId, 'processing', progress, 
          `Processed ${processedCount}/${fileGroups.length} files`);

      } catch (error) {
        await sessionManager.updateFileProcessing(sessionId, group.filePath, {
          status: 'failed',
          error: error.message
        });
        await sessionManager.addLog(sessionId, 'error', 
          `Error processing ${group.filePath}: ${error.message}`
        );
      }
    }

    if (fileChanges.length === 0) {
      throw new Error('No files were successfully processed');
    }

    // Phase 5: Commit Changes
    await sessionManager.updateSessionStatus(sessionId, 'committing', 70, 'Committing changes to GitHub...');

    const commits = await githubService.commitChanges(
      payload.globalContext.repositoryUrl,
      session.branchName!,
      fileChanges
    );

    for (const commit of commits) {
      const filePath = fileChanges.find(fc => fc.message === commit.message)?.path || 'unknown';
      await sessionManager.addCommit(sessionId, {
        sha: commit.sha,
        message: commit.message,
        url: commit.url,
        filePath
      });
    }

    await sessionManager.addLog(sessionId, 'success', 
      `Committed ${commits.length} changes to ${session.branchName}`
    );

    // Phase 6: Create Pull Request
    await sessionManager.updateSessionStatus(sessionId, 'pr_creating', 80, 'Creating pull request...');

    const prTitle = `AI Enhancement: ${featureName}`;
    const prBody = generatePullRequestBody(payload.changes, fileChanges, commits);

    const prInfo = await githubService.createPullRequest(
      payload.globalContext.repositoryUrl,
      session.branchName!,
      prTitle,
      prBody,
      session.baseBranch
    );

    await sessionManager.setPullRequestInfo(sessionId, prInfo.htmlUrl, prInfo.number);

    // Phase 7: Wait for Deployment
    await sessionManager.updateSessionStatus(sessionId, 'deploying', 85, 'Waiting for preview deployment...');

    try {
      // Wait for Netlify deployment (with timeout)
      const deploymentResult = await netlifyService.waitForBranchDeployment(
        session.branchName!,
        300000 // 5 minute timeout
      );

      if (deploymentResult.success && deploymentResult.url) {
        await sessionManager.setPreviewUrl(sessionId, deploymentResult.url);
        await sessionManager.addLog(sessionId, 'success', 
          'Preview deployment ready', 
          { previewUrl: deploymentResult.url }
        );
      } else {
        await sessionManager.addLog(sessionId, 'warning', 
          'Preview deployment not detected, but PR created successfully'
        );
      }
    } catch (deployError) {
      await sessionManager.addLog(sessionId, 'warning', 
        `Deployment check failed: ${deployError.message}, but PR created successfully`
      );
    }

    // Phase 8: Generate Tests (Optional)
    if (session.autoTest) {
      await sessionManager.updateSessionStatus(sessionId, 'testing', 90, 'Generating test suggestions...');
      
      try {
        for (const group of fileGroups) {
          const testSuggestions = await aiProcessor.generateTestSuggestions(
            group.filePath,
            group.changes,
            fileChanges.find(fc => fc.path === group.filePath)?.content || ''
          );
          
          if (testSuggestions.length > 0) {
            await sessionManager.addLog(sessionId, 'info', 
              `Test suggestions for ${group.filePath}`, 
              { suggestions: testSuggestions }
            );
          }
        }
      } catch (testError) {
        await sessionManager.addLog(sessionId, 'warning', 
          `Test generation failed: ${testError.message}`
        );
      }
    }

    // Phase 9: Complete
    await sessionManager.updateSessionStatus(sessionId, 'completed', 100, 'Processing completed successfully!');
    await sessionManager.setCompleted(sessionId);

  } catch (error) {
    console.error('Processing error:', error);
    
    // Check if this is a retry situation
    const session = await sessionManager.getSession(sessionId);
    const currentAttempt = (session?.retryInfo?.attempt || 0) + 1;
    const maxRetries = 3;

    if (currentAttempt <= maxRetries) {
      await sessionManager.setRetryInfo(sessionId, currentAttempt, maxRetries, error.message);
      await sessionManager.addLog(sessionId, 'warning', 
        `Attempt ${currentAttempt} failed, retrying...`, 
        { error: error.message }
      );
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, currentAttempt - 1), 30000);
      setTimeout(() => {
        processChangesEnhanced(sessionId, payload).catch(retryError => {
          console.error('Retry failed:', retryError);
        });
      }, delay);
    } else {
      await sessionManager.setError(sessionId, 
        `Processing failed after ${maxRetries} attempts: ${error.message}`
      );
    }
  }
}

/**
 * Generate comprehensive pull request body
 */
function generatePullRequestBody(
  changes: ChangeRequest[],
  fileChanges: FileChange[],
  commits: any[]
): string {
  const categories = [...new Set(changes.map(c => c.category))];
  const highPriority = changes.filter(c => c.priority === 'high').length;
  
  let body = `## 🤖 AI-Generated Changes

This pull request contains AI-generated improvements to the application based on user feedback.

### Summary
- **Files Modified**: ${fileChanges.length}
- **Changes Implemented**: ${changes.length}
- **Categories**: ${categories.join(', ')}
- **High Priority Changes**: ${highPriority}

### Changes Made

`;

  // Group changes by file
  const changesByFile = new Map<string, ChangeRequest[]>();
  changes.forEach(change => {
    const filePath = change.componentContext?.filePath || change.metadata?.filePath || 'unknown';
    if (!changesByFile.has(filePath)) {
      changesByFile.set(filePath, []);
    }
    changesByFile.get(filePath)!.push(change);
  });

  changesByFile.forEach((fileChanges, filePath) => {
    body += `#### \`${filePath}\`\n`;
    fileChanges.forEach(change => {
      body += `- **${change.componentId}** (${change.priority}): ${change.feedback}\n`;
    });
    body += '\n';
  });

  body += `### Commits
${commits.map(commit => `- \`${commit.sha.substring(0, 7)}\`: ${commit.message.split('\n')[0]}`).join('\n')}

### Testing
- [ ] Manual testing of all changed components
- [ ] Verify existing functionality is not broken
- [ ] Check responsive design on mobile devices
- [ ] Validate accessibility improvements

### Deployment
- Preview deployment will be available automatically via Netlify
- Changes target the \`develop\` branch

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
`;

  return body;
}

/**
 * Main handler function
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  console.log('Received event:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Handle GET request for session status
    if (event.httpMethod === 'GET') {
      const pathParts = event.path.split('/');
      const sessionId = pathParts[pathParts.length - 1];

      if (!sessionId || sessionId === 'process-changes-enhanced') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Session ID required' })
        };
      }

      const sessionSummary = await sessionManager.getSessionSummary(sessionId);
      if (!sessionSummary) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Session not found' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(sessionSummary)
      };
    }

    // Handle POST request for change submission
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Request body required' })
        };
      }

      const payload: SubmissionPayload = JSON.parse(event.body);

      // Validate payload
      if (!payload.changes || payload.changes.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No changes provided' })
        };
      }

      if (!payload.globalContext?.repositoryUrl) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Repository URL required' })
        };
      }

      // Create enhanced processing session
      const session = await sessionManager.createSession(
        payload.submissionId,
        payload.globalContext.projectId,
        payload.globalContext.repositoryUrl,
        payload.changes,
        {
          aiProvider: payload.globalContext.aiProvider || 'anthropic',
          baseBranch: 'develop',
          autoTest: true
        }
      );

      // Start processing asynchronously
      processChangesEnhanced(session.id, payload).catch(error => {
        console.error('Processing error:', error);
      });

      const response: SubmissionResponse = {
        success: true,
        sessionId: session.id,
        submissionId: payload.submissionId,
        message: 'Changes submitted successfully. Enhanced AI processing started.',
        statusUrl: `${process.env.URL}/api/process-changes-enhanced/${session.id}`,
        estimatedProcessingTime: session.estimatedCompletionTime! - session.startTime
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response)
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};