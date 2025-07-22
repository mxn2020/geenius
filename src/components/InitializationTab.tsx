// src/InitializationTab.tsx

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AppHooks } from '../app-types';

interface InitializationTabProps extends AppHooks {
  setActiveView: (view: string) => void;
}

const InitializationTab: React.FC<InitializationTabProps> = ({
  templates,
  githubAccounts,
  mongodbData,
  selectedOrg,
  selectedProject,
  selectedGithubAccount,
  projectName,
  agentMode,
  sessionId,
  sessionStatus,
  sessionLogs,
  loading,
  setSelectedGithubAccount,
  setProjectName,
  setAgentMode,
  setLoading,
  setLoadingMessage,
  setSessionId,
  setSessionStatus,
  setSessionLogs,
  setLogs,
  setActiveView,
  setDeploymentStatus,
  setSessionProgress,
  setRepoUrl,
  setNetlifyUrl,
  setProjectStatus,
  handleOrgChange,
  getSelectedOrgProjects,
  startLogStreaming,
  stopLogPolling
}) => {
  const [initMode, setInitMode] = useState('simple');

  const handleSimpleInitSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage('Initializing project...');
    
    // Complete reset of all project-related state
    setSessionLogs([]);
    setLogs([]);
    setSessionId('');
    setSessionStatus('');
    setSessionProgress(0);
    setRepoUrl('');
    setNetlifyUrl('');
    setDeploymentStatus('');
    setProjectStatus({ hasProject: false, loading: false });
    stopLogPolling();
    
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());

    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    // Use simplified defaults for simple mode
    const simplifiedData = {
      ...data,
      aiProvider: data.aiProvider || 'anthropic',
      agentMode: 'single',
      templateId: data.templateId || 'vite-react-mongo',
      autoSetup: true
    };

    // Use selected GitHub account if available, otherwise use form input
    if (githubAccounts.available && selectedGithubAccount) {
      simplifiedData.githubOrg = selectedGithubAccount;
    }

    try {
      const response = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simplifiedData)
      });

      const result = await response.json();

      if (response.ok) {
        setLoadingMessage('Project initialized successfully! Starting deployment...');

        if (result.sessionId) {
          setSessionId(result.sessionId);
          setDeploymentStatus('deploying');

          setTimeout(() => {
            setActiveView('logs');
            setLoading(false);
            startLogStreaming(result.sessionId, true);
          }, 1500);
        } else {
          setLoadingMessage('Project initialized successfully!');
          setTimeout(() => setLoading(false), 2000);
        }
      } else {
        throw new Error(result.error || 'Failed to initialize project');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Init failed:', error);
      setLoadingMessage(`Error: ${errorMessage}`);
      setTimeout(() => setLoading(false), 3000);
    }
  };

  const handleAdvancedInitSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setLoadingMessage('Initializing project...');
    
    // Complete reset of all project-related state
    setSessionLogs([]);
    setLogs([]);
    setSessionId('');
    setSessionStatus('');
    setSessionProgress(0);
    setRepoUrl('');
    setNetlifyUrl('');
    setDeploymentStatus('');
    setProjectStatus({ hasProject: false, loading: false });
    stopLogPolling();
    
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());

    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);

    // Use selected GitHub account if available, otherwise use form input
    if (githubAccounts.available && selectedGithubAccount) {
      data.githubOrg = selectedGithubAccount;
    }

    try {
      const response = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        setLoadingMessage('Project initialized successfully! Starting deployment...');

        if (result.sessionId) {
          setSessionId(result.sessionId);
          setDeploymentStatus('deploying');

          setTimeout(() => {
            setActiveView('logs');
            setLoading(false);
            startLogStreaming(result.sessionId, true);
          }, 1500);
        } else {
          setLoadingMessage('Project initialized successfully!');
          setTimeout(() => setLoading(false), 2000);
        }
      } else {
        throw new Error(result.error || 'Failed to initialize project');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Init failed:', error);
      setLoadingMessage(`Error: ${errorMessage}`);
      setTimeout(() => setLoading(false), 3000);
    }
  };

  return (
    <Card className="shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Initialize New Project</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Active Session Overlay */}
        {sessionId && sessionStatus && sessionStatus !== 'completed' && sessionStatus !== 'failed' && sessionStatus !== 'session_not_found' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-lg border-2 border-blue-200">
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Active Session in Progress
                </h3>
                <p className="text-gray-600 mb-4">
                  You currently have an active session running. Starting a new project will override the current session.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Current Session:</strong>
                  </p>
                  <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-1 block">
                    {sessionId}
                  </code>
                  {sessionStatus && (
                    <p className="text-sm text-blue-700 mt-2">
                      Status: <span className="font-medium capitalize">{sessionStatus.replace('_', ' ')}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setActiveView('logs')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📋 View Current Session
                  </Button>
                  <Button
                    onClick={() => {
                      // Complete reset of all project-related state
                      setSessionLogs([]);
                      setLogs([]);
                      setSessionId('');
                      setSessionStatus('');
                      setSessionProgress(0);
                      setRepoUrl('');
                      setNetlifyUrl('');
                      setDeploymentStatus('');
                      setProjectStatus({ hasProject: false, loading: false });
                      stopLogPolling();
                      
                      // Clear URL parameters
                      const url = new URL(window.location.href);
                      url.searchParams.delete('session');
                      window.history.replaceState({}, '', url.toString());
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑️ Start New Session
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nested Tabs for Simple vs Advanced */}
        <Tabs value={initMode} onValueChange={setInitMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="simple">Simple Setup</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Setup</TabsTrigger>
          </TabsList>
          
          {/* Simple Mode */}
          <TabsContent value="simple">
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Simple Mode:</strong> Quick setup with sensible defaults. Perfect for getting started quickly.
              </p>
            </div>
            <form onSubmit={handleSimpleInitSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  type="text"
                  name="projectName"
                  value={projectName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setProjectName(newName);
                    if (newName && selectedOrg && mongodbData.available) {
                      handleOrgChange(selectedOrg);
                    }
                  }}
                  placeholder="my-awesome-project"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="githubOrg">GitHub Organization/Username</Label>
                {githubAccounts.loading ? (
                  <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Loading GitHub accounts...
                  </div>
                ) : githubAccounts.available && githubAccounts.accounts.length > 0 ? (
                  <Select
                    name="githubOrg"
                    value={selectedGithubAccount}
                    onValueChange={setSelectedGithubAccount}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select GitHub account" />
                    </SelectTrigger>
                    <SelectContent>
                      {githubAccounts.accounts.map(account => (
                        <SelectItem key={account.login} value={account.login}>
                          {account.login} ({account.type === 'user' ? '👤 Personal' : '🏢 Organization'})
                          {account.description && ` - ${account.description}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="text"
                    name="githubOrg"
                    placeholder="Enter GitHub username or organization"
                    required
                  />
                )}
                {!githubAccounts.available && !githubAccounts.loading && (
                  <Alert>
                    <AlertDescription>
                      ⚠️ GitHub token not configured - manual input required
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectRequirements">Project Requirements (Optional)</Label>
                <Textarea
                  name="projectRequirements"
                  placeholder="Optional: Describe your project for AI customization. For example: 'Create a doctor website with client management, appointment scheduling, and visitors should be able to request appointments online.' Leave empty to deploy the standard template without AI customization."
                  rows={6}
                  className="min-h-[150px] text-base"
                />
                <p className="text-xs text-gray-500">
                  <strong>Empty:</strong> Deploy standard template without AI (faster). <strong>Filled:</strong> AI will customize the template based on your requirements.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select name="templateId" defaultValue="vite-react-mongo" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vite-react-mongo">Vite + React + MongoDB</SelectItem>
                    <SelectItem value="next-supabase">Next.js + Supabase</SelectItem>
                    <SelectItem value="react-indexeddb">React + IndexedDB + JWT</SelectItem>
                    <SelectItem value="vue-firebase">Vue + Pinia + Firebase</SelectItem>
                    <SelectItem value="svelte-drizzle">SvelteKit + Drizzle + PlanetScale</SelectItem>
                    <SelectItem value="astro-content">Astro + Content Collections</SelectItem>
                    <SelectItem value="express-prisma">Express + Prisma + PostgreSQL</SelectItem>
                    <SelectItem value="remix-sqlite">Remix + SQLite + Auth</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Default: Vite + React + MongoDB (recommended for most projects)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Default Settings Applied:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Template: Vite + React + MongoDB (standard deployment)</li>
                  <li>• AI Processing: Only if Project Requirements are provided</li>
                  <li>• AI Provider: Claude (Anthropic) - if AI is used</li>
                  <li>• Agent Mode: Single Agent - if AI is used</li>
                  <li>• Auto-setup: GitHub repo and Netlify deployment enabled</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                🚀 Quick Initialize Project
              </Button>
            </form>
          </TabsContent>
          
          {/* Advanced Mode */}
          <TabsContent value="advanced">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Advanced Mode:</strong> Full control over all configuration options.
              </p>
            </div>
            <form onSubmit={handleAdvancedInitSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aiProvider">AI Provider</Label>
            <Select name="aiProvider" required defaultValue="anthropic">
              <SelectTrigger>
                <SelectValue placeholder="Select AI provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">🤖 Claude (Anthropic) - Best for coding</SelectItem>
                <SelectItem value="openai">🧠 GPT-4 (OpenAI) - Most versatile</SelectItem>
                <SelectItem value="google">✨ Gemini (Google) - Creative problem solving</SelectItem>
                <SelectItem value="grok">⚡ Grok (X.AI) - Fast and witty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentMode">Agent Architecture</Label>
            <Select
              name="agentMode"
              value={agentMode}
              onValueChange={setAgentMode}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select agent architecture" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">🎯 Single Agent - Fast and focused</SelectItem>
                <SelectItem value="orchestrated">👥 Multi-Agent Team - Specialized roles</SelectItem>
                <SelectItem value="hybrid">🔄 Hybrid - Best of both worlds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectRequirements">Project Requirements (Optional)</Label>
            <Textarea
              name="projectRequirements"
              placeholder="Describe your project requirements for AI customization. For example: 'Create a doctor website with client management, appointment scheduling, and visitors should be able to request appointments online. Include patient records and appointment calendar.' Leave empty for standard template deployment."
              rows={6}
              className="min-h-[150px]"
            />
            <p className="text-xs text-gray-500">
              Optional: Provide detailed requirements for AI to customize the template. Leave empty to deploy the standard template without customization.
            </p>
          </div>

          {(agentMode === 'orchestrated' || agentMode === 'hybrid') && (
            <div className="space-y-2">
              <Label htmlFor="orchestrationStrategy">Team Coordination Strategy</Label>
              <Select name="orchestrationStrategy">
                <SelectTrigger>
                  <SelectValue placeholder="Select coordination strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hierarchical">📋 Hierarchical - Lead manages team</SelectItem>
                  <SelectItem value="collaborative">🤝 Collaborative - Agents work together</SelectItem>
                  <SelectItem value="parallel">⚡ Parallel - Maximum speed</SelectItem>
                  <SelectItem value="sequential">📐 Sequential - Step by step</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="templateId">Project Template</Label>
            <Select name="templateId" required>
              <SelectTrigger>
                <SelectValue placeholder={templates.length === 0 ? "Loading templates..." : "Select project template"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              type="text"
              name="projectName"
              value={projectName}
              onChange={(e) => {
                const newName = e.target.value;
                setProjectName(newName);
                if (newName && selectedOrg && mongodbData.available) {
                  handleOrgChange(selectedOrg);
                }
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="githubOrg">GitHub Organization/Username</Label>
            {githubAccounts.loading ? (
              <div className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading GitHub accounts...
              </div>
            ) : githubAccounts.available && githubAccounts.accounts.length > 0 ? (
              <Select
                name="githubOrg"
                value={selectedGithubAccount}
                onValueChange={setSelectedGithubAccount}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GitHub account" />
                </SelectTrigger>
                <SelectContent>
                  {githubAccounts.accounts.map(account => (
                    <SelectItem key={account.login} value={account.login}>
                      {account.login} ({account.type === 'user' ? '👤 Personal' : '🏢 Organization'})
                      {account.description && ` - ${account.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                name="githubOrg"
                placeholder="Enter GitHub username or organization"
                required
              />
            )}
            {!githubAccounts.available && !githubAccounts.loading && (
              <Alert>
                <AlertDescription>
                  ⚠️ GitHub token not configured - manual input required
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model (optional)</Label>
            <Input
              type="text"
              name="model"
              placeholder="Leave empty for default"
            />
          </div>

          {mongodbData.available && (
            <>
              <div className="space-y-2">
                <Label htmlFor="mongodbOrgId">MongoDB Organization</Label>
                <Select
                  name="mongodbOrgId"
                  value={selectedOrg}
                  onValueChange={handleOrgChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select MongoDB organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {mongodbData.organizations.map(orgData => (
                      <SelectItem key={orgData.organization.id} value={orgData.organization.id}>
                        {orgData.organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrg && (
                <div className="space-y-2">
                  <Label htmlFor="mongodbProjectId">MongoDB Project</Label>
                  <Select
                    name="mongodbProjectId"
                    value={selectedProject}
                    onValueChange={(value) => handleOrgChange(selectedOrg)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select MongoDB project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectName && (
                        <SelectItem value="CREATE_NEW">
                          🆕 Create new project: "{projectName}"
                        </SelectItem>
                      )}
                      {getSelectedOrgProjects().map(project => {
                        const hasExistingClusters = project.clusters && project.clusters.length > 0;
                        return (
                          <SelectItem 
                            key={project.id} 
                            value={project.id}
                            disabled={hasExistingClusters}
                            className={hasExistingClusters ? 'opacity-50 cursor-not-allowed' : ''}
                          >
                            {project.name} {hasExistingClusters && `(${project.clusters.length} cluster${project.clusters.length > 1 ? 's' : ''})`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              name="autoSetup"
              id="autoSetup"
              defaultChecked={true}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoSetup" className="text-sm text-gray-700">
              Auto-setup GitHub repo and Netlify project
            </label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            🚀 Initialize Project
          </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InitializationTab;