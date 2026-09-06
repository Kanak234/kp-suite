import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      vscode: path.resolve(__dirname, '../shared/src/testing/vscode-mock.ts'),
    },
  },
});
