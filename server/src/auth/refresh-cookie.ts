import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './auth.constants.js';
import type { IssuedRefreshToken } from './refresh-token.service.js';

function baseOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

export function readRefreshCookie(request: Request): string | undefined {
  const pairs = (request.headers.cookie ?? '').split(';');

  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator).trim();

    if (separator > 0 && name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }

  return undefined;
}

export function setRefreshCookie(
  response: Response,
  refreshToken: IssuedRefreshToken,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken.token, {
    ...baseOptions(secure),
    expires: refreshToken.expiresAt,
  });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE_NAME, baseOptions(secure));
}
