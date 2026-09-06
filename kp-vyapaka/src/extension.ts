/**
 * Vyapaka — Environment Doctor
 * 
 * Main extension entry point for the VS Code extension.
 * Provides comprehensive development environment diagnostics.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '@kanak-prabhakar/shared/types';
import { createOutputChannelLogger, logError } from '@kanak-prabhakar/shared/logging';
import { ConfigValidator, createCommonSchema } from '@kanak-prabhakar/shared/config';
import { ToolchainDetector } from './diagnostics/toolchain-detector';
import { DiagnosticReportGenerator } from './diagnostics/report-generator';
import { VyapakaWebviewProvider } from './webview/webview-provider';
import { VyapakaTreeViewProvider } from './views/tree-view-provider';
import { registerCommands } from './commands';

export interface VyapakaExtensionContext {
  subscriptions: vscode.Disposable[];
  logger: Logger;
  config: ConfigValidator;
  detector: ToolchainDetector;
  reportGenerator: DiagnosticReportGenerator;
  webviewProvider: VyapakaWebviewProvider;
  treeViewProvider: VyapakaTreeViewProvider;
}

let extensionContext: VyapakaExtensionContext | null = null;

/**
 * Activate the extension
 */
export async function activate(context: vscode.ExtensionContext): Promise<VyapakaExtensionContext | undefined> {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Vyapaka');
  const logger = createOutputChannelLogger('vyapaka', outputChannel);

  logger.info('Activating Vyapaka — Environment Doctor');

  try {
    // Load configuration
    const configSchema = createCommonSchema({
      autoDiagnoseOnStartup: { type: 'boolean', default: true, description: 'Auto-run diagnostics on startup' },
      checkInterval: { type: 'number', default: 3600000, minimum: 60000, description: 'Periodic check interval (ms)' },
      customToolchains: { type: 'array', default: [], description: 'Custom toolchain definitions' },
    });

    const config = new ConfigValidator({
      schema: configSchema,
      configPath: context.globalStorageUri ? path.join(context.globalStorageUri.fsPath, 'config.json') : undefined,
      logger,
    });

    await config.load();

    // Initialize core components
    const detector = new ToolchainDetector({
      customToolchains: (config.get('customToolchains') as any) ?? [],
      logger,
    });

    const reportGenerator = new DiagnosticReportGenerator();
    const webviewProvider = new VyapakaWebviewProvider(context.extensionUri, logger);
    const treeViewProvider = new VyapakaTreeViewProvider(detector, logger);

    // Register tree view
    const treeView = vscode.window.createTreeView('vyapaka.toolchainView', {
      treeDataProvider: treeViewProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Register webview
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('vyapaka.dashboard', webviewProvider)
    );

    // Store context globally
    extensionContext = {
      subscriptions: context.subscriptions,
      logger,
      config,
      detector,
      reportGenerator,
      webviewProvider,
      treeViewProvider,
    };

    // Register commands
    registerCommands(extensionContext);

    // Auto-diagnose on startup if enabled
    if (config.get('autoDiagnoseOnStartup')) {
      const currentCtx = extensionContext;
      setTimeout(() => {
        if (currentCtx) runDiagnostics(currentCtx);
      }, 1000);
    }

    // Periodic diagnostics
    const interval = config.get('checkInterval') as number;
    if (interval > 0) {
      const timer = setInterval(() => {
        if (extensionContext) runDiagnostics(extensionContext);
      }, interval);
      context.subscriptions.push({ dispose: () => clearInterval(timer) });
    }

    // Update tree view when workspace folders change
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        treeViewProvider.refresh();
      })
    );

    logger.info('Vyapaka activated successfully');
    return extensionContext;
  } catch (error) {
    logError(logger, error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage(`Vyapaka failed to activate: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Vyapaka activation failed:', error);
    return undefined;
  }
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  if (extensionContext) {
    extensionContext.logger.info('Deactivating Vyapaka');
    extensionContext = null;
  }
}

/**
 * Run diagnostics and update views
 */
async function runDiagnostics(ctx: VyapakaExtensionContext): Promise<void> {
  ctx.logger.info('Running environment diagnostics');
  try {
    const toolchains = await ctx.detector.detectAll();
    ctx.treeViewProvider.updateToolchains(toolchains);
    ctx.webviewProvider.updateToolchains(toolchains);

    // Show summary notification
    const working = toolchains.filter((t) => t.status === 'working').length;
    const missing = toolchains.filter((t) => t.status === 'missing').length;
    const warning = toolchains.filter((t) => t.status === 'warning').length;

    if (missing > 0) {
      vscode.window.showWarningMessage(
        `Vyapaka: ${missing} toolchain(s) missing, ${working} working`,
        'Open Dashboard'
      ).then((selection) => {
        if (selection === 'Open Dashboard') {
          vscode.commands.executeCommand('vyapaka.openDashboard');
        }
      });
    } else {
      ctx.logger.info(`Diagnostics complete: ${working} working, ${warning} warnings`);
    }
  } catch (error) {
    logError(ctx.logger, error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage(`Diagnostics failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}