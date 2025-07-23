import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StatusPanelProps {
  sessionId?: string
  isVisible?: boolean
}

export function StatusPanel({ sessionId, isVisible = true }: StatusPanelProps) {
  if (!isVisible) return null

  return (
    <>
      {/* Wall/mask element */}
      <div className="absolute top-10 left-1/2 transform -translate-x-1/2 max-w-3xl w-full h-60 bg-white dark:bg-black z-50"></div>
      
      {/* Status panel */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 max-w-2xl w-full z-0 transition-transform duration-500 ease-out translate-y-0">
        <Card className="pb-6 pt-4 px-4 bg-muted/30 border-muted-foreground/20 rounded-b-none rounded-t-lg border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Session:</span>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{sessionId}</code>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Processing
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground animate-pulse">
                Building your project...
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}