// src/App.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppState, useKeyboardNavigation } from './app-hooks';
import InitializationTab from './InitializationTab';
import StatusTab from './StatusTab';
import DevelopmentTab from './DevelopmentTab';
import LogsTab from './LogsTab';

function App() {
  const [activeView, setActiveView] = useState('init');
  const appState = useAppState();
  
  // Keyboard navigation hook
  useKeyboardNavigation(activeView, setActiveView);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <header className="text-center py-8 text-white">
        <h1 className="text-4xl font-bold mb-2">🚀 Geenius AI Development Agent</h1>
        <p className="text-xl opacity-90">Advanced AI agents with orchestration capabilities!</p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-8">
        {/* Navigation */}
        <Tabs value={activeView} onValueChange={setActiveView} className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-white/20 backdrop-blur-sm">
            <TabsTrigger
              value="init"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-white"
            >
              Initialize Project
            </TabsTrigger>
            <TabsTrigger
              value="status"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-white"
            >
              Project Status
            </TabsTrigger>
            <TabsTrigger
              value="develop"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-white"
            >
              Development
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 text-white"
            >
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Content Views */}
          <TabsContent value="init" className="relative">
            <InitializationTab {...appState} setActiveView={setActiveView} />
          </TabsContent>

          <TabsContent value="status">
            <StatusTab {...appState} setActiveView={setActiveView} />
          </TabsContent>

          <TabsContent value="develop">
            <DevelopmentTab {...appState} />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab {...appState} />
          </TabsContent>
        </Tabs>

        {/* Environment Status */}
        <Card className="mt-8 bg-white/10 backdrop-blur-sm border-white/20 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">Environment Setup Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex justify-between items-center">
                <span>GitHub:</span>
                <span className={`${appState.envStatus.github.loading ? 'text-yellow-300' :
                  appState.envStatus.github.configured ? 'text-green-300' : 'text-red-300'
                  }`}>
                  {appState.envStatus.github.loading ? 'Checking...' :
                    appState.envStatus.github.configured ? '✓ Connected' :
                      appState.envStatus.github.error || '✗ Not configured'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Netlify:</span>
                <span className={`${appState.envStatus.netlify.loading ? 'text-yellow-300' :
                  appState.envStatus.netlify.configured ? 'text-green-300' : 'text-orange-300'
                  }`}>
                  {appState.envStatus.netlify.loading ? 'Checking...' :
                    appState.envStatus.netlify.configured ? '✓ Connected' :
                      '~ Optional'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>MongoDB:</span>
                <span className={`${appState.envStatus.mongodb.loading ? 'text-yellow-300' :
                  appState.envStatus.mongodb.configured ? 'text-green-300' : 'text-orange-300'
                  }`}>
                  {appState.envStatus.mongodb.loading ? 'Checking...' :
                    appState.envStatus.mongodb.configured ? '✓ Connected' :
                      '~ Optional'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Loading Overlay */}
      {appState.loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">Processing...</h3>
            <p className="text-gray-600">{appState.loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;