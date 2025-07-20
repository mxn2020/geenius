// Environment status component
export class EnvironmentStatus {
  constructor(store) {
    this.store = store;
    this.element = null;
  }

  render() {
    const state = this.store.getState();
    const env = state.environmentStatus;
    
    return `
      <div class="env-status">
        <h3>Environment Setup Status:</h3>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">GitHub:</span>
            <span class="status-value ${this.getStatusClass(env.github)}">${this.getStatusText(env.github)}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Netlify:</span>
            <span class="status-value ${this.getStatusClass(env.netlify)}">${this.getStatusText(env.netlify)}</span>
          </div>
          <div class="status-item">
            <span class="status-label">MongoDB:</span>
            <span class="status-value ${this.getStatusClass(env.mongodb)}">${this.getStatusText(env.mongodb)}</span>
          </div>
        </div>
      </div>
    `;
  }

  getStatusClass(status) {
    if (status.configured) return 'success';
    if (status.optional) return 'warning';
    return 'error';
  }

  getStatusText(status) {
    if (status.configured) return '✅ Configured';
    if (status.optional) return '⚠️ Optional - Not configured';
    return `❌ ${status.error || 'Not configured'}`;
  }

  mount(container) {
    container.innerHTML = this.render();
    this.element = container;
  }

  update() {
    if (this.element) {
      this.element.innerHTML = this.render();
    }
  }
}