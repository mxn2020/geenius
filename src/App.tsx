// src/App.tsx

import { Header } from "./components/ui/header"
import { ChatInterface } from "./components/user-interface/chat-interface"
import { ThemeProvider } from "./components/user-interface/theme-provider"
import { ProjectInitProvider } from './components/project-initialization/ProjectInitializationContext'
import { Toaster } from "./components/ui/sonner"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="geenius-ui-theme">
      <ProjectInitProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main className="container mx-auto py-8 z-10">
            <ChatInterface />
          </main>
          <Toaster />
        </div>
      </ProjectInitProvider>
    </ThemeProvider>
  )
}

export default App