import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
