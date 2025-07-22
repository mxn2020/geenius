// Enhanced Agentic AI Process Changes API
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';
import { EnhancedGitHubService, FileChange } from '../src/services/enhanced-github-service';
import { AIFileProcessor, ChangeRequest } from './shared/ai-file-processor';
import { NetlifyService } from '../src/services/netlify';
import { DevIdRegistryScanner, RegistryContext } from './shared/devid-registry-scanner';

// Enhanced Types (matching template app structure)
export enum ChangeCategory {
  BUG_FIX = 'bug_fix',
  ENHANCEMENT = 'enhancement',
  STYLING = 'styling',
  CONTENT = 'content',
  BEHAVIOR = 'behavior',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  GENERAL = 'general'
}

export enum ChangePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum ChangeStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected'
}

interface ComponentContext {
  name: string;
  description: string;
  filePath: string;
  repositoryPath?: string;
  usageFilePath?: string;
  usageRepositoryPath?: string;
  usageLineNumber?: number;
  usageColumnNumber?: number;
  parentComponents: string[];
  childComponents: string[];
  semanticTags: string[];
  currentProps?: Record<string, any>;
  domPath?: string;
  boundingRect?: DOMRect;
}

interface PageContext {
  url: string;
  title: string;
  pathname: string;
  searchParams?: Record<string, string>;
  timestamp: number;
}

interface UserContext {
  sessionId: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  userId?: string;
  email?: string;
}

interface ChangeMetadata {
  screenshot?: string;
  elementPath?: string;
  relatedChanges?: string[];
  aiSuggestions?: string[];
}

interface EnhancedChangeRequest {
  id: string;
  componentId: string;
  feedback: string;
  timestamp: number;
  category: ChangeCategory;
  priority: ChangePriority;
  status: ChangeStatus;
  componentContext: ComponentContext;
  pageContext: PageContext;
  userContext?: UserContext;
  metadata?: ChangeMetadata;
}

interface GlobalContext {
  projectId?: string;
  environment: 'development' | 'staging' | 'production';
  version?: string;
  repositoryUrl?: string;
  branch?: string;
  commitHash?: string;
  aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
  userInfo?: UserContext;
}

interface SubmissionSummary {
  totalChanges: number;
  categoryCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  affectedComponents: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

interface SubmissionPayload {
  submissionId: string;
  timestamp: number;
  changes: EnhancedChangeRequest[];
  globalContext: GlobalContext;
  summary: SubmissionSummary;
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
 * Helper function to log to enhanced session manager
 */
async function logDevelopment(sessionId: string, level: 'info' | 'success' | 'warning' | 'error', message: string, metadata?: Record<string, any>): Promise<void> {
  // Log to enhanced session manager
  await sessionManager.addLog(sessionId, level, message, metadata);
}

/**
 * Generate a feature branch name from change requests
 */
function generateBranchName(changes: EnhancedChangeRequest[]): string {
  // Get the most common category
  const categories = changes.map(c => c.category);
  const categoryCount = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommonCategory = Object.entries(categoryCount)
    .sort(([,a], [,b]) => b - a)[0][0];

  // Create a descriptive name from first few changes
  const firstChange = changes[0];
  const description = firstChange.feedback
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(' ')
    .slice(0, 4)
    .join('-');

  const timestamp = Date.now().toString().slice(-6);
  
  return `feature/${mostCommonCategory}-${description}-${timestamp}`;
}

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
    console.log(`Starting validation for session: ${sessionId}`);
    
    // Check if session exists before proceeding
    const sessionBeforeValidation = await sessionManager.getSession(sessionId);
    console.log('Session exists before validation:', !!sessionBeforeValidation);
    
    await sessionManager.updateSessionStatus(sessionId, 'validating', 5, 'Validating change requests...');
    await logDevelopment(sessionId, 'info', 'Starting validation phase');
    
    const aiProcessor = new AIFileProcessor(payload.globalContext.aiProvider);
    
    // Log validation attempt details
    await logDevelopment(sessionId, 'info', `Starting validation with ${payload.changes.length} change requests`, {
      aiProvider: payload.globalContext.aiProvider,
      changeIds: payload.changes.map(c => c.id),
      categories: [...new Set(payload.changes.map(c => c.category))]
    });
    
    const validationResult = await aiProcessor.validateChangeRequests(payload.changes);
    
    console.log('Validation result:', JSON.stringify(validationResult, null, 2));
    await logDevelopment(sessionId, 'info', `Validation completed - ${validationResult.isValid ? 'PASSED' : 'FAILED'}`, {
      issues: validationResult.issues?.length || 0,
      securityConcerns: validationResult.securityConcerns?.length || 0,
      issuesList: validationResult.issues,
      securityList: validationResult.securityConcerns
    });
    
    if (!validationResult.isValid) {
      const issuesText = validationResult.issues && validationResult.issues.length > 0 
        ? validationResult.issues.join(', ')
        : 'No specific issues provided';
      const securityText = validationResult.securityConcerns && validationResult.securityConcerns.length > 0
        ? ` Security concerns: ${validationResult.securityConcerns.join(', ')}`
        : '';
      
      const errorMessage = `Validation failed: ${issuesText}${securityText}`;
      console.error('Validation failed:', errorMessage);
      await logDevelopment(sessionId, 'error', `❌ ${errorMessage}`, {
        issues: validationResult.issues,
        securityConcerns: validationResult.securityConcerns,
        changeRequests: payload.changes.map(c => ({ id: c.id, feedback: c.feedback, category: c.category }))
      });
      throw new Error(errorMessage);
    }
    
    await logDevelopment(sessionId, 'success', 'All change requests validated successfully');

    // Phase 2: File Analysis
    await sessionManager.updateSessionStatus(sessionId, 'analyzing', 15, 'Analyzing affected files...');
    
    const fileGroups = aiProcessor.groupChangesByFile(payload.changes);
    await logDevelopment(sessionId, 'info', `Identified ${fileGroups.length} files to be modified`);
    
    // Initialize file tracking
    for (const group of fileGroups) {
      await sessionManager.updateFileProcessing(sessionId, group.filePath, {
        status: 'pending',
        changeCount: group.changes.length
      });
    }

    // Phase 3: Generate Feature Branch Name (only if not already set)
    await sessionManager.updateSessionStatus(sessionId, 'processing', 20, 'Creating feature branch...');
    
    // Check if branch name already exists in session (for retries)
    let branchName = session.branchName;
    let featureName = session.featureName;
    
    if (!branchName) {
      // Generate branch name using change descriptions (first attempt only)
      branchName = generateBranchName(payload.changes);
      featureName = branchName.replace('feature/', '');
      await logDevelopment(sessionId, 'info', `Generated branch name: ${branchName}`);
      
      // Check if branch already exists
      const branchExists = await githubService.branchExists(payload.globalContext.repositoryUrl, branchName);
      if (branchExists) {
        const timestamp = Date.now();
        branchName = `${branchName}-${timestamp}`;
        await logDevelopment(sessionId, 'info', `Branch exists, using unique name: ${branchName}`);
      }
      
      // Store branch info in session
      await sessionManager.setBranchInfo(sessionId, branchName, featureName);
    } else {
      await logDevelopment(sessionId, 'info', `Using existing branch name from session: ${branchName}`);
    }

    // Create the feature branch (check if already created in previous attempts)
    try {
      // Check if branch already exists (could be from previous retry)
      const branchExists = await githubService.branchExists(payload.globalContext.repositoryUrl, branchName);
      
      if (branchExists) {
        await logDevelopment(sessionId, 'info', `Branch already exists, proceeding: ${branchName}`);
      } else {
        const branchInfo = await githubService.createFeatureBranch(
          payload.globalContext.repositoryUrl,
          branchName,
          session.baseBranch
        );
        
        await logDevelopment(sessionId, 'success', `Created feature branch: ${branchName}`, {
          repository: payload.globalContext.repositoryUrl,
          baseBranch: session.baseBranch
        });
      }
    } catch (branchError) {
      // If branch already exists error, that's okay - continue processing
      if (branchError.message.includes('Reference already exists')) {
        await logDevelopment(sessionId, 'info', `Branch already exists (from previous attempt), continuing: ${branchName}`);
      } else {
        await logDevelopment(sessionId, 'error', `Failed to create branch: ${branchError.message}`, {
          branchName: branchName,
          error: branchError.message
        });
        throw branchError;
      }
    }

    // Phase 4: Process Files
    await sessionManager.updateSessionStatus(sessionId, 'processing', 30, 'Processing file changes with AI...');

    const fileChanges: FileChange[] = [];
    let processedCount = 0;

    for (const group of fileGroups) {
      try {
        await sessionManager.updateFileProcessing(sessionId, group.filePath, { status: 'processing' });
        
        // Fetch current file content from GitHub
        await logDevelopment(sessionId, 'info', `Fetching file content: ${group.filePath}`);
        const fileContent = await githubService.getFileContent(
          payload.globalContext.repositoryUrl,
          group.filePath,
          session.baseBranch
        );
        
        if (!fileContent) {
          throw new Error(`Could not fetch content for ${group.filePath} from ${session.baseBranch} branch`);
        }
        
        await logDevelopment(sessionId, 'info', `File content loaded: ${fileContent.length} characters`);
        
        const startTime = Date.now();
        const result = await aiProcessor.processFileChanges(
          group.filePath,
          fileContent,
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

          await logDevelopment(sessionId, 'success', 
            `✅ Successfully processed ${group.filePath}`, 
            { changesCount: group.changes.length, processingTimeMs: Date.now() - startTime }
          );
        } else {
          await sessionManager.updateFileProcessing(sessionId, group.filePath, {
            status: 'failed',
            error: result.error
          });

          await logDevelopment(sessionId, 'error', 
            `❌ Failed to process ${group.filePath}: ${result.error}`
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

    // Phase 4.5: Component Registry Auto-Registration
    try {
      await sessionManager.updateSessionStatus(sessionId, 'processing', 65, 'Auto-registering new components...');
      await logDevelopment(sessionId, 'info', '🔍 Scanning for new component usages...');
      
      // Set up registry context for template app
      const registryContext: RegistryContext = {
        templatePath: '', // We don't need this for our use case
        registryDataPath: '', // This will be handled when we commit to the template repo
        repositoryUrl: payload.globalContext.repositoryUrl
      };
      
      const registryScanner = new DevIdRegistryScanner(registryContext);
      
      // Scan the processed files for new devIds
      const scanResults = await registryScanner.scanAndRegisterDevIds(
        fileChanges.map(fc => ({ path: fc.path, content: fc.content }))
      );
      
      if (scanResults.newDevIds.length > 0) {
        await logDevelopment(sessionId, 'success', 
          `📋 Auto-registered ${scanResults.registeredCount} new component usages`,
          { 
            newDevIds: scanResults.newDevIds.map(d => d.id),
            registeredCount: scanResults.registeredCount
          }
        );
        
        // Add registry updates as additional file changes if needed
        // Note: This is prepared for when we implement registry updates as commits
        
      } else {
        await logDevelopment(sessionId, 'info', '✅ No new component usages found - registry is up to date');
      }
      
      if (scanResults.errors.length > 0) {
        await logDevelopment(sessionId, 'warning', 
          `⚠️ Registry scanning had ${scanResults.errors.length} minor issues`,
          { errors: scanResults.errors }
        );
      }
      
    } catch (registryError) {
      // Registry scanning is not critical - log warning but continue
      await logDevelopment(sessionId, 'warning', 
        `⚠️ Component registry scanning failed: ${registryError.message}. Continuing without registry updates.`,
        { registryError: registryError.message }
      );
    }

    // Phase 5: Commit Changes
    await sessionManager.updateSessionStatus(sessionId, 'committing', 70, 'Committing changes to GitHub...');

    const commits = await githubService.commitChanges(
      payload.globalContext.repositoryUrl,
      branchName,
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

    await logDevelopment(sessionId, 'success', 
      `📝 Committed ${commits.length} changes to ${branchName}`,
      { commitCount: commits.length, branchName: branchName }
    );

    // Phase 6: Create Pull Request
    await sessionManager.updateSessionStatus(sessionId, 'pr_creating', 80, 'Creating pull request...');

    const prTitle = `AI Enhancement: ${featureName}`;
    const prBody = generatePullRequestBody(payload.changes, fileChanges, commits);

    const prInfo = await githubService.createPullRequest(
      payload.globalContext.repositoryUrl,
      branchName,
      prTitle,
      prBody,
      session.baseBranch
    );

    await sessionManager.setPullRequestInfo(sessionId, prInfo.htmlUrl, prInfo.number);
    await logDevelopment(sessionId, 'success', `🔀 Pull Request created: #${prInfo.number}`, {
      prUrl: prInfo.htmlUrl,
      prNumber: prInfo.number
    });

    // Phase 7: Wait for Deployment with Enhanced Tracking
    await sessionManager.updateSessionStatus(sessionId, 'deploying', 85, 'Waiting for preview deployment...');
    await logDevelopment(sessionId, 'info', '🚀 Waiting for Netlify preview deployment...');

    try {
      // Wait for Netlify deployment (with timeout and progress updates)
      await logDevelopment(sessionId, 'info', '⏳ Checking deployment status...');
      
      const deploymentResult = await netlifyService.waitForBranchDeployment(
        branchName,
        300000 // 5 minute timeout
      );

      if (deploymentResult.success && deploymentResult.url) {
        await sessionManager.setPreviewUrl(sessionId, deploymentResult.url);
        await logDevelopment(sessionId, 'success', 
          '🌐 Preview deployment ready!', 
          { 
            previewUrl: deploymentResult.url,
            deploymentStatus: 'ready',
            canPreview: true
          }
        );
        
        // Update session status to show preview is ready
        await sessionManager.updateSessionStatus(sessionId, 'preview_ready', 95, 'Preview deployment ready for testing');
        
      } else {
        await logDevelopment(sessionId, 'warning', 
          '⚠️ Preview deployment not detected, but PR created successfully',
          { deploymentStatus: 'unknown' }
        );
      }
    } catch (deployError) {
      await logDevelopment(sessionId, 'warning', 
        `⚠️ Deployment check failed: ${deployError.message}, but PR created successfully`,
        { deploymentError: deployError.message, deploymentStatus: 'failed' }
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
    
    const totalProcessingTime = Date.now() - session.startTime;
    await logDevelopment(sessionId, 'success', 
      `🎉 Change processing completed successfully!`,
      { 
        totalFiles: fileGroups.length,
        totalChanges: payload.changes.length,
        processingTimeMs: totalProcessingTime,
        branchName: branchName,
        prUrl: session.prUrl,
        previewUrl: session.previewUrl
      }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    // Check if this is a configuration error that should not be retried
    const isConfigurationError = error.message.includes('Base branch') && 
                                 error.message.includes('does not exist');
    const isRepositoryError = error.message.includes('Not Found') && 
                             error.message.includes('repository');
    
    if (isConfigurationError || isRepositoryError) {
      // Configuration errors should fail immediately without retry
      await sessionManager.setError(sessionId, 
        `Configuration error: ${error.message}`
      );
      await logDevelopment(sessionId, 'error', 
        `⚙️ Configuration error: ${error.message}`, 
        { 
          errorType: 'configuration',
          resolution: isConfigurationError ? 
            'Please ensure the base branch exists in the repository' :
            'Please verify the repository URL and access permissions'
        }
      );
      return;
    }
    
    // Check if this is a retry situation for transient errors
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
  changes: EnhancedChangeRequest[],
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
          baseBranch: payload.globalContext.branch || 'main',
          autoTest: true,
          sessionType: 'CHANGE_REQUEST'
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