import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,       // FFmpeg and PDF ops can be slow
    hookTimeout: 10000,
    exclude: ['node_modules/**', 'dist/**'],
  },
});
