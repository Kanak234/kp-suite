/**
 * @kanak-prabhakar/shared — config
 *
 * A tiny schema-validated configuration store. Extensions declare a schema of
 * typed fields with defaults, then load values from an optional JSON file on
 * disk; anything missing or invalid falls back to the declared default. This
 * keeps a student's config file from ever breaking the extension.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from './types';

export interface FieldSchema {
  type: 'boolean' | 'number' | 'string' | 'array' | 'object';
  default: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
}

export type ConfigSchema = Record<string, FieldSchema>;

/** Build a schema from a plain field map. (Kept as a function so call sites
 *  read declaratively and so we can extend validation centrally later.) */
export function createCommonSchema(fields: ConfigSchema): ConfigSchema {
  return { ...fields };
}

export interface ConfigValidatorOptions {
  schema: ConfigSchema;
  configPath?: string;
  logger?: Logger;
}

export class ConfigValidator {
  private readonly schema: ConfigSchema;
  private readonly configPath?: string;
  private readonly logger?: Logger;
  private values: Record<string, unknown> = {};

  constructor(options: ConfigValidatorOptions) {
    this.schema = options.schema;
    this.configPath = options.configPath;
    this.logger = options.logger;
    // Start from defaults so get() is always valid, even before load().
    this.values = this.defaults();
  }

  private defaults(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.schema)) out[key] = field.default;
    return out;
  }

  /** Load and validate values from the config file, if one is set. Missing
   *  file is fine — defaults stand. A malformed file is logged and ignored. */
  async load(): Promise<void> {
    this.values = this.defaults();
    if (!this.configPath) return;
    let raw: string;
    try {
      raw = await fs.promises.readFile(this.configPath, 'utf8');
    } catch {
      this.logger?.debug?.('No config file yet; using defaults', { path: this.configPath });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.logger?.warn?.('Config file is not valid JSON; using defaults', {
        path: this.configPath, error: e instanceof Error ? e.message : String(e)
      });
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      this.logger?.warn?.('Config file is not an object; using defaults');
      return;
    }
    for (const [key, field] of Object.entries(this.schema)) {
      const candidate = (parsed as Record<string, unknown>)[key];
      if (candidate === undefined) continue;
      if (this.isValid(candidate, field)) {
        this.values[key] = candidate;
      } else {
        this.logger?.warn?.(`Config value for "${key}" is invalid; using default`, {
          got: candidate, expected: field.type
        });
      }
    }
  }

  private isValid(value: unknown, field: FieldSchema): boolean {
    switch (field.type) {
      case 'boolean': return typeof value === 'boolean';
      case 'string': return typeof value === 'string';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) return false;
        if (field.minimum !== undefined && value < field.minimum) return false;
        if (field.maximum !== undefined && value > field.maximum) return false;
        return true;
      default: return false;
    }
  }

  /** Read a validated value. Always returns something (a default at worst). */
  get<T = unknown>(key: string): T {
    return this.values[key] as T;
  }

  /** Set a value in memory (does not persist unless save() is called). */
  set(key: string, value: unknown): void {
    const field = this.schema[key];
    if (field && !this.isValid(value, field)) {
      this.logger?.warn?.(`Refusing to set invalid value for "${key}"`);
      return;
    }
    this.values[key] = value;
  }

  /** Persist the current values to the config file, if a path is set. */
  async save(): Promise<void> {
    if (!this.configPath) return;
    try {
      await fs.promises.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.promises.writeFile(this.configPath, JSON.stringify(this.values, null, 2), 'utf8');
    } catch (e) {
      this.logger?.error?.('Failed to save config', {
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  /** All current values as a snapshot. */
  all(): Record<string, unknown> {
    return { ...this.values };
  }
}
