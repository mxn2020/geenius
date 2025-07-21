// src/LogsTab.tsx

import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AppHooks } from './app-types';

interface LogsTabProps extends AppHooks {}

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
                  {sessionStatus.toUpperCase().replace('_', ' ')}
                </Badge>
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
          {repoUrl && (
            <Button asChild>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                📁 View Repo
              </a>
            </Button>
          )}
          {netlifyUrl && (
            <Button
              asChild
              className="bg-purple-600 hover:bg-purple-700"
            >
              <a
                href={netlifyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                🌐 View Site
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LogsTab;