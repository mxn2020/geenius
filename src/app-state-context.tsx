// App State Context Provider
// Centralized state management for app-wide state that needs to be shared across components

import React, { createContext, useContext, ReactNode } from 'react';
import { useAppState as useAppStateHook } from './app-hooks';

// Create context with the return type of useAppState hook
type AppStateContextType = ReturnType<typeof useAppStateHook>;

const AppStateContext = createContext<AppStateContextType | null>(null);

// Provider component
interface AppStateProviderProps {
  children: ReactNode;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  const appState = useAppStateHook();

  return (
    <AppStateContext.Provider value={appState}>
      {children}
    </AppStateContext.Provider>
  );
};

// Hook to use the context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};