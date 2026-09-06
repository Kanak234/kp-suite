/**
 * Toolchain Detector
 * 
 * Detects compilers, interpreters, build tools, and debuggers.
 * Provides detailed status and fix recommendations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  ToolchainName,
  ToolchainInfo,
  FixRecommendation,
  PlatformInfo,
  Logger,
} from '@kanak-prabhakar/shared/types';
import { createLogger } from '@kanak-prabhakar/shared/logging';

export interface DetectorOptions {
  customToolchains?: Array<{
    name: ToolchainName;
    command: string;
    versionArgs: string[];
  }>;
  timeout?: number;
  logger?: Logger;
}

export class ToolchainDetector {
  private readonly options: Required<DetectorOptions>;
  private readonly logger: Logger;
  private readonly cache: Map<ToolchainName, ToolchainInfo & { _cachedAt?: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Standard toolchain definitions
  private static readonly STANDARD_TOOLCHAINS: Array<{
    name: ToolchainName;
    displayName: string;
    commands: string[];
    versionArgs: string[];
    category: string;
    installHint: string;
  }> = [
    // C/C++ Compilers
    { name: 'gcc', displayName: 'GCC', commands: ['gcc'], versionArgs: ['--version'], category: 'C Compiler', installHint: 'Install build-essential (Linux), Xcode Command Line Tools (macOS), or MinGW/MSYS2 (Windows)' },
    { name: 'g++', displayName: 'G++', commands: ['g++'], versionArgs: ['--version'], category: 'C++ Compiler', installHint: 'Install build-essential (Linux), Xcode Command Line Tools (macOS), or MinGW/MSYS2 (Windows)' },
    { name: 'clang', displayName: 'Clang', commands: ['clang'], versionArgs: ['--version'], category: 'C Compiler', installHint: 'Install clang (Linux), Xcode Command Line Tools (macOS), or LLVM (Windows)' },
    { name: 'clang++', displayName: 'Clang++', commands: ['clang++'], versionArgs: ['--version'], category: 'C++ Compiler', installHint: 'Install clang (Linux), Xcode Command Line Tools (macOS), or LLVM (Windows)' },

    // Java
    { name: 'java', displayName: 'Java Runtime', commands: ['java'], versionArgs: ['-version'], category: 'Java Runtime', installHint: 'Install OpenJDK or Oracle JDK' },
    { name: 'javac', displayName: 'Java Compiler', commands: ['javac'], versionArgs: ['-version'], category: 'Java Compiler', installHint: 'Install OpenJDK or Oracle JDK (includes javac)' },

    // Python
    { name: 'python', displayName: 'Python 3', commands: ['python3', 'python'], versionArgs: ['--version'], category: 'Python Interpreter', installHint: 'Install Python from python.org or use package manager' },

    // Node.js
    { name: 'node', displayName: 'Node.js', commands: ['node'], versionArgs: ['--version'], category: 'JavaScript Runtime', installHint: 'Install from nodejs.org or use nvm/fnm' },
    { name: 'npm', displayName: 'npm', commands: ['npm'], versionArgs: ['--version'], category: 'Package Manager', installHint: 'Comes with Node.js' },

    // Git
    { name: 'git', displayName: 'Git', commands: ['git'], versionArgs: ['--version'], category: 'Version Control', installHint: 'Install from git-scm.com or package manager' },

    // Debuggers
    { name: 'gdb', displayName: 'GDB', commands: ['gdb'], versionArgs: ['--version'], category: 'Debugger', installHint: 'Install gdb via package manager' },
    { name: 'lldb', displayName: 'LLDB', commands: ['lldb'], versionArgs: ['--version'], category: 'Debugger', installHint: 'Install lldb via package manager or Xcode Command Line Tools' },

    // Build Tools
    { name: 'make', displayName: 'Make', commands: ['make'], versionArgs: ['--version'], category: 'Build Tool', installHint: 'Install build-essential (Linux), Xcode Command Line Tools (macOS), or MinGW/MSYS2 (Windows)' },
    { name: 'cmake', displayName: 'CMake', commands: ['cmake'], versionArgs: ['--version'], category: 'Build Tool', installHint: 'Install from cmake.org or package manager' },
    { name: 'gradle', displayName: 'Gradle', commands: ['gradle'], versionArgs: ['--version'], category: 'Build Tool', installHint: 'Install from gradle.org or use wrapper' },
    { name: 'maven', displayName: 'Maven', commands: ['mvn'], versionArgs: ['--version'], category: 'Build Tool', installHint: 'Install from maven.apache.org or package manager' },
  ];

  constructor(options: DetectorOptions = {}) {
    this.options = {
      customToolchains: options.customToolchains ?? [],
      timeout: options.timeout ?? 5000,
      logger: options.logger ?? createLogger('vyapaka:detector'),
    };
    this.logger = this.options.logger;
  }

  /**
   * Detect all standard and custom toolchains
   */
  async detectAll(): Promise<ToolchainInfo[]> {
    const results: ToolchainInfo[] = [];

    // Detect standard toolchains
    for (const def of ToolchainDetector.STANDARD_TOOLCHAINS) {
      const info = await this.detectToolchain(def);
      results.push(info);
      this.cache.set(info.name, info);
    }

    // Detect custom toolchains
    for (const custom of this.options.customToolchains) {
      const info = await this.detectCustomToolchain(custom);
      results.push(info);
      this.cache.set(info.name, info);
    }

    return results;
  }

  /**
   * Detect a specific toolchain by name
   */
  async detect(name: ToolchainName): Promise<ToolchainInfo> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached._cachedAt && Date.now() - cached._cachedAt < this.cacheTimeout) {
      return cached;
    }

    const def = ToolchainDetector.STANDARD_TOOLCHAINS.find((t) => t.name === name);
    if (def) {
      const info = await this.detectToolchain(def);
      this.cache.set(name, info);
      return info;
    }

    const custom = this.options.customToolchains.find((t) => t.name === name);
    if (custom) {
      const info = await this.detectCustomToolchain(custom);
      this.cache.set(name, info);
      return info;
    }

    return this.createMissingInfo(name, `Unknown toolchain: ${name}`);
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get platform information
   */
  getPlatformInfo(): PlatformInfo {
    const shellEnv = process.env['SHELL'] ?? process.env['ComSpec'] ?? 'unknown';
    return {
      os: process.platform,
      arch: process.arch,
      version: process.version,
      shell: shellEnv,
    };
  }

  private async detectToolchain(def: typeof ToolchainDetector.STANDARD_TOOLCHAINS[0]): Promise<ToolchainInfo> {
    for (const command of def.commands) {
      try {
        const result = await this.runCommand(command, def.versionArgs);
        if (result.success) {
          return await this.createWorkingInfo(def, command, result.output);
        }
      } catch (error) {
        this.logger.debug(`Failed to detect ${def.name} via ${command}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return this.createMissingInfo(def.name, def.installHint);
  }

  private async detectCustomToolchain(custom: { name: ToolchainName; command: string; versionArgs: string[] }): Promise<ToolchainInfo> {
    try {
      const result = await this.runCommand(custom.command, custom.versionArgs);
      if (result.success) {
        const fullPath = await this.which(custom.command);
        return {
          name: custom.name,
          displayName: custom.name,
          version: this.extractVersion(result.output),
          path: fullPath,
          status: 'working',
          details: `Found at ${fullPath}: ${result.output.trim()}`,
        };
      }
    } catch {
      // Fall through to missing
    }

    return this.createMissingInfo(custom.name, `Custom toolchain '${custom.command}' not found in PATH`);
  }

  private async runCommand(command: string, args: string[]): Promise<{ success: boolean; output: string; path: string }> {
    const fullPath = await this.which(command);
    if (!fullPath) {
      return { success: false, output: '', path: '' };
    }

    return new Promise((resolve) => {
      const child = spawn(fullPath, args, {
        timeout: this.options.timeout,
        windowsHide: true,
      });

      let output = '';
      child.stdout?.on('data', (data) => { output += data.toString(); });
      child.stderr?.on('data', (data) => { output += data.toString(); });

      child.on('close', (code) => {
        resolve({ success: code === 0, output: output.trim(), path: fullPath });
      });

      child.on('error', () => {
        resolve({ success: false, output: '', path: fullPath });
      });
    });
  }

  private async which(command: string): Promise<string | null> {
    const pathEnv = process.env['PATH'] ?? '';
    const paths = pathEnv.split(path.delimiter);
    const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

    for (const basePath of paths) {
      for (const ext of extensions) {
        const fullPath = path.join(basePath, command + ext);
        try {
          await fs.promises.access(fullPath, fs.constants.X_OK);
          return fullPath;
        } catch {
          // Not executable or doesn't exist
        }
      }
    }
    return null;
  }

  private extractVersion(output: string): string | null {
    // Common version patterns
    const patterns = [
      /(\d+\.\d+\.\d+)/,
      /version\s+(\d+\.\d+\.\d+)/i,
      /(\d+\.\d+)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  private async createWorkingInfo(def: typeof ToolchainDetector.STANDARD_TOOLCHAINS[0], command: string, output: string): Promise<ToolchainInfo> {
    const version = this.extractVersion(output);
    const foundPath = await this.which(command);
    const dirPath = foundPath ? path.dirname(foundPath) : null;
    return {
      name: def.name,
      displayName: def.displayName,
      version,
      path: dirPath,
      status: 'working',
      details: `${def.displayName} ${version ? `v${version} ` : ''}found at ${command}`,
    };
  }

  private createMissingInfo(name: ToolchainName, hint: string): ToolchainInfo {
    const fixRecommendation: FixRecommendation = {
      what: `${name} is not installed or not in PATH`,
      why: `Required for ${name} development and compilation`,
      how: hint,
    };

    return {
      name,
      displayName: name,
      version: null,
      path: null,
      status: 'missing',
      details: `${name} not found in PATH`,
      fixRecommendation,
    };
  }
}