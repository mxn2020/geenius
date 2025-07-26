import { useState, useRef, useEffect } from "react"
import { ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  setIsConfigExpanded = () => { },
  isQuickActionsVisible = true,
  setIsQuickActionsVisible = () => { },
  onOpenProjects = () => { },
  onOpenTemplates = () => { },
  onOpenTasks = () => { },
  isInitViewHovered = false,
  setIsInitViewHovered = () => { }
}: InitViewProps) {
  const { state, updateProjectConfig, startInitialization } = useProjectInit()
  const [message, setMessage] = useState(state.userRequirements || "")
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMessage, setDialogMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  // Global keydown handler to refocus textarea when typing
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      // Only handle printable characters and common editing keys
      const isPrintableChar = e.key.length === 1
      const isEditingKey = ['Backspace', 'Delete', 'Enter', 'Space'].includes(e.key)

      // Don't interfere with special key combinations
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Don't refocus if user is already typing in an input/textarea
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return
      }

      // If user starts typing and focus is not in textarea, focus it
      if ((isPrintableChar || isEditingKey) && textareaRef.current) {
        textareaRef.current.focus()

        // For printable characters, add them to the textarea
        if (isPrintableChar) {
          // Prevent the default behavior and add character to textarea
          e.preventDefault()
          const currentValue = textareaRef.current.value
          const newValue = currentValue + e.key
          textareaRef.current.value = newValue
          setMessage(newValue)

          // Trigger input event for auto-resize
          const inputEvent = new Event('input', { bubbles: true })
          textareaRef.current.dispatchEvent(inputEvent)
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeydown)
    return () => document.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    // Validate required fields and show dialog with config panel opening
    if (!state.projectName.trim()) {
      setDialogMessage('Please enter a project name in the configuration panel')
      setShowDialog(true)
      setIsConfigExpanded(true)
      return
    }

    if (!state.githubOrg.trim()) {
      setDialogMessage('Please select a GitHub account in the configuration panel')
      setShowDialog(true)
      setIsConfigExpanded(true)
      return
    }

    if (!state.templateId.trim()) {
      setDialogMessage('Please select a template in the configuration panel')
      setShowDialog(true)
      setIsConfigExpanded(true)
      return
    }

    // Update the project requirements in context and start initialization
    updateProjectConfig({ userRequirements: message.trim() })

    try {
      // Update view for smooth transition  
      setCurrentView('processing')

      // Pass the userRequirements directly to ensure they're used immediately
      await startInitialization(message.trim())
      // Clear the message after successful submission
      setMessage("")
    } catch (error) {
      console.error('Initialization failed:', error)
    }
  }

  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuration Required</DialogTitle>
            <DialogDescription>
              {dialogMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setShowDialog(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col pt-1 flex-1 justify-between"
        onMouseEnter={() => setIsInitViewHovered(true)}
        onMouseLeave={() => setIsInitViewHovered(false)}
      >
        {/* Textarea */}
        <div className="p-4 mb-4 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your project requirements and AI will customize it for you... (e.g., 'Create a medical practice website with patient management and appointment booking')"
            className="min-h-[48px] max-h-[288px] resize-none border-0 shadow-none bg-transparent p-0 text-base placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden w-full text-lg leading-[2.1rem] placeholder:leading-[2.1rem]"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          const formEvent = e as any
          handleSubmit(formEvent)
              }
            }}
            style={{
              height: 'auto',
              minHeight: '48px',
              maxHeight: '288px',
              fontSize: '1.25rem', // 20px
              lineHeight: '2.1rem', // Increase line height for more row gap
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
              disabled={!message.trim() || state.isProcessing}
            >
              {state.isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">
                {state.isProcessing ? "Processing..." : "Send message"}
              </span>
            </Button>
          </div>
        </div>
      </form>

    </>
  )
}