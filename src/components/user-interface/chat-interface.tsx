import { useState, useEffect, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { ViewType } from "./view-types"
import { InitView } from "./views/init-view"
import { ProcessingView } from "./views/processing-view"
import { ProjectView } from "./views/project-view"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfigurationPanel } from "./configuration-panel"
import { QuickActionsPanel } from "./quick-actions-panel"
import { StatusPanel } from "./status-panel"
import { ProjectsPanel } from "./projects-panel"
import { TemplatesPanel } from "./templates-panel"
import { TasksPanel } from "./tasks-panel"
import { ItemDetails } from "./item-details"
import { useProjectInit } from "../project-initialization/ProjectInitializationContext"

export function ChatInterface() {
  const { state } = useProjectInit()
  
  // Map context steps to view types
  const getViewFromStep = (step: string): ViewType => {
    switch (step) {
      case 'init': return 'init'
      case 'status': return 'processing'
      case 'develop': return 'project'
      case 'logs': return 'processing'
      default: return 'init'
    }
  }

  const [currentView, setCurrentView] = useState<ViewType>(getViewFromStep(state.currentStep))
  const [isConfigExpanded, setIsConfigExpanded] = useState(false)
  const [isQuickActionsVisible, setIsQuickActionsVisible] = useState(true)
  const [activePanel, setActivePanel] = useState<'projects' | 'templates' | 'tasks' | null>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isInitViewHovered, setIsInitViewHovered] = useState(false)
  const [isChevronHovered, setIsChevronHovered] = useState(false)
  const [showChevron, setShowChevron] = useState(false)
  const hideChevronTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update view when context step changes
  useEffect(() => {
    setCurrentView(getViewFromStep(state.currentStep))
  }, [state.currentStep])

  // Handle chevron visibility with delay
  useEffect(() => {
    const shouldShow = currentView === 'init' && !isQuickActionsVisible && (isInitViewHovered || isChevronHovered) && !isConfigExpanded && !activePanel

    if (shouldShow) {
      // Clear any existing timeout
      if (hideChevronTimeoutRef.current) {
        clearTimeout(hideChevronTimeoutRef.current)
        hideChevronTimeoutRef.current = null
      }
      setShowChevron(true)
    } else {
      // Set timeout to hide after delay
      if (hideChevronTimeoutRef.current) {
        clearTimeout(hideChevronTimeoutRef.current)
      }
      hideChevronTimeoutRef.current = setTimeout(() => {
        setShowChevron(false)
        hideChevronTimeoutRef.current = null
      }, 300) // 300ms delay
    }

    // Cleanup timeout on unmount
    return () => {
      if (hideChevronTimeoutRef.current) {
        clearTimeout(hideChevronTimeoutRef.current)
      }
    }
  }, [currentView, isQuickActionsVisible, isInitViewHovered, isChevronHovered, isConfigExpanded, activePanel])

  // Dynamic height based on current view
  const getCardHeight = () => {
    switch (currentView) {
      case 'init':
        return 'min-h-[160px]'  // Allow init view to grow
      case 'processing':
        return 'h-[680px]'  // Increased to accommodate button row
      case 'project':
        return 'h-[900px]'   // Increased to accommodate button row
      default:
        return 'min-h-[160px]'
    }
  }
  // Get logs from context
  const logs = state.logs.map(log => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.level.toUpperCase()}: ${log.message}`)
  
  const addLog = (message: string) => {
    // This will be handled by the context
    console.log('Log:', message)
  }

  const clearLogs = () => {
    // Clear logs functionality would be added to context if needed
    console.log('Clear logs requested')
  }

  const handleClosePanel = () => {
    setActivePanel(null)
    setSelectedItem(null)
    // Show quick actions again if they were visible before
    setIsQuickActionsVisible(true)
  }

  const handleItemSelect = (item: any) => {
    setSelectedItem(item)
  }

  const handleItemUse = (item: any) => {
    console.log('Using item:', item)
    // Here you would implement the actual logic for using the item
    // For example, create a new project, apply a template, assign a task, etc.
    handleClosePanel()
  }

  const viewProps = {
    currentView,
    setCurrentView,
    sessionId: state.sessionId,
    projectName: state.projectName,
    logs,
    addLog,
    clearLogs,
    isConfigExpanded,
    setIsConfigExpanded,
    isQuickActionsVisible,
    setIsQuickActionsVisible,
    onOpenProjects: () => setActivePanel('projects'),
    onOpenTemplates: () => setActivePanel('templates'),
    onOpenTasks: () => setActivePanel('tasks'),
    isInitViewHovered,
    setIsInitViewHovered
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 pt-8">

      {/* View Content Wrapper */}
      <div className={`w-full relative transition-all duration-500 ease-in-out ${currentView === 'project' ? 'max-w-4xl' : 'max-w-3xl'}`}>
        <Card className={`relative z-50 overflow-hidden border-muted-foreground/20 shadow-lg rounded-3xl transition-all duration-500 ease-in-out transform-gpu flex flex-col ${getCardHeight()}`}>
          {currentView === 'init' && (
            <div className="flex-1 flex flex-col">
              <InitView {...viewProps} />
            </div>
          )}
          {currentView === 'processing' && (
            <div className="flex-1 flex flex-col">
              <ProcessingView {...viewProps} />
            </div>
          )}
          {currentView === 'project' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ProjectView {...viewProps} />
            </div>
          )}
        </Card>

        {/* Hover Chevron - Show below InitView when actions are hidden and view is hovered */}
        <div 
          className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ease-out ${
            showChevron
              ? 'translate-y-3/4 opacity-100' 
              : 'translate-y-0 opacity-0'
          }`}
          style={{ pointerEvents: showChevron ? 'auto' : 'none' }}
          onMouseEnter={() => setIsChevronHovered(true)}
          onMouseLeave={() => setIsChevronHovered(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsQuickActionsVisible(true)
              setShowChevron(false)
              setIsChevronHovered(false)
            }}
            className="h-8 w-16 rounded-b-full bg-muted/90 hover:bg-muted border border-muted-foreground/20 border-t-0 shadow-sm"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="sr-only">Show quick actions</span>
          </Button>
        </div>
        
        {/* Status Panel - Only show for processing view */}
        {currentView === 'processing' && (
          <div className="relative z-20">
            <StatusPanel sessionId={sessionId} isVisible={true} />
          </div>
        )}
        
        {/* Configuration Panel - Only show for init view */}
        {currentView === 'init' && (
          <div className="relative z-20">
            <ConfigurationPanel isExpanded={isConfigExpanded} />
          </div>
        )}

        {/* Quick Actions - Only show for init view when config is not expanded, actions are visible, and no panel is active */}
        {currentView === 'init' && !isConfigExpanded && isQuickActionsVisible && !activePanel && (
          <div className="relative">
            <QuickActionsPanel 
              isVisible={isQuickActionsVisible}
              onHide={() => setIsQuickActionsVisible(false)}
              onOpenProjects={() => setActivePanel('projects')}
              onOpenTemplates={() => setActivePanel('templates')}
              onOpenTasks={() => setActivePanel('tasks')}
            />
          </div>
        )}

      {/* Wall/mask element */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 max-w-3xl w-full h-[600px] bg-white dark:bg-black z-30"></div>

        {/* Projects Panel */}
        {currentView === 'init' && (
          <div className="relative z-20">
            <ProjectsPanel
              isExpanded={activePanel === 'projects'}
              onClose={handleClosePanel}
              onItemSelect={handleItemSelect}
              selectedItem={selectedItem}
            />
          </div>
        )}

        {/* Templates Panel */}
        {currentView === 'init' && (
          <div className="relative z-20">
            <TemplatesPanel
              isExpanded={activePanel === 'templates'}
              onClose={handleClosePanel}
              onItemSelect={handleItemSelect}
              selectedItem={selectedItem}
            />
          </div>
        )}

        {/* Tasks Panel */}
        {currentView === 'init' && (
          <div className="relative z-20">
            <TasksPanel
              isExpanded={activePanel === 'tasks'}
              onClose={handleClosePanel}
              onItemSelect={handleItemSelect}
              selectedItem={selectedItem}
            />
          </div>
        )}
      </div>

      {/* Item Details - Outside the main wrapper for better positioning */}
      {selectedItem && activePanel && (
        <ItemDetails
          item={selectedItem}
          isVisible={true}
          onClose={() => setSelectedItem(null)}
          onUse={handleItemUse}
          type={activePanel}
        />
      )}
    </div>
  )
}