import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useProjectInit } from "../../project-initialization/ProjectInitializationContext"
import { useAppState } from "../../../app-hooks"

interface StatusPanelProps {
  sessionId?: string
  isExpanded?: boolean
}

export function StatusPanel({ sessionId, isExpanded = true }: StatusPanelProps) {
  const { state } = useProjectInit()
  const { sessionStatus, sessionProgress } = useAppState()

  // Use session data from hooks
  const currentStatus = sessionStatus || state.status || 'initializing'
  const currentProgress = sessionProgress || state.progress || 0
  const currentSessionId = sessionId || state.sessionId

  // Determine status color and animation
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return { color: 'bg-green-500', badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', animate: false }
      case 'failed':
      case 'error':
        return { color: 'bg-red-500', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', animate: false }
      case 'analyzing':
        return { color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', animate: true }
      case 'processing':
      default:
        return { color: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', animate: true }
    }
  }

  const statusConfig = getStatusConfig(currentStatus)

  return (
    <>
      {/* Status panel - slides up from bottom */}
      <div 
        className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 max-w-2xl w-full z-0 transition-all duration-500 ease-out ${
          isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{
          transitionProperty: 'transform, opacity',
          transitionDuration: '500ms, 0ms',
          transitionTimingFunction: 'ease-out, ease-out',
          transitionDelay: isExpanded ? '0ms, 0ms' : '0ms, 500ms'
        }}
      >
        <Card className="pb-6 pt-4 px-4 bg-muted/30 border-muted-foreground/20 rounded-b-none rounded-t-lg border-b-0">
          {/* Top row - Session and Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Session:</span>
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                {currentSessionId || 'Not started'}
              </code>
              <Badge variant="secondary" className={statusConfig.badge}>
                {currentStatus}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${statusConfig.color} rounded-full ${statusConfig.animate ? 'animate-pulse' : ''}`}></div>
              <span className={`text-sm text-muted-foreground ${statusConfig.animate ? 'animate-pulse' : ''}`}>
                {currentStatus === 'completed' ? 'Project ready!' : 
                 currentStatus === 'failed' || currentStatus === 'error' ? 'Processing failed' :
                 'Building your project...'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-muted-foreground">{currentProgress}%</span>
            </div>
            <Progress value={currentProgress} className="h-2" />
          </div>
        </Card>
      </div>
    </>
  )
}