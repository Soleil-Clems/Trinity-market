import { validateEnv } from './env.js';

const BASE = {
  CORS_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://app:secret@localhost:5432/app',
  JWT_SECRET: 'unit-test-secret-of-at-least-32-chars',
  APP_URL: 'http://localhost:8080',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  MAIL_FROM: 'no-reply@trinitymarket.example',
};

function without(key: keyof typeof BASE): Record<string, unknown> {
  const { [key]: _removed, ...rest } = BASE;
  return rest;
}

describe('validateEnv', () => {
  it('applies defaults and parses the allowed origins', () => {
    const env = validateEnv({
      ...BASE,
      CORS_ORIGIN: 'http://localhost:3000, https://app.example.com',
    });

    expect(env).toEqual({
      ...BASE,
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: ['http://localhost:3000', 'https://app.example.com'],
      SMTP_PORT: 1025,
    });
  });

  it('converts PORT to a number', () => {
    expect(validateEnv({ ...BASE, PORT: '8080' }).PORT).toBe(8080);
  });

  it('removes the trailing slash of APP_URL', () => {
    expect(
      validateEnv({ ...BASE, APP_URL: 'https://tm.example.com/' }).APP_URL,
    ).toBe('https://tm.example.com');
  });

  it.each([
    'CORS_ORIGIN',
    'DATABASE_URL',
    'JWT_SECRET',
    'APP_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'MAIL_FROM',
  ] as const)('throws when %s is missing', (key) => {
    expect(() => validateEnv(without(key))).toThrow(new RegExp(key));
  });

  it.each([
    ['PORT', 'abc'],
    ['CORS_ORIGIN', 'localhost'],
    ['NODE_ENV', 'staging'],
    ['DATABASE_URL', 'mysql://app:secret@localhost:3306/app'],
    ['JWT_SECRET', 'change_me'],
    ['APP_URL', 'ftp://tm.example.com'],
    ['SMTP_PORT', '70000'],
  ])('throws when %s is invalid', (key, value) => {
    expect(() => validateEnv({ ...BASE, [key]: value })).toThrow(
      new RegExp(key),
    );
  });
});
