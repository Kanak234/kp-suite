/**
 * Vyapaka Tree View Provider
 * 
 * Provides the tree view in the Explorer sidebar showing toolchain status.
 */

import * as vscode from 'vscode';
import { ToolchainInfo, ToolchainStatus, Logger } from '@kanak-prabhakar/shared/types';
import { ToolchainDetector } from '../diagnostics/toolchain-detector';

export class VyapakaTreeViewProvider implements vscode.TreeDataProvider<ToolchainTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ToolchainTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private toolchains: ToolchainInfo[] = [];

  constructor(
    _detector?: ToolchainDetector,
    _logger?: Logger
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  updateToolchains(toolchains: ToolchainInfo[]): void {
    this.toolchains = toolchains;
    this.refresh();
  }

  getTreeItem(element: ToolchainTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ToolchainTreeItem): vscode.ProviderResult<ToolchainTreeItem[]> {
    if (!element) {
      // Root level - group by category
      return this.getCategoryItems();
    }

    // Category level - return toolchains in category
    if (element.category) {
      return this.getToolchainItems(element.category);
    }

    return [];
  }

  private getCategoryItems(): ToolchainTreeItem[] {
    const categories = new Map<string, ToolchainInfo[]>();

    for (const tool of this.toolchains) {
      const category = this.getCategory(tool.name);
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(tool);
    }

    return Array.from(categories.entries()).map(([category, tools]) => {
      const working = tools.filter((t) => t.status === 'working').length;
      const total = tools.length;
      return new ToolchainTreeItem(
        category,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category',
        `${working}/${total} working`,
        this.getCategoryIcon(category),
        category
      );
    });
  }

  private getToolchainItems(category: string): ToolchainTreeItem[] {
    return this.toolchains
      .filter((t) => this.getCategory(t.name) === category)
      .map((tool) => new ToolchainTreeItem(
        tool.displayName,
        vscode.TreeItemCollapsibleState.None,
        'toolchain',
        this.getStatusDescription(tool),
        this.getStatusIcon(tool.status),
        undefined,
        {
          command: 'vyapaka.showToolchainDetails',
          title: 'Show Details',
          arguments: [tool],
        }
      ));
  }

  private getCategory(name: ToolchainInfo['name']): string {
    const categories: Record<string, string> = {
      gcc: 'C/C++ Compilers',
      'g++': 'C/C++ Compilers',
      clang: 'C/C++ Compilers',
      'clang++': 'C/C++ Compilers',
      java: 'Java',
      javac: 'Java',
      python: 'Python',
      node: 'JavaScript/TypeScript',
      npm: 'JavaScript/TypeScript',
      git: 'Version Control',
      gdb: 'Debuggers',
      lldb: 'Debuggers',
      make: 'Build Tools',
      cmake: 'Build Tools',
      gradle: 'Build Tools',
      maven: 'Build Tools',
    };
    return categories[name] ?? 'Other';
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'C/C++ Compilers': '🔨',
      Java: '☕',
      Python: '🐍',
      'JavaScript/TypeScript': '📜',
      'Version Control': '📁',
      Debuggers: '🐛',
      'Build Tools': '⚙️',
      Other: '📦',
    };
    return icons[category] ?? '📦';
  }

  private getStatusIcon(status: ToolchainStatus): string {
    switch (status) {
      case 'working': return '✅';
      case 'warning': return '⚠️';
      case 'missing': return '❌';
      case 'unable-to-verify': return '❓';
      default: return '❓';
    }
  }

  private getStatusDescription(tool: ToolchainInfo): string {
    const parts: string[] = [];
    if (tool.version) parts.push(`v${tool.version}`);
    if (tool.path) parts.push(tool.path);
    return parts.join(' · ') || tool.details;
  }
}

class ToolchainTreeItem extends vscode.TreeItem {
  public readonly category?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: 'category' | 'toolchain',
    description: string,
    icon: string,
    category?: string,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.description = description;
    this.category = category;
    this.tooltip = `${label}: ${description}`;
    this.iconPath = new vscode.ThemeIcon(this.getThemeIcon(icon));
    if (command) this.command = command;
  }

  private getThemeIcon(emoji: string): string {
    const map: Record<string, string> = {
      '✅': 'check',
      '⚠️': 'warning',
      '❌': 'error',
      '❓': 'question',
      '🔨': 'tools',
      '☕': 'coffee',
      '🐍': 'symbol-class',
      '📜': 'symbol-namespace',
      '📁': 'repo',
      '🐛': 'bug',
      '⚙️': 'gear',
      '📦': 'package',
    };
    return map[emoji] ?? 'circle-outline';
  }
}