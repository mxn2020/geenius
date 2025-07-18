// netlify/functions/shared/webhook-handler.ts
import { GitHubService } from './github-service';
import { storage } from './redis-storage';

export class WebhookHandler {
  static async handleGitHubWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    if (!this.verifyGitHubSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = payload.action;
    const prNumber = payload.pull_request?.number;
    const repoUrl = payload.repository?.html_url;

    switch (event) {
      case 'closed':
        if (payload.pull_request?.merged) {
          await this.handlePRMerged(repoUrl, prNumber, payload.pull_request);
        }
        break;
      case 'synchronize':
        await this.handlePRUpdated(repoUrl, prNumber, payload.pull_request);
        break;
    }
  }

  private static verifyGitHubSignature(payload: any, signature: string): boolean {
    // Implement GitHub webhook signature verification
    const crypto = require('crypto');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!secret) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }

  private static async handlePRMerged(repoUrl: string, prNumber: number, pr: any): Promise<void> {
    // Find associated session
    const sessions = await this.findSessionsByPR(repoUrl, prNumber);
    
    for (const session of sessions) {
      await storage.updateSessionStatus(session.id, 'completed');
      await storage.addLog(session.id, 'success', 'Pull request merged successfully', {
        prNumber,
        mergeCommitSha: pr.merge_commit_sha
      });
    }
  }

  private static async handlePRUpdated(repoUrl: string, prNumber: number, pr: any): Promise<void> {
    // Handle PR updates (new commits, etc.)
    const sessions = await this.findSessionsByPR(repoUrl, prNumber);
    
    for (const session of sessions) {
      await storage.addLog(session.id, 'info', 'Pull request updated', {
        prNumber,
        headSha: pr.head.sha
      });
    }
  }

  private static async findSessionsByPR(repoUrl: string, prNumber: number): Promise<any[]> {
    // In a real implementation, query Redis for sessions with matching PR
    return [];
  }
}

