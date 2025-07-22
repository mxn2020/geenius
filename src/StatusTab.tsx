// src/StatusTab.tsx

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppHooks } from './app-types';

interface StatusTabProps extends AppHooks {
  setActiveView: (view: string) => void;
}

const StatusTab: React.FC<StatusTabProps> = ({
  projectStatus,
  loadProjectStatus,
  setActiveView
}) => {
  // Auto-refresh for active sessions
  React.useEffect(() => {
    if (projectStatus.isActiveSession && projectStatus.status !== 'completed' && projectStatus.status !== 'failed') {
      const interval = setInterval(() => {
        loadProjectStatus();
      }, 3000); // Refresh every 3 seconds for active sessions
      
      return () => clearInterval(interval);
    }
  }, [projectStatus.isActiveSession, projectStatus.status, loadProjectStatus]);

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <Card className="shadow-xl border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-3xl font-bold text-gray-800">Project Status</CardTitle>
            <Button
              onClick={loadProjectStatus}
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              🔄 Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {projectStatus.loading ? (
        <Card className="shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading project status...</span>
          </CardContent>
        </Card>
      ) : projectStatus.error ? (
        <Card className="shadow-xl border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">❌ Error: {projectStatus.error}</p>
            </div>
          </CardContent>
        </Card>
      ) : !projectStatus.hasProject ? (
        <Card className="shadow-xl border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <div className="text-6xl mb-4">🏗️</div>
              <h3 className="text-xl font-bold text-yellow-800 mb-2">No Project Initialized</h3>
              <p className="text-yellow-700 mb-6">Ready to build something amazing? Initialize your first project to get started.</p>
              <Button
                onClick={() => setActiveView('init')}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                🚀 Initialize Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project Overview Card */}
          <Card className={`shadow-xl border-l-4 ${projectStatus.isActiveSession ? 'border-l-blue-500' : 'border-l-green-500'}`}>
            <CardHeader>
              <CardTitle className={`text-xl flex items-center gap-2 ${projectStatus.isActiveSession ? 'text-blue-800' : 'text-green-800'}`}>
                {projectStatus.isActiveSession ? '🔄 Active Session' : '✅ Project Overview'}
                <Badge variant="secondary" className={projectStatus.isActiveSession ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                  {projectStatus.status || 'Active'}
                </Badge>
              </CardTitle>
              {projectStatus.isActiveSession && projectStatus.progress !== undefined && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>{projectStatus.currentStep || 'Processing...'}</span>
                    <span>{projectStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${projectStatus.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectStatus.projectName && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Project Name</label>
                    <p className="text-lg font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded border">{projectStatus.projectName}</p>
                  </div>
                )}
                {projectStatus.projectId && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Project ID</label>
                    <p className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded border">{projectStatus.projectId}</p>
                  </div>
                )}
                {projectStatus.templateId && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Template</label>
                    <p className="text-lg text-gray-900 bg-blue-50 px-3 py-2 rounded border border-blue-200">{projectStatus.templateId}</p>
                  </div>
                )}
                {projectStatus.aiProvider && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">AI Provider</label>
                    <p className="text-lg capitalize text-gray-900 bg-purple-50 px-3 py-2 rounded border border-purple-200">{projectStatus.aiProvider}</p>
                  </div>
                )}
                {projectStatus.agentMode && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Agent Mode</label>
                    <p className="text-lg capitalize text-gray-900 bg-orange-50 px-3 py-2 rounded border border-orange-200">{projectStatus.agentMode}</p>
                  </div>
                )}
                {projectStatus.orchestrationStrategy && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Strategy</label>
                    <p className="text-lg capitalize text-gray-900 bg-indigo-50 px-3 py-2 rounded border border-indigo-200">{projectStatus.orchestrationStrategy}</p>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              {(projectStatus.createdAt || projectStatus.updatedAt) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projectStatus.createdAt && (
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Created</label>
                        <p className="text-gray-700">{new Date(projectStatus.createdAt).toLocaleString()}</p>
                      </div>
                    )}
                    {projectStatus.updatedAt && (
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Last Updated</label>
                        <p className="text-gray-700">{new Date(projectStatus.updatedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* External Integrations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GitHub Integration */}
            <Card className="shadow-xl border-l-4 border-l-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                  📁 GitHub Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectStatus.githubOrg && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-600">Organization</label>
                      <p className="font-mono text-gray-900">{projectStatus.githubOrg}</p>
                    </div>
                  )}
                  {projectStatus.repositoryUrl ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-600">Repository</label>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded flex-1">
                          {projectStatus.repositoryUrl.split('/').slice(-2).join('/')}
                        </p>
                        <a
                          href={projectStatus.repositoryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 transition-colors"
                        >
                          View Repo
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-sm text-yellow-700">Repository not yet created</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Netlify Deployment */}
            <Card className="shadow-xl border-l-4 border-l-purple-600">
              <CardHeader>
                <CardTitle className="text-lg text-purple-800 flex items-center gap-2">
                  🌐 Netlify Deployment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectStatus.netlifyUrl ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">Live Site</label>
                        <div className="flex items-center gap-3">
                          <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded flex-1">
                            {new URL(projectStatus.netlifyUrl).hostname}
                          </p>
                          <a
                            href={projectStatus.netlifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Visit Site
                          </a>
                        </div>
                      </div>
                      
                      {projectStatus.netlifyProject && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-gray-600">Netlify Project ID</label>
                            <div className="flex items-center gap-3">
                              <p className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded flex-1 break-all">
                                {projectStatus.netlifyProject}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <a
                              href={`https://app.netlify.com/sites/${projectStatus.netlifyProject}/overview`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 transition-colors"
                            >
                              📊 Dashboard
                            </a>
                            <a
                              href={`https://app.netlify.com/sites/${projectStatus.netlifyProject}/settings/deploys`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 transition-colors"
                            >
                              ⚙️ Deploy Config
                            </a>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-sm text-yellow-700">Deployment not yet configured</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MongoDB Configuration */}
          {(projectStatus.mongodbOrgId || projectStatus.mongodbProjectId || projectStatus.mongodbDatabase) && (
            <Card className="shadow-xl border-l-4 border-l-green-600">
              <CardHeader>
                <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                  🍃 MongoDB Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projectStatus.mongodbOrgId && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-600">Organization ID</label>
                      <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded border break-all">
                        {projectStatus.mongodbOrgId}
                      </p>
                    </div>
                  )}
                  {projectStatus.mongodbProjectId && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-600">Project ID</label>
                      <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded border break-all">
                        {projectStatus.mongodbProjectId}
                      </p>
                    </div>
                  )}
                  {projectStatus.mongodbDatabase && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-600">Database</label>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-gray-900 bg-green-50 px-2 py-1 rounded border border-green-200 flex-1">
                          {projectStatus.mongodbDatabase}
                        </p>
                        {projectStatus.mongodbOrgId ? (
                          <a
                            href={`https://cloud.mongodb.com/v2/${projectStatus.mongodbOrgId}#/metrics/replicaSet/${projectStatus.mongodbDatabase}/explorer`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 bg-gray-400 text-white text-sm rounded cursor-not-allowed">
                            No Org ID
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="shadow-xl border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="text-lg text-indigo-800 flex items-center gap-2">
                🚀 Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => setActiveView('develop')}
                  className="bg-indigo-600 hover:bg-indigo-700 h-12"
                >
                  <span className="text-lg mr-2">💻</span>
                  Start Development
                </Button>
                <Button
                  onClick={() => setActiveView('logs')}
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-12"
                >
                  <span className="text-lg mr-2">📋</span>
                  View Logs
                </Button>
                <Button
                  onClick={() => window.open(projectStatus.repositoryUrl, '_blank')}
                  disabled={!projectStatus.repositoryUrl}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 h-12"
                >
                  <span className="text-lg mr-2">📁</span>
                  Open Repository
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StatusTab;