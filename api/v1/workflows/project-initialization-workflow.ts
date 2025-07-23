// Main project initialization workflow orchestrator

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ProjectInitRequest, ProjectInitResponse, WorkflowContext } from '../types/project-types';
import { SessionStep } from '../steps/session-step';
import { TemplateStep } from '../steps/template-step';
import { AIGenerationStep } from '../steps/ai-generation-step';
import { InfrastructureStep } from '../steps/infrastructure-step';
import { DeploymentStep } from '../steps/deployment-step';
import { EnhancedSessionManager } from '../../shared/enhanced-session-manager';

export class ProjectInitializationWorkflow {
  private sessionStep: SessionStep;
  private templateStep: TemplateStep;
  private aiGenerationStep: AIGenerationStep;
  private infrastructureStep: InfrastructureStep;
  private deploymentStep: DeploymentStep;
  private sessionManager: EnhancedSessionManager;

  constructor() {
    this.sessionStep = new SessionStep();
    this.templateStep = new TemplateStep();
    this.aiGenerationStep = new AIGenerationStep();
    this.infrastructureStep = new InfrastructureStep();
    this.deploymentStep = new DeploymentStep();
    this.sessionManager = new EnhancedSessionManager();
  }

  /**
   * Main workflow execution for AI-powered project initialization
   */
  async executeAIPoweredWorkflow(request: ProjectInitRequest): Promise<ProjectInitResponse> {
    console.log('[WORKFLOW] 🚀 Starting AI-powered project initialization...');
    
    try {
      // Phase 1: Session Initialization (10%)
      let context = await this.sessionStep.execute(request);
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'preparing', 
        10, 
        'Session created, preparing for AI-powered customization...'
      );

      // Phase 2: Template Retrieval (30%)
      await this.sessionStep.logProgress(context.sessionId, 'info', '🔍 Retrieving template files for AI customization');
      context = await this.templateStep.execute(context, 
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'generating', 
        30, 
        'Template files retrieved, generating customized project...'
      );

      // Phase 3: AI File Generation (50%)
      await this.sessionStep.logProgress(context.sessionId, 'info', '🤖 Generating complete project with AI agent');
      context = await this.aiGenerationStep.execute(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'committing', 
        50, 
        'AI generation complete, committing files...'
      );

      // Phase 4: File Commit (60%)
      context = await this.aiGenerationStep.commitFiles(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'success', msg)
      );
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'setting_up_infrastructure', 
        60, 
        'Files committed, setting up infrastructure...'
      );

      // Phase 5: Infrastructure Setup (80%)
      await this.sessionStep.logProgress(context.sessionId, 'info', '🏗️ Setting up database and deployment infrastructure with updated repository...');
      context = await this.infrastructureStep.execute(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'deploying', 
        80, 
        'Infrastructure ready, waiting for deployment...'
      );

      // Phase 6: Deployment with AI Error Fixing (90-98%)
      context = await this.deploymentStep.execute(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );

      // Phase 7: Final Status Update (100%)
      const finalStatus = context.deploymentState === 'ready' ? 'deployed' : 'completed';
      const finalProgress = context.deploymentState === 'ready' ? 98 : 100;
      const finalMessage = context.deploymentState === 'ready' 
        ? 'Project successfully deployed after AI customization'
        : 'Project initialization completed!';

      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        finalStatus, 
        finalProgress, 
        finalMessage
      );

      // Store final results in session
      const session = await this.sessionManager.getSession(context.sessionId);
      if (session && context.deploymentUrl) {
        session.deploymentUrl = context.deploymentUrl;
        if (context.infrastructure.netlifyProject) {
          session.netlifyUrl = context.infrastructure.netlifyProject.ssl_url;
          session.netlifyProjectId = context.infrastructure.netlifyProject.id;
        }
        if (context.infrastructure.mongodbProject) {
          session.mongodbDatabase = context.infrastructure.mongodbProject.databaseName;
          session.mongodbCluster = context.infrastructure.mongodbProject.clusterName;
          session.mongodbConnectionString = context.infrastructure.mongodbProject.connectionString;
        }
        await this.sessionManager.setSession(context.sessionId, session);
      }

      await this.sessionStep.logProgress(context.sessionId, 'success', '✅ AI-powered project initialization completed successfully!');

      return {
        success: true,
        sessionId: context.sessionId,
        message: 'AI-powered project initialization completed successfully!',
        statusUrl: `/api/process-changes-enhanced/${context.sessionId}`,
        generatedFiles: context.generatedFiles?.map(f => f.path) || [],
        estimatedProcessingTime: 300000 // 5 minutes
      };

    } catch (error: any) {
      console.error('[WORKFLOW] ❌ AI-powered initialization failed:', error.message);
      
      // Try to update session with error if we have a sessionId
      if (error.context?.sessionId) {
        await this.sessionStep.logProgress(error.context.sessionId, 'error', `❌ Initialization failed: ${error.message}`);
        await this.sessionManager.updateSessionStatus(
          error.context.sessionId, 
          'error', 
          0, 
          `Initialization failed: ${error.message}`
        );
      }

      return {
        success: false,
        sessionId: error.context?.sessionId || 'unknown',
        message: `AI-powered initialization failed: ${error.message}`,
        statusUrl: error.context?.sessionId ? `/api/process-changes-enhanced/${error.context.sessionId}` : '',
        generatedFiles: [],
        estimatedProcessingTime: 0,
        error: error.message
      };
    }
  }

  /**
   * Execute standard deployment workflow (no AI customization)
   */
  async executeStandardWorkflow(request: ProjectInitRequest): Promise<ProjectInitResponse> {
    console.log('[WORKFLOW] 📋 Starting standard deployment workflow...');
    
    try {
      // Phase 1: Session Initialization
      let context = await this.sessionStep.execute(request);
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'preparing', 
        20, 
        'Preparing standard deployment...'
      );

      await this.sessionStep.logProgress(context.sessionId, 'info', '📋 Using standard template without AI customization - repository is already created');

      // Phase 2: Infrastructure Setup (40%)
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'setting_up_infrastructure', 
        40, 
        'Setting up database and deployment...'
      );

      // Get template information for environment variables
      context = await this.templateStep.execute(context);
      context = await this.infrastructureStep.execute(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );

      // Phase 3: Deployment (80%)
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'deploying', 
        80, 
        'Waiting for deployment...'
      );

      context = await this.deploymentStep.execute(context,
        (msg) => this.sessionStep.logProgress(context.sessionId, 'info', msg)
      );

      // Phase 4: Complete (100%)
      await this.sessionManager.updateSessionStatus(
        context.sessionId, 
        'completed', 
        100, 
        'Standard deployment completed!'
      );

      return {
        success: true,
        sessionId: context.sessionId,
        message: 'Standard deployment completed successfully!',
        statusUrl: `/api/process-changes-enhanced/${context.sessionId}`,
        generatedFiles: [],
        estimatedProcessingTime: 180000 // 3 minutes
      };

    } catch (error: any) {
      console.error('[WORKFLOW] ❌ Standard deployment failed:', error.message);
      
      return {
        success: false,
        sessionId: error.context?.sessionId || 'unknown',
        message: `Standard deployment failed: ${error.message}`,
        statusUrl: error.context?.sessionId ? `/api/process-changes-enhanced/${error.context.sessionId}` : '',
        generatedFiles: [],
        estimatedProcessingTime: 0,
        error: error.message
      };
    }
  }
}

/**
 * Netlify Function Handler - Entry Point
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const request: ProjectInitRequest = JSON.parse(event.body || '{}');
    const workflow = new ProjectInitializationWorkflow();

    // Determine workflow type based on user requirements
    const hasUserRequirements = !!(request.userRequirements || request.projectRequirements);
    
    let response: ProjectInitResponse;
    if (hasUserRequirements) {
      console.log('[HANDLER] 🤖 Project requirements provided - proceeding with AI-powered customization');
      response = await workflow.executeAIPoweredWorkflow(request);
    } else {
      console.log('[HANDLER] 📋 No project requirements - proceeding with standard deployment');
      response = await workflow.executeStandardWorkflow(request);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error: any) {
    console.error('[HANDLER] ❌ Request processing failed:', error.message);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: `Request processing failed: ${error.message}`,
        error: error.message
      })
    };
  }
};