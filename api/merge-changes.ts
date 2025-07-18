// netlify/functions/merge-changes.ts
// Endpoint for handling merge operations
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { GitHubService } from './shared/github-service';
import { storage } from './shared/redis-storage';

interface MergeRequest {
  sessionId: string;
  prUrl: string;
  mergeMethod: 'merge' | 'squash' | 'rebase';
  deleteFeatureBranch: boolean;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const mergeRequest: MergeRequest = JSON.parse(event.body || '{}');
    
    if (!mergeRequest.sessionId || !mergeRequest.prUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Session ID and PR URL are required' })
      };
    }

    // Get session info
    const session = await storage.getSession(mergeRequest.sessionId);
    if (!session) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    // Update session status
    await storage.updateSessionStatus(mergeRequest.sessionId, 'pr_creating');
    await storage.addLog(mergeRequest.sessionId, 'info', 'Starting merge process...');

    const github = new GitHubService();
    
    // Extract PR details from URL
    const prMatch = mergeRequest.prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!prMatch) {
      throw new Error('Invalid PR URL format');
    }

    const [, owner, repo, prNumber] = prMatch;

    // Merge the PR
    const mergeResult = await github.mergePullRequest(session.repositoryUrl, {
      pullNumber: parseInt(prNumber),
      mergeMethod: mergeRequest.mergeMethod,
      commitTitle: `Merge AI-generated changes (Session: ${mergeRequest.sessionId})`,
      commitMessage: `Automatically merged AI-generated changes from session ${mergeRequest.sessionId}`
    });

    if (mergeRequest.deleteFeatureBranch && session.branchName) {
      await github.deleteBranch(session.repositoryUrl, session.branchName);
      await storage.addLog(mergeRequest.sessionId, 'info', `Feature branch ${session.branchName} deleted`);
    }

    // Update session as completed
    await storage.updateSessionStatus(mergeRequest.sessionId, 'completed');
    await storage.addLog(mergeRequest.sessionId, 'success', 'Changes merged successfully', {
      mergeCommitSha: mergeResult.sha,
      merged: mergeResult.merged
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Changes merged successfully',
        mergeCommitSha: mergeResult.sha,
        sessionId: mergeRequest.sessionId
      })
    };

  } catch (error) {
    console.error('Merge error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Merge failed',
        message: error.message
      })
    };
  }
};

