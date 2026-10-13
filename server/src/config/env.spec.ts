import { validateEnv } from './env.js';

const DATABASE_URL = 'postgresql://app:secret@localhost:5432/app';

describe('validateEnv', () => {
  it('applies defaults and parses the allowed origins', () => {
    const env = validateEnv({
      CORS_ORIGIN: 'http://localhost:3000, https://app.example.com',
      DATABASE_URL,
    });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: ['http://localhost:3000', 'https://app.example.com'],
      DATABASE_URL,
    });
  });

  it('converts PORT to a number', () => {
    const env = validateEnv({
      PORT: '8080',
      CORS_ORIGIN: 'http://localhost:3000',
      DATABASE_URL,
    });

    expect(env.PORT).toBe(8080);
  });

  it('throws when a required variable is missing', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/CORS_ORIGIN/);
  });

  it('throws when a variable has an invalid value', () => {
    expect(() =>
      validateEnv({
        PORT: 'abc',
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL,
      }),
    ).toThrow(/PORT/);
  });

  it('throws when an origin is not a URL', () => {
    expect(() =>
      validateEnv({ CORS_ORIGIN: 'localhost', DATABASE_URL }),
    ).toThrow(/CORS_ORIGIN/);
  });

  it('throws when NODE_ENV is unknown', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'staging',
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL,
      }),
    ).toThrow(/NODE_ENV/);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ CORS_ORIGIN: 'http://localhost:3000' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws when DATABASE_URL is not a PostgreSQL URL', () => {
    expect(() =>
      validateEnv({
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: 'mysql://app:secret@localhost:3306/app',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
