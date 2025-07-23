// Deployment and AI error fixing step

import { NetlifyService } from '../../../src/services/netlify';
import { WorkflowContext } from '../types/project-types';
import { parseDeploymentError, fixCodeWithAI, applyFixesToRepository } from '../utils/ai-error-utils';

export class DeploymentStep {
  private netlifyService: NetlifyService;

  constructor() {
    this.netlifyService = new NetlifyService();
  }

  async execute(context: WorkflowContext, onProgress?: (message: string) => void): Promise<WorkflowContext> {
    const { sessionId, request, infrastructure } = context;
    
    if (!infrastructure.netlifyProject) {
      console.log('[DEPLOYMENT-STEP] ⚠️ No Netlify project - skipping deployment wait');
      if (onProgress) onProgress('⚠️ No Netlify project - skipping deployment wait');
      return context;
    }

    console.log('[DEPLOYMENT-STEP] 🚀 Waiting for Netlify deployment...');
    if (onProgress) onProgress('🚀 Waiting for Netlify deployment...');

    try {
      // Wait for the initial deployment
      const deployment = await this.netlifyService.waitForInitialDeployment(
        infrastructure.netlifyProject.id,
        300000, // 5 minutes timeout
        (message: string) => {
          console.log(`[DEPLOYMENT-STEP] ${message}`);
          if (onProgress) onProgress(message);
        }
      );

      if (deployment.state === 'ready') {
        const deployUrl = deployment.deploy_ssl_url || infrastructure.netlifyProject.ssl_url;
        console.log('[DEPLOYMENT-STEP] 🌐 Deployment ready with customized project!');
        if (onProgress) onProgress('🌐 Deployment ready with customized project!');
        
        return {
          ...context,
          deploymentUrl: deployUrl,
          deploymentState: 'ready'
        };

      } else if (deployment.state === 'error') {
        console.log('[DEPLOYMENT-STEP] ❌ Netlify deployment failed - attempting AI fix...');
        if (onProgress) onProgress('❌ Netlify deployment failed - attempting AI fix...');

        // Attempt AI error fixing with retry loop
        const fixResult = await this.attemptAIErrorFixWithRetry(
          sessionId,
          deployment,
          request.repositoryUrl!,
          infrastructure.netlifyProject.id,
          context,
          onProgress
        );

        return {
          ...context,
          deploymentState: fixResult.success ? 'ready' : 'error',
          deploymentUrl: fixResult.deployUrl,
          aiFixAttempts: fixResult.attempts
        };
      }

      return {
        ...context,
        deploymentState: deployment.state
      };

    } catch (error: any) {
      console.error('[DEPLOYMENT-STEP] ❌ Deployment check failed:', error.message);
      if (onProgress) onProgress(`⚠️ Deployment check failed: ${error.message}`);
      
      return {
        ...context,
        deploymentState: 'error',
        deploymentError: error.message
      };
    }
  }

  private async attemptAIErrorFixWithRetry(
    sessionId: string,
    initialDeployment: any,
    repoUrl: string,
    siteId: string,
    context: WorkflowContext,
    onProgress?: (message: string) => void
  ): Promise<{ success: boolean; deployUrl?: string; attempts: number }> {
    
    const maxRetries = 3;
    let retryAttempt = 0;
    let currentDeployment = initialDeployment;
    let finalDeployUrl = null;

    while (retryAttempt < maxRetries && currentDeployment.state === 'error') {
      retryAttempt++;
      console.log(`[DEPLOYMENT-STEP] 🔄 AI Fix Attempt ${retryAttempt}/${maxRetries}...`);
      if (onProgress) onProgress(`🔄 AI Fix Attempt ${retryAttempt}/${maxRetries}...`);

      try {
        const fixResult = await this.attemptSingleAIFix(
          sessionId,
          currentDeployment,
          repoUrl,
          context,
          onProgress
        );

        if (fixResult.success) {
          console.log(`[DEPLOYMENT-STEP] 🔄 Triggering redeployment after AI fixes...`);
          if (onProgress) onProgress('🔄 Triggering redeployment after AI fixes...');

          // Trigger a new deployment after fixes
          const buildId = await this.netlifyService.triggerRedeploy(
            siteId,
            (message: string) => {
              console.log(`[DEPLOYMENT-STEP] ${message}`);
              if (onProgress) onProgress(message);
            }
          );

          if (buildId) {
            // Wait for retry deployment
            const retryDeployment = await this.netlifyService.waitForInitialDeployment(
              siteId,
              300000,
              (message: string) => {
                console.log(`[DEPLOYMENT-STEP] ${message}`);
                if (onProgress) onProgress(message);
              }
            );

            currentDeployment = retryDeployment;

            if (retryDeployment.state === 'ready') {
              finalDeployUrl = retryDeployment.deploy_ssl_url || context.infrastructure.netlifyProject?.ssl_url;
              console.log(`[DEPLOYMENT-STEP] 🎉 AI successfully fixed deployment errors on attempt ${retryAttempt}!`);
              if (onProgress) onProgress(`🎉 AI successfully fixed deployment errors on attempt ${retryAttempt}!`);
              
              return { success: true, deployUrl: finalDeployUrl, attempts: retryAttempt };

            } else if (retryDeployment.state === 'error') {
              console.log(`[DEPLOYMENT-STEP] ⚠️ Attempt ${retryAttempt} failed, deployment still has errors`);
              if (onProgress) onProgress(`⚠️ Attempt ${retryAttempt} failed, deployment still has errors`);
              
              if (retryAttempt < maxRetries) {
                console.log(`[DEPLOYMENT-STEP] 🔄 Analyzing new errors for next retry...`);
                if (onProgress) onProgress('🔄 Analyzing new errors for next retry...');
              }
            }
          } else {
            console.log(`[DEPLOYMENT-STEP] ⚠️ Failed to trigger redeployment on attempt ${retryAttempt}`);
            if (onProgress) onProgress(`⚠️ Failed to trigger redeployment on attempt ${retryAttempt}`);
            break;
          }
        } else {
          console.log(`[DEPLOYMENT-STEP] ⚠️ AI could not generate fixes on attempt ${retryAttempt}: ${fixResult.message}`);
          if (onProgress) onProgress(`⚠️ AI could not generate fixes on attempt ${retryAttempt}: ${fixResult.message}`);
          break;
        }
      } catch (retryError: any) {
        console.log(`[DEPLOYMENT-STEP] ❌ Error during retry attempt ${retryAttempt}: ${retryError.message}`);
        if (onProgress) onProgress(`❌ Error during retry attempt ${retryAttempt}: ${retryError.message}`);
        break;
      }
    }

    // Final result handling
    if (currentDeployment.state === 'error') {
      console.log(`[DEPLOYMENT-STEP] ❌ Deployment failed after ${retryAttempt} AI fix attempts`);
      if (onProgress) onProgress(`❌ Deployment failed after ${retryAttempt} AI fix attempts`);
      if (onProgress) onProgress('💡 Manual intervention may be required');
    }

    return { success: false, attempts: retryAttempt };
  }

  private async attemptSingleAIFix(
    sessionId: string,
    deployment: any,
    repoUrl: string,
    context: WorkflowContext,
    onProgress?: (message: string) => void
  ): Promise<{ success: boolean; message: string }> {
    
    try {
      // Parse the deployment error
      const errorInfo = await parseDeploymentError(deployment);

      if (!errorInfo.canFix) {
        console.log(`[DEPLOYMENT-STEP] ⚠️ Error type '${errorInfo.errorType}' cannot be automatically fixed`);
        if (onProgress) onProgress(`⚠️ Error type '${errorInfo.errorType}' cannot be automatically fixed`);
        return {
          success: false,
          message: `Cannot automatically fix ${errorInfo.errorType} errors`
        };
      }

      console.log(`[DEPLOYMENT-STEP] 🔍 Found ${errorInfo.errors.length} fixable ${errorInfo.errorType} errors`);
      if (onProgress) onProgress(`🔍 Found ${errorInfo.errors.length} fixable ${errorInfo.errorType} errors`);

      // Use AI to generate fixes
      const aiProvider = context.request.aiProvider || 'anthropic';
      const fixResult = await fixCodeWithAI(sessionId, errorInfo, repoUrl, aiProvider);

      if (!fixResult.success) {
        return {
          success: false,
          message: `AI could not generate fixes: ${fixResult.explanation}`
        };
      }

      console.log(`[DEPLOYMENT-STEP] 🤖 AI analyzing ${errorInfo.errors.length} deployment errors...`);
      if (onProgress) onProgress(`🤖 AI analyzing ${errorInfo.errors.length} deployment errors...`);

      // Apply fixes to repository
      console.log(`[DEPLOYMENT-STEP] 📝 Applying ${fixResult.fixes.length} code fixes to repository...`);
      if (onProgress) onProgress(`📝 Applying ${fixResult.fixes.length} code fixes to repository...`);

      const applySuccess = await applyFixesToRepository(sessionId, repoUrl, fixResult.fixes);

      if (applySuccess) {
        console.log(`[DEPLOYMENT-STEP] 🎉 Successfully applied ${fixResult.fixes.length} AI-generated fixes`);
        if (onProgress) onProgress(`🎉 Successfully applied ${fixResult.fixes.length} AI-generated fixes`);
        return {
          success: true,
          message: fixResult.explanation
        };
      } else {
        return {
          success: false,
          message: 'Failed to apply fixes to repository'
        };
      }

    } catch (error: any) {
      console.error(`[DEPLOYMENT-STEP] Error during AI error fixing:`, error);
      return {
        success: false,
        message: `AI error fixing failed: ${error.message}`
      };
    }
  }
}