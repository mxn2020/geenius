// Logs viewer component
export class LogsViewer {
  constructor(store) {
    this.store = store;
    this.element = null;
  }

  render() {
    const state = this.store.getState();
    
    return `
      <div class="card">
        <h2>Real-time Logs</h2>
        ${this.renderSessionInfo(state)}
        <div class="log-container">
          <div id="log-output" class="log-output">${this.renderLogs(state)}</div>
          <div class="log-actions">
            <button class="btn" id="copy-logs">📋 Copy Logs</button>
            <button class="btn" id="clear-logs">🗑️ Clear Logs</button>
            ${state.repoUrl ? `<a href="${state.repoUrl}" target="_blank" class="btn">📁 View Repo</a>` : ''}
            ${state.netlifyUrl ? `<a href="${state.netlifyUrl}" target="_blank" class="btn">🌐 View Site</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderSessionInfo(state) {
    if (!state.sessionId) return '';
    
    const statusBadge = state.sessionStatus ? 
      `<span class="status-badge status-${state.sessionStatus}">${state.sessionStatus.replace('_', ' ').toUpperCase()}</span>` : '';
    
    const progressBar = state.sessionProgress !== undefined ? 
      `<div class="progress-bar">
        <div class="progress-fill" style="width: ${state.sessionProgress}%"></div>
       </div>` : '';
    
    return `
      <div class="session-info">
        <div class="session-header">
          <span>Session ID: <code>${state.sessionId}</code></span>
          ${statusBadge}
        </div>
        ${progressBar}
        ${state.sessionError ? `<div class="error-message">❌ ${state.sessionError}</div>` : ''}
      </div>
    `;
  }

  renderLogs(state) {
    const allLogs = [];
    
    // Add regular logs (if any)
    if (state.logs && state.logs.length > 0) {
      state.logs.forEach(log => {
        // Extract timestamp from log message if it exists [HH:MM:SS AM/PM]
        const timestampMatch = log.match(/^\[(\d+:\d+:\d+ [AP]M)\]/);
        let timestamp = Date.now(); // Default fallback
        
        if (timestampMatch) {
          // Parse the timestamp
          const timeStr = timestampMatch[1];
          const today = new Date();
          const timeDate = new Date(`${today.toDateString()} ${timeStr}`);
          timestamp = timeDate.getTime();
        }
        
        allLogs.push({
          type: 'regular',
          message: log,
          timestamp: timestamp
        });
      });
    }
    
    // Add session logs (if any)
    if (state.sessionLogs && state.sessionLogs.length > 0) {
      state.sessionLogs.forEach(log => {
        allLogs.push({
          type: 'session',
          ...log
        });
      });
    }
    
    if (allLogs.length === 0) {
      if (state.isInitializing) {
        return '<div class="log-message">⏳ Waiting for logs...</div>';
      }
      return '<div class="log-message">No logs available</div>';
    }
    
    // Sort by timestamp to maintain chronological order
    allLogs.sort((a, b) => a.timestamp - b.timestamp);
    
    return allLogs.map(log => {
      if (log.type === 'session') {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelClass = log.level || 'info';
        const levelIcon = this.getLevelIcon(log.level);
        return `<div class="log-entry log-${levelClass}">
          <span class="log-timestamp">${timestamp}</span>
          <span class="log-level">${levelIcon} ${log.level.toUpperCase()}</span>
          <span class="log-message">${log.message}</span>
        </div>`;
      } else {
        // Format regular logs in the same style as session logs
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        return `<div class="log-entry log-regular">
          <span class="log-timestamp">${timestamp}</span>
          <span class="log-level">📝 LOG</span>
          <span class="log-message">${log.message.replace(/^\[\d+:\d+:\d+ [AP]M\]\s*/, '')}</span>
        </div>`;
      }
    }).join('');
  }

  getLevelIcon(level) {
    switch (level) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': 
      default: return 'ℹ️';
    }
  }

  mount(container) {
    container.innerHTML = this.render();
    this.element = container;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.element) return;

    const copyBtn = this.element.querySelector('#copy-logs');
    const clearBtn = this.element.querySelector('#clear-logs');

    copyBtn.addEventListener('click', () => {
      this.copyLogs();
    });

    clearBtn.addEventListener('click', () => {
      this.store.clearLogs();
    });
  }

  async copyLogs() {
    const copyButton = this.element.querySelector('#copy-logs');
    const state = this.store.getState();
    
    try {
      let logsText;
      if (state.sessionLogs && Array.isArray(state.sessionLogs)) {
        logsText = state.sessionLogs.map(log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          return `[${timestamp}] ${log.level.toUpperCase()}: ${log.message}`;
        }).join('\n');
      } else {
        logsText = (state.logs || []).join('\n');
      }
      
      if (logsText.trim() === '') {
        this.showError('No logs to copy');
        return;
      }

      // Try to use the modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(logsText);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = logsText;
        textArea.style.position = 'fixed';
        textArea.style.top = '-1000px';
        textArea.style.left = '-1000px';
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      // Show success feedback
      copyButton.classList.add('copy-success');
      copyButton.textContent = '✅ Copied!';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        copyButton.classList.remove('copy-success');
        copyButton.textContent = '📋 Copy Logs';
      }, 2000);

    } catch (error) {
      console.error('Failed to copy logs:', error);
      this.showError('Failed to copy logs to clipboard');
    }
  }

  showError(message) {
    // You could implement a toast notification here
    console.error(message);
  }

  update() {
    if (this.element) {
      // Re-render the entire component to update session info and logs
      this.element.innerHTML = this.render();
      this.setupEventListeners();
      
      // Auto-scroll to bottom
      const logOutput = this.element.querySelector('#log-output');
      if (logOutput) {
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    }
  }
}