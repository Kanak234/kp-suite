/**
 * Vyapaka Commands
 * 
 * Registers all extension commands.
 */

import * as vscode from 'vscode';
import { VyapakaExtensionContext } from '../extension';

export function registerCommands(ctx: VyapakaExtensionContext): void {
  const { subscriptions, logger, detector, reportGenerator, webviewProvider, treeViewProvider } = ctx;

  // Diagnose command
  subscriptions.push(
    vscode.commands.registerCommand('vyapaka.diagnose', async () => {
      logger.info('Running diagnose command');
      try {
        const toolchains = await detector.detectAll();
        treeViewProvider.updateToolchains(toolchains);
        webviewProvider.updateToolchains(toolchains);

        const working = toolchains.filter((t) => t.status === 'working').length;
        const missing = toolchains.filter((t) => t.status === 'missing').length;
        const warning = toolchains.filter((t) => t.status === 'warning').length;

        vscode.window.showInformationMessage(
          `Vyapaka: ${working} working, ${warning} warnings, ${missing} missing`
        );
      } catch (error) {
        logger.error('Diagnose failed', { error: error instanceof Error ? error.message : String(error) });
        vscode.window.showErrorMessage(`Diagnosis failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Open Dashboard command
  subscriptions.push(
    vscode.commands.registerCommand('vyapaka.openDashboard', async () => {
      logger.info('Opening dashboard');
      await vscode.commands.executeCommand('workbench.view.extension.vyapaka');
      // Also reveal the webview
      await vscode.commands.executeCommand('vyapaka.dashboard.focus');
    })
  );

  // Generate Report command
  subscriptions.push(
    vscode.commands.registerCommand('vyapaka.generateReport', async () => {
      logger.info('Generating diagnostic report');
      try {
        const toolchains = await detector.detectAll();
        const pkg = require('../../package.json');
        const report = await reportGenerator.generate(toolchains, pkg.version);
        const path = await reportGenerator.saveReport(report);

        if (path) {
          vscode.window.showInformationMessage(`Diagnostic report saved to ${path}`, 'Open').then((selection) => {
            if (selection === 'Open') {
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path));
            }
          });
        }
      } catch (error) {
        logger.error('Report generation failed', { error: error instanceof Error ? error.message : String(error) });
        vscode.window.showErrorMessage(`Report generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Show Toolchain Details command
  subscriptions.push(
    vscode.commands.registerCommand('vyapaka.showToolchainDetails', (toolchain: import('@kanak-prabhakar/shared/types').ToolchainInfo) => {
      const fix = toolchain.fixRecommendation;
      let message = `**${toolchain.displayName}**\n\n`;
      message += `Status: ${toolchain.status}\n`;
      if (toolchain.version) message += `Version: ${toolchain.version}\n`;
      if (toolchain.path) message += `Path: ${toolchain.path}\n`;
      message += `\n${toolchain.details}`;

      if (fix) {
        message += `\n\n**Fix Recommendation:**\n`;
        message += `• What: ${fix.what}\n`;
        message += `• Why: ${fix.why}\n`;
        message += `• How: ${fix.how}`;
      }

      vscode.window.showInformationMessage(message, { modal: true });
    })
  );

}