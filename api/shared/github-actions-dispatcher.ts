// GitHub Actions Dispatcher for Agentic AI System
import { Octokit } from 'octokit';
import { EnhancedSessionManager } from './enhanced-session-manager';

export interface GitHubActionsConfig {
  owner: string;
  repo: string;
  workflow: string;
  token: string;
}

export interface DispatchPayload {
  session_id: string;
  repository_url: string;
  changes_json: string;
  ai_provider: string;
  base_branch?: string;
  webhook_url?: string;
}

export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled' | 'failure';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required';
  html_url: string;
  created_at: string;
  updated_at: string;
}

export class GitHubActionsDispatcher {
  private octokit: Octokit;
  private sessionManager: EnhancedSessionManager;
  private config: GitHubActionsConfig;

  constructor(config: GitHubActionsConfig, sessionManager: EnhancedSessionManager) {
    this.config = config;
    this.sessionManager = sessionManager;
    this.octokit = new Octokit({
      auth: config.token
    });
  }

  /**
   * Dispatch AI processing workflow to GitHub Actions
   */
  async dispatchProcessingWorkflow(
    sessionId: string,
    payload: DispatchPayload
  ): Promise<{
    success: boolean;
    workflow_run_id?: number;
    error?: string;
  }> {
    try {
      await this.sessionManager.addLog(
        sessionId, 
        'info', 
        'Dispatching to GitHub Actions for advanced processing'
      );

      // Trigger repository dispatch event
      await this.octokit.rest.repos.createDispatchEvent({
        owner: this.config.owner,
        repo: this.config.repo,
        event_type: 'ai-process-changes',
        client_payload: payload
      });

      await this.sessionManager.addLog(
        sessionId, 
        'success', 
        'GitHub Actions workflow dispatched successfully'
      );

      // Wait a moment for workflow to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get the workflow run ID
      const workflowRun = await this.getLatestWorkflowRun(sessionId);
      
      if (workflowRun) {
        await this.sessionManager.addLog(
          sessionId, 
          'info', 
          'GitHub Actions workflow started', 
          { 
            workflow_run_id: workflowRun.id,
            workflow_url: workflowRun.html_url 
          }
        );

        return {
          success: true,
          workflow_run_id: workflowRun.id
        };
      } else {
        return {
          success: true // Dispatch succeeded even if we can't find the run
        };
      }

    } catch (error) {
      await this.sessionManager.addLog(
        sessionId, 
        'error', 
        'Failed to dispatch GitHub Actions workflow', 
        { error: error.message }
      );

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor GitHub Actions workflow progress
   */
  async monitorWorkflowProgress(
    sessionId: string,
    workflowRunId: number,
    maxWaitTime: number = 1800000 // 30 minutes
  ): Promise<{
    success: boolean;
    status: string;
    conclusion?: string;
    artifacts?: any[];
    error?: string;
  }> {
    const startTime = Date.now();
    const pollInterval = 30000; // 30 seconds

    try {
      await this.sessionManager.addLog(
        sessionId, 
        'info', 
        'Monitoring GitHub Actions workflow progress',
        { workflow_run_id: workflowRunId }
      );

      while (Date.now() - startTime < maxWaitTime) {
        const workflowRun = await this.getWorkflowRun(workflowRunId);
        
        if (!workflowRun) {
          throw new Error('Workflow run not found');
        }

        await this.sessionManager.addLog(
          sessionId, 
          'info', 
          `Workflow status: ${workflowRun.status}`,
          { 
            workflow_run_id: workflowRunId,
            status: workflowRun.status,
            conclusion: workflowRun.conclusion
          }
        );

        // Check if workflow is complete
        if (workflowRun.status === 'completed') {
          const artifacts = await this.getWorkflowArtifacts(workflowRunId);
          
          await this.sessionManager.addLog(
            sessionId, 
            workflowRun.conclusion === 'success' ? 'success' : 'error', 
            `Workflow completed with conclusion: ${workflowRun.conclusion}`,
            { 
              workflow_run_id: workflowRunId,
              conclusion: workflowRun.conclusion,
              artifacts_count: artifacts.length
            }
          );

          return {
            success: workflowRun.conclusion === 'success',
            status: workflowRun.status,
            conclusion: workflowRun.conclusion,
            artifacts
          };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      // Timeout
      await this.sessionManager.addLog(
        sessionId, 
        'warning', 
        'Workflow monitoring timed out',
        { workflow_run_id: workflowRunId, max_wait_time: maxWaitTime }
      );

      return {
        success: false,
        status: 'timeout',
        error: 'Workflow monitoring timed out'
      };

    } catch (error) {
      await this.sessionManager.addLog(
        sessionId, 
        'error', 
        'Failed to monitor workflow progress', 
        { error: error.message, workflow_run_id: workflowRunId }
      );

      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get latest workflow run for a session
   */
  private async getLatestWorkflowRun(sessionId: string): Promise<WorkflowRun | null> {
    try {
      const { data: runs } = await this.octokit.rest.actions.listWorkflowRuns({
        owner: this.config.owner,
        repo: this.config.repo,
        workflow_id: this.config.workflow,
        per_page: 5
      });

      // Find run that matches our session (would need better correlation)
      return runs.workflow_runs[0] || null;
    } catch (error) {
      console.error('Failed to get latest workflow run:', error);
      return null;
    }
  }

  /**
   * Get specific workflow run details
   */
  private async getWorkflowRun(runId: number): Promise<WorkflowRun | null> {
    try {
      const { data: run } = await this.octokit.rest.actions.getWorkflowRun({
        owner: this.config.owner,
        repo: this.config.repo,
        run_id: runId
      });

      return {
        id: run.id,
        status: run.status as any,
        conclusion: run.conclusion as any,
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at
      };
    } catch (error) {
      console.error('Failed to get workflow run:', error);
      return null;
    }
  }

  /**
   * Get workflow artifacts
   */
  private async getWorkflowArtifacts(runId: number): Promise<any[]> {
    try {
      const { data: artifacts } = await this.octokit.rest.actions.listWorkflowRunArtifacts({
        owner: this.config.owner,
        repo: this.config.repo,
        run_id: runId
      });

      return artifacts.artifacts;
    } catch (error) {
      console.error('Failed to get workflow artifacts:', error);
      return [];
    }
  }

  /**
   * Cancel workflow run
   */
  async cancelWorkflowRun(
    sessionId: string,
    workflowRunId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.octokit.rest.actions.cancelWorkflowRun({
        owner: this.config.owner,
        repo: this.config.repo,
        run_id: workflowRunId
      });

      await this.sessionManager.addLog(
        sessionId, 
        'warning', 
        'GitHub Actions workflow cancelled', 
        { workflow_run_id: workflowRunId }
      );

      return { success: true };
    } catch (error) {
      await this.sessionManager.addLog(
        sessionId, 
        'error', 
        'Failed to cancel workflow', 
        { error: error.message, workflow_run_id: workflowRunId }
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Get workflow logs for debugging
   */
  async getWorkflowLogs(
    sessionId: string,
    workflowRunId: number
  ): Promise<{ success: boolean; logs?: string; error?: string }> {
    try {
      const { data: logs } = await this.octokit.rest.actions.downloadWorkflowRunLogs({
        owner: this.config.owner,
        repo: this.config.repo,
        run_id: workflowRunId
      });

      await this.sessionManager.addLog(
        sessionId, 
        'info', 
        'Retrieved workflow logs', 
        { workflow_run_id: workflowRunId }
      );

      return { success: true, logs: logs as any };
    } catch (error) {
      await this.sessionManager.addLog(
        sessionId, 
        'error', 
        'Failed to retrieve workflow logs', 
        { error: error.message, workflow_run_id: workflowRunId }
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger workflow with manual inputs (for testing)
   */
  async triggerWorkflowManually(
    sessionId: string,
    inputs: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.octokit.rest.actions.createWorkflowDispatch({
        owner: this.config.owner,
        repo: this.config.repo,
        workflow_id: this.config.workflow,
        ref: 'main', // or 'develop'
        inputs
      });

      await this.sessionManager.addLog(
        sessionId, 
        'info', 
        'Manual workflow triggered', 
        { inputs }
      );

      return { success: true };
    } catch (error) {
      await this.sessionManager.addLog(
        sessionId, 
        'error', 
        'Failed to trigger manual workflow', 
        { error: error.message }
      );

      return { success: false, error: error.message };
    }
  }

  /**
   * Get workflow run jobs for detailed status
   */
  async getWorkflowJobs(
    workflowRunId: number
  ): Promise<{ success: boolean; jobs?: any[]; error?: string }> {
    try {
      const { data: jobs } = await this.octokit.rest.actions.listJobsForWorkflowRun({
        owner: this.config.owner,
        repo: this.config.repo,
        run_id: workflowRunId
      });

      return { success: true, jobs: jobs.jobs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create workflow status report
   */
  generateWorkflowReport(
    workflowRun: WorkflowRun,
    jobs?: any[],
    artifacts?: any[]
  ): string {
    let report = `# GitHub Actions Workflow Report\n\n`;
    report += `**Workflow Run ID:** ${workflowRun.id}\n`;
    report += `**Status:** ${workflowRun.status}\n`;
    report += `**Conclusion:** ${workflowRun.conclusion || 'N/A'}\n`;
    report += `**Started:** ${workflowRun.created_at}\n`;
    report += `**Updated:** ${workflowRun.updated_at}\n`;
    report += `**URL:** ${workflowRun.html_url}\n\n`;

    if (jobs && jobs.length > 0) {
      report += `## Jobs\n\n`;
      jobs.forEach(job => {
        report += `### ${job.name}\n`;
        report += `- **Status:** ${job.status}\n`;
        report += `- **Conclusion:** ${job.conclusion || 'N/A'}\n`;
        report += `- **Started:** ${job.started_at}\n`;
        report += `- **Completed:** ${job.completed_at || 'N/A'}\n\n`;
      });
    }

    if (artifacts && artifacts.length > 0) {
      report += `## Artifacts\n\n`;
      artifacts.forEach(artifact => {
        report += `- **${artifact.name}** (${artifact.size_in_bytes} bytes)\n`;
      });
      report += `\n`;
    }

    return report;
  }
}