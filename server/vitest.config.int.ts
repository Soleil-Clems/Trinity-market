import { defineConfig } from 'vitest/config';
import { testDatabase } from './test/integration/test-database.js';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/integration/**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:3000',
      JWT_SECRET: 'integration-test-secret-of-at-least-32-chars',
      APP_URL: 'http://localhost:8080',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      MAIL_FROM: 'no-reply@trinitymarket.example',
      DATABASE_URL: testDatabase().url,
    },
  },
});
