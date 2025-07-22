// src/LogsTab.tsx

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AppHooks } from '../app-types';
import { SessionLog } from '../app-types';
import DinosaurGame from './DinosaurGame';

interface LogsTabProps extends AppHooks {}

// Helper function to get next step name
const getNextStepName = (currentStatus: string): string => {
  const stepMap: Record<string, string> = {
    'running': 'validation',
    'validating': 'code analysis', 
    'analyzing': 'file processing',
    'processing': 'branch creation',
    'creating_branch': 'code commits',
    'committing': 'testing',
    'testing': 'pull request',
    'pr_creating': 'deployment',
    'deploying': 'completion'
  };
  
  return stepMap[currentStatus] || 'next step';
};

// Helper function to extract repository URL from logs
const extractRepoUrlFromLogs = (logs: SessionLog[]): string => {
  for (const log of logs) {
    const repoMatch = log.message.match(/GitHub Repository: (https:\/\/github\.com\/[^\s]+)/);
    if (repoMatch) {
      return repoMatch[1];
    }
  }
  return '';
};

// Helper function to extract Netlify URL from logs
const extractNetlifyUrlFromLogs = (logs: SessionLog[]): string => {
  for (const log of logs) {
    const netlifyMatch = log.message.match(/Netlify URL: (https:\/\/[^\s]+)/) || 
                        log.message.match(/Live URL: (https:\/\/[^\s]+)/);
    if (netlifyMatch) {
      return netlifyMatch[1];
    }
  }
  return '';
};

const LogsTab: React.FC<LogsTabProps> = ({
  sessionId,
  sessionStatus,
  sessionProgress,
  sessionLogs,
  logs,
  repoUrl,
  netlifyUrl,
  setLogs,
  setSessionLogs
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [gameOpen, setGameOpen] = useState(false);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logContainerRef.current && (logs.length > 0 || sessionLogs.length > 0)) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, sessionLogs]);

  return (
    <Card className="shadow-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Real-time Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Session Info */}
        {sessionId && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-sm text-gray-600">
                  {sessionId.startsWith('init_') ? 'Project Initialization' : 'Change Processing'} Session
                </span>
                <br />
                <code className="bg-gray-200 px-2 py-1 rounded text-xs">{sessionId}</code>
              </div>
              {sessionStatus && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      sessionStatus === 'completed' ? 'default' :
                        sessionStatus === 'failed' ? 'destructive' :
                          ['running', 'processing', 'validating', 'analyzing', 'committing', 'creating_branch', 'testing', 'pr_creating', 'deploying'].includes(sessionStatus) ? 'default' :
                            'secondary'
                    }
                    className={
                      sessionStatus === 'completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                        ['running', 'processing', 'validating', 'analyzing', 'committing', 'creating_branch', 'testing', 'pr_creating', 'deploying'].includes(sessionStatus) ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                          sessionStatus === 'failed' ? '' :
                            'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                    }
                  >
                    {sessionStatus === 'completed' ? '✅ COMPLETED' : 
                     sessionStatus === 'failed' ? '❌ FAILED' :
                     ['running', 'processing', 'validating', 'analyzing', 'committing', 'creating_branch', 'testing', 'pr_creating', 'deploying'].includes(sessionStatus) ? 
                       `🔄 ${sessionStatus.toUpperCase().replace('_', ' ')}` :
                       sessionStatus.toUpperCase().replace('_', ' ')
                    }
                  </Badge>
                  {/* Show next step indicator for running sessions */}
                  {['running', 'processing', 'validating', 'analyzing', 'committing', 'creating_branch', 'testing', 'pr_creating', 'deploying'].includes(sessionStatus) && (
                    <span className="text-xs text-gray-500 animate-pulse">
                      Now processing {getNextStepName(sessionStatus)}...
                    </span>
                  )}
                </div>
              )}
            </div>
            {sessionProgress > 0 && (
              <Progress value={sessionProgress} className="w-full" />
            )}
          </div>
        )}

        {/* Log Output */}
        <div
          ref={logContainerRef}
          className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4 min-h-[400px] max-h-[600px] overflow-y-auto"
        >
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
                  <span className="text-green-400">{log}</span>
                </div>
              ))}

              {/* Session logs */}
              {sessionLogs.map((log, index) => (
                <div key={`session-${index}`} className="mb-1">
                  <span className="text-blue-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={`font-bold ${log.level === 'error' ? 'text-red-400' :
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
          <Button
            onClick={() => {
              const allLogs = [...logs, ...sessionLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`)].join('\n');
              navigator.clipboard.writeText(allLogs);
            }}
            variant="secondary"
          >
            📋 Copy Logs
          </Button>
          <Button
            onClick={() => {
              setLogs([]);
              setSessionLogs([]);
            }}
            variant="destructive"
          >
            🗑️ Clear Logs
          </Button>
          
          {/* Show repo button when available OR when project initialization is completed */}
          {(repoUrl || (sessionStatus === 'completed' && sessionId && (sessionId.startsWith('ge_') || sessionId.startsWith('init_')))) && (
            <Button asChild>
              <a
                href={repoUrl || extractRepoUrlFromLogs(sessionLogs)}
                target="_blank"
                rel="noopener noreferrer"
              >
                📁 View Repo
              </a>
            </Button>
          )}
          
          {/* Show site button when available OR when project initialization is completed */}
          {(netlifyUrl || (sessionStatus === 'completed' && sessionId && (sessionId.startsWith('ge_') || sessionId.startsWith('init_')))) && (
            <Button
              asChild
              className="bg-purple-600 hover:bg-purple-700"
            >
              <a
                href={netlifyUrl || extractNetlifyUrlFromLogs(sessionLogs)}
                target="_blank"
                rel="noopener noreferrer"
              >
                🌐 View Site
              </a>
            </Button>
          )}
          
          {/* Add game button during long processes */}
          {['running', 'processing', 'validating', 'analyzing', 'committing', 'creating_branch', 'testing', 'pr_creating', 'deploying'].includes(sessionStatus) && (
            <Button
              onClick={() => setGameOpen(true)}
              variant="outline"
              className="bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100"
            >
              🦕 Play Game
            </Button>
          )}
        </div>
        
        {/* Dinosaur Game Dialog */}
        {gameOpen && (
          <DinosaurGame 
            isOpen={gameOpen} 
            onClose={() => setGameOpen(false)} 
          />
        )}
      </CardContent>
    </Card>
  );
};

export default LogsTab;