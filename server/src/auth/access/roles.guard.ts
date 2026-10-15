import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

export const FORBIDDEN_MESSAGE = 'You are not allowed to access this resource';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );

    if (!roles) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();

    if (!roles.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return true;
  }
}
