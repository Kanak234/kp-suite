/**
 * Kriyasala Tree View Provider
 */

import * as vscode from 'vscode';
import { Logger, ProcessResult } from '@kanak-prabhakar/shared/types';

export interface ExecutionRecord {
  id: string;
  file: string;
  timestamp: Date;
  result: ProcessResult;
}

export class KriyasalaTreeViewProvider implements vscode.TreeDataProvider<ExecutionTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ExecutionTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private records: ExecutionRecord[] = [];

  constructor(_logger?: Logger) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  addRecord(record: ExecutionRecord): void {
    this.records.unshift(record);
    this.refresh();
  }

  getTreeItem(element: ExecutionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: ExecutionTreeItem): vscode.ProviderResult<ExecutionTreeItem[]> {
    if (this.records.length === 0) {
      return [
        new ExecutionTreeItem('No recent executions', vscode.TreeItemCollapsibleState.None, 'info', 'Run a file to see execution status'),
      ];
    }

    return this.records.map(
      (r) =>
        new ExecutionTreeItem(
          r.file,
          vscode.TreeItemCollapsibleState.None,
          'record',
          `Exit Code: ${r.result.exitCode} (${r.result.duration}ms)`,
          r.result.exitCode === 0 ? 'check' : 'error'
        )
    );
  }
}

class ExecutionTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: string,
    description: string,
    iconName?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.description = description;
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}
