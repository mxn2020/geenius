# 🔌 Developer Integration Guide
## Geenius Project Initialization System

> **For developers implementing new UI designs over the existing workflow system**

---

## 📋 Overview

The Geenius project initialization system has been refactored into a **modular, plug-and-play architecture**. This guide shows you how to integrate your new UI design with the existing workflow logic using our **Context Provider** approach.

### 🎯 Key Benefits:
- ✅ **No workflow logic changes needed** - Focus only on UI
- ✅ **Real-time state updates** - Automatic progress tracking
- ✅ **Centralized state management** - One source of truth
- ✅ **Plug-and-play integration** - Drop in your components
- ✅ **TypeScript support** - Full type safety

---

## 🚀 Quick Start Integration

### 1. Wrap Your App with Context Provider

```tsx
// src/App.tsx
import React from 'react';
import { ProjectInitProvider } from './components/project-initialization/ProjectInitializationContext';
import YourNewDesign from './YourNewDesign';

function App() {
  return (
    <ProjectInitProvider>
      <YourNewDesign />
    </ProjectInitProvider>
  );
}

export default App;
```

### 2. Use the Hook in Your Components

```tsx
// YourNewDesign.tsx
import React from 'react';
import { useProjectInit } from './components/project-initialization/ProjectInitializationContext';

const YourNewDesign: React.FC = () => {
  const {
    state,
    updateProjectConfig,
    updateAIConfig,
    updateInfrastructureConfig,
    startInitialization,
    setError,
    addLog
  } = useProjectInit();

  const handleStartProject = async () => {
    // Update configuration
    updateProjectConfig({
      projectName: 'My Awesome Project',
      templateId: 'vite-react-mongo',
      userRequirements: 'Create a medical practice website',
      businessDomain: 'healthcare'
    });

    // Start the workflow
    await startInitialization();
  };

  return (
    <div className="your-custom-design">
      <h1>Your Amazing UI</h1>
      
      {/* Project configuration inputs */}
      <input 
        value={state.projectName}
        onChange={(e) => updateProjectConfig({ projectName: e.target.value })}
        placeholder="Project Name"
      />
      
      {/* Progress display */}
      {state.isProcessing && (
        <div className="progress-section">
          <div className="progress-bar" style={{ width: `${state.progress}%` }} />
          <p>{state.status}</p>
        </div>
      )}
      
      {/* Start button */}
      <button onClick={handleStartProject} disabled={state.isProcessing}>
        {state.isProcessing ? 'Processing...' : 'Start Project'}
      </button>
      
      {/* Results */}
      {state.deploymentUrl && (
        <div className="success-section">
          <h2>🎉 Project Ready!</h2>
          <a href={state.deploymentUrl} target="_blank" rel="noopener noreferrer">
            View Your Project
          </a>
        </div>
      )}
    </div>
  );
};
```

---

## 🔧 Complete API Reference

### State Object

```typescript
interface ProjectInitState {
  // Navigation & Status
  currentStep: 'init' | 'status' | 'develop' | 'logs';
  isProcessing: boolean;
  progress: number;          // 0-100
  status: string;           // Human readable status
  error: string | null;
  
  // Project Configuration
  projectName: string;
  templateId: string;       // 'vite-react-mongo', 'nextjs-supabase', etc.
  userRequirements: string; // AI prompt for customization
  businessDomain: string;   // 'healthcare', 'legal', 'restaurant', etc.
  
  // AI Configuration
  aiProvider: 'anthropic' | 'openai' | 'google' | 'grok';
  model: string;
  
  // Infrastructure
  githubOrg: string;
  autoSetup: boolean;
  mongodbOrgId: string;
  mongodbProjectId: string;
  
  // Results
  sessionId: string | null;
  deploymentUrl: string | null;
  logs: LogEntry[];
}
```

### Available Methods

```typescript
interface ProjectInitContextType {
  // State access
  state: ProjectInitState;
  
  // Navigation
  setStep: (step: 'init' | 'status' | 'develop' | 'logs') => void;
  
  // Configuration updates
  updateProjectConfig: (config: {
    projectName?: string;
    templateId?: string;
    userRequirements?: string;
    businessDomain?: string;
  }) => void;
  
  updateAIConfig: (config: {
    aiProvider?: 'anthropic' | 'openai' | 'google' | 'grok';
    model?: string;
  }) => void;
  
  updateInfrastructureConfig: (config: {
    githubOrg?: string;
    autoSetup?: boolean;
    mongodbOrgId?: string;
    mongodbProjectId?: string;
  }) => void;
  
  // Workflow control
  startInitialization: () => Promise<void>;
  setProcessing: (processing: boolean) => void;
  resetState: () => void;
  
  // Logging & errors
  addLog: (log: { level: 'info' | 'success' | 'warning' | 'error'; message: string; data?: any }) => void;
  setError: (error: string | null) => void;
}
```

---

## 🎨 Design Implementation Patterns

### Pattern 1: Single Page Design

```tsx
const SinglePageDesign: React.FC = () => {
  const { state, updateProjectConfig, startInitialization } = useProjectInit();
  
  return (
    <div className="single-page-layout">
      {/* Header */}
      <header className="project-header">
        <h1>Create Your Project</h1>
        <div className="progress-indicator">
          {state.isProcessing && (
            <div className="progress-bar" style={{ width: `${state.progress}%` }} />
          )}
        </div>
      </header>
      
      {/* Main Content - Changes based on state */}
      <main className="main-content">
        {!state.isProcessing && !state.deploymentUrl && (
          <ProjectConfigurationForm />
        )}
        
        {state.isProcessing && (
          <ProcessingView />
        )}
        
        {state.deploymentUrl && (
          <SuccessView />
        )}
      </main>
    </div>
  );
};
```

### Pattern 2: Multi-Step Wizard

```tsx
const WizardDesign: React.FC = () => {
  const { state, setStep, updateProjectConfig, startInitialization } = useProjectInit();
  
  const steps = [
    { id: 'config', title: 'Configure Project', component: ConfigStep },
    { id: 'ai', title: 'AI Settings', component: AIStep },
    { id: 'infrastructure', title: 'Infrastructure', component: InfraStep },
    { id: 'review', title: 'Review & Launch', component: ReviewStep }
  ];
  
  return (
    <div className="wizard-layout">
      <div className="wizard-steps">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`step ${state.currentStep === step.id ? 'active' : ''}`}
            onClick={() => setStep(step.id)}
          >
            {step.title}
          </div>
        ))}
      </div>
      
      <div className="step-content">
        {/* Render current step component */}
      </div>
    </div>
  );
};
```

### Pattern 3: Dashboard Style

```tsx
const DashboardDesign: React.FC = () => {
  const { state, startInitialization } = useProjectInit();
  
  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <ProjectQuickActions />
        <RecentProjects />
      </aside>
      
      <main className="dashboard-main">
        <div className="cards-grid">
          <ProjectConfigCard />
          <StatusCard />
          <LogsCard />
          <DeploymentCard />
        </div>
      </main>
    </div>
  );
};
```

---

## 🔌 Integration Examples

### Example 1: Custom Form Integration

```tsx
const CustomProjectForm: React.FC = () => {
  const { state, updateProjectConfig, startInitialization } = useProjectInit();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!state.projectName.trim()) {
      setError('Project name is required');
      return;
    }
    
    // Start initialization
    await startInitialization();
  };
  
  return (
    <form onSubmit={handleSubmit} className="custom-form">
      <div className="form-group">
        <label htmlFor="projectName">Project Name</label>
        <input
          id="projectName"
          type="text"
          value={state.projectName}
          onChange={(e) => updateProjectConfig({ projectName: e.target.value })}
          className="form-control"
          placeholder="My Awesome Project"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="requirements">Describe Your Project</label>
        <textarea
          id="requirements"
          value={state.userRequirements}
          onChange={(e) => updateProjectConfig({ userRequirements: e.target.value })}
          className="form-control"
          placeholder="I want to create a medical practice website with appointment booking..."
          rows={4}
        />
      </div>
      
      <button 
        type="submit" 
        disabled={state.isProcessing}
        className="btn btn-primary"
      >
        {state.isProcessing ? 'Creating Project...' : 'Create Project'}
      </button>
    </form>
  );
};
```

### Example 2: Progress Visualization

```tsx
const CustomProgressDisplay: React.FC = () => {
  const { state } = useProjectInit();
  
  const getProgressStage = () => {
    if (state.progress < 20) return 'Initializing';
    if (state.progress < 40) return 'Setting up template';
    if (state.progress < 60) return 'AI customization';
    if (state.progress < 80) return 'Infrastructure setup';
    if (state.progress < 95) return 'Deployment';
    return 'Finalizing';
  };
  
  return (
    <div className="progress-display">
      <div className="progress-circle">
        <svg className="progress-ring" width="120" height="120">
          <circle
            className="progress-ring-background"
            stroke="#e6e6e6"
            strokeWidth="8"
            fill="transparent"
            r="52"
            cx="60"
            cy="60"
          />
          <circle
            className="progress-ring-progress"
            stroke="#3b82f6"
            strokeWidth="8"
            fill="transparent"
            r="52"
            cx="60"
            cy="60"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - state.progress / 100)}`}
          />
        </svg>
        <div className="progress-text">
          <span className="progress-percentage">{state.progress}%</span>
          <span className="progress-stage">{getProgressStage()}</span>
        </div>
      </div>
      
      <div className="status-message">
        {state.status}
      </div>
    </div>
  );
};
```

### Example 3: Real-time Logs

```tsx
const CustomLogsDisplay: React.FC = () => {
  const { state } = useProjectInit();
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);
  
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };
  
  return (
    <div className="logs-container">
      <h3>Project Creation Progress</h3>
      <div className="logs-list">
        {state.logs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.level}`}>
            <span className="log-icon">{getLogIcon(log.level)}</span>
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
```

---

## 🎯 Templates Available

| Template ID | Description | Tech Stack |
|-------------|-------------|------------|
| `vite-react-mongo` | React + MongoDB + BetterAuth | Vite, React, MongoDB, TypeScript |
| `vite-react-supabase` | React + Supabase + Auth | Vite, React, Supabase, TypeScript |
| `vite-react-planetscale` | React + PlanetScale + Drizzle | Vite, React, PlanetScale, Drizzle ORM |
| `vite-react-upstash` | React + Upstash Redis | Vite, React, Upstash Redis |
| `vite-react-indexeddb` | React + IndexedDB (Offline) | Vite, React, IndexedDB |
| `nextjs-supabase` | Next.js + Supabase | Next.js, Supabase, TypeScript |
| `nextjs-mongodb` | Next.js + MongoDB + Prisma | Next.js, MongoDB, Prisma |
| `nextjs-planetscale` | Next.js + PlanetScale | Next.js, PlanetScale, Drizzle |
| `nuxt-supabase` | Nuxt + Supabase | Nuxt 3, Supabase, Vue 3 |
| `vue-supabase` | Vue + Supabase | Vue 3, Supabase, Vite |

---

## 🔧 Environment Variables

The system automatically configures environment variables based on the selected template:

```typescript
// Automatically configured based on template
const envVars = {
  // Database
  'DATABASE_URL': 'mongodb://...', // or postgres://...
  'MONGODB_URI': 'mongodb://...',
  
  // Authentication
  'BETTER_AUTH_SECRET': 'auto-generated-secret',
  'NEXTAUTH_SECRET': 'auto-generated-secret',
  
  // App URLs (updated after deployment)
  'VITE_APP_URL': 'https://your-project.netlify.app',
  'BETTER_AUTH_URL': 'https://your-project.netlify.app',
  
  // Service-specific
  'SUPABASE_URL': 'from-env-or-placeholder',
  'PLANETSCALE_TOKEN': 'from-env-or-placeholder',
  'UPSTASH_REDIS_REST_URL': 'from-env-or-placeholder'
};
```

---

## 🚨 Error Handling

```tsx
const ErrorHandling: React.FC = () => {
  const { state, setError, addLog, resetState } = useProjectInit();
  
  useEffect(() => {
    if (state.error) {
      // Handle errors in your UI
      console.error('Project initialization error:', state.error);
      
      // Add to logs
      addLog({
        level: 'error',
        message: `Error: ${state.error}`,
        data: { timestamp: new Date().toISOString() }
      });
    }
  }, [state.error]);
  
  const handleRetry = () => {
    setError(null);
    // Retry logic here
  };
  
  const handleReset = () => {
    resetState();
  };
  
  if (state.error) {
    return (
      <div className="error-display">
        <h3>❌ Something went wrong</h3>
        <p>{state.error}</p>
        <div className="error-actions">
          <button onClick={handleRetry}>Try Again</button>
          <button onClick={handleReset}>Start Over</button>
        </div>
      </div>
    );
  }
  
  return null;
};
```

---

## ✅ Testing Your Integration

```typescript
// Test component
const TestIntegration: React.FC = () => {
  const { state, updateProjectConfig, startInitialization, addLog } = useProjectInit();
  
  const runTest = async () => {
    // Test configuration
    updateProjectConfig({
      projectName: 'Test Project',
      templateId: 'vite-react-mongo',
      userRequirements: 'Test medical website'
    });
    
    addLog({ level: 'info', message: 'Starting test...' });
    
    // Test initialization (dry run)
    console.log('Current state:', state);
    
    // Start actual initialization
    await startInitialization();
  };
  
  return (
    <div>
      <button onClick={runTest}>Test Integration</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};
```

---

## 🎉 That's It!

Your new UI design is now fully integrated with the Geenius project initialization system. The context provider handles all the complex workflow logic, so you can focus on creating an amazing user experience.

### 📞 Need Help?

- Check the existing components in `src/components/project-initialization/`
- Review the workflow logic in `api/v1/`
- Test with the provided examples
- The backend API handles all the heavy lifting automatically!

**Happy coding! 🚀**