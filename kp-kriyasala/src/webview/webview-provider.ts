/**
 * Kriyasala Webview Provider
 */

import * as vscode from 'vscode';
import { Logger, ProcessResult } from '@kanak-prabhakar/shared/types';

export class KriyasalaWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'kriyasala.dashboard';

  private readonly extensionUri: vscode.Uri;
  private view?: vscode.WebviewView;

  constructor(extensionUri: vscode.Uri, _logger?: Logger) {
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

  updateExecutionResult(result: ProcessResult): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'executionResult',
        payload: result,
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
    <title>Kriyasala Execution Lab</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 12px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
        .card { background: var(--vscode-sideBar-background); padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--vscode-widget-border); }
        .title { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
        pre { font-family: var(--vscode-editor-font-family); background: var(--vscode-terminal-background); padding: 8px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="card">
        <div class="title">🧪 Kriyasala — Code Execution Lab</div>
        <p>Run your program directly from the editor or command palette.</p>
    </div>
    <div id="output-card" class="card" style="display:none;">
        <div class="title" id="output-title">Execution Result</div>
        <pre id="output-text"></pre>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'executionResult') {
                const res = message.payload;
                document.getElementById('output-card').style.display = 'block';
                document.getElementById('output-title').textContent = 'Result (Exit code: ' + res.exitCode + ', ' + res.duration + 'ms)';
                document.getElementById('output-text').textContent = res.stdout || res.stderr || 'No output';
            }
        });
    </script>
</body>
</html>`;
  }
}
