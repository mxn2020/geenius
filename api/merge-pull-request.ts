// netlify/functions/merge-pull-request.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { storage } from '../src/services/redis-storage';
import { Octokit } from 'octokit';

// Merge functionality for UI integration
export async function mergePullRequest(sessionId: string, prNumber: number): Promise<any> {
  try {
    const session = await storage.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }
    
    const octokit = new Octokit({ auth: githubToken });
    const repoPath = extractRepoPath(session.repositoryUrl);
    const [owner, repo] = repoPath.split('/');
    
    // Merge the pull request
    const mergeResult = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      commit_title: 'Merge AI-generated improvements',
      commit_message: `Merging AI-generated improvements from session ${sessionId}`,
      merge_method: 'squash'
    });
    
    // Update session with merge information
    session.status = 'completed';
    session.endTime = Date.now();
    await storage.setSession(sessionId, session);
    
    await storage.addLog(sessionId, 'success', 'Pull request merged successfully', {
      mergeCommitSha: mergeResult.data.sha,
      merged: mergeResult.data.merged
    });
    
    return {
      success: true,
      mergeCommitSha: mergeResult.data.sha,
      merged: mergeResult.data.merged
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function extractRepoPath(repoUrl: string): string {
  const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : '';
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
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
    const { sessionId, prNumber } = JSON.parse(event.body || '{}');
    
    if (!sessionId || !prNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'sessionId and prNumber are required' })
      };
    }
    
    const result = await mergePullRequest(sessionId, prNumber);
    
    return {
      statusCode: result.success ? 200 : 500,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};