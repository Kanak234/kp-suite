import * as vscode from 'vscode';
import { Logger } from '@kanak-prabhakar/shared/types';
import { minimatch } from 'minimatch';

/** One classified file: how policy sees the path currently open. */
export interface FileVerdict {
  relativePath: string;
  status: 'locked' | 'warning' | 'open';
  matchedPattern?: string;
}

/**
 * Enforces workspace governance:
 *  - locked files cannot be edited. In strict mode an edit is undone
 *    immediately (the buffer is reverted); otherwise the user is warned.
 *  - warning files raise a prompt when saved.
 *
 * All matching is glob-based against the workspace-relative path.
 */
export class PolicyEnforcer {
  private readonly logger: Logger;
  private enabled = true;
  private strictMode = false;
  private lockedPatterns: string[] = [];
  private warningPatterns: string[] = [];

  /** Paths we are mid-revert on, so our own undo edit doesn't re-trigger us. */
  private reverting = new Set<string>();
  /** Debounce so we warn about a locked file at most once per burst of edits. */
  private recentlyWarned = new Map<string, number>();

  private statusBar: vscode.StatusBarItem | undefined;

  constructor(logger: Logger) {
    this.logger = logger;
    this.loadConfig();
  }

  private loadConfig(): void {
    const config = vscode.workspace.getConfiguration('adhikarana');
    this.enabled = config.get<boolean>('enabled') ?? true;
    this.strictMode = config.get<boolean>('strictMode') ?? false;
    this.lockedPatterns = config.get<string[]>('lockedFiles') ?? [];
    this.warningPatterns = config.get<string[]>('warningFiles') ?? [];
    this.logger.info(
      `Config: enabled=${this.enabled} strict=${this.strictMode} ` +
      `locked=${this.lockedPatterns.length} warning=${this.warningPatterns.length}`
    );
    this.refreshStatusBar();
  }

  public register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('adhikarana')) this.loadConfig();
      }),
      vscode.workspace.onDidChangeTextDocument(e => this.handleDocumentChange(e)),
      vscode.workspace.onWillSaveTextDocument(e => this.handleWillSave(e)),
      vscode.window.onDidChangeActiveTextEditor(() => this.refreshStatusBar())
    );

    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBar.command = 'adhikarana.checkPermissions';
    context.subscriptions.push(this.statusBar);
    this.refreshStatusBar();
  }

  /* -- classification -- */

  private matchFirst(relativePath: string, patterns: string[]): string | undefined {
    for (const p of patterns) {
      if (minimatch(relativePath, p)) return p;
    }
    return undefined;
  }

  /** Classify a path against the current policy. */
  public classify(uri: vscode.Uri): FileVerdict {
    const relativePath = vscode.workspace.asRelativePath(uri);
    if (!this.enabled) return { relativePath, status: 'open' };

    const lockedBy = this.matchFirst(relativePath, this.lockedPatterns);
    if (lockedBy) return { relativePath, status: 'locked', matchedPattern: lockedBy };

    const warnBy = this.matchFirst(relativePath, this.warningPatterns);
    if (warnBy) return { relativePath, status: 'warning', matchedPattern: warnBy };

    return { relativePath, status: 'open' };
  }

  /* -- enforcement -- */

  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.enabled) return;
    if (event.contentChanges.length === 0) return;

    const uri = event.document.uri;
    if (uri.scheme !== 'file') return;

    const key = uri.toString();
    if (this.reverting.has(key)) return; // our own undo -- ignore

    const verdict = this.classify(uri);
    if (verdict.status !== 'locked') return;

    if (this.strictMode) {
      this.revert(uri, verdict.relativePath);
    } else {
      this.warnOnce(verdict.relativePath);
    }
  }

  private revert(uri: vscode.Uri, relativePath: string): void {
    const key = uri.toString();
    this.reverting.add(key);
    vscode.commands.executeCommand('workbench.action.files.revert').then(
      () => {
        this.logger.warn(`Reverted edit on locked file: ${relativePath}`);
        vscode.window.showErrorMessage(
          `Adhikarana: ${relativePath} is locked by project policy -- your change was undone.`
        );
        setTimeout(() => this.reverting.delete(key), 50);
      },
      () => { this.reverting.delete(key); }
    );
  }

  private warnOnce(relativePath: string): void {
    const now = Date.now();
    const last = this.recentlyWarned.get(relativePath) ?? 0;
    if (now - last < 3000) return;
    this.recentlyWarned.set(relativePath, now);
    this.logger.warn(`Edit on locked file (soft mode): ${relativePath}`);
    vscode.window.showWarningMessage(
      `Adhikarana: ${relativePath} is governed and locked. Enable strictMode to block edits automatically.`
    );
  }

  private handleWillSave(event: vscode.TextDocumentWillSaveEvent): void {
    if (!this.enabled) return;
    const uri = event.document.uri;
    if (uri.scheme !== 'file') return;

    const verdict = this.classify(uri);
    if (verdict.status === 'warning') {
      this.logger.info(`Warning on save: ${verdict.relativePath}`);
      vscode.window.showWarningMessage(
        `Adhikarana: saving ${verdict.relativePath} -- flagged for review under project governance.`
      );
    }
  }

  /* -- status bar -- */

  private refreshStatusBar(): void {
    if (!this.statusBar) return;
    const editor = vscode.window.activeTextEditor;
    if (!this.enabled) {
      this.statusBar.text = '$(unlock) Governance off';
      this.statusBar.tooltip = 'Adhikarana is disabled';
      this.statusBar.show();
      return;
    }
    if (!editor || editor.document.uri.scheme !== 'file') {
      this.statusBar.hide();
      return;
    }
    const verdict = this.classify(editor.document.uri);
    switch (verdict.status) {
      case 'locked':
        this.statusBar.text = '$(lock) Locked';
        this.statusBar.tooltip =
          `Locked by policy (${verdict.matchedPattern}). ` +
          (this.strictMode ? 'Edits are reverted.' : 'Edits are warned.');
        this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'warning':
        this.statusBar.text = '$(warning) Review';
        this.statusBar.tooltip = `Flagged for review on save (${verdict.matchedPattern}).`;
        this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      default:
        this.statusBar.text = '$(shield) Governed';
        this.statusBar.tooltip = 'Adhikarana governance is active. This file is editable.';
        this.statusBar.backgroundColor = undefined;
    }
    this.statusBar.show();
  }

  /* -- used by commands -- */

  /** A snapshot for the permission check / dashboard. */
  public snapshot(): {
    enabled: boolean;
    strictMode: boolean;
    lockedPatterns: string[];
    warningPatterns: string[];
    active?: FileVerdict;
  } {
    const editor = vscode.window.activeTextEditor;
    return {
      enabled: this.enabled,
      strictMode: this.strictMode,
      lockedPatterns: this.lockedPatterns,
      warningPatterns: this.warningPatterns,
      active: editor && editor.document.uri.scheme === 'file'
        ? this.classify(editor.document.uri)
        : undefined
    };
  }
}
