import type { Request, Response } from 'express';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';

const request = (cookie?: string) =>
  ({ headers: { cookie } }) as unknown as Request;

describe('readRefreshCookie', () => {
  it('returns undefined without a cookie header', () => {
    expect(readRefreshCookie(request())).toBeUndefined();
  });

  it('finds the refresh token among other cookies', () => {
    expect(
      readRefreshCookie(request('theme=dark; refresh_token=abc-123; lang=fr')),
    ).toBe('abc-123');
  });

  it('ignores a cookie whose name only ends with refresh_token', () => {
    expect(readRefreshCookie(request('x_refresh_token=abc'))).toBeUndefined();
  });
});

describe('setRefreshCookie', () => {
  it('sets an httpOnly, SameSite=Strict cookie scoped to /api/auth', () => {
    const cookie = vi.fn();
    const expiresAt = new Date('2026-10-20T08:00:00.000Z');

    setRefreshCookie(
      { cookie } as unknown as Response,
      { token: 'abc-123', expiresAt },
      true,
    );

    expect(cookie).toHaveBeenCalledWith('refresh_token', 'abc-123', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
      expires: expiresAt,
    });
  });
});

describe('clearRefreshCookie', () => {
  it('clears the cookie with the same attributes', () => {
    const clearCookie = vi.fn();

    clearRefreshCookie({ clearCookie } as unknown as Response, false);

    expect(clearCookie).toHaveBeenCalledWith('refresh_token', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api/auth',
    });
  });
});
