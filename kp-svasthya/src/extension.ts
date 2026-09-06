/**
 * Svasthya — System Health Monitor
 * 
 * Real-time CPU/memory profiling, extension diagnostic logger, and health engine.
 */

import * as vscode from 'vscode';
import { Logger } from '@kanak-prabhakar/shared/types';
import { createOutputChannelLogger, logError } from '@kanak-prabhakar/shared/logging';
import { HealthMonitor } from './monitor/health-monitor';
import { SvasthyaWebviewProvider } from './webview/webview-provider';

export interface ExtensionContextState {
  subscriptions: vscode.Disposable[];
  logger: Logger;
  monitor: HealthMonitor;
  webviewProvider: SvasthyaWebviewProvider;
}

let extensionState: ExtensionContextState | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionContextState | undefined> {
  const outputChannel = vscode.window.createOutputChannel('Svasthya');
  const logger = createOutputChannelLogger('svasthya', outputChannel);

  logger.info('Activating Svasthya — System Health Monitor');

  try {
    const monitor = new HealthMonitor(logger);
    const webviewProvider = new SvasthyaWebviewProvider(context.extensionUri, logger);

    // Register Webview
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SvasthyaWebviewProvider.viewType, webviewProvider)
    );

    // Wire up monitor to webview
    context.subscriptions.push(
      monitor.onMetricsUpdated((metrics) => {
        webviewProvider.updateMetrics(metrics);
      })
    );

    const config = vscode.workspace.getConfiguration('svasthya');
    const interval = config.get<number>('interval') ?? 5000;
    
    // Start monitor
    monitor.start(interval);
    context.subscriptions.push({ dispose: () => monitor.dispose() });

    const cmdMain = vscode.commands.registerCommand('svasthya.checkHealth', () => {
      logger.info('Executing command: svasthya.checkHealth');
      vscode.window.showInformationMessage('Svasthya Health Check requested.');
      vscode.commands.executeCommand('svasthya.dashboard.focus');
    });

    const cmdDashboard = vscode.commands.registerCommand('svasthya.openDashboard', () => {
      logger.info('Executing command: svasthya.openDashboard');
      vscode.commands.executeCommand('svasthya.dashboard.focus');
    });

    context.subscriptions.push(cmdMain, cmdDashboard);

    extensionState = {
      subscriptions: context.subscriptions,
      logger,
      monitor,
      webviewProvider
    };

    logger.info('Svasthya activated successfully');
    return extensionState;
  } catch (error) {
    logError(logger, error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage('Svasthya failed to activate');
    return undefined;
  }
}

export function deactivate(): void {
  if (extensionState) {
    extensionState.logger.info('Deactivating Svasthya');
    extensionState.monitor.stop();
    extensionState = null;
  }
}
