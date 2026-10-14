import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PasswordManagementService } from '../../src/auth/password-management.service.js';
import { PasswordService } from '../../src/auth/password.service.js';
import type { MailMessage } from '../../src/mail/mail.service.js';
import { MailService } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const PASSWORD = 'TimeManager-Demo-2026';
const NEW_PASSWORD = 'Pointage-Entrepot-42';
const EMAIL = 'camille.laurent@trinitymarket.example';
const RESET_ACCEPTED = {
  message: 'If an account matches this email, a reset link has been sent',
};

function tokenFrom(mail: MailMessage): string {
  return /token=([\w-]+)/.exec(mail.text)![1];
}

function refreshCookie(response: request.Response): string {
  const header = response.headers['set-cookie'] as unknown as string[];

  return header
    .find((value) => value.startsWith('refresh_token='))!
    .split(';')[0];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

describe('Password management (integration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const sent: MailMessage[] = [];

  const http = () => request(app.getHttpServer());
  const login = (email = EMAIL, password = PASSWORD, ip = '203.0.113.1') =>
    http()
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password });
  const forgot = (email = EMAIL) =>
    http().post('/api/auth/forgot-password').send({ email });
  const reset = (token: string, password = NEW_PASSWORD) =>
    http().post('/api/auth/reset-password').send({ token, password });
  const changePassword = (
    accessToken: string,
    currentPassword: string,
    newPassword = NEW_PASSWORD,
  ) =>
    http()
      .patch('/api/me/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword, newPassword });
  const refresh = (cookie: string) =>
    http().post('/api/auth/refresh').set('Cookie', cookie);

  const resetLink = async (email = EMAIL) => {
    await forgot(email).expect(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    return tokenFrom(sent.pop()!);
  };

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

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', true);
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await settle();
    await app.close();
  });

  beforeEach(async () => {
    await settle();
    sent.length = 0;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "auth_attempts" CASCADE',
    );

    const passwordHash = await app.get(PasswordService).hash(PASSWORD);
    const person = {
      firstName: 'Camille',
      lastName: 'Laurent',
      contractMinutesPerWeek: 2100,
    };
    await prisma.user.create({
      data: { ...person, email: EMAIL, passwordHash },
    });

    await prisma.user.create({
      data: {
        ...person,
        email: 'deleted@trinitymarket.example',
        passwordHash,
        deletedAt: new Date(),
      },
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('mails a single-use link valid 30 minutes and stores only its hash', async () => {
      const response = await forgot().expect(202);

      expect(response.body).toEqual(RESET_ACCEPTED);
      await vi.waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].to).toBe(EMAIL);
      expect(sent[0].text).toContain(
        'http://localhost:8080/reset-password?token=',
      );

      const token = tokenFrom(sent[0]);
      const stored = await prisma.passwordResetToken.findFirstOrThrow();
      const ttl = stored.expiresAt.getTime() - stored.createdAt.getTime();

      expect(stored.purpose).toBe('PASSWORD_RESET');
      expect(stored.tokenHash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(ttl).toBeGreaterThan(29 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(30 * 60 * 1000);
    });

    it.each([
      ['an unknown email', 'nobody@trinitymarket.example'],
      ['a deleted account', 'deleted@trinitymarket.example'],
    ])(
      'answers the same way for %s without sending anything',
      async (_case, email) => {
        const response = await forgot(email).expect(202);

        expect(response.body).toEqual(RESET_ACCEPTED);
        await settle();
        expect(sent).toHaveLength(0);
        expect(await prisma.passwordResetToken.count()).toBe(0);
      },
    );

    it('answers 429 to the 6th request for the same email', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await forgot('nobody@trinitymarket.example').expect(202);
      }

      const response = await forgot('nobody@trinitymarket.example').expect(429);
      expect(response.body.message).toBe('Too many attempts, try again later');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('replaces the password and revokes every session', async () => {
      const cookie = refreshCookie(await login().expect(200));

      await reset(await resetLink()).expect(204);

      await login(EMAIL, PASSWORD).expect(401);
      await login(EMAIL, NEW_PASSWORD).expect(200);
      await refresh(cookie).expect(401);
    });

    it('refuses a link used twice', async () => {
      const token = await resetLink();

      await reset(token).expect(204);
      const response = await reset(token, 'Another-Password-2026').expect(400);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('refuses an expired link', async () => {
      const token = await resetLink();
      await prisma.passwordResetToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await reset(token).expect(400);
      await login().expect(200);
    });

    it('refuses an unknown link', async () => {
      await reset('unknown-token').expect(400);
    });

    it('invalidates the previous link when a new one is requested', async () => {
      const first = await resetLink();
      const second = await resetLink();

      await reset(first).expect(400);
      await reset(second).expect(204);
    });

    it.each([
      ['too short', 'Short-pw1'],
      ['too common', 'Password1234'],
    ])(
      'rejects a %s password with a 422 and keeps the link usable',
      async (_case, password) => {
        const token = await resetLink();
        const response = await reset(token, password).expect(422);

        expect(response.body.details).toEqual([
          { path: 'password', message: expect.any(String) },
        ]);
        await reset(token).expect(204);
      },
    );
  });

  describe('activation link', () => {
    it('lets an employee created without password choose one', async () => {
      const employee = await prisma.user.create({
        data: {
          firstName: 'Karim',
          lastName: 'Haddad',
          email: 'karim.haddad@trinitymarket.example',
          contractMinutesPerWeek: 2100,
        },
      });

      await app.get(PasswordManagementService).sendActivation(employee.id);

      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(employee.email);
      expect(sent[0].text).toContain('http://localhost:8080/activate?token=');

      const stored = await prisma.passwordResetToken.findFirstOrThrow();
      const ttl = stored.expiresAt.getTime() - stored.createdAt.getTime();
      expect(stored.purpose).toBe('ACTIVATION');
      expect(ttl).toBeGreaterThan(71 * 60 * 60 * 1000);

      await login(employee.email, NEW_PASSWORD).expect(401);
      await reset(tokenFrom(sent[0])).expect(204);
      await login(employee.email, NEW_PASSWORD).expect(200);
    });
  });

  describe('login rate limiting', () => {
    const failFiveTimes = async (ip?: string) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await login(EMAIL, 'wrong-password', ip).expect(401);
      }
    };

    it('answers 429 to the 6th attempt after 5 failures, even with the right password', async () => {
      await failFiveTimes();

      const response = await login().expect(429);
      expect(response.body).toMatchObject({
        statusCode: 429,
        error: 'Too Many Requests',
      });
    });

    it('locks only the IP and email pair', async () => {
      await failFiveTimes();

      await login(EMAIL, PASSWORD, '203.0.113.2').expect(200);
      await login('nobody@trinitymarket.example', PASSWORD).expect(401);
    });

    it('resets the counter after a successful login', async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await login(EMAIL, 'wrong-password').expect(401);
      }
      await login().expect(200);

      await failFiveTimes();
      await login().expect(429);
    });

    it('lifts the lock once the 15 minute window has passed', async () => {
      await failFiveTimes();
      await prisma.authAttempt.updateMany({
        data: { attemptedAt: new Date(Date.now() - 15 * 60 * 1000 - 1000) },
      });

      await login().expect(200);
    });
  });

  describe('PATCH /api/me/password', () => {
    it('requires authentication', async () => {
      await http()
        .patch('/api/me/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(401);
    });

    it('changes the password, keeps the current session and revokes the others', async () => {
      const current = await login().expect(200);
      const other = refreshCookie(await login().expect(200));

      await changePassword(current.body.accessToken, PASSWORD).expect(204);

      await refresh(refreshCookie(current)).expect(200);
      await refresh(other).expect(401);
      await login(EMAIL, PASSWORD).expect(401);
      await login(EMAIL, NEW_PASSWORD).expect(200);
    });

    it('rejects a wrong current password with a 422', async () => {
      const { body } = await login().expect(200);
      const response = await changePassword(
        body.accessToken,
        'wrong-password',
      ).expect(422);

      expect(response.body.details).toEqual([
        { path: 'currentPassword', message: 'Current password is incorrect' },
      ]);
      await login().expect(200);
    });

    it('rejects a new password that breaks the policy', async () => {
      const { body } = await login().expect(200);
      const response = await changePassword(
        body.accessToken,
        PASSWORD,
        'qwerty123456',
      ).expect(422);

      expect(response.body.details).toEqual([
        { path: 'newPassword', message: 'This password is too common' },
      ]);
    });

    it('answers 429 after 5 wrong current passwords', async () => {
      const { body } = await login().expect(200);

      for (let attempt = 0; attempt < 5; attempt++) {
        await changePassword(body.accessToken, 'wrong-password').expect(422);
      }

      await changePassword(body.accessToken, PASSWORD).expect(429);
    });
  });
});
