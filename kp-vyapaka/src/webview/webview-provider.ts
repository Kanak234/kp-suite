/**
 * Vyapaka Webview Provider
 * 
 * Provides the main dashboard webview for the extension.
 */

import * as vscode from 'vscode';
import { ToolchainInfo, Logger } from '@kanak-prabhakar/shared/types';

export class VyapakaWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vyapaka.dashboard';

  private readonly extensionUri: vscode.Uri;
  private readonly logger: Logger;
  private view?: vscode.WebviewView;
  private toolchains: ToolchainInfo[] = [];

  constructor(extensionUri: vscode.Uri, logger: Logger) {
    this.extensionUri = extensionUri;
    this.logger = logger;
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

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      []
    );

    // Send initial data
    if (this.toolchains.length > 0) {
      this.sendToolchains();
    }
  }

  updateToolchains(toolchains: ToolchainInfo[]): void {
    this.toolchains = toolchains;
    this.sendToolchains();
  }

  private sendToolchains(): void {
    if (this.view) {
      this.view.webview.postMessage({
        type: 'toolchains',
        payload: this.toolchains,
      });
    }
  }

  private handleMessage(message: { type: string; payload?: unknown }): void {
    switch (message.type) {
      case 'refresh':
        this.logger.info('Webview requested refresh');
        vscode.commands.executeCommand('vyapaka.diagnose');
        break;
      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'vyapaka');
        break;
      case 'generateReport':
        vscode.commands.executeCommand('vyapaka.generateReport');
        break;
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = this.getMediaUri(webview, 'dashboard.js');
    const styleUri = this.getMediaUri(webview, 'dashboard.css');
    const codiconsUri = this.getMediaUri(webview, 'codicon.css');

    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; font-src ${cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <link href="${codiconsUri}" rel="stylesheet">
    <title>Vyapaka Dashboard</title>
</head>
<body>
    <div class="container">
        <header>
            <h1>Vyapaka — Environment Doctor</h1>
            <p class="subtitle">Comprehensive Development Environment Diagnostics</p>
        </header>

        <div class="toolbar">
            <button id="refreshBtn" class="btn btn-primary">
                <span class="codicon codicon-refresh"></span> Refresh
            </button>
            <button id="reportBtn" class="btn btn-secondary">
                <span class="codicon codicon-export"></span> Generate Report
            </button>
            <button id="settingsBtn" class="btn btn-secondary">
                <span class="codicon codicon-gear"></span> Settings
            </button>
        </div>

        <div id="summary" class="summary">
            <div class="stat">
                <span class="stat-value" id="workingCount">0</span>
                <span class="stat-label">Working</span>
            </div>
            <div class="stat">
                <span class="stat-value warning" id="warningCount">0</span>
                <span class="stat-label">Warnings</span>
            </div>
            <div class="stat">
                <span class="stat-value error" id="missingCount">0</span>
                <span class="stat-label">Missing</span>
            </div>
            <div class="stat">
                <span class="stat-value" id="unknownCount">0</span>
                <span class="stat-label">Unknown</span>
            </div>
        </div>

        <div id="toolchainList" class="toolchain-list">
            <div class="loading">Loading diagnostics...</div>
        </div>

        <footer>
            <p>Vyapaka v1.0.0 — Kanak Prabhakar</p>
        </footer>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getMediaUri(webview: vscode.Webview, fileName: string): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', fileName));
  }
}