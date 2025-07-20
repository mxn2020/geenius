// vercel-function-template.js
// This is a template for a Vercel Function that supports the Geenius AI Vercel Sandbox workflow
// Deploy this as a separate Vercel Function to enable the Vercel processing option

import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VercelSandboxAgent {
  constructor(config) {
    this.config = config;
    this.repoUrl = config.repoUrl;
    this.baseBranch = config.baseBranch || 'develop';
    this.git = simpleGit();
    this.workingDir = '/tmp/geenius-vercel';
    this.branchName = `feature/geenius-vercel-${Date.now()}`;
    
    // Setup AI provider
    this.setupAI();
    
    // Setup GitHub
    this.octokit = new Octokit({ 
      auth: process.env.GITHUB_TOKEN 
    });
  }

  setupAI() {
    const providers = {
      anthropic: anthropic,
      openai: openai,
      google: google
    };
    
    this.aiProvider = providers[this.config.aiConfig?.provider || 'anthropic'];
    this.model = this.config.aiConfig?.model || this.getDefaultModel(this.config.aiConfig?.provider || 'anthropic');
  }

  getDefaultModel(provider) {
    const defaults = {
      anthropic: 'claude-3-5-sonnet-20241022',
      openai: 'gpt-4o',
      google: 'gemini-1.5-pro'
    };
    return defaults[provider] || 'claude-3-5-sonnet-20241022';
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Vercel Sandbox...');
      
      // Clean up any existing working directory
      if (await fs.pathExists(this.workingDir)) {
        await fs.remove(this.workingDir);
      }
      
      // Create working directory
      await fs.ensureDir(this.workingDir);
      
      // Clone repository
      await this.git.clone(this.repoUrl, this.workingDir);
      await this.git.cwd(this.workingDir);
      
      // Switch to base branch and create feature branch
      await this.git.checkout(this.baseBranch);
      await this.git.checkoutBranch(this.branchName, this.baseBranch);
      
      // Install dependencies if package.json exists
      const packageJsonPath = path.join(this.workingDir, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const { spawn } = await import('child_process');
        await new Promise((resolve, reject) => {
          const install = spawn('npm', ['install'], { 
            cwd: this.workingDir,
            stdio: 'inherit'
          });
          install.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`npm install failed with code ${code}`));
          });
        });
      }
      
      console.log('✅ Vercel Sandbox initialized successfully');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Vercel Sandbox initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  async processTasks(tasks) {
    console.log(`🎯 Processing ${tasks.length} tasks in Vercel Sandbox...`);
    
    let completedTasks = 0;
    let testsCreated = 0;
    const changes = [];

    const tools = {
      listFiles: tool({
        description: 'List files and directories at a given path',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Relative path to list files from, defaults to current directory'
            }
          }
        }
      }, async ({ path = '.' }) => {
        const fullPath = path === '.' ? this.workingDir : path.join(this.workingDir, path);
        if (await fs.pathExists(fullPath)) {
          const files = await fs.readdir(fullPath);
          return files.join('\\n');
        }
        return 'Directory not found';
      }),

      readFile: tool({
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Relative path to the file to read'
            }
          },
          required: ['path']
        }
      }, async ({ path }) => {
        const fullPath = path.join(this.workingDir, path);
        if (await fs.pathExists(fullPath)) {
          return await fs.readFile(fullPath, 'utf8');
        }
        return 'File not found';
      }),

      writeFile: tool({
        description: 'Write or update content in a file',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Relative path to the file to write'
            },
            content: { 
              type: 'string', 
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }, async ({ path, content }) => {
        const fullPath = path.join(this.workingDir, path);
        const dir = path.dirname(fullPath);
        
        // Ensure directory exists
        await fs.ensureDir(dir);
        
        // Write file
        await fs.writeFile(fullPath, content, 'utf8');
        
        return `File written successfully: ${path}`;
      }),

      createTest: tool({
        description: 'Create a test file for a component or feature',
        parameters: {
          type: 'object',
          properties: {
            testPath: { 
              type: 'string', 
              description: 'Path where the test file should be created'
            },
            testContent: { 
              type: 'string', 
              description: 'Test code content'
            },
            description: {
              type: 'string',
              description: 'Description of what the test covers'
            }
          },
          required: ['testPath', 'testContent']
        }
      }, async ({ testPath, testContent, description }) => {
        const fullPath = path.join(this.workingDir, testPath);
        const dir = path.dirname(fullPath);
        
        await fs.ensureDir(dir);
        await fs.writeFile(fullPath, testContent, 'utf8');
        
        return `Test file created: ${testPath} - ${description || 'Test created'}`;
      })
    };

    for (const task of tasks) {
      try {
        console.log(`📝 Processing task: ${task.description}`);
        
        const result = await generateText({
          model: this.aiProvider(this.model),
          messages: [
            {
              role: 'system',
              content: `You are a senior software engineer working on a project in a Vercel sandbox environment. 
              
Your task is to implement the following change: "${task.description}"

First, explore the project structure by listing files, then read relevant files to understand the codebase. 
Implement the requested changes following existing code patterns and conventions.
Create appropriate tests for your changes using the createTest tool.

Component: ${task.component}
Category: ${task.category}
Priority: ${task.priority}
Context: ${JSON.stringify(task.context, null, 2)}

Be thorough and follow best practices. Always create tests for new functionality.`
            },
            {
              role: 'user',
              content: task.description
            }
          ],
          tools,
          maxSteps: 15
        });

        completedTasks++;
        changes.push({
          id: task.id,
          description: task.description,
          category: task.category,
          implementation: result.text,
          files: await this.getChangedFiles()
        });

        // Count tests created (simple heuristic)
        const testMatches = result.text.match(/Test file created/g);
        testsCreated += testMatches ? testMatches.length : 0;
        
        console.log(`✅ Task completed: ${task.id}`);
        
      } catch (error) {
        console.error(`❌ Task failed: ${task.id}`, error);
      }
    }

    return {
      success: true,
      completedTasks,
      testsCreated,
      changes
    };
  }

  async runTests() {
    try {
      console.log('🧪 Running test suite...');
      
      const packageJsonPath = path.join(this.workingDir, 'package.json');
      if (!(await fs.pathExists(packageJsonPath))) {
        return { passed: true, message: 'No package.json found, skipping tests' };
      }

      const packageJson = await fs.readJson(packageJsonPath);
      if (!packageJson.scripts?.test) {
        return { passed: true, message: 'No test script configured' };
      }

      const { spawn } = await import('child_process');
      return new Promise((resolve) => {
        const test = spawn('npm', ['test'], { 
          cwd: this.workingDir,
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        test.stdout.on('data', (data) => {
          output += data.toString();
        });

        test.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        test.on('close', (code) => {
          const passed = code === 0;
          
          // Parse test results (simplified)
          const passedMatches = output.match(/(\\d+)\\s+passing/);
          const failedMatches = output.match(/(\\d+)\\s+failing/);
          
          resolve({
            passed,
            passedTests: passedMatches ? parseInt(passedMatches[1]) : 0,
            failedTests: failedMatches ? parseInt(failedMatches[1]) : 0,
            totalTests: (passedMatches ? parseInt(passedMatches[1]) : 0) + (failedMatches ? parseInt(failedMatches[1]) : 0),
            output: output,
            errorOutput: errorOutput
          });
        });
      });
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      return { 
        passed: false, 
        error: error.message,
        passedTests: 0,
        failedTests: 1,
        totalTests: 1
      };
    }
  }

  async createPullRequest(changes, prDetails) {
    try {
      console.log('📤 Creating pull request...');
      
      // Stage all changes
      await this.git.add('.');
      
      // Create commit
      const commitMessage = `feat: Geenius AI improvements (${changes.length} changes)

${changes.map(c => `- ${c.category}: ${c.description}`).join('\\n')}

🤖 Generated with Geenius AI (Vercel Sandbox Processing)`;

      await this.git.commit(commitMessage);
      
      // Push to origin
      await this.git.push('origin', this.branchName);
      
      // Extract repository info
      const repoMatch = this.repoUrl.match(/github\\.com[\\/:](\\w+)\\/(\\w+)/);
      if (!repoMatch) {
        throw new Error('Invalid repository URL format');
      }
      
      const [, owner, repo] = repoMatch;
      
      // Create pull request via GitHub API
      const prResponse = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: prDetails.title,
        body: prDetails.body,
        head: this.branchName,
        base: this.baseBranch
      });
      
      console.log('✅ Pull request created successfully');
      
      return {
        success: true,
        prUrl: prResponse.data.html_url,
        branchName: this.branchName
      };
      
    } catch (error) {
      console.error('❌ Pull request creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkDeployment(branchName) {
    try {
      // This would check Vercel deployments via API
      // For now, return a placeholder
      return {
        success: false,
        message: 'Vercel deployment checking not implemented'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanup() {
    try {
      if (await fs.pathExists(this.workingDir)) {
        await fs.remove(this.workingDir);
      }
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async getChangedFiles() {
    try {
      const status = await this.git.status();
      return [
        ...status.created,
        ...status.modified,
        ...status.renamed.map(r => r.to)
      ];
    } catch (error) {
      return [];
    }
  }
}

// Main Vercel Function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, ...config } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const agent = new VercelSandboxAgent(config);

    switch (action) {
      case 'initialize': {
        const result = await agent.initialize();
        if (result.success) {
          res.json({ 
            success: true, 
            sandboxUrl: `${process.env.VERCEL_URL}/sandbox-status`,
            message: 'Vercel sandbox initialized successfully'
          });
        } else {
          res.status(500).json(result);
        }
        break;
      }

      case 'process_tasks': {
        const { tasks } = config;
        if (!tasks || !Array.isArray(tasks)) {
          return res.status(400).json({ error: 'Tasks array required' });
        }

        await agent.initialize();
        const result = await agent.processTasks(tasks);
        await agent.cleanup();
        
        res.json(result);
        break;
      }

      case 'run_tests': {
        await agent.initialize();
        const result = await agent.runTests();
        await agent.cleanup();
        
        res.json(result);
        break;
      }

      case 'create_pr': {
        const { changes, prDetails } = config;
        if (!changes || !prDetails) {
          return res.status(400).json({ error: 'Changes and PR details required' });
        }

        await agent.initialize();
        const result = await agent.createPullRequest(changes, prDetails);
        await agent.cleanup();
        
        res.json(result);
        break;
      }

      case 'check_deployment': {
        const { branchName } = config;
        if (!branchName) {
          return res.status(400).json({ error: 'Branch name required' });
        }

        const result = await agent.checkDeployment(branchName);
        res.json(result);
        break;
      }

      case 'cleanup': {
        await agent.cleanup();
        res.json({ success: true, message: 'Cleanup completed' });
        break;
      }

      default:
        res.status(400).json({ error: 'Unknown action' });
    }

  } catch (error) {
    console.error('Vercel Function error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}