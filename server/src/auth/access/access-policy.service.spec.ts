import type { Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../current-user.decorator.js';
import { AccessPolicyService } from './access-policy.service.js';

const ACTOR_ID = '0199d8a0-0000-7000-8000-000000000001';
const OTHER_ID = '0199d8a0-0000-7000-8000-000000000002';

function actor(role: Role): AuthenticatedUser {
  return { id: ACTOR_ID, role, sessionId: 'session' };
}

function createPolicy(count = 0) {
  const prisma = {
    teamMembership: { count: vi.fn().mockResolvedValue(count) },
    team: { count: vi.fn().mockResolvedValue(count) },
  };

  return {
    prisma,
    policy: new AccessPolicyService(prisma as unknown as PrismaService),
  };
}

describe('AccessPolicyService', () => {
  describe('canAccessUser', () => {
    it.each(['EMPLOYEE', 'MANAGER', 'ADMIN'] as const)(
      'lets a %s access their own account without querying the base',
      async (role) => {
        const { policy, prisma } = createPolicy();

        await expect(policy.canAccessUser(actor(role), ACTOR_ID)).resolves.toBe(
          true,
        );
        expect(prisma.teamMembership.count).not.toHaveBeenCalled();
      },
    );

    it('lets an admin access anyone', async () => {
      const { policy } = createPolicy();

      await expect(
        policy.canAccessUser(actor('ADMIN'), OTHER_ID),
      ).resolves.toBe(true);
    });

    it('refuses another account to an employee', async () => {
      const { policy } = createPolicy(1);

      await expect(
        policy.canAccessUser(actor('EMPLOYEE'), OTHER_ID),
      ).resolves.toBe(false);
    });

    it('lets a manager access a member of a team they manage', async () => {
      const { policy, prisma } = createPolicy(1);

      await expect(
        policy.canAccessUser(actor('MANAGER'), OTHER_ID),
      ).resolves.toBe(true);
      expect(prisma.teamMembership.count).toHaveBeenCalledWith({
        where: { userId: OTHER_ID, team: { managerId: ACTOR_ID } },
      });
    });

    it('refuses a manager someone outside their teams', async () => {
      const { policy } = createPolicy(0);

      await expect(
        policy.canAccessUser(actor('MANAGER'), OTHER_ID),
      ).resolves.toBe(false);
    });
  });

  describe('canAccessTeam', () => {
    it('lets a manager access a team they manage', async () => {
      const { policy, prisma } = createPolicy(1);

      await expect(
        policy.canAccessTeam(actor('MANAGER'), OTHER_ID),
      ).resolves.toBe(true);
      expect(prisma.team.count).toHaveBeenCalledWith({
        where: { id: OTHER_ID, managerId: ACTOR_ID },
      });
    });

    it('refuses any team to an employee', async () => {
      const { policy } = createPolicy(1);

      await expect(
        policy.canAccessTeam(actor('EMPLOYEE'), OTHER_ID),
      ).resolves.toBe(false);
    });

    it('lets an admin access any team', async () => {
      const { policy } = createPolicy(0);

      await expect(
        policy.canAccessTeam(actor('ADMIN'), OTHER_ID),
      ).resolves.toBe(true);
    });
  });

  describe('list filters', () => {
    const { policy } = createPolicy();

    it('restricts an employee to their own account and no team', () => {
      expect(policy.visibleUsers(actor('EMPLOYEE'))).toEqual({ id: ACTOR_ID });
      expect(policy.visibleTeams(actor('EMPLOYEE'))).toEqual({
        id: { in: [] },
      });
    });

    it('restricts a manager to their teams and their members', () => {
      expect(policy.visibleUsers(actor('MANAGER'))).toEqual({
        OR: [
          { id: ACTOR_ID },
          { memberships: { some: { team: { managerId: ACTOR_ID } } } },
        ],
      });
      expect(policy.visibleTeams(actor('MANAGER'))).toEqual({
        managerId: ACTOR_ID,
      });
    });

    it('does not filter anything for an admin', () => {
      expect(policy.visibleUsers(actor('ADMIN'))).toEqual({});
      expect(policy.visibleTeams(actor('ADMIN'))).toEqual({});
    });
  });
});
