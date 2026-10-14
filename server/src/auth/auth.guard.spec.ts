import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard.js';

const SECRET = 'unit-test-secret-of-at-least-32-chars';
const USER_ID = '0199d8a0-0000-7000-8000-000000000001';

function createContext(authorization?: string, isPublic = false) {
  const request: Record<string, unknown> = { headers: { authorization } };
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { request, reflector, context };
}

describe('AuthGuard', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 900 },
    verifyOptions: { algorithms: ['HS256'] },
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a public route through without a token', async () => {
    const { reflector, context } = createContext(undefined, true);

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).resolves.toBe(true);
  });

  it('rejects a protected route without a token', async () => {
    const { reflector, context } = createContext();

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a scheme other than Bearer', async () => {
    const { reflector, context } = createContext('Basic abc');

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the user of a valid token to the request', async () => {
    const token = await jwt.signAsync({ sub: USER_ID, role: 'MANAGER' });
    const { request, reflector, context } = createContext(`Bearer ${token}`);

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).resolves.toBe(true);
    expect(request.user).toEqual({ id: USER_ID, role: 'MANAGER' });
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-of-at-least-32-characters',
    }).signAsync({ sub: USER_ID, role: 'ADMIN' });
    const { reflector, context } = createContext(`Bearer ${forged}`);

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T08:00:00.000Z'));
    const token = await jwt.signAsync({ sub: USER_ID, role: 'EMPLOYEE' });
    const { reflector, context } = createContext(`Bearer ${token}`);

    vi.setSystemTime(new Date('2026-10-13T08:15:01.000Z'));

    await expect(
      new AuthGuard(reflector, jwt).canActivate(context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
