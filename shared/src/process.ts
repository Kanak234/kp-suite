/**
 * @kanak-prabhakar/shared — process
 *
 * A safe child-process executor used by the code-runner extension. It runs a
 * command to completion and returns captured output, enforcing a timeout, an
 * output-size cap, and a concurrency limit, and validating its inputs before
 * spawning. Cancellation is cooperative via AbortController.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type {
  Logger, ProcessOptions, ProcessResult, ExecutorLimits, UserFacingError
} from './types';

interface ProcessTracker {
  pid: number;
  startTime: number;
  abortController: AbortController;
  command: string;
  args: string[];
}

const DEFAULTS: Required<ExecutorLimits> = {
  maxConcurrent: 3,
  defaultTimeoutMs: 30000,
  maxOutputMB: 10
};

export class ProcessExecutor extends EventEmitter {
  private readonly limits: Required<ExecutorLimits>;
  private readonly logger: Logger;
  private readonly activeProcesses = new Map<number, ProcessTracker>();

  constructor(limits: ExecutorLimits, logger: Logger) {
    super();
    this.limits = {
      maxConcurrent: limits.maxConcurrent ?? DEFAULTS.maxConcurrent,
      defaultTimeoutMs: limits.defaultTimeoutMs ?? DEFAULTS.defaultTimeoutMs,
      maxOutputMB: limits.maxOutputMB ?? DEFAULTS.maxOutputMB
    };
    this.logger = logger;
  }

  /** Number of processes currently running under this executor. */
  get activeCount(): number { return this.activeProcesses.size; }

  async execute(options: ProcessOptions): Promise<ProcessResult> {
    const startTime = Date.now();
    const timeout = options.timeout ?? this.limits.defaultTimeoutMs;
    const maxOutputSize = (options.maxOutputSize ?? this.limits.maxOutputMB) * 1024 * 1024;

    this.validateCommand(options.command);
    this.validateArgs(options.args);
    this.validateCwd(options.cwd);
    this.validateEnv(options.env);

    if (this.activeProcesses.size >= this.limits.maxConcurrent) {
      throw this.createError(
        'PROCESS_LIMIT_EXCEEDED',
        `Maximum concurrent processes (${this.limits.maxConcurrent}) reached`,
        'Wait for running processes to complete or cancel them',
        false
      );
    }

    const abortController = new AbortController();
    let childProcess: ChildProcess | null = null;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    let exitCode: number | null = null;

    try {
      childProcess = this.spawnProcess(options, abortController.signal);
      const pid = childProcess.pid ?? -1;
      const tracker: ProcessTracker = {
        pid, startTime, abortController,
        command: options.command, args: options.args ?? []
      };
      this.activeProcesses.set(pid, tracker);
      this.emit('process-start', { pid, command: options.command });

      const stdoutPromise = this.captureStream(childProcess.stdout, maxOutputSize);
      const stderrPromise = this.captureStream(childProcess.stderr, maxOutputSize);

      // A timeout that aborts the process, but does not itself gate completion:
      // if the process exits first we clear it, so a normal run never waits on it.
      let timeoutHandle: NodeJS.Timeout | undefined;
      const armTimeout = () => {
        timeoutHandle = setTimeout(() => abortController.abort(), timeout);
        if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref();
      };
      armTimeout();

      if (options.stdin && childProcess.stdin) {
        childProcess.stdin.write(options.stdin);
        childProcess.stdin.end();
      }

      const exitCodePromise = this.waitForExit(childProcess);
      const [stdoutResult, stderrResult, exitCodeResult] = await Promise.all([
        stdoutPromise, stderrPromise, exitCodePromise
      ]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      stdout = stdoutResult;
      stderr = stderrResult;
      exitCode = exitCodeResult;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        timedOut = true;
        killed = true;
        this.logger.warn(`Process timed out after ${timeout}ms`, { command: options.command });
      } else if (error && typeof error === 'object' && 'userFacing' in error) {
        throw error;
      } else {
        this.logger.error('Process execution failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw this.createError(
          'EXECUTION_FAILED', 'Process execution failed',
          'Check command validity and try again', false,
          error instanceof Error ? error : undefined
        );
      }
    } finally {
      if (childProcess?.pid) {
        this.activeProcesses.delete(childProcess.pid);
        this.emit('process-end', { pid: childProcess.pid, exitCode });
      }
    }

    const duration = Date.now() - startTime;
    return {
      exitCode,
      stdout: stdout.slice(0, maxOutputSize),
      stderr: stderr.slice(0, maxOutputSize),
      timedOut, killed, duration
    };
  }

  /** Cancel one running process by PID. Returns false if not found. */
  cancel(pid: number): boolean {
    const tracker = this.activeProcesses.get(pid);
    if (!tracker) return false;
    tracker.abortController.abort();
    return true;
  }

  /** Cancel every running process. Returns how many were cancelled. */
  cancelAll(): number {
    let count = 0;
    for (const [, tracker] of this.activeProcesses) {
      tracker.abortController.abort();
      count++;
    }
    return count;
  }

  /* ── internals ─────────────────────────────────────────────── */

  private spawnProcess(options: ProcessOptions, signal: AbortSignal): ChildProcess {
    const env = options.env ? { ...process.env, ...options.env } : process.env;
    return spawn(options.command, options.args ?? [], {
      cwd: options.cwd,
      env,
      signal,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }

  private captureStream(
    stream: NodeJS.ReadableStream | null,
    maxSize: number
  ): Promise<string> {
    return new Promise((resolve) => {
      if (!stream) { resolve(''); return; }
      let data = '';
      let capped = false;
      stream.on('data', (chunk: Buffer) => {
        if (capped) return;
        data += chunk.toString();
        if (data.length >= maxSize) { data = data.slice(0, maxSize); capped = true; }
      });
      stream.on('end', () => resolve(data));
      stream.on('error', () => resolve(data));
    });
  }

  private waitForExit(child: ChildProcess): Promise<number | null> {
    return new Promise((resolve, reject) => {
      let settled = false;
      child.on('exit', (code) => { if (!settled) { settled = true; resolve(code); } });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        // A killed/aborted process surfaces here; propagate so execute() can
        // classify it as a timeout rather than a hard failure.
        reject(err);
      });
    });
  }

  private validateCommand(command: unknown): void {
    if (typeof command !== 'string' || command.trim() === '') {
      throw this.createError('INVALID_COMMAND', 'Command must be a non-empty string',
        'Provide a valid command name or path', false);
    }
  }

  private validateArgs(args: unknown): void {
    if (args === undefined) return;
    if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) {
      throw this.createError('INVALID_ARGS', 'Arguments must be an array of strings',
        'Pass args as string[]', false);
    }
  }

  private validateCwd(cwd: unknown): void {
    if (cwd === undefined) return;
    if (typeof cwd !== 'string' || cwd.trim() === '') {
      throw this.createError('INVALID_CWD', 'Working directory must be a non-empty string',
        'Provide a valid directory path', false);
    }
  }

  private validateEnv(env: unknown): void {
    if (env === undefined) return;
    if (typeof env !== 'object' || env === null) {
      throw this.createError('INVALID_ENV', 'Environment must be an object',
        'Pass env as Record<string,string>', false);
    }
  }

  private createError(
    code: string, message: string, remedy: string,
    recoverable: boolean, cause?: Error
  ): UserFacingError {
    const err = new Error(message) as UserFacingError;
    err.code = code;
    err.remedy = remedy;
    err.userFacing = true;
    err.recoverable = recoverable;
    if (cause) err.cause = cause;
    return err;
  }
}
