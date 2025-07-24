import { useEffect, useRef } from "react"
import { Copy, Trash2, Play, Github, Globe, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ViewType } from "../view-types"
import { useProjectInit } from "../../project-initialization/ProjectInitializationContext"
import { useAppState } from "../../../app-hooks"

interface ProcessingViewProps {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  sessionId?: string
  projectName?: string
  logs?: string[]
  addLog?: (message: string) => void
  clearLogs?: () => void
}

export function ProcessingView({ 
  setCurrentView, 
  sessionId, 
  logs = [], 
  clearLogs 
}: ProcessingViewProps) {
  const logRef = useRef<HTMLTextAreaElement>(null)
  const { state } = useProjectInit()
  const { sessionLogs, repoUrl, netlifyUrl, sessionStatus } = useAppState()

  // Check if project is still processing
  const isProcessing = state.isProcessing || (sessionStatus && !['completed', 'failed', 'error'].includes(sessionStatus))

  // Use session logs from useAppState if available, otherwise fall back to context logs or props
  const displayLogs = sessionLogs.length > 0 
    ? sessionLogs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level?.toUpperCase() || 'INFO'}: ${log.message}`)
    : state.logs.length > 0 
      ? state.logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`)
      : logs

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [displayLogs])

  const copyLogs = () => {
    navigator.clipboard.writeText(displayLogs.join('\n'))
  }

  const handleViewRepo = () => {
    if (repoUrl) {
      window.open(repoUrl, '_blank')
    }
  }

  const handleViewSite = () => {
    if (netlifyUrl) {
      window.open(netlifyUrl, '_blank')
    }
  }

  return (
    <>
      {/* Main Log Content */}
      <div className="flex flex-col flex-1">
          {/* Log Display */}
          <div className="p-4 flex-1 flex">
            <Textarea
              ref={logRef}
              value={displayLogs.join('\n')}
              readOnly
              className="flex-1 resize-none border-0 shadow-none bg-transparent p-0 text-sm font-mono placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto w-full"
              rows={30}
              placeholder="Logs will appear here..."
            />
          </div>

          {/* Bottom buttons row */}
          <div className="flex items-center justify-between px-4 pb-4 flex-shrink-0">
            {/* Left side buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyLogs}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Logs
              </Button>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                disabled={isProcessing}
              >
                <Play className="h-4 w-4" />
                Play a Game
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleViewRepo}
                disabled={!repoUrl || isProcessing}
              >
                <Github className="h-4 w-4" />
                View Repo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleViewSite}
                disabled={!netlifyUrl || isProcessing}
              >
                <Globe className="h-4 w-4" />
                View Site
              </Button>
              <Button 
                onClick={() => setCurrentView('project')}
                className="gap-2"
                disabled={isProcessing}
              >
                Project View
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
      </div>
    </>
  )
}