import { Handler } from '@netlify/functions';
import { promises as fs } from 'fs';
import { join } from 'path';
import { storage } from './shared/redis-storage';

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // First try to get project data from Redis
    let projectData = null;
    let configData = null;
    
    // Check for config file in current working directory
    const configPath = join(process.cwd(), '.dev-agent.json');
    
    try {
      const configFileData = await fs.readFile(configPath, 'utf-8');
      configData = JSON.parse(configFileData);
      
      // If config has projectId, try to get full project data from Redis
      if (configData.projectId) {
        projectData = await storage.getProject(configData.projectId);
      }
      
      // If no Redis data but we have a project name, try to find by name
      if (!projectData && configData.projectName) {
        projectData = await storage.getProjectByName(configData.projectName);
      }
      
    } catch (fileError: any) {
      if (fileError.code !== 'ENOENT') {
        throw fileError;
      }
      // Config file doesn't exist - try to find any active project in Redis
      const allProjects = await storage.getAllProjects();
      const activeProjects = allProjects.filter(p => p.status === 'active');
      if (activeProjects.length > 0) {
        projectData = activeProjects[0]; // Use the first active project
      }
    }
    
    if (projectData || configData) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          hasProject: true,
          // Merge config data with Redis project data (Redis takes precedence)
          projectName: projectData?.name || configData?.projectName,
          templateId: projectData?.template || configData?.template,
          aiProvider: projectData?.aiProvider || configData?.aiProvider,
          agentMode: projectData?.agentMode || configData?.agentMode,
          orchestrationStrategy: projectData?.orchestrationStrategy || configData?.orchestrationStrategy,
          githubOrg: projectData?.githubOrg || configData?.githubOrg,
          // Redis-only deployment data
          repositoryUrl: projectData?.repositoryUrl,
          netlifyUrl: projectData?.netlifyUrl,
          mongodbOrgId: projectData?.mongodbOrgId || configData?.mongodbOrgId,
          mongodbProjectId: projectData?.mongodbProjectId || configData?.mongodbProjectId,
          mongodbDatabase: projectData?.mongodbDatabase,
          // Additional metadata
          projectId: projectData?.id,
          status: projectData?.status || 'active',
          createdAt: projectData?.createdAt,
          updatedAt: projectData?.updatedAt,
        })
      };
    } else {
      // No project found
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          hasProject: false,
          message: 'No project initialized'
        })
      };
    }
  } catch (error: any) {
    console.error('Status error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message || 'Failed to load project status'
      })
    };
  }
};