import { createHash } from 'node:crypto';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { CurrentUser } from '../../src/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../src/auth/current-user.decorator.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const PASSWORD = 'TimeManager-Demo-2026';
const EMAIL = 'camille.laurent@trinitymarket.example';
const INVALID_CREDENTIALS = {
  statusCode: 401,
  error: 'Unauthorized',
  message: 'Invalid email or password',
};

@Controller('probe')
class ProbeController {
  @Get()
  whoAmI(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

function refreshCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[];
  const cookie = header.find((value) => value.startsWith('refresh_token='))!;

  return cookie.split(';')[0];
}

describe('Auth (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  const login = (email = EMAIL, password = PASSWORD) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  const refresh = (cookie?: string) => {
    const call = request(app.getHttpServer()).post('/api/auth/refresh');
    return cookie ? call.set('Cookie', cookie) : call;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');

    const passwordHash = await app.get(PasswordService).hash(PASSWORD);
    const person = {
      firstName: 'Camille',
      lastName: 'Laurent',
      contractMinutesPerWeek: 2100,
    };
    const user = await prisma.user.create({
      data: { ...person, email: EMAIL, passwordHash },
    });
    userId = user.id;

    await prisma.user.create({
      data: {
        ...person,
        email: 'deleted@trinitymarket.example',
        passwordHash,
        deletedAt: new Date(),
      },
    });
    await prisma.user.create({
      data: { ...person, email: 'microsoft.only@trinitymarket.example' },
    });
  });

  describe('POST /api/auth/login', () => {
    it('opens a session with valid credentials', async () => {
      const response = await login().expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: userId,
          firstName: 'Camille',
          lastName: 'Laurent',
          email: EMAIL,
          role: 'EMPLOYEE',
        },
      });
    });

    it('sets the refresh token in a hardened cookie', async () => {
      const response = await login().expect(200);
      const header = (
        response.headers['set-cookie'] as unknown as string[]
      ).join(';');

      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Strict');
      expect(header).toContain('Path=/api/auth');
    });

    it('stores only the hash of the refresh token', async () => {
      const response = await login().expect(200);
      const token = refreshCookie(response).split('=')[1];
      const stored = await prisma.refreshToken.findMany();

      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('ignores the case of the email', async () => {
      await login('Camille.Laurent@TrinityMarket.example').expect(200);
    });

    it.each([
      ['a wrong password', EMAIL, 'wrong-password'],
      ['an unknown email', 'nobody@trinitymarket.example', PASSWORD],
      ['a deleted account', 'deleted@trinitymarket.example', PASSWORD],
      [
        'an account without password',
        'microsoft.only@trinitymarket.example',
        PASSWORD,
      ],
    ])('answers the same 401 for %s', async (_case, email, password) => {
      const response = await login(email, password).expect(401);

      expect(response.body).toMatchObject(INVALID_CREDENTIALS);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a malformed body with a 422', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email' })
        .expect(422);

      expect(response.body.details).toEqual([
        { path: 'email', message: expect.any(String) },
        { path: 'password', message: expect.any(String) },
      ]);
    });
  });

  describe('protected routes', () => {
    it('rejects a request without access token', async () => {
      await request(app.getHttpServer()).get('/api/probe').expect(401);
    });

    it('identifies the user from the access token', async () => {
      const { body } = await login().expect(200);
      const response = await request(app.getHttpServer())
        .get('/api/probe')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(response.body).toEqual({ id: userId, role: 'EMPLOYEE' });
    });

    it('keeps the public routes open', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('renews the session and replaces the refresh token', async () => {
      const first = refreshCookie(await login().expect(200));
      const response = await refresh(first).expect(200);
      const second = refreshCookie(response);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user.id).toBe(userId);
      expect(second).not.toBe(first);
      await refresh(second).expect(200);
    });

    it('rejects a request without refresh token', async () => {
      await refresh().expect(401);
    });

    it('rejects an unknown refresh token', async () => {
      await refresh('refresh_token=unknown').expect(401);
    });

    it('revokes the whole session when a refresh token is reused', async () => {
      const first = refreshCookie(await login().expect(200));
      const second = refreshCookie(await refresh(first).expect(200));

      await refresh(first).expect(401);
      await refresh(second).expect(401);

      const active = await prisma.refreshToken.count({
        where: { revokedAt: null },
      });
      expect(active).toBe(0);
    });

    it('leaves the other sessions of the user untouched after a reuse', async () => {
      const phone = refreshCookie(await login().expect(200));
      const laptop = refreshCookie(await login().expect(200));

      await refresh(phone).expect(200);
      await refresh(phone).expect(401);

      await refresh(laptop).expect(200);
    });

    it('rejects an expired refresh token', async () => {
      const cookie = refreshCookie(await login().expect(200));
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await refresh(cookie).expect(401);
    });

    it('rejects the refresh token of an account deleted meanwhile', async () => {
      const cookie = refreshCookie(await login().expect(200));
      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });

      await refresh(cookie).expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const cookie = refreshCookie(await login().expect(200));
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(refreshCookie(response)).toBe('refresh_token=');
      await refresh(cookie).expect(401);
    });

    it('answers 204 even without a session', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
    });
  });
});
