// src/App.tsx

import React from 'react';
import { ProjectInitProvider } from './components/project-initialization/ProjectInitializationContext';
import { ChatInterface } from './components/user-interface/chat-interface';
import { ThemeProvider } from './components/user-interface/theme-provider';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="geenius-ui-theme">
      <ProjectInitProvider>
        <div className="min-h-screen bg-background">
          <ChatInterface />
        </div>
      </ProjectInitProvider>
    </ThemeProvider>
  );
}

export default App;