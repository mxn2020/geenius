// Project initialization component
export class ProjectInitializer {
  constructor(store) {
    this.store = store;
    this.element = null;
  }

  render() {
    const state = this.store.getState();
    
    return `
      <div class="card">
        <h2>Initialize New Project</h2>
        <form id="init-form">
          <div class="form-group">
            <label for="ai-provider">AI Provider:</label>
            <select id="ai-provider" name="aiProvider" required>
              <option value="anthropic">🤖 Claude (Anthropic) - Best for coding</option>
              <option value="openai">🧠 GPT-4 (OpenAI) - Most versatile</option>
              <option value="google">✨ Gemini (Google) - Creative problem solving</option>
              <option value="grok">⚡ Grok (X.AI) - Fast and witty</option>
            </select>
          </div>

          <div class="form-group">
            <label for="agent-mode">Agent Architecture:</label>
            <select id="agent-mode" name="agentMode" required>
              <option value="single">🎯 Single Agent - Fast and focused</option>
              <option value="orchestrated">👥 Multi-Agent Team - Specialized roles</option>
              <option value="hybrid">🔄 Hybrid - Best of both worlds</option>
            </select>
          </div>

          <div class="form-group" id="orchestration-group" style="display: none;">
            <label for="orchestration-strategy">Team Coordination Strategy:</label>
            <select id="orchestration-strategy" name="orchestrationStrategy">
              <option value="hierarchical">📋 Hierarchical - Lead manages team</option>
              <option value="collaborative">🤝 Collaborative - Agents work together</option>
              <option value="parallel">⚡ Parallel - Maximum speed</option>
              <option value="sequential">📐 Sequential - Step by step</option>
            </select>
          </div>

          <div class="form-group">
            <label for="template-id">Project Template:</label>
            <select id="template-id" name="templateId" required>
              ${this.renderTemplateOptions(state.templates)}
            </select>
          </div>

          <div class="form-group">
            <label for="project-name">Project Name:</label>
            <input type="text" id="project-name" name="projectName" required>
          </div>

          <div class="form-group">
            <label for="github-org">GitHub Organization/Username:</label>
            <input type="text" id="github-org" name="githubOrg" required>
          </div>

          <div class="form-group">
            <label for="model">Model (optional):</label>
            <input type="text" id="model" name="model" placeholder="Leave empty for default">
          </div>

          <div class="form-group" id="mongodb-section" style="display: none;">
            <h3>MongoDB Configuration</h3>
            <div class="mongodb-status" id="mongodb-status">
              <span>🔍 Loading MongoDB projects...</span>
            </div>
            <div id="mongodb-selection" style="display: none;">
              <div class="form-group">
                <label for="mongodb-org">MongoDB Organization:</label>
                <select id="mongodb-org" name="mongodbOrgId">
                  <option value="">Select organization...</option>
                </select>
              </div>
              <div class="form-group">
                <label for="mongodb-project">MongoDB Project:</label>
                <select id="mongodb-project" name="mongodbProjectId">
                  <option value="">Select project...</option>
                </select>
                <small class="help-text">
                  💡 Choose "Create new project" to create a dedicated MongoDB project for this app, 
                  or select an existing project that has no free clusters (M0) yet.
                </small>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="auto-setup" name="autoSetup" checked>
              Auto-setup GitHub repo and Netlify project
            </label>
          </div>

          <button type="submit" class="btn-primary" id="init-btn">
            🚀 Initialize Project
          </button>
        </form>
      </div>
    `;
  }

  renderTemplateOptions(templates) {
    if (!templates || templates.length === 0) {
      return '<option value="">Loading templates...</option>';
    }
    
    return templates.map(template => 
      `<option value="${template.id}">${template.name} - ${template.description}</option>`
    ).join('');
  }

  mount(container) {
    container.innerHTML = this.render();
    this.element = container.querySelector('#init-form');
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.element) return;

    // Agent mode change handler
    const agentModeSelect = this.element.querySelector('#agent-mode');
    const orchestrationGroup = this.element.querySelector('#orchestration-group');
    
    agentModeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'orchestrated' || e.target.value === 'hybrid') {
        orchestrationGroup.style.display = 'block';
      } else {
        orchestrationGroup.style.display = 'none';
      }
    });

    // Template change handler for MongoDB section
    const templateSelect = this.element.querySelector('#template-id');
    const mongodbSection = this.element.querySelector('#mongodb-section');
    
    const handleTemplateChange = async (templateId) => {
      const selectedTemplate = this.store.getState().templates.find(t => t.id === templateId);
      console.log('Template selected:', templateId, selectedTemplate);
      
      if (selectedTemplate && (selectedTemplate.envVars?.includes('MONGODB_URI') || selectedTemplate.envVars?.includes('DATABASE_URL'))) {
        console.log('MongoDB template detected, showing MongoDB section');
        mongodbSection.style.display = 'block';
        await this.loadMongoDBProjects();
      } else {
        console.log('Non-MongoDB template, hiding MongoDB section');
        mongodbSection.style.display = 'none';
      }
    };
    
    templateSelect.addEventListener('change', async (e) => {
      await handleTemplateChange(e.target.value);
    });
    
    // Check current selection on mount
    if (templateSelect.value) {
      handleTemplateChange(templateSelect.value);
    }

    // MongoDB organization change handler
    const mongodbOrgSelect = this.element.querySelector('#mongodb-org');
    const mongodbProjectSelect = this.element.querySelector('#mongodb-project');
    const projectNameInput = this.element.querySelector('#project-name');
    
    mongodbOrgSelect.addEventListener('change', (e) => {
      const selectedOrg = this.mongodbData?.organizations.find(org => org.organization.id === e.target.value);
      this.populateMongoDBProjects(selectedOrg);
    });
    
    // Project name change handler - refresh MongoDB projects to update "Create new" option
    projectNameInput.addEventListener('input', () => {
      const selectedOrgId = mongodbOrgSelect.value;
      if (selectedOrgId && this.mongodbData) {
        const selectedOrg = this.mongodbData.organizations.find(org => org.organization.id === selectedOrgId);
        this.populateMongoDBProjects(selectedOrg);
      }
    });

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
      if (key === 'autoSetup') {
        data[key] = true;
      } else {
        data[key] = value;
      }
    }

    // Handle checkbox
    if (!formData.has('autoSetup')) {
      data.autoSetup = false;
    }

    try {
      await this.store.initializeProject(data);
      
      // Update button to show success state
      const initBtn = this.element.querySelector('#init-btn');
      initBtn.textContent = '✅ Project Initialized';
      initBtn.disabled = true;
      initBtn.style.backgroundColor = '#10b981';
      
    } catch (error) {
      console.error('Project initialization failed:', error);
    }
  }

  async loadMongoDBProjects() {
    const mongodbStatus = this.element.querySelector('#mongodb-status');
    const mongodbSelection = this.element.querySelector('#mongodb-selection');
    
    try {
      mongodbStatus.innerHTML = '<span>🔍 Loading MongoDB projects...</span>';
      
      const response = await fetch('/.netlify/functions/mongodb-projects');
      const data = await response.json();
      
      if (!data.available) {
        mongodbStatus.innerHTML = `<span style="color: orange;">⚠️ ${data.message}</span>`;
        return;
      }
      
      this.mongodbData = data;
      this.populateMongoDBOrganizations(data.organizations);
      
      mongodbStatus.innerHTML = '<span style="color: green;">✅ MongoDB projects loaded</span>';
      mongodbSelection.style.display = 'block';
      
    } catch (error) {
      console.error('Failed to load MongoDB projects:', error);
      mongodbStatus.innerHTML = '<span style="color: red;">❌ Failed to load MongoDB projects</span>';
    }
  }

  populateMongoDBOrganizations(organizations) {
    const orgSelect = this.element.querySelector('#mongodb-org');
    
    orgSelect.innerHTML = '<option value="">Select organization...</option>';
    
    organizations.forEach(orgData => {
      const option = document.createElement('option');
      option.value = orgData.organization.id;
      option.textContent = `${orgData.organization.name} (${orgData.projects.length} projects)`;
      orgSelect.appendChild(option);
    });
  }

  populateMongoDBProjects(selectedOrgData) {
    const projectSelect = this.element.querySelector('#mongodb-project');
    
    projectSelect.innerHTML = '<option value="">Select project...</option>';
    
    if (!selectedOrgData || !selectedOrgData.projects) return;
    
    // Add "Create new project" option first
    const projectNameInput = this.element.querySelector('#project-name');
    const currentProjectName = projectNameInput ? projectNameInput.value.trim() : '';
    
    if (currentProjectName) {
      const newProjectOption = document.createElement('option');
      newProjectOption.value = 'CREATE_NEW';
      newProjectOption.textContent = `🆕 Create new project: "${currentProjectName}"`;
      newProjectOption.style.fontWeight = 'bold';
      newProjectOption.style.color = '#0969da';
      projectSelect.appendChild(newProjectOption);
      
      // Add separator
      const separatorOption = document.createElement('option');
      separatorOption.disabled = true;
      separatorOption.textContent = '─────────────────────────';
      projectSelect.appendChild(separatorOption);
    }
    
    // Add existing projects
    selectedOrgData.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      
      const canCreate = project.canCreateFreeCluster ? '✅' : '❌';
      const freeClusterInfo = project.freeClustersCount > 0 ? 
        `${project.freeClustersCount} free cluster${project.freeClustersCount > 1 ? 's' : ''}` :
        'no free clusters';
      
      option.textContent = `${project.name} ${canCreate} (${freeClusterInfo})`;
      option.disabled = !project.canCreateFreeCluster;
      
      projectSelect.appendChild(option);
    });
  }

  update() {
    if (this.element) {
      // Re-render template options if they've loaded
      const templateSelect = this.element.querySelector('#template-id');
      if (templateSelect) {
        const state = this.store.getState();
        templateSelect.innerHTML = this.renderTemplateOptions(state.templates);
      }
    }
  }
}