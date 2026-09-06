/**
 * Adhikarana -- Governance & Access Engine
 *
 * Workspace governance for CS projects: mark files as locked (protected from
 * edits) or warning (flagged for review on save), enforced by glob rules.
 */

import * as vscode from 'vscode';
import { Logger } from '@kanak-prabhakar/shared/types';
import { createOutputChannelLogger, logError } from '@kanak-prabhakar/shared/logging';
import { PolicyEnforcer } from './governance/policy-enforcer';

export interface ExtensionContextState {
  logger: Logger;
  enforcer: PolicyEnforcer;
}

let extensionState: ExtensionContextState | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Adhikarana');
  const logger = createOutputChannelLogger('adhikarana', outputChannel);
  logger.info('Activating Adhikarana -- Governance & Access Engine');

  try {
    const enforcer = new PolicyEnforcer(logger);
    enforcer.register(context);

    const cmdCheck = vscode.commands.registerCommand('adhikarana.checkPermissions', () => {
      logger.info('Command: adhikarana.checkPermissions');
      showPermissionReport(enforcer);
    });

    const cmdDashboard = vscode.commands.registerCommand('adhikarana.openDashboard', () => {
      logger.info('Command: adhikarana.openDashboard');
      openDashboard(context, enforcer);
    });

    context.subscriptions.push(cmdCheck, cmdDashboard, outputChannel);
    extensionState = { logger, enforcer };
    logger.info('Adhikarana activated successfully');
  } catch (error) {
    logError(logger, 'activate', error);
    vscode.window.showErrorMessage('Adhikarana failed to activate');
  }
}

export function deactivate(): void {
  if (extensionState) {
    extensionState.logger.info('Deactivating Adhikarana');
    extensionState = null;
  }
}

/** Quick-pick style report of the active file's governance status. */
function showPermissionReport(enforcer: PolicyEnforcer): void {
  const snap = enforcer.snapshot();
  if (!snap.enabled) {
    vscode.window.showInformationMessage('Adhikarana is disabled (adhikarana.enabled = false).');
    return;
  }
  const mode = snap.strictMode ? 'strict (edits reverted)' : 'soft (edits warned)';
  if (snap.active) {
    const a = snap.active;
    if (a.status === 'locked') {
      vscode.window.showErrorMessage(
        `LOCKED: ${a.relativePath} -- matched "${a.matchedPattern}". Mode: ${mode}.`
      );
    } else if (a.status === 'warning') {
      vscode.window.showWarningMessage(
        `REVIEW: ${a.relativePath} -- flagged on save by "${a.matchedPattern}".`
      );
    } else {
      vscode.window.showInformationMessage(
        `EDITABLE: ${a.relativePath} -- no policy applies. ` +
        `${snap.lockedPatterns.length} locked / ${snap.warningPatterns.length} review rules active.`
      );
    }
  } else {
    vscode.window.showInformationMessage(
      `Adhikarana active in ${mode} mode. ` +
      `${snap.lockedPatterns.length} locked rules, ${snap.warningPatterns.length} review rules. ` +
      `Open a file to see its status.`
    );
  }
}

/** A real webview dashboard listing the governance rules and current file. */
function openDashboard(context: vscode.ExtensionContext, enforcer: PolicyEnforcer): void {
  const panel = vscode.window.createWebviewPanel(
    'adhikaranaDashboard',
    'Adhikarana Governance',
    vscode.ViewColumn.One,
    { enableScripts: false, retainContextWhenHidden: true }
  );
  const render = () => { panel.webview.html = dashboardHtml(enforcer); };
  render();
  // keep it live while open
  const sub = vscode.window.onDidChangeActiveTextEditor(render);
  panel.onDidDispose(() => sub.dispose(), null, context.subscriptions);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dashboardHtml(enforcer: PolicyEnforcer): string {
  const snap = enforcer.snapshot();
  const rows = (items: string[], kind: string) =>
    items.length
      ? items.map(p => `<tr><td>${esc(p)}</td><td class="${kind}">${kind}</td></tr>`).join('')
      : `<tr><td colspan="2" class="muted">none configured</td></tr>`;

  const active = snap.active
    ? `<p>Active file: <code>${esc(snap.active.relativePath)}</code> &mdash;
       <span class="${snap.active.status}">${snap.active.status.toUpperCase()}</span>
       ${snap.active.matchedPattern ? `(matched <code>${esc(snap.active.matchedPattern)}</code>)` : ''}</p>`
    : `<p class="muted">No file open.</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); padding: 1rem 1.4rem; color: var(--vscode-foreground); }
  h1 { font-size: 1.3rem; } h2 { font-size: 1rem; margin-top: 1.4rem; }
  table { border-collapse: collapse; width: 100%; margin-top: .4rem; }
  td { padding: .35rem .6rem; border-bottom: 1px solid var(--vscode-panel-border); font-size: .9rem; }
  code { background: var(--vscode-textCodeBlock-background); padding: 0 .3rem; border-radius: 3px; }
  .locked { color: #e5534b; font-weight: 600; } .warning { color: #d3a740; font-weight: 600; }
  .open { color: #57ab5a; font-weight: 600; } .muted { opacity: .6; }
  .badge { display:inline-block; padding:.15rem .5rem; border-radius: 10px; font-size:.8rem;
           background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
</style></head><body>
  <h1>Adhikarana &mdash; Workspace Governance</h1>
  <p>Status: <span class="badge">${snap.enabled ? 'ENABLED' : 'DISABLED'}</span>
     Enforcement: <span class="badge">${snap.strictMode ? 'STRICT (revert edits)' : 'SOFT (warn only)'}</span></p>
  ${active}
  <h2>Locked files (${snap.lockedPatterns.length})</h2>
  <table>${rows(snap.lockedPatterns, 'locked')}</table>
  <h2>Review-on-save files (${snap.warningPatterns.length})</h2>
  <table>${rows(snap.warningPatterns, 'warning')}</table>
  <h2>How to change these</h2>
  <p class="muted">Edit <code>adhikarana.lockedFiles</code>, <code>adhikarana.warningFiles</code>,
     and <code>adhikarana.strictMode</code> in your workspace settings. Changes apply immediately.</p>
</body></html>`;
}
