import { useState } from "react"
import { ChevronDown, ChevronUp, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { AttachmentDropdown } from "../attachment-dropdown"
import { ModelSelector } from "../model-selector"
import { ViewType } from "../view-types"
import { useProjectInit } from "../../project-initialization/ProjectInitializationContext"

interface InitViewProps {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  sessionId?: string
  projectName?: string
  logs?: string[]
  addLog?: (message: string) => void
  clearLogs?: () => void
  isConfigExpanded?: boolean
  setIsConfigExpanded?: (expanded: boolean) => void
  isQuickActionsVisible?: boolean
  setIsQuickActionsVisible?: (visible: boolean) => void
  onOpenProjects?: () => void
  onOpenTemplates?: () => void
  onOpenTasks?: () => void
  isInitViewHovered?: boolean
  setIsInitViewHovered?: (hovered: boolean) => void
}

export function InitView({ 
  setCurrentView, 
  isConfigExpanded = false, 
  setIsConfigExpanded = () => {},
  isQuickActionsVisible = true,
  setIsQuickActionsVisible = () => {},
  onOpenProjects = () => {},
  onOpenTemplates = () => {},
  onOpenTasks = () => {},
  isInitViewHovered = false,
  setIsInitViewHovered = () => {}
}: InitViewProps) {
  const { state, updateProjectConfig, startInitialization } = useProjectInit()
  const [message, setMessage] = useState(state.userRequirements || "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      // Update the project requirements in context
      updateProjectConfig({ userRequirements: message.trim() })
      
      // Start the initialization process
      await startInitialization()
      
      // The view will automatically change to 'processing' via context state change
      setMessage("")
    }
  }

  return (
    <>
      <form 
        onSubmit={handleSubmit} 
        className="flex flex-col pt-1 flex-1 justify-between"
        onMouseEnter={() => setIsInitViewHovered(true)}
        onMouseLeave={() => setIsInitViewHovered(false)}
      >
          {/* Textarea */}
          <div className="p-4 mb-4 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your project requirements... (e.g., 'Create a medical practice website with patient management and appointment booking')"
              className="min-h-[24px] max-h-[288px] resize-none border-0 shadow-none bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden w-full"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              style={{
                height: 'auto',
                minHeight: '24px',
                maxHeight: '288px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 288) + 'px'
              }}
            />
          </div>

          {/* Bottom buttons row */}
          <div className="flex items-center justify-between px-4 pb-4">
            {/* Left side buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`h-10 w-10 border rounded-full ${isConfigExpanded ? 'bg-muted/30' : ''}`}
                onClick={() => setIsConfigExpanded(!isConfigExpanded)}
              >
                {isConfigExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle configuration</span>
              </Button>
              <AttachmentDropdown />
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-1">
              <ModelSelector />
              <Button 
                type="submit" 
                size="icon" 
                className="h-9 w-9 rounded-full"
                disabled={!message.trim()}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </div>
        </form>

    </>
  )
}