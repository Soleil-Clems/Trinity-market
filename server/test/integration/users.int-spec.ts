import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { RefreshTokenService } from '../../src/auth/refresh-token.service.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import type { MailMessage } from '../../src/mail/mail.service.js';
import { MailService } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

type Persona = 'camille' | 'karim' | 'sophie' | 'nadia' | 'marc';

const PEOPLE: [Persona, string, string, Role][] = [
  ['camille', 'Camille', 'Laurent', 'EMPLOYEE'],
  ['karim', 'Karim', 'Haddad', 'EMPLOYEE'],
  ['sophie', 'Sophie', 'Martin', 'MANAGER'],
  ['nadia', 'Nadia', 'Benali', 'MANAGER'],
  ['marc', 'Marc', 'Dubois', 'ADMIN'],
];

const NEW_USER = {
  firstName: 'Léa',
  lastName: 'Morel',
  email: 'lea.morel@trinitymarket.example',
  phone: '+33 6 12 34 56 78',
  contractMinutesPerWeek: 2100,
};

describe('Users (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: MailMessage[] = [];
  const ids: Record<string, string> = {};
  const tokens: Partial<Record<Persona, string>> = {};

  const as = (persona: Persona | undefined, pending: request.Test) =>
    persona
      ? pending.set('Authorization', `Bearer ${tokens[persona]}`)
      : pending;
  const get = (path: string, persona?: Persona) =>
    as(persona, request(app.getHttpServer()).get(path));
  const post = (path: string, body: object, persona?: Persona) =>
    as(persona, request(app.getHttpServer()).post(path).send(body));
  const patch = (path: string, body: object, persona?: Persona) =>
    as(persona, request(app.getHttpServer()).patch(path).send(body));
  const del = (path: string, persona?: Persona) =>
    as(persona, request(app.getHttpServer()).delete(path));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        send: (message: MailMessage) => {
          sent.push(message);
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    sent.length = 0;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "auth_attempts" CASCADE',
    );

    const jwt = app.get(JwtService);

    for (const [persona, firstName, lastName, role] of PEOPLE) {
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: `${persona}@trinitymarket.example`,
          role,
          contractMinutesPerWeek: 2100,
          passwordHash: 'not-a-real-hash',
        },
      });
      ids[persona] = user.id;
      tokens[persona] = await jwt.signAsync({
        sub: user.id,
        role,
        sid: randomUUID(),
      });
    }

    ids.customerService = (
      await prisma.team.create({
        data: { name: 'Service client', managerId: ids.sophie },
      })
    ).id;
    ids.warehouse = (
      await prisma.team.create({
        data: { name: 'Entrepôt', managerId: ids.nadia },
      })
    ).id;

    await prisma.teamMembership.createMany({
      data: [
        { userId: ids.camille, teamId: ids.customerService },
        { userId: ids.karim, teamId: ids.warehouse },
      ],
    });
  });

  const emails = (response: request.Response) =>
    (response.body.items as { email: string }[]).map(({ email }) => email);

  describe('GET /api/users', () => {
    it('answers 401 without authentication', async () => {
      await get('/api/users').expect(401);
    });

    it('answers 403 to an employee', async () => {
      await get('/api/users', 'camille').expect(403);
    });

    it('shows a manager only themself and the members of their teams', async () => {
      const response = await get('/api/users', 'sophie').expect(200);

      expect(emails(response)).toEqual([
        'camille@trinitymarket.example',
        'sophie@trinitymarket.example',
      ]);
      expect(response.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
    });

    it('shows the whole company to an admin', async () => {
      const response = await get('/api/users', 'marc').expect(200);

      expect(response.body.total).toBe(5);
    });

    it('searches the first name, last name and email, word by word', async () => {
      const response = await get(
        '/api/users?search=karim%20HADDAD',
        'marc',
      ).expect(200);

      expect(emails(response)).toEqual(['karim@trinitymarket.example']);
    });

    it('filters by role and by team', async () => {
      const managers = await get('/api/users?role=MANAGER', 'marc').expect(200);
      const warehouse = await get(
        `/api/users?teamId=${ids.warehouse}`,
        'marc',
      ).expect(200);

      expect(managers.body.total).toBe(2);
      expect(emails(warehouse)).toEqual(['karim@trinitymarket.example']);
    });

    it('paginates in a stable order', async () => {
      const response = await get('/api/users?page=2&pageSize=2', 'marc').expect(
        200,
      );

      expect(response.body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect(emails(response)).toEqual([
        'karim@trinitymarket.example',
        'camille@trinitymarket.example',
      ]);
    });

    it('hides deleted accounts', async () => {
      await prisma.user.update({
        where: { id: ids.karim },
        data: { deletedAt: new Date() },
      });

      const response = await get('/api/users', 'marc').expect(200);
      expect(emails(response)).not.toContain('karim@trinitymarket.example');
    });

    it('never returns password hashes or Microsoft ids', async () => {
      const response = await get('/api/users', 'marc').expect(200);

      expect(response.text).not.toContain('passwordHash');
      expect(response.text).not.toContain('not-a-real-hash');
      expect(response.text).not.toContain('microsoftId');
    });

    it('answers 422 to invalid query parameters', async () => {
      const response = await get('/api/users?pageSize=1000', 'marc').expect(
        422,
      );

      expect(response.body.details).toEqual([
        { path: 'pageSize', message: expect.any(String) },
      ]);
    });
  });

  describe('GET /api/users/{id}', () => {
    it('lets an employee read their own account', async () => {
      const response = await get(`/api/users/${ids.camille}`, 'camille').expect(
        200,
      );

      expect(response.body).toMatchObject({
        email: 'camille@trinitymarket.example',
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        teams: [{ id: ids.customerService, name: 'Service client' }],
      });
    });

    it('answers 403 to an employee reading someone else', async () => {
      await get(`/api/users/${ids.karim}`, 'camille').expect(403);
    });

    it('answers 403 to a manager outside their teams', async () => {
      await get(`/api/users/${ids.karim}`, 'sophie').expect(403);
    });

    it('answers 401 without authentication', async () => {
      await get(`/api/users/${ids.camille}`).expect(401);
    });

    it('answers 404 to an admin for a deleted account', async () => {
      await prisma.user.update({
        where: { id: ids.karim },
        data: { deletedAt: new Date() },
      });

      await get(`/api/users/${ids.karim}`, 'marc').expect(404);
    });
  });

  describe('POST /api/users', () => {
    it('lets a manager add an employee to their team and sends the activation link', async () => {
      const response = await post(
        '/api/users',
        { ...NEW_USER, teamIds: [ids.customerService] },
        'sophie',
      ).expect(201);

      expect(response.body).toMatchObject({
        email: NEW_USER.email,
        phone: '+33612345678',
        role: 'EMPLOYEE',
        status: 'INVITED',
        timezone: 'Europe/Paris',
        teams: [{ id: ids.customerService, name: 'Service client' }],
      });
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(NEW_USER.email);
      expect(sent[0].text).toContain('/activate?token=');

      await get(`/api/users/${response.body.id}`, 'sophie').expect(200);
    });

    it('requires a manager to pick one of their teams', async () => {
      const response = await post('/api/users', NEW_USER, 'sophie').expect(422);

      expect(response.body.details).toEqual([
        { path: 'teamIds', message: expect.any(String) },
      ]);
    });

    it('answers 403 when a manager targets a team they do not manage', async () => {
      await post(
        '/api/users',
        { ...NEW_USER, teamIds: [ids.warehouse] },
        'sophie',
      ).expect(403);
      expect(
        await prisma.user.count({ where: { email: NEW_USER.email } }),
      ).toBe(0);
    });

    it('answers 403 when a manager tries to create a manager', async () => {
      await post(
        '/api/users',
        { ...NEW_USER, role: 'MANAGER', teamIds: [ids.customerService] },
        'sophie',
      ).expect(403);
    });

    it('lets an admin create a manager without team', async () => {
      const response = await post(
        '/api/users',
        { ...NEW_USER, role: 'MANAGER' },
        'marc',
      ).expect(201);

      expect(response.body).toMatchObject({ role: 'MANAGER', teams: [] });
    });

    it('answers 422 to an admin for an unknown team', async () => {
      await post(
        '/api/users',
        { ...NEW_USER, teamIds: [randomUUID()] },
        'marc',
      ).expect(422);
    });

    it('answers 409 to a duplicate email, whatever its case', async () => {
      const response = await post(
        '/api/users',
        { ...NEW_USER, email: 'Camille@TrinityMarket.example' },
        'marc',
      ).expect(409);

      expect(response.body.message).toBe('Email already in use');
      expect(sent).toHaveLength(0);
    });

    it('answers 422 to an invalid body', async () => {
      const response = await post(
        '/api/users',
        { ...NEW_USER, phone: '0612345678', email: 'not-an-email' },
        'marc',
      ).expect(422);

      expect(response.body.details.map(({ path }) => path).sort()).toEqual([
        'email',
        'phone',
      ]);
    });

    it('answers 403 to an employee and 401 without authentication', async () => {
      await post('/api/users', NEW_USER, 'camille').expect(403);
      await post('/api/users', NEW_USER).expect(401);
    });
  });

  describe('PATCH /api/users/{id}', () => {
    it('lets a manager update a member of their team', async () => {
      const response = await patch(
        `/api/users/${ids.camille}`,
        {
          lastName: 'Laurent-Petit',
          contractMinutesPerWeek: 1800,
          phone: null,
        },
        'sophie',
      ).expect(200);

      expect(response.body).toMatchObject({
        lastName: 'Laurent-Petit',
        contractMinutesPerWeek: 1800,
        phone: null,
      });
    });

    it('answers 409 when the new email is taken', async () => {
      await patch(
        `/api/users/${ids.camille}`,
        { email: 'karim@trinitymarket.example' },
        'marc',
      ).expect(409);
    });

    it('answers 422 to a role change or an empty body', async () => {
      await patch(
        `/api/users/${ids.camille}`,
        { role: 'ADMIN' },
        'marc',
      ).expect(422);
      await patch(`/api/users/${ids.camille}`, {}, 'marc').expect(422);
    });

    it('answers 403 to an employee, even on their own account', async () => {
      await patch(
        `/api/users/${ids.camille}`,
        { firstName: 'Cam' },
        'camille',
      ).expect(403);
    });

    it('answers 403 to a manager outside their teams', async () => {
      await patch(
        `/api/users/${ids.karim}`,
        { firstName: 'K' },
        'sophie',
      ).expect(403);
    });

    it('answers 401 without authentication', async () => {
      await patch(`/api/users/${ids.camille}`, { firstName: 'C' }).expect(401);
    });

    it('answers 404 to an admin for a deleted account', async () => {
      await prisma.user.update({
        where: { id: ids.karim },
        data: { deletedAt: new Date() },
      });

      await patch(`/api/users/${ids.karim}`, { firstName: 'K' }, 'marc').expect(
        404,
      );
    });
  });

  describe('DELETE /api/users/{id}', () => {
    it('anonymizes the account, keeps its id and revokes its sessions', async () => {
      await app.get(RefreshTokenService).issue(ids.camille);

      await del(`/api/users/${ids.camille}`, 'sophie').expect(204);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: ids.camille },
      });
      expect(user).toMatchObject({
        firstName: 'Utilisateur',
        lastName: 'supprimé',
        email: `deleted+${ids.camille}@anonymized.invalid`,
        phone: null,
        microsoftId: null,
        passwordHash: null,
        deletedAt: expect.any(Date),
      });
      expect(
        await prisma.refreshToken.count({
          where: { userId: ids.camille, revokedAt: null },
        }),
      ).toBe(0);
      await get(`/api/users/${ids.camille}`, 'marc').expect(404);
    });

    it('answers 409 for a manager who still manages teams', async () => {
      const response = await del(`/api/users/${ids.nadia}`, 'marc').expect(409);

      expect(response.body.message).toMatch(/still manages teams/);
    });

    it('answers 403 to an employee and to a manager outside their teams', async () => {
      await del(`/api/users/${ids.karim}`, 'camille').expect(403);
      await del(`/api/users/${ids.karim}`, 'sophie').expect(403);
    });

    it('answers 401 without authentication', async () => {
      await del(`/api/users/${ids.karim}`).expect(401);
    });
  });

  describe('/api/me', () => {
    it('returns the account of the caller', async () => {
      const response = await get('/api/me', 'karim').expect(200);

      expect(response.body.email).toBe('karim@trinitymarket.example');
    });

    it('lets the caller change their name and phone', async () => {
      const response = await patch(
        '/api/me',
        { firstName: 'Karim', phone: '+33 7 00 00 00 00' },
        'karim',
      ).expect(200);

      expect(response.body.phone).toBe('+33700000000');
    });

    it.each([
      ['email', { email: 'new@trinitymarket.example' }],
      ['contract hours', { contractMinutesPerWeek: 600 }],
    ])('refuses to let the caller change their %s', async (_field, body) => {
      await patch('/api/me', body, 'karim').expect(422);
    });

    it('anonymizes the account of the caller', async () => {
      await del('/api/me', 'karim').expect(204);

      await get('/api/me', 'karim').expect(404);
    });

    it('answers 409 to a manager who still manages teams', async () => {
      await del('/api/me', 'sophie').expect(409);
    });

    it('answers 401 without authentication', async () => {
      await get('/api/me').expect(401);
      await patch('/api/me', { firstName: 'X' }).expect(401);
      await del('/api/me').expect(401);
    });
  });
});
