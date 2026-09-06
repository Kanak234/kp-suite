/**
 * @kanak-prabhakar/shared — logging
 *
 * Small logger factories. Production code logs to a VS Code output channel;
 * tests use a console or silent logger. All satisfy the Logger interface.
 */

import type { Logger } from './types';

function fmt(message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  if (meta && Object.keys(meta).length > 0) {
    let metaStr: string;
    try { metaStr = JSON.stringify(meta); } catch { metaStr = String(meta); }
    return `[${ts}] ${message} ${metaStr}`;
  }
  return `[${ts}] ${message}`;
}

/** Something we can append lines to — matches vscode.OutputChannel's shape
 *  without importing vscode here, so the shared lib stays UI-agnostic. */
export interface Appendable {
  appendLine(value: string): void;
}

/** A logger that writes to an output-channel-like sink. An optional scope name
 *  may be passed first (some call sites label their channel); it's prefixed to
 *  each line when given. */
export function createOutputChannelLogger(
  scopeOrChannel: string | Appendable,
  maybeChannel?: Appendable
): Logger {
  let channel: Appendable;
  let prefix = '';
  if (typeof scopeOrChannel === 'string') {
    prefix = '[' + scopeOrChannel + '] ';
    channel = maybeChannel as Appendable;
  } else {
    channel = scopeOrChannel;
  }
  return {
    info(message, meta) { channel.appendLine('INFO  ' + prefix + fmt(message, meta)); },
    warn(message, meta) { channel.appendLine('WARN  ' + prefix + fmt(message, meta)); },
    error(message, meta) { channel.appendLine('ERROR ' + prefix + fmt(message, meta)); },
    debug(message, meta) { channel.appendLine('DEBUG ' + prefix + fmt(message, meta)); }
  };
}

/** A logger backed by the given console (defaults to the global console). */
export function createLogger(scope = 'kp', con: Console = console): Logger {
  const tag = '[' + scope + '] ';
  return {
    info(message, meta) { con.log(tag + fmt(message, meta)); },
    warn(message, meta) { con.warn(tag + fmt(message, meta)); },
    error(message, meta) { con.error(tag + fmt(message, meta)); },
    debug(message, meta) { con.debug ? con.debug(tag + fmt(message, meta)) : con.log(tag + fmt(message, meta)); }
  };
}

/** A logger that discards everything — handy in tests. */
export function createSilentLogger(): Logger {
  const noop = () => { /* intentionally empty */ };
  return { info: noop, warn: noop, error: noop, debug: noop };
}

/** Log an error object through a logger, unwrapping message and stack. */
export function logError(logger: Logger, context: string, error: unknown): void {
  if (error instanceof Error) {
    logger.error(context + ': ' + error.message, { stack: error.stack });
  } else {
    logger.error(context + ': ' + String(error));
  }
}
