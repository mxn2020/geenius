// Project status component
export class ProjectStatus {
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
          <h2>Project Status</h2>
          <p>No project initialized yet. Go to the Initialize tab to get started.</p>
        </div>
      `;
    }

    return `
      <div class="card">
        <h2>Project Status</h2>
        <div class="status-section">
          <h3>Current Project</h3>
          <p><strong>Name:</strong> ${project.name}</p>
          <p><strong>Template:</strong> ${project.template}</p>
          <p><strong>AI Provider:</strong> ${project.aiProvider}</p>
          <p><strong>Agent Mode:</strong> ${project.agentMode}</p>
          ${project.orchestrationStrategy ? `<p><strong>Strategy:</strong> ${project.orchestrationStrategy}</p>` : ''}
          <p><strong>Repository:</strong> <a href="${project.repoUrl}" target="_blank">${project.repoUrl}</a></p>
          ${project.netlifyProject ? `<p><strong>Netlify:</strong> <a href="https://app.netlify.com/sites/${project.netlifyProject}/overview" target="_blank">View Dashboard</a></p>` : ''}
          <p><strong>Created:</strong> ${new Date(project.createdAt).toLocaleString()}</p>
          ${project.updatedAt ? `<p><strong>Last Updated:</strong> ${new Date(project.updatedAt).toLocaleString()}</p>` : ''}
        </div>
      </div>
    `;
  }

  mount(container) {
    container.innerHTML = this.render();
  }

  async update() {
    // Reload project status
    await this.store.loadProjectStatus();
    
    if (this.element) {
      this.element.innerHTML = this.render();
    }
  }
}