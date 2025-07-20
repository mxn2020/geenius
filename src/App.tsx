import React, { useState } from 'react'

function App() {
  const [activeView, setActiveView] = useState('init')

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
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider:</label>
                  <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="anthropic">🤖 Claude (Anthropic) - Best for coding</option>
                    <option value="openai">🧠 GPT-4 (OpenAI) - Most versatile</option>
                    <option value="google">✨ Gemini (Google) - Creative problem solving</option>
                    <option value="grok">⚡ Grok (X.AI) - Fast and witty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Agent Architecture:</label>
                  <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="single">🎯 Single Agent - Fast and focused</option>
                    <option value="orchestrated">👥 Multi-Agent Team - Specialized roles</option>
                    <option value="hybrid">🔄 Hybrid - Best of both worlds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Name:</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GitHub Organization/Username:</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter GitHub username or organization"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
              <p className="text-gray-600">Start a new development session here.</p>
            </div>
          )}

          {activeView === 'logs' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-800">Real-time Logs</h2>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                <p>Logs will appear here...</p>
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
              <span className="text-yellow-300">Checking...</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Netlify:</span>
              <span className="text-yellow-300">Checking...</span>
            </div>
            <div className="flex justify-between items-center">
              <span>MongoDB:</span>
              <span className="text-yellow-300">Checking...</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App