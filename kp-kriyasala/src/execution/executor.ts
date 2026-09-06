/**
 * Kriyasala Code Execution Engine
 * 
 * Executes code files across supported languages (C, C++, Java, Python, JS, TS)
 * using ProcessExecutor from @kanak-prabhakar/shared.
 */

import * as path from 'path';
import { ProcessExecutor } from '@kanak-prabhakar/shared/process';
import { Logger, ProcessResult } from '@kanak-prabhakar/shared/types';

export interface ExecutionOptions {
  filePath: string;
  timeout?: number;
  args?: string[];
}

export class CodeExecutor {
  private readonly processExecutor: ProcessExecutor;
  private readonly logger: Logger;

  constructor(_workspaceRoots: string[], logger: Logger) {
    this.logger = logger;
    this.processExecutor = new ProcessExecutor(
      {
        maxConcurrent: 3,
        defaultTimeoutMs: 30000,
      },
      logger
    );
  }

  async executeFile(options: ExecutionOptions): Promise<ProcessResult> {
    const { filePath, timeout = 30000 } = options;
    this.logger.info(`Executing file: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);
    const fileNameWithoutExt = path.basename(filePath, ext);
    const args = options.args ?? [];

    let result: ProcessResult;

    switch (ext) {
      case '.py':
        result = await this.processExecutor.execute({ command: 'python3', args: [filePath, ...args], cwd: dir, timeout });
        break;
      case '.js':
        result = await this.processExecutor.execute({ command: 'node', args: [filePath, ...args], cwd: dir, timeout });
        break;
      case '.ts':
        result = await this.processExecutor.execute({ command: 'ts-node', args: [filePath, ...args], cwd: dir, timeout });
        break;
      case '.c': {
        const outBinary = path.join(dir, `${fileNameWithoutExt}.out`);
        const compileResult = await this.processExecutor.execute({ command: 'gcc', args: [filePath, '-o', outBinary], cwd: dir, timeout: 15000 });
        if (compileResult.exitCode !== 0) {
          return compileResult;
        }
        result = await this.processExecutor.execute({ command: outBinary, args, cwd: dir, timeout });
        break;
      }
      case '.cpp': {
        const outBinary = path.join(dir, `${fileNameWithoutExt}.out`);
        const compileResult = await this.processExecutor.execute({ command: 'g++', args: [filePath, '-o', outBinary], cwd: dir, timeout: 15000 });
        if (compileResult.exitCode !== 0) {
          return compileResult;
        }
        result = await this.processExecutor.execute({ command: outBinary, args, cwd: dir, timeout });
        break;
      }
      case '.java': {
        const compileResult = await this.processExecutor.execute({ command: 'javac', args: [filePath], cwd: dir, timeout: 15000 });
        if (compileResult.exitCode !== 0) {
          return compileResult;
        }
        result = await this.processExecutor.execute({ command: 'java', args: ['-cp', dir, fileNameWithoutExt, ...args], cwd: dir, timeout });
        break;
      }
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }

    return result;
  }

  stop(): void {
    this.logger.info('Stopping active code executions');
    this.processExecutor.cancelAll();
  }
}
