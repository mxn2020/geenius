import { Handler } from '@netlify/functions';
import { MongoDBService } from '../apps/cli/services/mongodb';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if MongoDB is configured
    if (!process.env.MONGODB_ATLAS_PUBLIC_KEY || !process.env.MONGODB_ATLAS_PRIVATE_KEY) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          message: 'MongoDB Atlas not configured'
        })
      };
    }

    const mongodbService = new MongoDBService();
    
    // Get organizations first
    const organizations = await mongodbService.getOrganizations();
    
    if (organizations.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          available: false,
          message: 'No MongoDB organizations found'
        })
      };
    }

    // Get projects with cluster info for each organization
    const orgProjects = await Promise.all(
      organizations.map(async (org) => {
        try {
          const projects = await mongodbService.listProjectsWithClusterInfo(org.id);
          return {
            organization: {
              id: org.id,
              name: org.name
            },
            projects
          };
        } catch (error) {
          console.error(`Error getting projects for org ${org.id}:`, error);
          return {
            organization: {
              id: org.id,
              name: org.name
            },
            projects: []
          };
        }
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        available: true,
        organizations: orgProjects
      })
    };

  } catch (error) {
    console.error('MongoDB projects API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to get MongoDB projects',
        details: error.message
      })
    };
  }
};