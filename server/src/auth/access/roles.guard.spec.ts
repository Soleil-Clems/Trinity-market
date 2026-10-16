import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import { IS_PUBLIC_KEY } from '../public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

function createContext(
  metadata: Record<string, unknown>,
  role: Role = 'EMPLOYEE',
): ExecutionContext {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
    (key) => metadata[key as string],
  );

  return {
    reflector,
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-id', role, sessionId: 's' } }),
    }),
  } as unknown as ExecutionContext & { reflector: Reflector };
}

function guardFor(context: ExecutionContext): RolesGuard {
  return new RolesGuard(
    (context as unknown as { reflector: Reflector }).reflector,
  );
}

describe('RolesGuard', () => {
  it('lets any authenticated user through when the route has no @Roles', () => {
    const context = createContext({});

    expect(guardFor(context).canActivate(context)).toBe(true);
  });

  it('lets a listed role through', () => {
    const context = createContext(
      { [ROLES_KEY]: ['MANAGER', 'ADMIN'] },
      'ADMIN',
    );

    expect(guardFor(context).canActivate(context)).toBe(true);
  });

  it('rejects a role that is not listed with a 403', () => {
    const context = createContext({ [ROLES_KEY]: ['MANAGER'] }, 'ADMIN');

    expect(() => guardFor(context).canActivate(context)).toThrow(
      ForbiddenException,
    );
  });

  it('ignores public routes', () => {
    const context = createContext({
      [IS_PUBLIC_KEY]: true,
      [ROLES_KEY]: ['ADMIN'],
    });

    expect(guardFor(context).canActivate(context)).toBe(true);
  });
});
