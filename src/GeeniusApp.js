// Main Geenius web application
import { projectStore } from './stores/ProjectStore.js';
import { ProjectInitializer } from './components/ProjectInitializer.js';
import { ProjectStatus } from './components/ProjectStatus.js';
import { DevelopmentSession } from './components/DevelopmentSession.js';
import { LogsViewer } from './components/LogsViewer.js';
import { EnvironmentStatus } from './components/EnvironmentStatus.js';

export class GeeniusApp {
  constructor() {
    this.store = projectStore;
    this.currentView = 'init';
    this.components = {};
    this.init();
  }

  async init() {
    // Initialize components
    this.components = {
      projectInitializer: new ProjectInitializer(this.store),
      projectStatus: new ProjectStatus(this.store),
      developmentSession: new DevelopmentSession(this.store),
      logsViewer: new LogsViewer(this.store),
      environmentStatus: new EnvironmentStatus(this.store)
    };

    // Subscribe to store changes
    this.store.subscribe(this.handleStoreChange.bind(this));

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadInitialData();

    // Mount components
    this.mountComponents();

    // Make app globally available for component callbacks
    window.app = this;
  }

  async loadInitialData() {
    try {
      // Load environment status and templates in parallel
      await Promise.all([
        this.store.checkEnvironmentStatus(),
        this.store.loadTemplates(),
        this.store.loadProjectStatus()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });
  }

  mountComponents() {
    // Mount environment status
    const envContainer = document.getElementById('env-status');
    if (envContainer) {
      this.components.environmentStatus.mount(envContainer);
    }

    // Mount initial view
    this.switchView(this.currentView);
  }

  switchView(view) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-view="${view}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Update views
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    
    const viewElement = document.getElementById(`${view}-view`);
    if (viewElement) {
      viewElement.classList.add('active');
    }

    this.currentView = view;

    // Mount appropriate component
    this.mountViewComponent(view);
  }

  mountViewComponent(view) {
    const viewElement = document.getElementById(`${view}-view`);
    if (!viewElement) return;

    switch (view) {
      case 'init':
        this.components.projectInitializer.mount(viewElement);
        break;
      case 'status':
        this.components.projectStatus.mount(viewElement);
        break;
      case 'develop':
        this.components.developmentSession.mount(viewElement);
        break;
      case 'logs':
        this.components.logsViewer.mount(viewElement);
        break;
    }
  }

  handleStoreChange(state) {
    // Update loading overlay
    this.updateLoadingOverlay(state);

    // Handle automatic tab switching
    if (state.activeTab && state.activeTab !== this.currentView) {
      this.switchView(state.activeTab);
    }

    // Update components based on state changes
    this.updateComponents(state);
  }

  updateLoadingOverlay(state) {
    const overlay = document.getElementById('loading-overlay');
    const title = document.getElementById('loading-title');
    const message = document.getElementById('loading-message');

    if (overlay) {
      if (state.isLoading) {
        overlay.style.display = 'flex';
        if (title) title.textContent = state.loadingTitle || 'Processing...';
        if (message) message.textContent = state.loadingMessage || 'Please wait...';
      } else {
        overlay.style.display = 'none';
      }
    }
  }

  updateComponents(state) {
    // Update environment status
    this.components.environmentStatus.update();

    // Update project initializer with new templates
    this.components.projectInitializer.update();

    // Update logs viewer
    this.components.logsViewer.update();

    // If we're viewing logs and new logs arrived, auto-switch to logs view
    if (state.logs.length > 0 && state.isLoading) {
      if (this.currentView !== 'logs') {
        this.switchView('logs');
      }
    }
  }

  // Public methods for component callbacks
  showSuccess(message) {
    this.store.addLog(`✅ ${message}`);
  }

  showError(message) {
    this.store.addLog(`❌ ${message}`);
  }
}