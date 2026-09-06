/**
 * Kriyasala — Code Execution Lab
 * 
 * Main extension entry point for the VS Code extension.
 * Provides a graphical code execution environment for CS students.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '@kanak-prabhakar/shared/types';
import { createOutputChannelLogger, logError } from '@kanak-prabhakar/shared/logging';
import { ConfigValidator, createCommonSchema } from '@kanak-prabhakar/shared/config';
import { CodeExecutor } from './execution/executor';
import { KriyasalaWebviewProvider } from './webview/webview-provider';
import { KriyasalaTreeViewProvider } from './views/tree-view-provider';
import { registerCommands } from './commands';

export interface KriyasalaExtensionContext {
  subscriptions: vscode.Disposable[];
  logger: Logger;
  config: ConfigValidator;
  executor: CodeExecutor;
  webviewProvider: KriyasalaWebviewProvider;
  treeViewProvider: KriyasalaTreeViewProvider;
}

let extensionContext: KriyasalaExtensionContext | null = null;

/**
 * Activate the extension
 */
export async function activate(context: vscode.ExtensionContext): Promise<KriyasalaExtensionContext | undefined> {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Kriyasala');
  const logger = createOutputChannelLogger('kriyasala', outputChannel);

  logger.info('Activating Kriyasala — Code Execution Lab');

  try {
    // Load configuration
    const configSchema = createCommonSchema({
      autoExecuteOnStartup: { type: 'boolean', default: false, description: 'Auto-run test on startup' },
      defaultTimeout: { type: 'number', default: 30000, minimum: 1000, description: 'Default execution timeout (ms)' },
      maxOutputSize: { type: 'number', default: 10485760, description: 'Maximum output size (bytes)' },
    });

    const config = new ConfigValidator({
      schema: configSchema,
      configPath: context.globalStorageUri ? path.join(context.globalStorageUri.fsPath, 'config.json') : undefined,
      logger,
    });

    await config.load();

    const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    const executor = new CodeExecutor(workspaceRoots.length > 0 ? workspaceRoots : [process.cwd()], logger);
    const webviewProvider = new KriyasalaWebviewProvider(context.extensionUri, logger);
    const treeViewProvider = new KriyasalaTreeViewProvider(logger);

    // Register tree view
    const treeView = vscode.window.createTreeView('kriyasala.executionView', {
      treeDataProvider: treeViewProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Register webview
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('kriyasala.dashboard', webviewProvider)
    );

    // Store context globally
    extensionContext = {
      subscriptions: context.subscriptions,
      logger,
      config,
      executor,
      webviewProvider,
      treeViewProvider,
    };

    // Register commands
    registerCommands(extensionContext);

    logger.info('Kriyasala activated successfully');
    return extensionContext;
  } catch (error) {
    logError(logger, error instanceof Error ? error : new Error(String(error)));
    vscode.window.showErrorMessage(`Kriyasala failed to activate: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  if (extensionContext) {
    extensionContext.logger.info('Deactivating Kriyasala');
    extensionContext = null;
  }
}