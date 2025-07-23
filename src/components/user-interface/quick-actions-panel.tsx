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
  if (!isVisible) return null

  return (
    <Card 
    className="absolute border-none shadow-none bg-transparent top-2 max-w-3xl w-full p-4 transition-all duration-300 ease-in-out animate-in slide-in-from-top-2 animation-delay-5000"
      style={{ animationDelay: '200ms' }}
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