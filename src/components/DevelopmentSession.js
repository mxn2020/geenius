// Development session component
export class DevelopmentSession {
  constructor(store) {
    this.store = store;
    this.element = null;
  }

  render() {
    const state = this.store.getState();
    const project = state.currentProject;
    
    if (!project || !project.hasProject) {
      return `
        <div class="card">
          <h2>Development Session</h2>
          <div id="no-project-message">
            <p>No project initialized. Please initialize a project first.</p>
            <button class="btn" onclick="window.app.switchView('init')">
              Go to Initialize
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <h2>Development Session</h2>
        <form id="develop-form">
          <div class="form-group">
            <label for="feature-name">Feature Branch Name:</label>
            <input type="text" id="feature-name" name="featureName" required 
                   value="feature/ai-${Date.now()}" placeholder="feature/ai-development">
          </div>

          <div class="form-group">
            <label for="complexity">Task Complexity:</label>
            <select id="complexity" name="complexity" required>
              <option value="simple">🟢 Simple - Bug fixes, small updates</option>
              <option value="medium" selected>🟡 Medium - New features, refactoring</option>
              <option value="complex">🔴 Complex - Architecture changes, integrations</option>
            </select>
          </div>

          <div class="form-group">
            <label for="priority">Task Priority:</label>
            <select id="priority" name="priority" required>
              <option value="urgent">🔥 Urgent - Critical fixes</option>
              <option value="high">🔴 High - Important features</option>
              <option value="medium" selected>🟡 Medium - Regular development</option>
              <option value="low">🟢 Low - Nice to have</option>
            </select>
          </div>

          <div class="form-group">
            <label for="preferred-mode">Agent Mode:</label>
            <select id="preferred-mode" name="preferredMode" required>
              <option value="single">🎯 Single Agent - Fast execution</option>
              <option value="orchestrated">👥 Multi-Agent Team - Comprehensive approach</option>
              <option value="auto" selected>🤖 Auto-select - Let AI decide</option>
            </select>
          </div>

          <div class="form-group">
            <label for="task-description">Task Description:</label>
            <textarea id="task-description" name="taskDescription" rows="12" required 
                      placeholder="# Feature Requirements

## Description
Describe your feature here...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
- Implementation details
- Performance considerations
- Security requirements

## Testing Requirements
- Unit tests
- Integration tests
- E2E tests if applicable"></textarea>
          </div>

          <button type="submit" class="btn-primary" id="develop-btn">
            🚀 Start Development
          </button>
        </form>
      </div>
    `;
  }

  mount(container) {
    container.innerHTML = this.render();
    this.element = container.querySelector('#develop-form');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.element) return;

    // Form submission handler
    this.element.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(e);
    });
  }

  async handleSubmit(e) {
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }

    try {
      await this.store.startDevelopment(data);
    } catch (error) {
      console.error('Development session failed:', error);
    }
  }

  async update() {
    // Reload project status to check if project exists
    await this.store.loadProjectStatus();
    
    if (this.element) {
      // Re-render if project status changed
      const container = this.element.parentElement;
      if (container) {
        this.mount(container);
      }
    }
  }
}