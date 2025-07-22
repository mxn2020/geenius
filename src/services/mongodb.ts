// web/services/mongodb.ts - Using same approach as CLI
import DigestClient from 'digest-fetch';

export interface MongoDBProject {
  id: string;
  name: string;
  clusterName: string;
  connectionString: string;
  databaseName: string;
  username: string;
  password: string;
  region: string;
  tier: string;
}

export class MongoDBService {
  private apiUrl: string;
  private client: DigestClient;

  constructor() {
    this.apiUrl = 'https://cloud.mongodb.com/api/atlas/v2';
    const publicKey = process.env.MONGODB_ATLAS_PUBLIC_KEY || '';
    const privateKey = process.env.MONGODB_ATLAS_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
      throw new Error('MongoDB Atlas API keys are required. Please set MONGODB_ATLAS_PUBLIC_KEY and MONGODB_ATLAS_PRIVATE_KEY in your environment.');
    }

    // Create digest client
    this.client = new DigestClient(publicKey, privateKey);
  }

  async validateCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await this.client.fetch(`${this.apiUrl}/orgs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json'
        }
      });

      if (response.status === 401) {
        return { valid: false, error: 'Invalid MongoDB Atlas API credentials - check public/private keys' };
      } else if (response.status === 403) {
        return { valid: false, error: 'MongoDB Atlas API access forbidden - check permissions' };
      } else if (!response.ok) {
        return { valid: false, error: `MongoDB Atlas API error: ${response.status} ${response.statusText}` };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: `Network error: ${error.message}` };
    }
  }

  async createProject(projectName: string, orgId?: string, onProgress?: (message: string) => void): Promise<MongoDBProject> {
    try {
      console.log(`🍃 Creating MongoDB Atlas project: ${projectName}`);

      // Get organization ID if not provided
      if (!orgId) {
        orgId = await this.getDefaultOrganizationId();
      }

      console.log(`   🏢 Organization ID: ${orgId}`);

      // Generate unique names
      const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const uniqueSuffix = Date.now().toString(36).slice(-6);
      const clusterName = `${cleanName}-${uniqueSuffix}`;
      const databaseName = cleanName.replace(/-/g, '_');

      // Create project
      const project = await this.createAtlasProject(projectName, orgId);
      console.log(`   ✅ Project created: ${project.name} (${project.id})`);

      // Create cluster
      if (onProgress) onProgress('🏗️ Creating MongoDB cluster...');
      const cluster = await this.createCluster(project.id, clusterName);
      console.log(`   ✅ Cluster created: ${cluster.name}`);

      // Create database user
      if (onProgress) onProgress('👤 Creating database user...');
      const username = `${cleanName}-user`;
      const password = this.generateSecurePassword();
      await this.createDatabaseUser(project.id, username, password, databaseName);
      console.log(`   ✅ Database user created: ${username}`);

      // Configure IP whitelist (allow all for now - can be restricted later)
      if (onProgress) onProgress('🔐 Configuring network access...');
      await this.whitelistIP(project.id, '0.0.0.0/0', 'Allow all IPs');
      console.log(`   ✅ IP whitelist configured`);

      // Wait for cluster to be ready
      await this.waitForClusterReady(project.id, clusterName, 600000, onProgress);
      console.log(`   ✅ Cluster is ready`);

      // Get connection string
      const connectionString = await this.getConnectionString(project.id, clusterName, username, password, databaseName);
      console.log(`   ✅ Connection string generated`);

      return {
        id: project.id,
        name: project.name,
        clusterName: cluster.name,
        connectionString,
        databaseName,
        username,
        password,
        region: cluster.providerSettings?.regionName || 'EU_CENTRAL_1',
        tier: cluster.providerSettings?.instanceSizeName || 'M0'
      };
    } catch (error: any) {
      console.error('❌ Error creating MongoDB project:', error.message);
      throw new Error(`Failed to create MongoDB project: ${error.message}`);
    }
  }

  private async getDefaultOrganizationId(): Promise<string> {
    console.log('🔍 Fetching organizations...');

    try {
      const response = await this.client.fetch(`${this.apiUrl}/orgs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json'
        }
      });

      console.log(`📡 Organizations API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Organizations API error:', errorText);
        throw new Error(`Failed to get organizations: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 Number of organizations found: ', data.results.length);

      if (!data.results || data.results.length === 0) {
        throw new Error('No organizations found. Please ensure your API keys have proper permissions.');
      }

      const orgId = data.results[0].id;
      console.log(`✅ Using organization ID: ${orgId}`);
      return orgId;
    } catch (error: any) {
      console.error('❌ Organizations API error:', error.message);
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  private async createAtlasProject(name: string, orgId: string): Promise<any> {
    const body = {
      name,
      orgId,
      withDefaultAlertsSettings: true
    };

    try {
      const response = await this.client.fetch(`${this.apiUrl}/groups`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create project error:', errorText);
        throw new Error(`Failed to create Atlas project: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Create project error:', error.message);
      throw new Error(`Failed to create Atlas project: ${error.message}`);
    }
  }

  private async createCluster(projectId: string, clusterName: string, region: string = 'EU_CENTRAL_1'): Promise<any> {
    const clusterConfig = {
      name: clusterName,
      clusterType: 'REPLICASET',
      replicationSpecs: [{
        regionConfigs: [{
          providerName: 'TENANT',
          backingProviderName: 'AWS',
          regionName: region,
          priority: 7,
          electableSpecs: {
            instanceSize: 'M0',
            nodeCount: 3
          }
        }]
      }],
    };

    try {
      const response = await this.client.fetch(`${this.apiUrl}/groups/${projectId}/clusters`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clusterConfig)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create cluster error:', errorText);
        throw new Error(`Failed to create cluster: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Create cluster error:', error.message);
      throw new Error(`Failed to create cluster: ${error.message}`);
    }
  }

  private async createDatabaseUser(projectId: string, username: string, password: string, databaseName: string): Promise<any> {
    const userConfig = {
      username,
      password,
      databaseName: 'admin',
      roles: [
        {
          roleName: 'readWrite',
          databaseName: databaseName
        }
      ]
    };

    try {
      const response = await this.client.fetch(`${this.apiUrl}/groups/${projectId}/databaseUsers`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userConfig)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create database user error:', errorText);
        throw new Error(`Failed to create database user: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Create database user error:', error.message);
      throw new Error(`Failed to create database user: ${error.message}`);
    }
  }

  private async whitelistIP(projectId: string, ipAddress: string, comment: string): Promise<any> {
    const ipConfig = [{
      ipAddress,
      comment
    }];

    try {
      const response = await this.client.fetch(`${this.apiUrl}/groups/${projectId}/accessList`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ipConfig)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Whitelist IP error:', errorText);
        throw new Error(`Failed to whitelist IP: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Whitelist IP error:', error.message);
      throw new Error(`Failed to whitelist IP: ${error.message}`);
    }
  }

  private async waitForClusterReady(projectId: string, clusterName: string, maxWait: number = 600000, onProgress?: (message: string) => void): Promise<void> {
    console.log(`   ⏳ Waiting for cluster ${clusterName} to be ready...`);
    if (onProgress) onProgress(`⏳ Creating MongoDB cluster ${clusterName}...`);
    
    const startTime = Date.now();
    let lastState = '';

    while (Date.now() - startTime < maxWait) {
      const cluster = await this.getCluster(projectId, clusterName);
      const currentState = cluster.stateName;

      if (currentState !== lastState) {
        lastState = currentState;
        console.log(`   ⏳ Cluster state changed to: ${currentState}`);
        
        if (onProgress) {
          switch (currentState) {
            case 'CREATING':
              onProgress('🔧 MongoDB cluster: Initializing infrastructure...');
              break;
            case 'REPLICASET_PROVISIONING':
              onProgress('⚙️ MongoDB cluster: Provisioning replica set...');
              break;
            case 'CONFIGURING':
              onProgress('🔧 MongoDB cluster: Configuring settings...');
              break;
            case 'UPDATING':
              onProgress('🔄 MongoDB cluster: Applying updates...');
              break;
            case 'IDLE':
              onProgress('✅ MongoDB cluster: Ready and operational!');
              break;
            default:
              onProgress(`🔄 MongoDB cluster: ${currentState.toLowerCase()}...`);
          }
        }
      }

      if (cluster.stateName === 'IDLE') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }

    throw new Error('Cluster creation timeout - cluster took longer than expected to be ready');
  }

  private async getCluster(projectId: string, clusterName: string): Promise<any> {
    try {
      const response = await this.client.fetch(`${this.apiUrl}/groups/${projectId}/clusters/${clusterName}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Get cluster error:', errorText);
        throw new Error(`Failed to get cluster: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Get cluster error:', error.message);
      throw new Error(`Failed to get cluster: ${error.message}`);
    }
  }

  private async getConnectionString(projectId: string, clusterName: string, username: string, password: string, databaseName?: string): Promise<string> {
    const cluster = await this.getCluster(projectId, clusterName);

    if (!cluster.connectionStrings?.standardSrv) {
      throw new Error('Connection string not available');
    }

    let connectionString = cluster.connectionStrings.standardSrv;

    // URL encode username and password to handle special characters
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);

    // Replace placeholders if they exist
    connectionString = connectionString
      .replace('<username>', encodedUsername)
      .replace('<password>', encodedPassword);

    // If the connection string doesn't have username:password format, add it
    if (!connectionString.includes('@')) {
      // Format: mongodb+srv://cluster.mongodb.net -> mongodb+srv://username:password@cluster.mongodb.net
      connectionString = connectionString.replace('mongodb+srv://', `mongodb+srv://${encodedUsername}:${encodedPassword}@`);
    } else if (!connectionString.includes(`${encodedUsername}:${encodedPassword}`)) {
      // If it has @ but not our credentials, replace the credentials part
      connectionString = connectionString.replace(/mongodb\+srv:\/\/[^@]*@/, `mongodb+srv://${encodedUsername}:${encodedPassword}@`);
    }

    // Add database name if provided
    if (databaseName) {
      console.log(`   🔍 Adding database name: ${databaseName}`);
      console.log(`   🔍 Connection string before: ${connectionString}`);
      
      // Check if connection string already has a database name or query parameters
      if (connectionString.includes('?')) {
        // Has query parameters, replace or add database name before the ?
        connectionString = connectionString.replace(/\/[^?]*\?/, `/${databaseName}?`);
      } else {
        // No query parameters, just add database name
        connectionString = connectionString + `/${databaseName}`;
      }
      
      console.log(`   🔍 Connection string after: ${connectionString}`);
    }

    // Ensure required query parameters are present
    if (!connectionString.includes('retryWrites=true')) {
      connectionString += connectionString.includes('?') ? '&retryWrites=true' : '?retryWrites=true';
    }
    if (!connectionString.includes('w=majority')) {
      connectionString += '&w=majority';
    }

    return connectionString;
  }

  generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }

  async getOrganizations(): Promise<any[]> {
    try {
      const response = await this.client.fetch(`${this.apiUrl}/orgs`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Get organizations error:', errorText);
        throw new Error(`Failed to get organizations: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error: any) {
      console.error('❌ Get organizations error:', error.message);
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  async getProjects(orgId: string): Promise<any[]> {
    try {
      const response = await this.client.fetch(`${this.apiUrl}/orgs/${orgId}/groups`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.atlas.2025-03-12+json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Get projects error:', errorText);
        throw new Error(`Failed to get projects: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error: any) {
      console.error('❌ Get projects error:', error.message);
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  }

  async createProjectWithSelection(projectName: string, selectedOrgId?: string, selectedProjectId?: string, onProgress?: (message: string) => void): Promise<MongoDBProject> {
    try {
      console.log(`🍃 Creating MongoDB Atlas database for: ${projectName}`);

      let targetOrgId = selectedOrgId;
      let targetProjectId = selectedProjectId;

      // If no organization selected, use the first one
      if (!targetOrgId) {
        const organizations = await this.getOrganizations();
        if (organizations.length === 0) {
          throw new Error('No organizations found. Please ensure your API keys have proper permissions.');
        }
        targetOrgId = organizations[0].id;
        console.log(`   🏢 Using organization: ${organizations[0].name} (${targetOrgId})`);
      }

      // Generate unique names
      const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const uniqueSuffix = Date.now().toString(36).slice(-6);
      const clusterName = `${cleanName}-${uniqueSuffix}`;
      const databaseName = cleanName.replace(/-/g, '_');

      let project;
      if (targetProjectId && targetOrgId) {
        // Use existing project
        const existingProjects = await this.getProjects(targetOrgId);
        project = existingProjects.find(p => p.id === targetProjectId);
        if (!project) {
          throw new Error(`Project with ID ${targetProjectId} not found`);
        }
        console.log(`   📁 Using existing project: ${project.name} (${project.id})`);
      } else if (targetOrgId) {
        // Create new project
        project = await this.createAtlasProject(projectName, targetOrgId);
        console.log(`   ✅ Project created: ${project.name} (${project.id})`);
      } else {
        throw new Error('No organization or project selected. Please select an organization or project to continue.');
      }

      // Create cluster
      if (onProgress) onProgress('🏗️ Creating MongoDB cluster...');
      const cluster = await this.createCluster(project.id, clusterName);
      console.log(`   ✅ Cluster created: ${cluster.name}`);

      // Create database user
      if (onProgress) onProgress('👤 Creating database user...');
      const username = `${cleanName}-user`;
      const password = this.generateSecurePassword();
      await this.createDatabaseUser(project.id, username, password, databaseName);
      console.log(`   ✅ Database user created: ${username}`);

      // Configure IP whitelist (allow all for now - can be restricted later)
      if (onProgress) onProgress('🔐 Configuring network access...');
      await this.whitelistIP(project.id, '0.0.0.0/0', 'Allow all IPs');
      console.log(`   ✅ IP whitelist configured`);

      // Wait for cluster to be ready
      await this.waitForClusterReady(project.id, clusterName, 600000, onProgress);
      console.log(`   ✅ Cluster is ready`);

      // Get connection string
      const connectionString = await this.getConnectionString(project.id, clusterName, username, password, databaseName);
      console.log(`   ✅ Connection string generated`);

      return {
        id: project.id,
        name: project.name,
        clusterName: cluster.name,
        connectionString,
        databaseName,
        username,
        password,
        region: cluster.providerSettings?.regionName || 'EU_CENTRAL_1',
        tier: cluster.providerSettings?.instanceSizeName || 'M0'
      };
    } catch (error: any) {
      console.error('❌ Error creating MongoDB project:', error.message);
      throw new Error(`Failed to create MongoDB project: ${error.message}`);
    }
  }
}