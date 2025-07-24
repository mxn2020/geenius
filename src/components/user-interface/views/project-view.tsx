import { useState } from "react"
import { RefreshCw, Github, Globe, Play, Database, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ViewType } from "../view-types"
import { useProjectInit } from "../../project-initialization/ProjectInitializationContext"
import { useAppState } from "../../../app-hooks"

interface ProjectViewProps {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  sessionId?: string
  projectName?: string
  logs?: string[]
  addLog?: (message: string) => void
  clearLogs?: () => void
}

export function ProjectView({ 
  setCurrentView, 
  sessionId, 
  projectName = "My Newsletter App",
  logs = []
}: ProjectViewProps) {
  const { state } = useProjectInit()
  const { sessionLogs, repoUrl, netlifyUrl, sessionStatus, sessionProgress } = useAppState()
  const [activeTab, setActiveTab] = useState("status")

  // Use repository URL from context if available, otherwise from useAppState
  // If neither is available, try to construct from github org + project name
  const repositoryUrl = state.repositoryUrl || repoUrl || 
    (state.githubOrg && state.projectName ? `https://github.com/${state.githubOrg}/${state.projectName}` : null)

  // Use session logs from useAppState if available, otherwise fall back to context logs or props
  const displayLogs = sessionLogs.length > 0 
    ? sessionLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level?.toUpperCase() || 'INFO'}: ${log.message}`)
    : state.logs.length > 0 
      ? state.logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`)
      : logs

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          {/* Tab Panel - slides up from bottom */}
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 w-full z-20 animate-in slide-in-from-top-2">
            <Card className="bg-muted/30 border-muted-foreground/20 rounded-t-lg rounded-b-none border-b-0">
              <TabsList className="grid w-full grid-cols-3 bg-transparent">
                <TabsTrigger 
                  value="status" 
                  onClick={() => setActiveTab("status")}
                  className="data-[state=active]:bg-background"
                >
                  Project Status
                </TabsTrigger>
                <TabsTrigger 
                  value="development" 
                  onClick={() => setActiveTab("development")}
                  className="data-[state=active]:bg-background"
                >
                  Development
                </TabsTrigger>
                <TabsTrigger 
                  value="logs" 
                  onClick={() => setActiveTab("logs")}
                  className="data-[state=active]:bg-background"
                >
                  Logs
                </TabsTrigger>
              </TabsList>
            </Card>
          </div>

          <TabsContent value="status" className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Project Status Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Project Status</h2>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {/* Active Session */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {sessionStatus === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : sessionStatus === 'failed' || sessionStatus === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  <span className="font-semibold">Active Session</span>
                  <Badge variant="secondary" className={
                    sessionStatus === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    sessionStatus === 'failed' || sessionStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }>
                    {sessionStatus || 'initializing'}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{sessionProgress || 0}%</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {sessionStatus === 'completed' ? 'Processing completed successfully' :
                 sessionStatus === 'failed' || sessionStatus === 'error' ? 'Processing failed' :
                 'Processing in progress...'}
              </p>
              <Progress value={sessionProgress || 0} className="h-2" />
            </Card>

            {/* Project Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">PROJECT NAME</h3>
                <p className="text-muted-foreground">{state.projectName || projectName}</p>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-2">TEMPLATE</h3>
                <p className="text-muted-foreground">{state.templateId || 'Template Applied'}</p>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-2">AI PROVIDER</h3>
                <p className="text-muted-foreground">{state.aiProvider || 'Anthropic'}</p>
              </Card>
            </div>

            {/* Integration Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Github className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">GitHub Integration</h3>
                </div>
                {repositoryUrl ? (
                  <div className="space-y-2">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-800 dark:text-green-200">Repository created successfully</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                        {repositoryUrl}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(repositoryUrl, '_blank')}
                      >
                        View Repo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">Repository not yet created</p>
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Netlify Deployment</h3>
                </div>
                {netlifyUrl ? (
                  <div className="space-y-2">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-800 dark:text-green-200">Site deployed successfully</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                        {netlifyUrl}
                      </code>
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => window.open(netlifyUrl, '_blank')}
                      >
                        Visit Site
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">Site not yet deployed</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Database Configuration */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold">MongoDB Configuration</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Organization</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {state.mongodbOrgId || 'Not configured'}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Project</p>
                  <Badge variant="outline" className="text-muted-foreground">
                    {state.mongodbProjectId === 'CREATE_NEW' ? 'New Project' : state.mongodbProjectId || 'Not configured'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Play className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                  onClick={() => setCurrentView('init')}
                >
                  <Database className="h-4 w-4" />
                  New Project
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setActiveTab('logs')}
                >
                  <AlertCircle className="h-4 w-4" />
                  View Logs
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => repositoryUrl && window.open(repositoryUrl, '_blank')}
                  disabled={!repositoryUrl}
                >
                  <Github className="h-4 w-4" />
                  Open Repository
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="development" className="p-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Development</h2>
            <p className="text-muted-foreground">Development tools and environment setup will be displayed here.</p>
          </TabsContent>

          <TabsContent value="logs" className="p-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Logs</h2>
            <Card className="p-4 bg-muted/30">
              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
                {displayLogs.length > 0 ? (
                  displayLogs.map((log, index) => (
                    <div key={index} className="text-muted-foreground whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    No logs available
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
      </Tabs>

      {/* Bottom buttons row */}
      <div className="flex items-center justify-between px-6 pb-6 flex-shrink-0">
        {/* Left side buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentView('init')}
          >
            New Chat
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentView('processing')}
          >
            View Processing
          </Button>
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => repositoryUrl && window.open(repositoryUrl, '_blank')}
            disabled={!repositoryUrl}
          >
            <Github className="h-4 w-4" />
            Repository
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => netlifyUrl && window.open(netlifyUrl, '_blank')}
            disabled={!netlifyUrl}
          >
            <Globe className="h-4 w-4" />
            Live Site
          </Button>
        </div>
      </div>
    </>
  )
}