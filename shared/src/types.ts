/**
 * @kanak-prabhakar/shared — types
 *
 * The common type surface used across the KP student-tooling extensions
 * (vyapaka, kriyasala, svasthya). Kept dependency-free so every extension can
 * build against it in isolation.
 */

/** A minimal logger the extensions write through. Backed by a VS Code output
 *  channel in production; a no-op or console logger in tests. */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/** The result of running a child process to completion. */
export interface ProcessResult {
  /** Exit code, or null if the process was killed before exiting. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** True if the process was killed because it exceeded its timeout. */
  timedOut: boolean;
  /** True if the process was killed for any reason (timeout or cancel). */
  killed: boolean;
  /** Wall-clock duration in milliseconds. */
  duration: number;
}

/** Options for a single process execution. */
export interface ProcessOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  /** Milliseconds before the process is killed. */
  timeout?: number;
  /** Text piped to the process's stdin. */
  stdin?: string;
  /** Cap on captured output, in megabytes. */
  maxOutputSize?: number;
}

/** Concurrency and safety limits for the executor. */
export interface ExecutorLimits {
  maxConcurrent?: number;
  defaultTimeoutMs?: number;
  maxOutputMB?: number;
}

/** Whether a detected toolchain is present and usable. */
export type ToolchainStatus = 'working' | 'missing' | 'error';

/** One detected (or missing) developer tool. */
export interface ToolchainInfo {
  name: string;
  displayName: string;
  version?: string;
  path?: string;
  status: ToolchainStatus;
  category?: string;
  details?: string;
  installHint?: string;
}

/** An error the suite surfaces to the user with a remedy attached. */
export interface UserFacingError extends Error {
  code: string;
  remedy?: string;
  userFacing: true;
  recoverable: boolean;
  cause?: unknown;
}
