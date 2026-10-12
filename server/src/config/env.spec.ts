import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies defaults and parses the allowed origins', () => {
    const env = validateEnv({
      CORS_ORIGIN: 'http://localhost:3000, https://app.example.com',
    });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGIN: ['http://localhost:3000', 'https://app.example.com'],
    });
  });

  it('converts PORT to a number', () => {
    const env = validateEnv({
      PORT: '8080',
      CORS_ORIGIN: 'http://localhost:3000',
    });

    expect(env.PORT).toBe(8080);
  });

  it('throws when a required variable is missing', () => {
    expect(() => validateEnv({})).toThrow(/CORS_ORIGIN/);
  });

  it('throws when a variable has an invalid value', () => {
    expect(() =>
      validateEnv({ PORT: 'abc', CORS_ORIGIN: 'http://localhost:3000' }),
    ).toThrow(/PORT/);
  });

  it('throws when an origin is not a URL', () => {
    expect(() => validateEnv({ CORS_ORIGIN: 'localhost' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  it('throws when NODE_ENV is unknown', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'staging',
        CORS_ORIGIN: 'http://localhost:3000',
      }),
    ).toThrow(/NODE_ENV/);
  });
});
