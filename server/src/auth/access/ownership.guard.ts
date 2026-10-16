import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';
import type { AuthenticatedUser } from '../current-user.decorator.js';
import { IS_PUBLIC_KEY } from '../public.decorator.js';
import { AccessPolicyService } from './access-policy.service.js';
import { OWNERSHIP_KEY, OwnershipRule } from './ownership.decorator.js';
import { FORBIDDEN_MESSAGE } from './roles.guard.js';

const uuidSchema = z.uuid();

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AccessPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const rule = this.reflector.getAllAndOverride<OwnershipRule | undefined>(
      OWNERSHIP_KEY,
      targets,
    );

    if (!rule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: Record<string, string | undefined>;
    }>();
    const id = request.params[rule.param];

    if (
      !uuidSchema.safeParse(id).success ||
      !(await this.allows(request.user, rule, id!))
    ) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return true;
  }

  private allows(
    actor: AuthenticatedUser,
    rule: OwnershipRule,
    id: string,
  ): Promise<boolean> {
    return rule.resource === 'user'
      ? this.policy.canAccessUser(actor, id)
      : this.policy.canAccessTeam(actor, id);
  }
}
