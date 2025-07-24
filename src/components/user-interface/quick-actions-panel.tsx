import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { FolderOpen, FileText, CheckSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QuickActionsPanelProps {
  isVisible: boolean
  onHide: () => void
  onOpenProjects: () => void
  onOpenTemplates: () => void
  onOpenTasks: () => void
}

export function QuickActionsPanel({ 
  isVisible, 
  onHide, 
  onOpenProjects, 
  onOpenTemplates, 
  onOpenTasks 
}: QuickActionsPanelProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // First render the component (but hidden)
      setShouldRender(true)
      // Then after a small delay, start the animation
      const timer = setTimeout(() => {
        setShouldAnimate(true)
      }, 50) // Small delay to ensure render is complete
      return () => clearTimeout(timer)
    } else {
      // Hide immediately
      setShouldAnimate(false)
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300) // Match animation duration
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  if (!shouldRender) return null

  return (
    <Card 
      className={`absolute border-none shadow-none bg-transparent top-2 max-w-3xl w-full p-4 transition-all duration-300 ease-in-out ${
        shouldAnimate ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
        <div className="flex flex-wrap justify-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={onOpenProjects}
                className="px-4 py-2 bg-muted/50 border border-muted-foreground/20 hover:bg-muted rounded-lg"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                <span className="text-sm">Projects</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={onOpenTemplates}
                className="px-4 py-2 bg-muted/50 border border-muted-foreground/20 hover:bg-muted rounded-lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-sm">Templates</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={onOpenTasks}
                className="px-4 py-2 bg-muted/50 border border-muted-foreground/20 hover:bg-muted rounded-lg"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                <span className="text-sm">Tasks</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onHide}
                className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted border border-muted-foreground/20"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Hide quick actions</span>
              </Button>
            </div>
          </div>
    </Card>
  )
}