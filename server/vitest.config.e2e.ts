import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://app:app@localhost:5432/app',
    },
  },
});
