// Merge Pull Request API - Merge PR after preview approval
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { EnhancedSessionManager } from './shared/enhanced-session-manager';
import { EnhancedGitHubService } from './shared/enhanced-github-service';

// Initialize services
const sessionManager = new EnhancedSessionManager();
const githubService = new EnhancedGitHubService();

/**
 * Main handler function
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Extract session ID from path
    const pathParts = event.path.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    if (!sessionId || sessionId === 'merge-pr') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session ID required' })
      };
    }

    // Get session information
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    // Check if session has PR information
    if (!session.prUrl || !session.prNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'No pull request found for this session',
          sessionId
        })
      };
    }

    // Check if PR is in mergeable state
    if (session.status !== 'completed' && session.status !== 'preview_ready') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Cannot merge PR in current state: ${session.status}`,
          status: session.status
        })
      };
    }

    console.log(`Attempting to merge PR #${session.prNumber} for session ${sessionId}`);

    // Update session status to merging
    await sessionManager.updateSessionStatus(sessionId, 'merging', 98, 'Merging pull request...');
    await sessionManager.addLog(sessionId, 'info', '🔄 Merging pull request...');

    // Extract repository info from session
    const repositoryUrl = session.repositoryUrl || 
      `https://github.com/${session.prUrl?.split('/').slice(-4, -2).join('/')}`;

    try {
      // Merge the pull request
      const mergeResult = await githubService.mergePullRequest(
        repositoryUrl,
        session.prNumber,
        {
          commit_title: `Merge AI Enhancement: ${session.featureName}`,
          commit_message: `Merged AI-generated changes from ${session.branchName}\n\n✅ Preview tested and approved`,
          merge_method: 'squash' // Can be 'merge', 'squash', or 'rebase'
        }
      );

      if (mergeResult.success) {
        // Update session to merged status
        await sessionManager.updateSessionStatus(sessionId, 'merged', 100, 'Pull request merged successfully!');
        await sessionManager.addLog(sessionId, 'success', 
          `🎉 Pull Request #${session.prNumber} merged successfully!`,
          { 
            mergeCommitSha: mergeResult.sha,
            mergedAt: new Date().toISOString()
          }
        );

        console.log(`Successfully merged PR #${session.prNumber} for session ${sessionId}`);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Pull request merged successfully',
            sessionId,
            prNumber: session.prNumber,
            mergeCommitSha: mergeResult.sha
          })
        };

      } else {
        throw new Error(mergeResult.error || 'Merge failed without specific error');
      }

    } catch (mergeError) {
      console.error(`Failed to merge PR #${session.prNumber}:`, mergeError);
      
      await sessionManager.addLog(sessionId, 'error', 
        `❌ Failed to merge PR: ${mergeError.message}`,
        { error: mergeError.message }
      );

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Failed to merge pull request: ${mergeError.message}`,
          sessionId,
          prNumber: session.prNumber
        })
      };
    }

  } catch (error) {
    console.error('Merge PR error:', error);
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