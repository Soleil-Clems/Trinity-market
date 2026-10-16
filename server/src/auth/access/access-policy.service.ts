import { Injectable } from '@nestjs/common';
import type {
  TeamWhereInput,
  UserWhereInput,
} from '../../generated/prisma/models.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../current-user.decorator.js';

@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessUser(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<boolean> {
    if (actor.role === 'ADMIN' || actor.id === userId) {
      return true;
    }

    if (actor.role !== 'MANAGER') {
      return false;
    }

    const memberships = await this.prisma.teamMembership.count({
      where: { userId, team: { managerId: actor.id } },
    });

    return memberships > 0;
  }

  async canAccessTeam(
    actor: AuthenticatedUser,
    teamId: string,
  ): Promise<boolean> {
    if (actor.role === 'ADMIN') {
      return true;
    }

    if (actor.role !== 'MANAGER') {
      return false;
    }

    const teams = await this.prisma.team.count({
      where: { id: teamId, managerId: actor.id },
    });

    return teams > 0;
  }

  visibleUsers(actor: AuthenticatedUser): UserWhereInput {
    switch (actor.role) {
      case 'ADMIN':
        return {};
      case 'MANAGER':
        return {
          OR: [
            { id: actor.id },
            { memberships: { some: { team: { managerId: actor.id } } } },
          ],
        };
      default:
        return { id: actor.id };
    }
  }

  visibleTeams(actor: AuthenticatedUser): TeamWhereInput {
    switch (actor.role) {
      case 'ADMIN':
        return {};
      case 'MANAGER':
        return { managerId: actor.id };
      default:
        return { id: { in: [] } };
    }
  }
}
