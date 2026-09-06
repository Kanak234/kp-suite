/**
 * Kriyasala Commands
 */

import * as vscode from 'vscode';
import { KriyasalaExtensionContext } from '../extension';

export function registerCommands(ctx: KriyasalaExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('kriyasala.execute', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active text editor found to execute');
        return;
      }

      await editor.document.save();
      const filePath = editor.document.uri.fsPath;

      ctx.logger.info(`Running execution command for: ${filePath}`);
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Executing ${vscode.workspace.asRelativePath(filePath)}...`,
          cancellable: true,
        },
        async (_progress, _token) => {
          try {
            const result = await ctx.executor.executeFile({ filePath });
            ctx.treeViewProvider.addRecord({
              id: String(Date.now()),
              file: vscode.workspace.asRelativePath(filePath),
              timestamp: new Date(),
              result,
            });
            ctx.webviewProvider.updateExecutionResult(result);

            if (result.exitCode === 0) {
              vscode.window.showInformationMessage(`Execution succeeded (${result.duration}ms)`);
            } else {
              vscode.window.showErrorMessage(`Execution failed with exit code ${result.exitCode}`);
            }
          } catch (err) {
            vscode.window.showErrorMessage(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      );
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('kriyasala.stopExecution', () => {
      ctx.executor.stop();
      vscode.window.showInformationMessage('Execution stopped');
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('kriyasala.openDashboard', () => {
      vscode.commands.executeCommand('workbench.view.extension.kriyasala');
      vscode.commands.executeCommand('kriyasala.dashboard.focus');
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('kriyasala.restartExecution', () => {
      vscode.commands.executeCommand('kriyasala.execute');
    })
  );
}
