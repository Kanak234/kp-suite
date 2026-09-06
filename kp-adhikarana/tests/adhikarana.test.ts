import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';

describe('Adhikarana — Governance & Access Engine', () => {
  it('should have configuration settings defined', () => {
    const cfg = vscode.workspace.getConfiguration('adhikarana');
    expect(cfg).toBeDefined();
  });
});
