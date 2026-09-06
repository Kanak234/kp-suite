import * as vscode from 'vscode';
import { Logger } from '@kanak-prabhakar/shared/types';
import { SystemMetrics } from '../monitor/health-monitor';

export class SvasthyaWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'svasthya.dashboard';

  private readonly extensionUri: vscode.Uri;
  private view?: vscode.WebviewView;

  constructor(extensionUri: vscode.Uri, _logger: Logger) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);
  }

  updateMetrics(metrics: SystemMetrics): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'metrics',
        payload: metrics,
      });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">
    <title>Svasthya System Health</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
        .card { background: var(--vscode-sideBar-background); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--vscode-widget-border); }
        .title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        
        .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .metric { display: flex; flex-direction: column; }
        .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
        .metric-value { font-size: 28px; font-weight: 700; }
        
        .progress-bar { width: 100%; height: 8px; background-color: var(--vscode-editorWidget-background); border-radius: 4px; overflow: hidden; margin-top: 8px; }
        .progress-fill { height: 100%; transition: width 0.3s ease, background-color 0.3s ease; }
        
        .status-good { color: var(--vscode-testing-iconPassed); }
        .status-warn { color: var(--vscode-problemsWarningIcon-foreground); }
        .status-crit { color: var(--vscode-problemsErrorIcon-foreground); }
        .bg-good { background-color: var(--vscode-testing-iconPassed); }
        .bg-warn { background-color: var(--vscode-problemsWarningIcon-foreground); }
        .bg-crit { background-color: var(--vscode-problemsErrorIcon-foreground); }
        
        .sub-metrics { font-size: 12px; margin-top: 16px; color: var(--vscode-descriptionForeground); line-height: 1.6; }
    </style>
</head>
<body>
    <div class="card">
        <div class="title">🩺 Svasthya Health Monitor</div>
        
        <div class="metric-grid">
            <div class="metric">
                <span class="metric-label">CPU Usage</span>
                <span class="metric-value" id="cpu-val">0%</span>
                <div class="progress-bar"><div class="progress-fill" id="cpu-bar" style="width: 0%"></div></div>
            </div>
            
            <div class="metric">
                <span class="metric-label">Memory Usage</span>
                <span class="metric-value" id="mem-val">0%</span>
                <div class="progress-bar"><div class="progress-fill" id="mem-bar" style="width: 0%"></div></div>
            </div>
        </div>
        
        <div class="sub-metrics">
            <div><strong>Uptime:</strong> <span id="uptime-val">-</span></div>
            <div><strong>Load Avg (1m, 5m, 15m):</strong> <span id="load-val">-</span></div>
            <div><strong>VS Code Memory (RSS):</strong> <span id="proc-mem-val">-</span></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function getStatusClass(percent) {
            if (percent < 70) return 'good';
            if (percent < 90) return 'warn';
            return 'crit';
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function formatUptime(seconds) {
            const d = Math.floor(seconds / (3600*24));
            const h = Math.floor(seconds % (3600*24) / 3600);
            const m = Math.floor(seconds % 3600 / 60);
            return \`\${d}d \${h}h \${m}m\`;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'metrics') {
                const m = message.payload;
                
                const cpuStatus = getStatusClass(m.cpuUsage);
                const memStatus = getStatusClass(m.memoryUsagePercent);
                
                const cpuVal = document.getElementById('cpu-val');
                cpuVal.textContent = m.cpuUsage + '%';
                cpuVal.className = 'metric-value status-' + cpuStatus;
                
                const cpuBar = document.getElementById('cpu-bar');
                cpuBar.style.width = m.cpuUsage + '%';
                cpuBar.className = 'progress-fill bg-' + cpuStatus;
                
                const memVal = document.getElementById('mem-val');
                memVal.textContent = m.memoryUsagePercent + '%';
                memVal.className = 'metric-value status-' + memStatus;
                
                const memBar = document.getElementById('mem-bar');
                memBar.style.width = m.memoryUsagePercent + '%';
                memBar.className = 'progress-fill bg-' + memStatus;
                
                document.getElementById('uptime-val').textContent = formatUptime(m.uptime);
                document.getElementById('load-val').textContent = m.loadAvg.map(l => l.toFixed(2)).join(', ');
                document.getElementById('proc-mem-val').textContent = formatBytes(m.processMemory.rss);
            }
        });
    </script>
</body>
</html>`;
  }
}
