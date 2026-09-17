import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'index.ts'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.ts',
        'test_*.ts',
        'screenInfo.ts',
        'nutjs/',
        'scripts/',
        'package/',
        'docs/',
        'assets/',
        'dist/',
        'coverage/'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 70,
        statements: 90
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
