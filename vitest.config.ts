/// <reference types="vitest" />

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('./jest.setup.ts', import.meta.url))],
    include: ['src/**/*.{spec,test}.ts'],
    reporters: ['default', 'verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      reportsDirectory: './coverage',
    },
  },
});
