// netlify/functions/logs.ts
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'text/html'
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get session ID from query parameters
  const sessionId = event.queryStringParameters?.session;
  
  if (!sessionId) {
    return {
      statusCode: 400,
      headers,
      body: `
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>Session ID required in query parameters</p>
        </body>
        </html>
      `
    };
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Geenius AI Agent Logs - ${sessionId}</title>
    <style>
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #0d1117;
            color: #c9d1d9;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: #21262d;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #30363d;
        }
        .header h1 {
            margin: 0;
            color: #58a6ff;
            font-size: 24px;
        }
        .session-info {
            margin-top: 10px;
            font-size: 14px;
            color: #8b949e;
        }
        .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
        }
        .status.completed { background: #238636; color: white; }
        .status.failed { background: #da3633; color: white; }
        .status.in-progress { background: #f85149; color: white; }
        .logs-container {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            max-height: 600px;
            overflow-y: auto;
        }
        .log-entry {
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 4px;
            border-left: 4px solid #30363d;
        }
        .log-entry.info { border-left-color: #58a6ff; }
        .log-entry.success { border-left-color: #56d364; }
        .log-entry.warning { border-left-color: #d29922; }
        .log-entry.error { border-left-color: #f85149; }
        .log-timestamp {
            color: #8b949e;
            font-size: 12px;
            margin-right: 10px;
        }
        .log-level {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 10px;
            min-width: 50px;
            text-align: center;
        }
        .log-level.info { background: #0969da; color: white; }
        .log-level.success { background: #1a7f37; color: white; }
        .log-level.warning { background: #9a6700; color: white; }
        .log-level.error { background: #cf222e; color: white; }
        .log-message {
            color: #c9d1d9;
        }
        .actions {
            background: #21262d;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #30363d;
            margin-bottom: 20px;
        }
        .btn {
            display: inline-block;
            padding: 8px 16px;
            background: #238636;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-right: 10px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .btn:hover {
            background: #2ea043;
        }
        .btn.secondary {
            background: #21262d;
            border: 1px solid #30363d;
        }
        .btn.secondary:hover {
            background: #30363d;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #8b949e;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #21262d;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        .progress-fill {
            height: 100%;
            background: #58a6ff;
            transition: width 0.3s ease;
        }
        .auto-refresh {
            float: right;
            font-size: 12px;
            color: #8b949e;
        }
        .error-message {
            background: #da3633;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Geenius AI Agent Logs</h1>
            <div class="session-info">
                Session ID: <code id="session-id">${sessionId}</code>
                <span id="status-badge" class="status">Loading...</span>
                <div class="auto-refresh">
                    <label>
                        <input type="checkbox" id="auto-refresh" checked> Auto-refresh
                    </label>
                </div>
            </div>
        </div>

        <div class="progress-bar">
            <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
        </div>

        <div class="actions" id="actions" style="display: none;">
            <a href="#" id="preview-link" class="btn" target="_blank">🚀 View Preview</a>
            <a href="#" id="pr-link" class="btn secondary" target="_blank">📋 View PR</a>
        </div>

        <div id="error-container"></div>

        <div class="logs-container">
            <div id="logs-content" class="loading">
                <div>Loading logs...</div>
            </div>
        </div>
    </div>

    <script>
        const sessionId = '${sessionId}';
        const apiBase = window.location.origin;
        let autoRefresh = true;
        let refreshInterval;

        async function fetchLogs() {
            if (!sessionId) return;
            
            try {
                // Try web-init session first, then fall back to process-changes-enhanced
                let response;
                if (sessionId.startsWith('ge_')) {
                    response = await fetch(apiBase + '/.netlify/functions/web-init/' + sessionId);
                } else {
                    response = await fetch(apiBase + '/api/process-changes-enhanced/' + sessionId);
                }
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                // Check if response is JSON before parsing
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    if (text.includes('TimeoutError') || text.includes('timed out')) {
                        throw new Error('Function timed out - please try again');
                    }
                    throw new Error('Invalid response format: ' + text.substring(0, 100));
                }
                
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error('Error fetching logs:', error);
                document.getElementById('error-container').innerHTML = 
                    '<div class="error-message">❌ Network error: ' + error.message + '</div>';
            }
        }

        function updateUI(data) {
            // Clear any error messages
            document.getElementById('error-container').innerHTML = '';
            
            // Update status badge
            const statusBadge = document.getElementById('status-badge');
            statusBadge.textContent = data.status.replace('_', ' ').toUpperCase();
            statusBadge.className = 'status ' + (data.status === 'completed' ? 'completed' : 
                                                data.status === 'failed' ? 'failed' : 'in-progress');

            // Update progress bar
            const progressFill = document.getElementById('progress-fill');
            progressFill.style.width = (data.progress || 0) + '%';

            // Update actions
            const actions = document.getElementById('actions');
            const previewLink = document.getElementById('preview-link');
            const prLink = document.getElementById('pr-link');
            
            // Handle both web-init and process-changes data structures
            const previewUrl = data.previewUrl || data.netlifyUrl;
            const prUrl = data.prUrl || data.repoUrl;
            
            if (previewUrl || prUrl) {
                actions.style.display = 'block';
                if (previewUrl) {
                    previewLink.href = previewUrl;
                    previewLink.style.display = 'inline-block';
                    previewLink.textContent = data.netlifyUrl ? '🌐 View Site' : '🚀 View Preview';
                } else {
                    previewLink.style.display = 'none';
                }
                if (prUrl) {
                    prLink.href = prUrl;
                    prLink.style.display = 'inline-block';
                    prLink.textContent = data.repoUrl ? '📁 View Repo' : '📋 View PR';
                } else {
                    prLink.style.display = 'none';
                }
            } else {
                actions.style.display = 'none';
            }

            // Update logs
            const logsContent = document.getElementById('logs-content');
            if (data.logs && data.logs.length > 0) {
                // Sort logs by timestamp to ensure chronological order (oldest first)
                const sortedLogs = [...data.logs].sort((a, b) => a.timestamp - b.timestamp);
                
                logsContent.innerHTML = sortedLogs.map(log => {
                    const timestamp = new Date(log.timestamp).toLocaleString();
                    return '<div class="log-entry ' + log.level + '">' +
                        '<span class="log-timestamp">' + timestamp + '</span>' +
                        '<span class="log-level ' + log.level + '">' + log.level.toUpperCase() + '</span>' +
                        '<span class="log-message">' + log.message + '</span>' +
                        '</div>';
                }).join('');
                
                // Auto-scroll to bottom to show latest logs
                logsContent.scrollTop = logsContent.scrollHeight;
            } else {
                logsContent.innerHTML = '<div class="loading">No logs yet...</div>';
            }

            // Stop auto-refresh if completed or failed
            if (data.status === 'completed' || data.status === 'failed') {
                autoRefresh = false;
                document.getElementById('auto-refresh').checked = false;
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                }
            }
        }

        function startAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
            if (autoRefresh) {
                refreshInterval = setInterval(fetchLogs, 2000);
            }
        }

        // Initialize
        if (sessionId) {
            fetchLogs();
            startAutoRefresh();
        }

        // Auto-refresh toggle
        document.getElementById('auto-refresh').addEventListener('change', function(e) {
            autoRefresh = e.target.checked;
            startAutoRefresh();
        });

        // Refresh when page becomes visible
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && autoRefresh && sessionId) {
                fetchLogs();
            }
        });
    </script>
</body>
</html>
  `;
  
  return {
    statusCode: 200,
    headers,
    body: html
  };
};