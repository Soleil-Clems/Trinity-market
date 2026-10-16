import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccessPolicyService } from '../auth/access/access-policy.service.js';
import { FORBIDDEN_MESSAGE } from '../auth/access/roles.guard.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { PasswordManagementService } from '../auth/password-management.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { UserWhereInput } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateMeDto,
  UpdateUserDto,
} from './dto/user.dto.js';
import { presentUser, USER_SELECT, UserResponse } from './user.presenter.js';

export interface UserPage {
  items: UserResponse[];
  page: number;
  pageSize: number;
  total: number;
}

export const EMAIL_TAKEN_MESSAGE = 'Email already in use';
export const MANAGES_TEAMS_MESSAGE =
  'This user still manages teams: assign them to another manager first';

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function validationError(path: string, message: string) {
  return new UnprocessableEntityException({
    message: 'Validation failed',
    details: [{ path, message }],
  });
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
    private readonly passwordManagement: PasswordManagementService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    query: ListUsersQueryDto,
  ): Promise<UserPage> {
    const terms = query.search?.split(/\s+/) ?? [];
    const where: UserWhereInput = {
      AND: [
        this.policy.visibleUsers(actor),
        { deletedAt: null },
        query.role ? { role: query.role } : {},
        query.teamId ? { memberships: { some: { teamId: query.teamId } } } : {},
        ...terms.map((term) => ({
          OR: [
            { firstName: { contains: term, mode: 'insensitive' as const } },
            { lastName: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
          ],
        })),
      ],
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map(presentUser),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return presentUser(user);
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<UserResponse> {
    await this.assertCanCreate(actor, dto);

    let created: { id: string };

    try {
      created = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          contractMinutesPerWeek: dto.contractMinutesPerWeek,
          timezone: dto.timezone,
          role: dto.role ?? 'EMPLOYEE',
          memberships: {
            create: dto.teamIds.map((teamId) => ({ teamId })),
          },
        },
        select: { id: true },
      });
    } catch (error) {
      throw hasPrismaCode(error, 'P2002')
        ? new ConflictException(EMAIL_TAKEN_MESSAGE)
        : error;
    }

    try {
      await this.passwordManagement.sendActivation(created.id);
    } catch (error) {
      this.logger.error(
        `Activation mail failed for user ${created.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return this.findOne(created.id);
  }

  async update(
    id: string,
    dto: UpdateUserDto | UpdateMeDto,
  ): Promise<UserResponse> {
    try {
      await this.prisma.user.update({
        where: { id, deletedAt: null },
        data: dto,
        select: { id: true },
      });
    } catch (error) {
      if (hasPrismaCode(error, 'P2025')) {
        throw new NotFoundException('User not found');
      }
      throw hasPrismaCode(error, 'P2002')
        ? new ConflictException(EMAIL_TAKEN_MESSAGE)
        : error;
    }

    return this.findOne(id);
  }

  async anonymize(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, _count: { select: { managedTeams: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user._count.managedTeams > 0) {
      throw new ConflictException(MANAGES_TEAMS_MESSAGE);
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          firstName: 'Utilisateur',
          lastName: 'supprimé',
          email: `deleted+${id}@anonymized.invalid`,
          phone: null,
          microsoftId: null,
          passwordHash: null,
          deletedAt: now,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
  }

  private async assertCanCreate(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<void> {
    if (actor.role === 'MANAGER') {
      if (dto.role && dto.role !== 'EMPLOYEE') {
        throw new ForbiddenException(FORBIDDEN_MESSAGE);
      }

      if (dto.teamIds.length === 0) {
        throw validationError(
          'teamIds',
          'A manager must add the user to at least one of their teams',
        );
      }
    }

    if (dto.teamIds.length === 0) {
      return;
    }

    const teams = await this.prisma.team.count({
      where: {
        AND: [{ id: { in: dto.teamIds } }, this.policy.visibleTeams(actor)],
      },
    });

    if (teams === dto.teamIds.length) {
      return;
    }

    if (actor.role === 'MANAGER') {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    throw validationError('teamIds', 'Unknown team');
  }
}
