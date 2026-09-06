/**
 * Diagnostic Report Generator
 * 
 * Generates comprehensive diagnostic reports for the development environment.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import {
  DiagnosticReport,
  ToolchainInfo,
  WorkspaceInfo,
  ConfigurationSnapshot,
  DiagnosticError,
  PlatformInfo,
} from '@kanak-prabhakar/shared/types';

export class DiagnosticReportGenerator {
  constructor() {}

  /**
   * Generate a full diagnostic report
   */
  async generate(
    toolchains: ToolchainInfo[],
    extensionVersion: string
  ): Promise<DiagnosticReport> {
    const platform = this.getPlatformInfo();
    const workspace = this.getWorkspaceInfo();
    const configuration = await this.getConfigurationSnapshot();
    const errors = this.analyzeErrors(toolchains);

    return {
      timestamp: new Date().toISOString(),
      extensionVersion,
      vscodeVersion: vscode.version,
      platform,
      toolchains,
      workspace,
      configuration,
      errors,
    };
  }

  /**
   * Generate a markdown report for display
   */
  generateMarkdown(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('# Vyapaka Diagnostic Report');
    lines.push('');
    lines.push(`**Generated:** ${report.timestamp}`);
    lines.push(`**Extension Version:** ${report.extensionVersion}`);
    lines.push(`**VS Code Version:** ${report.vscodeVersion}`);
    lines.push('');

    // Platform
    lines.push('## Platform');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| OS | ${report.platform.os} ${report.platform.version} |`);
    lines.push(`| Architecture | ${report.platform.arch} |`);
    lines.push(`| Shell | ${report.platform.shell} |`);
    lines.push('');

    // Workspace
    lines.push('## Workspace');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Has Workspace | ${report.workspace.hasWorkspace ? 'Yes' : 'No'} |`);
    if (report.workspace.rootPath) {
      lines.push(`| Root Path | ${report.workspace.rootPath} |`);
    }
    lines.push(`| Folder Count | ${report.workspace.folderCount} |`);
    if (report.workspace.projectType) {
      lines.push(`| Project Type | ${report.workspace.projectType} |`);
    }
    lines.push('');

    // Toolchains
    lines.push('## Toolchain Status');
    lines.push('');
    lines.push(`| Status | Toolchain | Version | Path | Details |`);
    lines.push(`|--------|-----------|---------|------|---------|`);

    const statusOrder: Record<string, number> = { missing: 0, warning: 1, 'unable-to-verify': 2, working: 3 };
    const sorted = [...report.toolchains].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

    for (const tool of sorted) {
      const statusIcon = this.getStatusIcon(tool.status);
      const version = tool.version ?? 'N/A';
      const path = tool.path ?? 'Not found';
      lines.push(`| ${statusIcon} ${tool.status} | ${tool.displayName} | ${version} | ${path} | ${tool.details} |`);
    }
    lines.push('');

    // Fix Recommendations
    const missing = report.toolchains.filter((t) => t.status === 'missing' && t.fixRecommendation);
    if (missing.length > 0) {
      lines.push('## Fix Recommendations');
      lines.push('');
      for (const tool of missing) {
        const fix = tool.fixRecommendation!;
        lines.push(`### ${tool.displayName}`);
        lines.push('');
        lines.push(`**What's Wrong:** ${fix.what}`);
        lines.push('');
        lines.push(`**Why It Matters:** ${fix.why}`);
        lines.push('');
        lines.push(`**How to Fix:** ${fix.how}`);
        if (fix.links && fix.links.length > 0) {
          lines.push('');
          lines.push('**Resources:**');
          for (const link of fix.links) {
            lines.push(`- ${link}`);
          }
        }
        lines.push('');
      }
    }

    // Errors
    if (report.errors.length > 0) {
      lines.push('## Errors & Warnings');
      lines.push('');
      for (const error of report.errors) {
        lines.push(`### ${error.severity.toUpperCase()}: ${error.code}`);
        lines.push('');
        lines.push(error.message);
        if (error.source) {
          lines.push(`*Source: ${error.source}*`);
        }
        lines.push('');
      }
    }

    // Configuration
    lines.push('## Configuration');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.configuration, null, 2));
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Save report to file
   */
  async saveReport(report: DiagnosticReport, filePath?: string): Promise<string> {
    const markdown = this.generateMarkdown(report);
    const defaultPath = `vyapaka-diagnostic-${Date.now()}.md`;

    const uri = filePath
      ? vscode.Uri.file(filePath)
      : await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultPath),
          filters: { 'Markdown': ['md'], 'All Files': ['*'] },
        });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf8'));
      return uri.fsPath;
    }

    return '';
  }

  private getPlatformInfo(): PlatformInfo {
    return {
      os: os.platform(),
      arch: os.arch(),
      version: os.release(),
      shell: process.env['SHELL'] ?? process.env['ComSpec'] ?? 'unknown',
    };
  }

  private getWorkspaceInfo(): WorkspaceInfo {
    const folders = vscode.workspace.workspaceFolders ?? [];
    return {
      hasWorkspace: folders.length > 0,
      rootPath: folders[0]?.uri.fsPath,
      folderCount: folders.length,
      projectType: this.detectProjectType(folders[0]?.uri.fsPath),
    };
  }

  private detectProjectType(rootPath?: string): string | undefined {
    if (!rootPath) return undefined;

    const indicators: Record<string, string> = {
      'package.json': 'Node.js',
      'pom.xml': 'Maven (Java)',
      'build.gradle': 'Gradle (Java/Kotlin)',
      'CMakeLists.txt': 'CMake (C/C++)',
      'Makefile': 'Make (C/C++)',
      'pyproject.toml': 'Python (modern)',
      'requirements.txt': 'Python (legacy)',
      'Cargo.toml': 'Rust',
      'go.mod': 'Go',
      'composer.json': 'PHP',
      'Gemfile': 'Ruby',
    };

    for (const [file, type] of Object.entries(indicators)) {
      try {
        require('fs').accessSync(require('path').join(rootPath, file), require('fs').constants.F_OK);
        return type;
      } catch {
        // File doesn't exist
      }
    }
    return 'Unknown';
  }

  private async getConfigurationSnapshot(): Promise<ConfigurationSnapshot> {
    const config = vscode.workspace.getConfiguration('vyapaka');
    return {
      enabled: config.get('enabled'),
      autoDiagnoseOnStartup: config.get('autoDiagnoseOnStartup'),
      checkInterval: config.get('checkInterval'),
      customToolchainsCount: (config.get('customToolchains') as unknown[]).length,
    };
  }

  private analyzeErrors(toolchains: ToolchainInfo[]): DiagnosticError[] {
    const errors: DiagnosticError[] = [];

    const missing = toolchains.filter((t) => t.status === 'missing');
    if (missing.length > 0) {
      errors.push({
        code: 'TOOLCHAINS_MISSING',
        message: `${missing.length} essential toolchain(s) not found: ${missing.map((t) => t.displayName).join(', ')}`,
        severity: 'warning',
        source: 'toolchain-detector',
      });
    }

    const unable = toolchains.filter((t) => t.status === 'unable-to-verify');
    if (unable.length > 0) {
      errors.push({
        code: 'TOOLCHAINS_UNVERIFIED',
        message: `${unable.length} toolchain(s) could not be verified`,
        severity: 'info',
        source: 'toolchain-detector',
      });
    }

    return errors;
  }

  private getStatusIcon(status: ToolchainInfo['status']): string {
    switch (status) {
      case 'working': return '✅';
      case 'warning': return '⚠️';
      case 'missing': return '❌';
      case 'unable-to-verify': return '❓';
      default: return '❓';
    }
  }
}