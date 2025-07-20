import React, { useState, useEffect } from 'react'

function App() {
  const [activeView, setActiveView] = useState('init')
  const [envStatus, setEnvStatus] = useState({
    github: { configured: false, loading: true, error: null },
    netlify: { configured: false, loading: true, error: null },
    mongodb: { configured: false, loading: true, error: null }
  })
  const [templates, setTemplates] = useState([])
  const [mongodbData, setMongodbData] = useState({ available: false, organizations: [] })
  const [selectedOrg, setSelectedOrg] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [agentMode, setAgentMode] = useState('single')
  const [sessionId, setSessionId] = useState('')
  const [logs, setLogs] = useState([])
  const [deploymentStatus, setDeploymentStatus] = useState('')
  const [sessionLogs, setSessionLogs] = useState([])
  const [sessionStatus, setSessionStatus] = useState('')
  const [sessionProgress, setSessionProgress] = useState(0)
  const [repoUrl, setRepoUrl] = useState('')
  const [netlifyUrl, setNetlifyUrl] = useState('')
  const [logPollingInterval, setLogPollingInterval] = useState(null)

  useEffect(() => {
    checkEnvironmentStatus()
    loadTemplates()
    loadMongodbProjects()
    
    // Check for session ID in URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const urlSessionId = urlParams.get('session')
    if (urlSessionId) {
      setSessionId(urlSessionId)
      setActiveView('logs')
      startLogPolling(urlSessionId)
    }
  }, [])

  const checkEnvironmentStatus = async () => {
    try {
      const response = await fetch('/.netlify/functions/web-env-status')
      const data = await response.json()
      
      if (response.ok) {
        setEnvStatus({
          github: { 
            configured: data.github.configured, 
            loading: false, 
            error: data.github.error 
          },
          netlify: { 
            configured: data.netlify.configured, 
            loading: false, 
            error: data.netlify.error 
          },
          mongodb: { 
            configured: data.mongodb.configured, 
            loading: false, 
            error: data.mongodb.error 
          }
        })
      } else {
        throw new Error(data.error || 'Failed to check environment status')
      }
    } catch (error) {
      console.error('Environment status check failed:', error)
      setEnvStatus({
        github: { configured: false, loading: false, error: 'Check failed' },
        netlify: { configured: false, loading: false, error: 'Check failed' },
        mongodb: { configured: false, loading: false, error: 'Check failed' }
      })
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/.netlify/functions/web-templates')
      const data = await response.json()
      if (response.ok) {
        // API returns templates array directly, not wrapped in { templates: [] }
        setTemplates(Array.isArray(data) ? data : data.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const loadMongodbProjects = async () => {
    try {
      const response = await fetch('/.netlify/functions/mongodb-projects')
      const data = await response.json()
      if (response.ok) {
        setMongodbData(data)
        // Auto-select first org and project if available
        if (data.available && data.organizations.length > 0) {
          const firstOrg = data.organizations[0]
          setSelectedOrg(firstOrg.organization.id)
          if (firstOrg.projects.length > 0) {
            setSelectedProject(firstOrg.projects[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load MongoDB projects:', error)
    }
  }

  const handleOrgChange = (orgId) => {
    setSelectedOrg(orgId)
    // Reset project selection and auto-select based on project name or first project
    if (projectName) {
      setSelectedProject(`create:${projectName}`)
    } else {
      const org = mongodbData.organizations.find(o => o.organization.id === orgId)
      if (org && org.projects.length > 0) {
        setSelectedProject(org.projects[0].id)
      } else {
        setSelectedProject('')
      }
    }
  }

  const getSelectedOrgProjects = () => {
    const org = mongodbData.organizations.find(o => o.organization.id === selectedOrg)
    return org ? org.projects : []
  }

  const addLog = (message) => {
    const timestamp = `[${new Date().toLocaleTimeString()}] ${message}`
    setLogs(prev => [...prev, timestamp])
  }

  const startLogStreaming = async (sessionIdParam) => {
    addLog('🚀 Project initialization started...')
    addLog(`📝 Session ID: ${sessionIdParam}`)
    
    // Update URL with session parameter
    const url = new URL(window.location.href)
    url.searchParams.set('session', sessionIdParam)
    window.history.pushState({}, '', url.toString())
    
    startLogPolling(sessionIdParam)
  }

  const startLogPolling = (sessionIdParam) => {
    if (logPollingInterval) {
      clearInterval(logPollingInterval)
    }
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/.netlify/functions/web-init/${sessionIdParam}`)
        if (response.ok) {
          const data = await response.json()
          
          setSessionStatus(data.status)
          setSessionProgress(data.progress || 0)
          setSessionLogs(data.logs || [])
          
          if (data.repoUrl) setRepoUrl(data.repoUrl)
          if (data.netlifyUrl) setNetlifyUrl(data.netlifyUrl)
          
          // Check if completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval)
            setLogPollingInterval(null)
            setDeploymentStatus(data.status)
            
            if (data.status === 'completed') {
              addLog('🎉 Project initialization completed!')
              if (data.repoUrl) addLog(`📁 Repository: ${data.repoUrl}`)
              if (data.netlifyUrl) addLog(`🌐 Netlify URL: ${data.netlifyUrl}`)
              if (data.mongodbDatabase) addLog(`🍃 MongoDB Database: ${data.mongodbDatabase}`)
            }
          }
        }
      } catch (error) {
        console.error('Error polling logs:', error)
      }
    }, 2000)
    
    setLogPollingInterval(interval)
  }

  const stopLogPolling = () => {
    if (logPollingInterval) {
      clearInterval(logPollingInterval)
      setLogPollingInterval(null)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopLogPolling()
  }, [])

  const handleInitSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoadingMessage('Initializing project...')
    
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData)
    
    try {
      const response = await fetch('/.netlify/functions/web-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setLoadingMessage('Project initialized successfully! Starting deployment...')
        
        // Capture session ID for tracking
        if (result.sessionId) {
          setSessionId(result.sessionId)
          setDeploymentStatus('deploying')
          
          // Switch to logs tab
          setTimeout(() => {
            setActiveView('logs')
            setLoading(false)
            startLogStreaming(result.sessionId)
          }, 1500)
        } else {
          setLoadingMessage('Project initialized successfully!')
          setTimeout(() => setLoading(false), 2000)
        }
      } else {
        throw new Error(result.error || 'Failed to initialize project')
      }
    } catch (error) {
      console.error('Init failed:', error)
      setLoadingMessage(`Error: ${error.message}`)
      setTimeout(() => setLoading(false), 3000)
    }
  }

  const handleDevelopSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoadingMessage('Starting development session...')
    
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData)
    
    try {
      const response = await fetch('/.netlify/functions/web-develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setLoadingMessage('Development session started!')
        setTimeout(() => setLoading(false), 2000)
      } else {
        throw new Error(result.error || 'Failed to start development')
      }
    } catch (error) {
      console.error('Development failed:', error)
      setLoadingMessage(`Error: ${error.message}`)
      setTimeout(() => setLoading(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <header className="text-center py-8 text-white">
        <h1 className="text-4xl font-bold mb-2">🚀 Geenius AI Development Agent</h1>
        <p className="text-xl opacity-90">Advanced AI agents with orchestration capabilities!</p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-8">
        {/* Navigation */}
        <nav className="flex gap-4 mb-8 flex-wrap">
          <button 
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeView === 'init' 
                ? 'bg-white text-blue-600 shadow-lg' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            onClick={() => setActiveView('init')}
          >
            Initialize Project
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeView === 'status' 
                ? 'bg-white text-blue-600 shadow-lg' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            onClick={() => setActiveView('status')}
          >
            Project Status
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeView === 'develop' 
                ? 'bg-white text-blue-600 shadow-lg' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            onClick={() => setActiveView('develop')}
          >
            Development
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeView === 'logs' 
                ? 'bg-white text-blue-600 shadow-lg' 
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            onClick={() => setActiveView('logs')}
          >
            Logs
          </button>
        </nav>

        {/* Content Views */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {activeView === 'init' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Initialize New Project</h2>
              <form onSubmit={handleInitSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider:</label>
                  <select name="aiProvider" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                    <option value="anthropic">🤖 Claude (Anthropic) - Best for coding</option>
                    <option value="openai">🧠 GPT-4 (OpenAI) - Most versatile</option>
                    <option value="google">✨ Gemini (Google) - Creative problem solving</option>
                    <option value="grok">⚡ Grok (X.AI) - Fast and witty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Agent Architecture:</label>
                  <select 
                    name="agentMode" 
                    value={agentMode}
                    onChange={(e) => setAgentMode(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    required
                  >
                    <option value="single">🎯 Single Agent - Fast and focused</option>
                    <option value="orchestrated">👥 Multi-Agent Team - Specialized roles</option>
                    <option value="hybrid">🔄 Hybrid - Best of both worlds</option>
                  </select>
                </div>

                {(agentMode === 'orchestrated' || agentMode === 'hybrid') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team Coordination Strategy:</label>
                    <select name="orchestrationStrategy" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="hierarchical">📋 Hierarchical - Lead manages team</option>
                      <option value="collaborative">🤝 Collaborative - Agents work together</option>
                      <option value="parallel">⚡ Parallel - Maximum speed</option>
                      <option value="sequential">📐 Sequential - Step by step</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Template:</label>
                  <select name="templateId" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                    {templates.length === 0 ? (
                      <option value="">Loading templates...</option>
                    ) : (
                      templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.description}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Name:</label>
                  <input 
                    type="text" 
                    name="projectName"
                    value={projectName}
                    onChange={(e) => {
                      const newName = e.target.value
                      setProjectName(newName)
                      // Auto-select "create new" option if MongoDB is available and org is selected
                      if (newName && selectedOrg && mongodbData.available) {
                        setSelectedProject(`create:${newName}`)
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GitHub Organization/Username:</label>
                  <input 
                    type="text" 
                    name="githubOrg"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model (optional):</label>
                  <input 
                    type="text" 
                    name="model"
                    placeholder="Leave empty for default"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

{mongodbData.available && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">MongoDB Organization:</label>
                      <select 
                        name="mongodbOrg"
                        value={selectedOrg}
                        onChange={(e) => handleOrgChange(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {mongodbData.organizations.map(orgData => (
                          <option key={orgData.organization.id} value={orgData.organization.id}>
                            {orgData.organization.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedOrg && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">MongoDB Project:</label>
                        <select 
                          name="mongodbProject"
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {projectName && (
                            <option value={`create:${projectName}`}>
                              🆕 Create new project: "{projectName}"
                            </option>
                          )}
                          {getSelectedOrgProjects().map(project => (
                            <option key={project.id} value={project.id}>
                              {project.name} {project.clusters && project.clusters.length > 0 && `(${project.clusters.length} clusters)`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    name="autoSetup" 
                    id="autoSetup"
                    defaultChecked
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoSetup" className="text-sm text-gray-700">
                    Auto-setup GitHub repo and Netlify project
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  🚀 Initialize Project
                </button>
              </form>
            </div>
          )}

          {activeView === 'status' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Project Status</h2>
              <p className="text-gray-600">Loading project status...</p>
            </div>
          )}

          {activeView === 'develop' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Development Session</h2>
              <form onSubmit={handleDevelopSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Feature Branch Name:</label>
                  <input 
                    type="text" 
                    name="featureName"
                    placeholder="feature/ai-development"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Complexity:</label>
                  <select name="complexity" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                    <option value="simple">🟢 Simple - Bug fixes, small updates</option>
                    <option value="medium" defaultValue>🟡 Medium - New features, refactoring</option>
                    <option value="complex">🔴 Complex - Architecture changes, integrations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Priority:</label>
                  <select name="priority" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                    <option value="urgent">🔥 Urgent - Critical fixes</option>
                    <option value="high">🔴 High - Important features</option>
                    <option value="medium" defaultValue>🟡 Medium - Regular development</option>
                    <option value="low">🟢 Low - Nice to have</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Agent Mode:</label>
                  <select name="preferredMode" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required>
                    <option value="single">🎯 Single Agent - Fast execution</option>
                    <option value="orchestrated">👥 Multi-Agent Team - Comprehensive approach</option>
                    <option value="auto" defaultValue>🤖 Auto-select - Let AI decide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Description:</label>
                  <textarea 
                    name="taskDescription"
                    rows={12}
                    placeholder="# Feature Requirements

## Description
Describe your feature here...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
- Implementation details
- Performance considerations
- Security requirements

## Testing Requirements
- Unit tests
- Integration tests
- E2E tests if applicable"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  🚀 Start Development
                </button>
              </form>
            </div>
          )}

          {activeView === 'logs' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Real-time Logs</h2>
              
              {/* Session Info */}
              {sessionId && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Session ID: <code className="bg-gray-200 px-2 py-1 rounded">{sessionId}</code></span>
                    {sessionStatus && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        sessionStatus === 'completed' ? 'bg-green-100 text-green-800' :
                        sessionStatus === 'failed' ? 'bg-red-100 text-red-800' :
                        sessionStatus === 'running' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sessionStatus.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {sessionProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${sessionProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Log Output */}
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4 min-h-[400px] max-h-[600px] overflow-y-auto">
                {logs.length === 0 && sessionLogs.length === 0 ? (
                  sessionId ? (
                    <p>⏳ Waiting for logs...</p>
                  ) : (
                    <p>No logs available</p>
                  )
                ) : (
                  <div>
                    {/* Regular logs */}
                    {logs.map((log, index) => (
                      <div key={`log-${index}`} className="mb-1">
                        <span className="text-blue-400">[{new Date().toLocaleTimeString()}]</span>
                        <span className="text-yellow-400"> LOG </span>
                        <span>{log.replace(/^\[\d+:\d+:\d+ [AP]M\]\s*/, '')}</span>
                      </div>
                    ))}
                    
                    {/* Session logs */}
                    {sessionLogs.map((log, index) => (
                      <div key={`session-${index}`} className="mb-1">
                        <span className="text-blue-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={`font-bold ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warning' ? 'text-yellow-400' :
                          log.level === 'success' ? 'text-green-400' :
                          'text-cyan-400'
                        }`}>
                          {log.level === 'error' ? ' ❌ ERROR ' :
                           log.level === 'warning' ? ' ⚠️ WARN ' :
                           log.level === 'success' ? ' ✅ SUCCESS ' :
                           ' ℹ️ INFO '}
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-4 flex-wrap">
                <button 
                  onClick={() => {
                    const allLogs = [...logs, ...sessionLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`)].join('\n')
                    navigator.clipboard.writeText(allLogs)
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  📋 Copy Logs
                </button>
                <button 
                  onClick={() => {
                    setLogs([])
                    setSessionLogs([])
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  🗑️ Clear Logs
                </button>
                {repoUrl && (
                  <a 
                    href={repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    📁 View Repo
                  </a>
                )}
                {netlifyUrl && (
                  <a 
                    href={netlifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    🌐 View Site
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Environment Status */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">Environment Setup Status:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex justify-between items-center">
              <span>GitHub:</span>
              <span className={`${
                envStatus.github.loading ? 'text-yellow-300' :
                envStatus.github.configured ? 'text-green-300' : 'text-red-300'
              }`}>
                {envStatus.github.loading ? 'Checking...' :
                 envStatus.github.configured ? '✓ Connected' :
                 envStatus.github.error || '✗ Not configured'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Netlify:</span>
              <span className={`${
                envStatus.netlify.loading ? 'text-yellow-300' :
                envStatus.netlify.configured ? 'text-green-300' : 'text-orange-300'
              }`}>
                {envStatus.netlify.loading ? 'Checking...' :
                 envStatus.netlify.configured ? '✓ Connected' :
                 '~ Optional'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>MongoDB:</span>
              <span className={`${
                envStatus.mongodb.loading ? 'text-yellow-300' :
                envStatus.mongodb.configured ? 'text-green-300' : 'text-orange-300'
              }`}>
                {envStatus.mongodb.loading ? 'Checking...' :
                 envStatus.mongodb.configured ? '✓ Connected' :
                 '~ Optional'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">Processing...</h3>
            <p className="text-gray-600">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App