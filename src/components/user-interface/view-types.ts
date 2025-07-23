export type ViewType = 'init' | 'processing' | 'project'

export interface ViewState {
  currentView: ViewType
  sessionId?: string
  projectName?: string
  logs?: string[]
}