import { readFileSync } from 'node:fs';
import {
  Controller,
  Get,
  INestApplication,
  RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import {
  CanAccessTeam,
  CanAccessUser,
  OWNERSHIP_KEY,
  OwnershipRule,
} from '../../src/auth/access/ownership.decorator.js';
import { Roles, ROLES_KEY } from '../../src/auth/access/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../../src/auth/public.decorator.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'ADMIN'];
const CONTROL_TO_RESOURCE: Record<string, OwnershipRule['resource']> = {
  utilisateur: 'user',
  équipe: 'team',
};

@Controller('probe')
class ProbeController {
  @Get('managers')
  @Roles('MANAGER', 'ADMIN')
  managersOnly() {
    return { ok: true };
  }

  @Get('users/:id/summary')
  @CanAccessUser()
  userSummary() {
    return { ok: true };
  }

  @Get('teams/:id/members')
  @CanAccessTeam()
  teamMembers() {
    return { ok: true };
  }
}

interface MatrixRow {
  route: string;
  cells: Record<'anonymous' | Role, string>;
  control: string;
}

function readMatrix(): Map<string, MatrixRow> {
  const markdown = readFileSync(
    new URL('../../../docs/permissions.md', import.meta.url),
    'utf8',
  );
  const rows = new Map<string, MatrixRow>();

  for (const line of markdown.split('\n')) {
    const match = /^\| `([A-Z]+ \/api[^`]*)` \|(.*)\|$/.exec(line);

    if (!match) {
      continue;
    }

    const [, anonymous, employee, manager, admin, control] = match[2]
      .split('|')
      .map((cell) => cell.trim());
    rows.set(match[1], {
      route: match[1],
      cells: { anonymous, EMPLOYEE: employee, MANAGER: manager, ADMIN: admin },
      control,
    });
  }

  return rows;
}

interface DiscoveredRoute {
  route: string;
  isPublic: boolean;
  roles?: Role[];
  ownership?: OwnershipRule;
}

function discoverRoutes(app: INestApplication): DiscoveredRoute[] {
  const reflector = app.get(Reflector);
  const routes: DiscoveredRoute[] = [];

  for (const { metatype } of app.get(DiscoveryService).getControllers()) {
    if (!metatype || metatype === ProbeController) {
      continue;
    }

    const prefix = Reflect.getMetadata(PATH_METADATA, metatype) as string;
    const prototype = metatype.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];

      if (
        name === 'constructor' ||
        typeof handler !== 'function' ||
        Reflect.getMetadata(PATH_METADATA, handler) === undefined
      ) {
        continue;
      }

      const path = ['api', prefix, Reflect.getMetadata(PATH_METADATA, handler)]
        .flatMap((part: string) => part.split('/'))
        .filter(Boolean)
        .map((part) => part.replace(/^:(.+)$/, '{$1}'))
        .join('/');
      const method =
        RequestMethod[
          Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
        ];
      const targets = [handler, metatype];

      routes.push({
        route: `${method} /${path}`,
        isPublic:
          reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false,
        roles: reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets),
        ownership: reflector.getAllAndOverride<OwnershipRule>(
          OWNERSHIP_KEY,
          targets,
        ),
      });
    }
  }

  return routes;
}

describe('Permissions (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "auth_attempts" CASCADE',
    );

    const people: [string, Role][] = [
      ['camille', 'EMPLOYEE'],
      ['karim', 'EMPLOYEE'],
      ['sophie', 'MANAGER'],
      ['nadia', 'MANAGER'],
      ['marc', 'ADMIN'],
    ];
    const jwt = app.get(JwtService);

    for (const [name, role] of people) {
      const user = await prisma.user.create({
        data: {
          firstName: name,
          lastName: 'Test',
          email: `${name}@trinitymarket.example`,
          role,
          contractMinutesPerWeek: 2100,
        },
      });
      ids[name] = user.id;
      tokens[name] = await jwt.signAsync({
        sub: user.id,
        role,
        sid: crypto.randomUUID(),
      });
    }

    const customerService = await prisma.team.create({
      data: { name: 'Service client', managerId: ids.sophie },
    });
    const warehouse = await prisma.team.create({
      data: { name: 'Entrepôt', managerId: ids.nadia },
    });
    ids.customerService = customerService.id;
    ids.warehouse = warehouse.id;

    await prisma.teamMembership.createMany({
      data: [
        { userId: ids.camille, teamId: customerService.id },
        { userId: ids.karim, teamId: warehouse.id },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (path: string, as?: string) => {
    const pending = request(app.getHttpServer()).get(path);
    return as ? pending.set('Authorization', `Bearer ${tokens[as]}`) : pending;
  };

  describe('matrix in docs/permissions.md', () => {
    it('lists every implemented route', () => {
      const documented = readMatrix();
      const missing = discoverRoutes(app)
        .map(({ route }) => route)
        .filter((route) => !documented.has(route));

      expect(missing).toEqual([]);
    });

    it('matches the decorators of every implemented route', () => {
      const documented = readMatrix();

      for (const route of discoverRoutes(app)) {
        const row = documented.get(route.route)!;
        const allowed = ROLES.filter((role) => row.cells[role] !== 'Non');
        const resource = CONTROL_TO_RESOURCE[row.control];

        expect({ route: route.route, isPublic: route.isPublic }).toEqual({
          route: route.route,
          isPublic: row.cells.anonymous === 'Oui',
        });

        if (route.isPublic) {
          continue;
        }

        expect({ route: route.route, roles: route.roles ?? ROLES }).toEqual({
          route: route.route,
          roles: allowed,
        });
        expect({
          route: route.route,
          ownership: route.ownership?.resource,
        }).toEqual({
          route: route.route,
          ownership: resource,
        });
      }
    });
  });

  describe('roles', () => {
    it.each([
      [undefined, 401],
      ['camille', 403],
      ['sophie', 200],
      ['marc', 200],
    ])('answers %s with %i on a manager route', async (as, status) => {
      await call('/api/probe/managers', as).expect(status);
    });

    it('returns the error format of the API on a 403', async () => {
      const response = await call('/api/probe/managers', 'camille').expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You are not allowed to access this resource',
      });
    });
  });

  describe('user ownership', () => {
    const summary = (user: string) => `/api/probe/users/${ids[user]}/summary`;

    it.each([
      ['an employee', 'camille', 'camille', 200],
      ['an employee', 'camille', 'karim', 403],
      ['a manager', 'sophie', 'camille', 200],
      ['a manager', 'sophie', 'sophie', 200],
      ['a manager', 'sophie', 'karim', 403],
      ['a manager', 'sophie', 'nadia', 403],
      ['an admin', 'marc', 'karim', 200],
    ])('lets %s (%s) read %s: %i', async (_who, as, target, status) => {
      await call(summary(target), as).expect(status);
    });

    it('answers 401 without authentication', async () => {
      await call(summary('camille')).expect(401);
    });

    it('answers 403 for an unknown or malformed id', async () => {
      await call(
        '/api/probe/users/0199d8a0-0000-7000-8000-000000000000/summary',
        'sophie',
      ).expect(403);
      await call('/api/probe/users/not-a-uuid/summary', 'sophie').expect(403);
    });
  });

  describe('team ownership', () => {
    const members = (team: string) => `/api/probe/teams/${ids[team]}/members`;

    it.each([
      ['its manager', 'sophie', 'customerService', 200],
      ['another manager', 'nadia', 'customerService', 403],
      ['a member employee', 'camille', 'customerService', 403],
      ['an admin', 'marc', 'warehouse', 200],
    ])(
      'lets %s (%s) list the members of %s: %i',
      async (_who, as, team, status) => {
        await call(members(team), as).expect(status);
      },
    );
  });
});
