import { useState, useEffect, useRef } from "react"
import { flushSync } from "react-dom"
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
import { useAppState } from "../../app-hooks"

export function ChatInterface() {
  const { state, syncSessionStatus } = useProjectInit()
  const { startLogStreaming, sessionStatus, sessionProgress, repoUrl, netlifyUrl } = useAppState()
  
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

  const [currentView, setCurrentView] = useState<ViewType>('init')
  const [capturedInitHeight, setCapturedInitHeight] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Custom setCurrentView that captures height before transitioning
  const handleViewChange = (newView: ViewType) => {
    if (currentView === 'init' && newView !== 'init' && cardRef.current) {
      // Capture the current height of the init view
      const currentHeight = cardRef.current.offsetHeight
      setCapturedInitHeight(currentHeight)
      
      // Set a brief timeout to allow the height to be captured, then transition
      setTimeout(() => {
        setCurrentView(newView)
        // Reset captured height after transition completes
        setTimeout(() => setCapturedInitHeight(null), 500)
      }, 10)
    } else {
      setCurrentView(newView)
      setCapturedInitHeight(null)
    }
  }
  const [isConfigExpanded, setIsConfigExpanded] = useState(false)
  const [isQuickActionsVisible, setIsQuickActionsVisible] = useState(true)
  const [activePanel, setActivePanel] = useState<'projects' | 'templates' | 'tasks' | null>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isInitViewHovered, setIsInitViewHovered] = useState(false)
  const [isChevronHovered, setIsChevronHovered] = useState(false)
  const [showChevron, setShowChevron] = useState(false)
  const hideChevronTimeoutRef = useRef<NodeJS.Timeout | null>(null)


  // Start log streaming when session starts
  useEffect(() => {
    if (state.sessionId && state.currentStep === 'status') {
      startLogStreaming(state.sessionId, true)
    }
  }, [state.sessionId, state.currentStep]) // Removed startLogStreaming from dependencies

  // Sync session status updates from useAppState to ProjectInitializationContext
  useEffect(() => {
    if (sessionStatus && sessionProgress !== undefined) {
      syncSessionStatus(sessionStatus, sessionProgress, repoUrl, netlifyUrl)
    }
  }, [sessionStatus, sessionProgress, repoUrl, netlifyUrl]) // Removed syncSessionStatus from dependencies

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
        return capturedInitHeight ? '' : 'h-auto min-h-[160px]'  // Remove class when using inline style
      case 'processing':
        return 'h-[680px]'  // Fixed height for smooth transition
      case 'project':
        return 'h-[900px]'   // Fixed height for smooth transition
      default:
        return 'h-auto min-h-[160px]'
    }
  }

  // Get inline style for height (used when we have captured height)
  const getCardStyle = () => {
    if (capturedInitHeight && currentView === 'init') {
      return { height: `${capturedInitHeight}px` }
    }
    return {}
  }

  // Removed transition state management to fix card jumping issue
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
    setCurrentView: handleViewChange,
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
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
 {/* Logo */}
      <div className={`mb-8 z-50 transition-opacity duration-500 ${currentView === 'processing' || currentView === 'project' ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 text-2xl font-bold">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-primary-foreground rounded-full relative">
              <div className="absolute inset-0 border-2 border-primary rounded-full transform rotate-45"></div>
            </div>
          </div>
          Geenius
        </div>
      </div>
      
      {/* View Content Wrapper */}
      <div className={`w-full relative transition-all duration-500 ease-in-out ${currentView === 'project' ? 'max-w-4xl' : 'max-w-3xl'}`}>
        <Card 
          ref={cardRef}
          className={`relative z-50 overflow-hidden border-muted-foreground/20 shadow-lg rounded-3xl transition-all duration-500 ease-in-out transform-gpu flex flex-col ${getCardHeight()}`}
          style={getCardStyle()}
        >
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
            <StatusPanel sessionId={state.sessionId} isVisible={true} />
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