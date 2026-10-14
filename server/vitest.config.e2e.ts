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
      JWT_SECRET: 'e2e-test-secret-of-at-least-32-chars',
      APP_URL: 'http://localhost:8080',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      MAIL_FROM: 'no-reply@trinitymarket.example',
    },
  },
});
