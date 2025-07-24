// Example integration of ProjectInitializationContext with a new UI design
// This shows how to use the context provider with any custom UI

import React from 'react';
import { ProjectInitProvider, useProjectInit } from './ProjectInitializationContext';

// Your custom UI component that uses the context
const CustomProjectInitUI: React.FC = () => {
  const {
    state,
    updateProjectConfig,
    updateAIConfig,
    updateInfrastructureConfig,
    startInitialization,
    setError,
    addLog,
    resetState
  } = useProjectInit();

  const handleStartProject = async () => {
    // Validate required fields
    if (!state.projectName.trim()) {
      setError('Project name is required');
      return;
    }
    
    if (!state.userRequirements.trim()) {
      setError('Project requirements are required');
      return;
    }

    // Start the workflow
    await startInitialization();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          🚀 Project Initialization
        </h1>

        {/* Current Step Indicator */}
        <div className="mb-8 text-center">
          <div className="text-white text-xl">
            Current Step: <span className="font-bold capitalize">{state.currentStep}</span>
          </div>
          {state.isProcessing && (
            <div className="mt-2">
              <div className="bg-white/20 rounded-full h-2 w-full max-w-md mx-auto">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-white/80 mt-2">{state.status}</p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-500/20 border border-red-500 text-white p-4 rounded-lg mb-6">
            <h3 className="font-bold">❌ Error</h3>
            <p>{state.error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Display */}
        {state.deploymentUrl && (
          <div className="bg-green-500/20 border border-green-500 text-white p-4 rounded-lg mb-6">
            <h3 className="font-bold">🎉 Project Ready!</h3>
            <p>Your project has been successfully created and deployed!</p>
            <a 
              href={state.deploymentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 inline-block px-4 py-2 bg-green-500 hover:bg-green-600 rounded"
            >
              View Project
            </a>
          </div>
        )}

        {/* Configuration Form */}
        {state.currentStep === 'init' && !state.isProcessing && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-6">
            {/* Project Configuration */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Project Configuration</h2>
              
              <div>
                <label className="block text-white font-medium mb-2">Project Name</label>
                <input
                  type="text"
                  value={state.projectName}
                  onChange={(e) => updateProjectConfig({ projectName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30"
                  placeholder="My Awesome Project"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Template</label>
                <select
                  value={state.templateId}
                  onChange={(e) => updateProjectConfig({ templateId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                >
                  <option value="vite-react-mongo">React + MongoDB + Prisma</option>
                  <option value="vite-react-supabase">React + Supabase</option>
                  <option value="nextjs-supabase">Next.js + Supabase</option>
                  <option value="vite-react-planetscale">React + PlanetScale</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Business Domain</label>
                <select
                  value={state.businessDomain}
                  onChange={(e) => updateProjectConfig({ businessDomain: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                >
                  <option value="">Select a domain...</option>
                  <option value="medical">Medical/Healthcare</option>
                  <option value="legal">Legal Services</option>
                  <option value="restaurant">Restaurant/Food</option>
                  <option value="retail">Retail/E-commerce</option>
                  <option value="service">Service Business</option>
                  <option value="finance">Finance</option>
                  <option value="education">Education</option>
                  <option value="technology">Technology</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Project Requirements</label>
                <textarea
                  value={state.userRequirements}
                  onChange={(e) => updateProjectConfig({ userRequirements: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 h-32"
                  placeholder="Describe what you want your project to do..."
                />
              </div>
            </div>

            {/* AI Configuration */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">AI Configuration</h2>
              
              <div>
                <label className="block text-white font-medium mb-2">AI Provider</label>
                <select
                  value={state.aiProvider}
                  onChange={(e) => updateAIConfig({ aiProvider: e.target.value as any })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white border border-white/30"
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="google">Google (Gemini)</option>
                  <option value="grok">X.AI (Grok)</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Model</label>
                <input
                  type="text"
                  value={state.model}
                  onChange={(e) => updateAIConfig({ model: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30"
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
            </div>

            {/* Infrastructure Configuration */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Infrastructure Configuration</h2>
              
              <div>
                <label className="block text-white font-medium mb-2">GitHub Organization</label>
                <input
                  type="text"
                  value={state.githubOrg}
                  onChange={(e) => updateInfrastructureConfig({ githubOrg: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30"
                  placeholder="your-github-org"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-white">
                  <input
                    type="checkbox"
                    checked={state.autoSetup}
                    onChange={(e) => updateInfrastructureConfig({ autoSetup: e.target.checked })}
                    className="rounded"
                  />
                  <span>Auto-setup infrastructure (MongoDB, Netlify)</span>
                </label>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">MongoDB Organization ID</label>
                <input
                  type="text"
                  value={state.mongodbOrgId}
                  onChange={(e) => updateInfrastructureConfig({ mongodbOrgId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30"
                  placeholder="MongoDB Atlas Organization ID"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">MongoDB Project ID</label>
                <input
                  type="text"
                  value={state.mongodbProjectId}
                  onChange={(e) => updateInfrastructureConfig({ mongodbProjectId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30"
                  placeholder="CREATE_NEW or existing project ID"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-6">
              <button
                onClick={resetState}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                Reset Form
              </button>
              
              <button
                onClick={handleStartProject}
                disabled={state.isProcessing}
                className="px-8 py-3 bg-white hover:bg-white/90 text-blue-600 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.isProcessing ? 'Creating Project...' : 'Create Project'}
              </button>
            </div>
          </div>
        )}

        {/* Status Display */}
        {(state.currentStep === 'status' || state.isProcessing) && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Project Status</h2>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-white mb-2">
                <span>Progress</span>
                <span>{state.progress}%</span>
              </div>
              <div className="bg-white/20 rounded-full h-4">
                <div 
                  className="bg-white h-4 rounded-full transition-all duration-300" 
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>

            {/* Current Status */}
            <div className="text-white mb-4">
              <strong>Status:</strong> {state.status}
            </div>

            {/* Session ID */}
            {state.sessionId && (
              <div className="text-white/80 mb-4">
                <strong>Session ID:</strong> {state.sessionId}
              </div>
            )}
          </div>
        )}

        {/* Logs Display */}
        {state.logs.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mt-6">
            <h2 className="text-2xl font-bold text-white mb-4">Activity Logs</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.logs.slice(-10).map((log, index) => (
                <div 
                  key={index}
                  className={`text-sm p-2 rounded ${
                    log.level === 'error' ? 'bg-red-500/20 text-red-200' :
                    log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-200' :
                    log.level === 'success' ? 'bg-green-500/20 text-green-200' :
                    'bg-white/10 text-white/80'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium">{log.level.toUpperCase()}</span>
                    <span className="text-xs opacity-70">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main wrapper component with provider
const ProjectInitApp: React.FC = () => {
  return (
    <ProjectInitProvider>
      <CustomProjectInitUI />
    </ProjectInitProvider>
  );
};

export default ProjectInitApp;